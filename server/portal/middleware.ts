// Galaxy Portal auth middleware: validate JWT, resolve tenant from client_id,
// JIT-provision a portal_user, rate-limit per tenant, and write an audit row.

import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { validateGalaxyJwt, type GalaxyAuthContext } from './galaxy-jwt';
import { ROLES, USER_TYPES } from '../../shared/rbac';
import type { User, InsertUser, InsertPortalAuditLog } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      portalAuth?: GalaxyAuthContext;
    }
  }
}

// ----- Rate limiter (per-tenant sliding window) -----------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = Number(process.env.PORTAL_RATE_LIMIT_PER_MINUTE || 600);
const tenantBuckets = new Map<string, number[]>();

function checkRateLimit(tenantId: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  let bucket = tenantBuckets.get(tenantId) || [];
  bucket = bucket.filter(ts => ts > cutoff);
  if (bucket.length >= RATE_LIMIT_PER_WINDOW) {
    tenantBuckets.set(tenantId, bucket);
    const oldest = bucket[0] ?? now;
    return { allowed: false, remaining: 0, resetMs: Math.max(0, oldest + RATE_LIMIT_WINDOW_MS - now) };
  }
  bucket.push(now);
  tenantBuckets.set(tenantId, bucket);
  return { allowed: true, remaining: RATE_LIMIT_PER_WINDOW - bucket.length, resetMs: RATE_LIMIT_WINDOW_MS };
}

// ----- JIT provisioning -----------------------------------------------------

// Tenant-scoped synthetic placeholder used when the Galaxy email is not safe
// to write into users.email (collision, missing, etc). The same Galaxy `sub`
// can map to multiple Vega tenants, so we include both galaxyClientId and
// galaxyUserId to keep this globally unique under the users.email constraint.
function syntheticPortalEmail(ctx: GalaxyAuthContext): string {
  return `galaxy-${ctx.galaxyClientId}-${ctx.galaxyUserId}@portal.invalid`;
}

async function findOrProvisionPortalUser(
  ctx: GalaxyAuthContext,
): Promise<{ user: User; linkedUser?: User }> {
  const { tenant, galaxyUserId, email, name } = ctx;

  // Capture a pre-existing Vega user (same tenant, same email) for ownership
  // matching only; we never modify this row.
  let linkedUser: User | undefined;
  if (email) {
    const candidate = await storage.getUserByEmail(email);
    if (candidate && candidate.tenantId === tenant.id && candidate.role !== ROLES.PORTAL_USER) {
      linkedUser = candidate;
    }
  }

  const existing = await storage.getUserByGalaxyUserId(galaxyUserId, tenant.id);
  if (existing) return { user: existing, linkedUser };

  // Use the Galaxy-supplied email only if it is unclaimed; otherwise fall
  // back to the tenant/client-scoped placeholder.
  let userEmail = email;
  if (!userEmail || (await storage.getUserByEmail(userEmail))) {
    userEmail = syntheticPortalEmail(ctx);
  }

  // Use a sentinel password hash that bcrypt.compare can never match. This
  // prevents any local-login or password-reset flow from establishing a
  // session for portal_user accounts even if those flows fail to exclude
  // authProvider='galaxy' in the future.
  const insert: InsertUser = {
    email: userEmail,
    password: '!galaxy-no-local-login!',
    name: name || email || `Galaxy User ${galaxyUserId.slice(0, 8)}`,
    role: ROLES.PORTAL_USER,
    tenantId: tenant.id,
    emailVerified: true,
    authProvider: 'galaxy',
    userType: USER_TYPES.CLIENT,
    galaxyUserId,
  };

  const user = await storage.createUser(insert);
  return { user, linkedUser };
}

// ----- Audit log helper -----------------------------------------------------

function recordAudit(
  req: Request,
  res: Response,
  ctx: GalaxyAuthContext | null,
  startedAt: number,
  errorMessage?: string,
) {
  const tenantId = ctx?.tenant.id || req.effectiveTenantId;
  if (!tenantId) return;
  const log: InsertPortalAuditLog = {
    tenantId,
    userId: req.user?.id ?? null,
    galaxyClientId: ctx?.galaxyClientId ?? null,
    galaxyUserId: ctx?.galaxyUserId ?? null,
    route: req.path,
    method: req.method,
    statusCode: res.statusCode,
    durationMs: Date.now() - startedAt,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    errorMessage: errorMessage ?? null,
  };
  storage.createPortalAuditLog(log).catch(err => {
    console.error('[Portal] Failed to write audit log:', err);
  });
}

// ----- Middleware -----------------------------------------------------------

export async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' });
    recordAudit(req, res, null, startedAt, 'missing_bearer');
    return;
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({ error: 'invalid_token', error_description: 'Empty bearer token' });
    recordAudit(req, res, null, startedAt, 'empty_token');
    return;
  }

  const ctx = await validateGalaxyJwt(token);
  if (!ctx) {
    res.status(401).json({ error: 'invalid_token', error_description: 'Galaxy token validation failed' });
    recordAudit(req, res, null, startedAt, 'jwt_validation_failed');
    return;
  }

  const rl = checkRateLimit(ctx.tenant.id);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_PER_WINDOW));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
    res.status(429).json({ error: 'rate_limit_exceeded' });
    recordAudit(req, res, ctx, startedAt, 'rate_limited');
    return;
  }

  let user: User;
  let linkedUser: User | undefined;
  try {
    const result = await findOrProvisionPortalUser(ctx);
    user = result.user;
    linkedUser = result.linkedUser;
  } catch (err) {
    console.error('[Portal] JIT provisioning failed:', err);
    res.status(500).json({ error: 'server_error' });
    recordAudit(req, res, ctx, startedAt, 'jit_failed');
    return;
  }
  if (linkedUser) {
    ctx.linkedVegaUser = { id: linkedUser.id, email: linkedUser.email };
  }

  // Defense-in-depth invariants: a portal_user row must always be scoped to
  // the resolved tenant and must never carry a non-portal role.
  if (user.tenantId !== ctx.tenant.id) {
    console.error(`[Portal] User ${user.id} tenant mismatch (${user.tenantId} vs ${ctx.tenant.id})`);
    res.status(403).json({ error: 'tenant_mismatch' });
    recordAudit(req, res, ctx, startedAt, 'tenant_mismatch');
    return;
  }
  if (user.role !== ROLES.PORTAL_USER) {
    console.error(`[Portal] User ${user.id} has unexpected role '${user.role}' for portal access`);
    res.status(403).json({ error: 'invalid_role' });
    recordAudit(req, res, ctx, startedAt, 'invalid_role');
    return;
  }

  req.user = user;
  req.effectiveTenantId = ctx.tenant.id;
  req.portalAuth = ctx;

  res.on('finish', () => recordAudit(req, res, ctx, startedAt));
  next();
}
