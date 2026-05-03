// Embeddable Cards (Task #64).
//
// Two surfaces:
//   1. /api/embed-tokens/*  — tenant-admin CRUD over embed tokens.
//   2. /embed/v1/:entityType/:token — public, server-rendered card. Sends
//      Content-Security-Policy: frame-ancestors * so the URL can be embedded
//      in any iframe (SharePoint, Galaxy portal, intranets). Supports
//      ?theme=dark and ?json=1, and self-refreshes every 5 minutes.

import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { storage } from './storage';
import {
  EMBED_ENTITY_TYPES,
  type EmbedEntityType,
  type EmbedToken,
  type Objective,
  type KeyResult,
  type BigRock,
} from '@shared/schema';

// Roles that may create tokens with no expiry (or any expiry duration).
const EMBED_ADMIN_ROLES = new Set(['tenant_admin', 'admin', 'vega_admin', 'global_admin', 'vega_consultant']);
const MAX_NON_ADMIN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ----- Token helpers --------------------------------------------------------

const TOKEN_PREFIX = 'vega_emb_';

function generateEmbedToken(): { raw: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const raw = `${TOKEN_PREFIX}${random}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  // First 12 chars of the random portion is plenty to disambiguate in UI.
  const prefix = `${TOKEN_PREFIX}${random.slice(0, 6)}…`;
  return { raw, hash, prefix };
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isExpired(t: EmbedToken): boolean {
  if (t.revokedAt) return true;
  if (t.expiresAt && t.expiresAt.valueOf() < Date.now()) return true;
  return false;
}

// ----- Audit log helper -----------------------------------------------------

async function recordAccess(
  req: Request,
  res: Response,
  token: EmbedToken | null,
  entityType: string | null,
  entityId: string | null,
  startedAt: number,
  format: 'html' | 'json',
  errorMessage?: string,
) {
  try {
    await storage.createEmbedAccessLog({
      tenantId: token?.tenantId ?? null,
      tokenId: token?.id ?? null,
      entityType,
      entityId,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
      referer: (req.headers.referer as string) || null,
      format,
      errorMessage: errorMessage ?? null,
    });
  } catch (err) {
    console.error('[Embed] Failed to write access log:', err);
  }
}

// ============================================================================
//  Admin CRUD router (mounted at /api/embed-tokens, behind adminOnly)
// ============================================================================

export const embedAdminRouter = Router();

const createTokenSchema = z.object({
  entityType: z.enum(EMBED_ENTITY_TYPES),
  entityId: z.string().min(1).optional().nullable(),
  label: z.string().min(1).max(200),
  expiresAt: z.string().datetime().optional().nullable(),
});

embedAdminRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  const allTokens = await storage.getEmbedTokensByTenantId(tenantId);

  // Tenant admins see all tokens; other roles see only their own.
  const userRole = req.user?.role as string | undefined;
  const isAdmin = userRole ? EMBED_ADMIN_ROLES.has(userRole) : false;
  const userId = req.user?.id;

  // Optional per-entity filter so EmbedDialog can list only tokens for a specific item.
  const filterType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const filterId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;

  const tokens = allTokens.filter(t => {
    if (!isAdmin && t.createdByUserId !== userId) return false;
    if (filterType && t.entityType !== filterType) return false;
    if (filterId && t.entityId !== filterId) return false;
    return true;
  });

  // 30-day access counts derived from access log table.
  const counts30d = await storage.getEmbed30DayCounts(tenantId);

  // Never leak the hash — only the prefix.
  res.json(
    tokens.map(t => ({
      id: t.id,
      entityType: t.entityType,
      entityId: t.entityId,
      label: t.label,
      tokenPrefix: t.tokenPrefix,
      expiresAt: t.expiresAt,
      lastUsedAt: t.lastUsedAt,
      accessCount: t.accessCount,
      accessCount30d: counts30d[t.id] ?? 0,
      createdAt: t.createdAt,
      revokedAt: t.revokedAt,
      createdByUserId: t.createdByUserId,
    })),
  );
});

embedAdminRouter.post('/', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });

  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const body = parsed.data;

  // Validate entity belongs to this tenant (skip for tenant-wide cards).
  if (body.entityType === 'objective') {
    if (!body.entityId) return res.status(400).json({ error: 'entity_id_required' });
    const o = await storage.getObjectiveById(body.entityId);
    if (!o || o.tenantId !== tenantId) return res.status(404).json({ error: 'entity_not_found' });
  } else if (body.entityType === 'key_result') {
    if (!body.entityId) return res.status(400).json({ error: 'entity_id_required' });
    const k = await storage.getKeyResultById(body.entityId);
    if (!k || k.tenantId !== tenantId) return res.status(404).json({ error: 'entity_not_found' });
  } else if (body.entityType === 'big_rock') {
    if (!body.entityId) return res.status(400).json({ error: 'entity_id_required' });
    const b = await storage.getBigRockByIdForTenant(body.entityId, tenantId);
    if (!b) return res.status(404).json({ error: 'entity_not_found' });
  }
  // executive_dashboard: tenant-wide, no entity required.

  // Non-admins must have a time-bounded token (capped at 30 days).
  const userRole = req.user?.role as string | undefined;
  const isEmbedAdmin = userRole ? EMBED_ADMIN_ROLES.has(userRole) : false;
  let resolvedExpiresAt: Date | null = body.expiresAt ? new Date(body.expiresAt) : null;
  if (!isEmbedAdmin) {
    const maxExpiry = new Date(Date.now() + MAX_NON_ADMIN_EXPIRY_MS);
    if (!resolvedExpiresAt || resolvedExpiresAt > maxExpiry) {
      resolvedExpiresAt = maxExpiry;
    }
  }

  const { raw, hash, prefix } = generateEmbedToken();
  const created = await storage.createEmbedToken({
    tenantId,
    entityType: body.entityType,
    entityId: body.entityType === 'executive_dashboard' ? null : body.entityId ?? null,
    label: body.label,
    tokenHash: hash,
    tokenPrefix: prefix,
    expiresAt: resolvedExpiresAt,
    createdByUserId: req.user?.id ?? null,
  });

  // Build the absolute public URL so copy-paste snippets work without modification.
  const embedPath = `/embed/v1/${body.entityType}/${raw}`;
  const origin = `${req.protocol}://${req.get('host')}`;
  const absoluteUrl = `${origin}${embedPath}`;
  res.status(201).json({
    id: created.id,
    entityType: created.entityType,
    entityId: created.entityId,
    label: created.label,
    tokenPrefix: created.tokenPrefix,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
    // Returned ONCE — never persisted in plaintext.
    token: raw,
    embedPath: absoluteUrl,
    iframeSnippet: `<iframe src="${absoluteUrl}" width="100%" height="240" frameborder="0" style="border:0" loading="lazy"></iframe>`,
  });
});

embedAdminRouter.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  const token = await storage.getEmbedTokenById(req.params.id);
  if (!token || token.tenantId !== tenantId) {
    return res.status(404).json({ error: 'not_found' });
  }
  // Tenant admins may revoke any token; others may only revoke their own.
  const userRole = req.user?.role as string | undefined;
  const isAdmin = userRole ? EMBED_ADMIN_ROLES.has(userRole) : false;
  if (!isAdmin && token.createdByUserId !== req.user?.id) {
    return res.status(403).json({ error: 'forbidden', message: 'Only the token creator or an admin may revoke this embed.' });
  }
  await storage.revokeEmbedToken(token.id, req.user?.id);
  res.status(204).end();
});

// Access logs contain IP addresses, referrers and user-agents — restricted
// to tenant/platform admins only to protect visitor privacy.
embedAdminRouter.get('/access-logs', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  const userRole = req.user?.role as string | undefined;
  if (!userRole || !EMBED_ADMIN_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Embed access logs are restricted to tenant/platform admins.' });
  }
  const tokenId = typeof req.query.tokenId === 'string' ? req.query.tokenId : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
  const logs = await storage.getEmbedAccessLogs(tenantId, { tokenId, limit });
  res.json(logs);
});

// ============================================================================
//  Public render router (mounted at /embed/v1)
// ============================================================================

export const embedPublicRouter = Router();

// Per-route CSP that allows any parent frame to embed these URLs.
// X-Frame-Options is intentionally NOT set here — CSP frame-ancestors * is
// the modern standard and takes precedence. Setting X-Frame-Options alongside
// it causes inconsistent behaviour across browsers.
embedPublicRouter.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.removeHeader('X-Frame-Options');
  // Embed cards are server-rendered with current state — never cache for
  // longer than the auto-refresh interval.
  res.setHeader('Cache-Control', 'private, max-age=60');
  next();
});

embedPublicRouter.get('/:entityType/:token', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const entityType = req.params.entityType as EmbedEntityType;
  const rawToken = req.params.token;
  const wantsJson = req.query.json === '1' || req.query.json === 'true';
  const theme = req.query.theme === 'dark' ? 'dark' : 'light';
  const format: 'html' | 'json' = wantsJson ? 'json' : 'html';

  if (!EMBED_ENTITY_TYPES.includes(entityType)) {
    res.status(404);
    await recordAccess(req, res, null, entityType, null, startedAt, format, 'invalid_entity_type');
    return wantsJson
      ? res.json({ error: 'invalid_entity_type' })
      : res.type('html').send(renderError('Invalid embed type', theme));
  }

  const tokenRow = await storage.getEmbedTokenByHash(hashToken(rawToken));
  if (!tokenRow || tokenRow.entityType !== entityType) {
    res.status(404);
    await recordAccess(req, res, tokenRow ?? null, entityType, null, startedAt, format, 'token_not_found');
    return wantsJson
      ? res.json({ error: 'not_found' })
      : res.type('html').send(renderError('Embed not found', theme));
  }
  if (isExpired(tokenRow)) {
    res.status(410);
    await recordAccess(req, res, tokenRow, entityType, tokenRow.entityId, startedAt, format, 'token_expired_or_revoked');
    return wantsJson
      ? res.json({ error: 'expired' })
      : res.type('html').send(renderError('This embed has been revoked or expired.', theme));
  }

  // Load the entity and confirm tenant scoping.
  let card: EmbedCardData | null = null;
  try {
    card = await loadCardData(tokenRow);
  } catch (err: any) {
    console.error('[Embed] Failed to load card data:', err);
  }
  if (!card) {
    res.status(404);
    await recordAccess(req, res, tokenRow, entityType, tokenRow.entityId, startedAt, format, 'entity_unavailable');
    return wantsJson
      ? res.json({ error: 'entity_unavailable' })
      : res.type('html').send(renderError('The item this embed points to is no longer available.', theme));
  }

  // Record successful hit (best effort).
  storage.recordEmbedTokenHit(tokenRow.id).catch(() => {});

  if (wantsJson) {
    await recordAccess(req, res, tokenRow, entityType, tokenRow.entityId, startedAt, 'json');
    return res.json(card);
  }
  res.type('html').send(renderCardHtml(card, theme));
  await recordAccess(req, res, tokenRow, entityType, tokenRow.entityId, startedAt, 'html');
});

// ----- Card data loaders ----------------------------------------------------

interface EmbedCardData {
  entityType: EmbedEntityType;
  title: string;
  subtitle?: string;
  status?: string | null;
  progress?: number | null;
  ownerLabel?: string | null;
  metric?: { current: number; target: number; unit?: string | null } | null;
  metrics?: Array<{ label: string; value: string | number }>;
  updatedAt?: string | null;
  lastCheckInNote?: string | null;
}

async function loadCardData(token: EmbedToken): Promise<EmbedCardData | null> {
  const tenantId = token.tenantId;
  if (token.entityType === 'objective' && token.entityId) {
    const o = await storage.getObjectiveById(token.entityId);
    if (!o || o.tenantId !== tenantId || o.deletedAt) return null;
    return {
      entityType: 'objective',
      title: o.title,
      subtitle: o.description ?? undefined,
      status: o.status ?? null,
      progress: typeof o.progress === 'number' ? o.progress : null,
      ownerLabel: o.ownerEmail ?? null,
      updatedAt: (o.updatedAt ?? o.createdAt)?.toISOString() ?? null,
      lastCheckInNote: o.lastCheckInNote ?? null,
    };
  }
  if (token.entityType === 'key_result' && token.entityId) {
    const k = await storage.getKeyResultById(token.entityId);
    if (!k || k.tenantId !== tenantId || k.deletedAt) return null;
    return {
      entityType: 'key_result',
      title: k.title,
      subtitle: k.description ?? undefined,
      status: k.status ?? null,
      progress: typeof k.progress === 'number' ? k.progress : null,
      metric: {
        current: k.currentValue ?? 0,
        target: k.targetValue,
        unit: k.unit ?? null,
      },
      updatedAt: (k.updatedAt ?? k.createdAt)?.toISOString() ?? null,
      lastCheckInNote: k.lastCheckInNote ?? null,
    };
  }
  if (token.entityType === 'big_rock' && token.entityId) {
    const b = await storage.getBigRockByIdForTenant(token.entityId, tenantId);
    if (!b || b.deletedAt) return null;
    return {
      entityType: 'big_rock',
      title: b.title,
      subtitle: b.description ?? undefined,
      status: b.status ?? null,
      progress: typeof b.completionPercentage === 'number' ? b.completionPercentage : null,
      ownerLabel: b.ownerEmail ?? null,
      updatedAt: (b.updatedAt ?? b.createdAt)?.toISOString() ?? null,
      lastCheckInNote: b.lastCheckInNote ?? null,
    };
  }
  if (token.entityType === 'executive_dashboard') {
    const [objectives, keyResults, bigRocks, tenant] = await Promise.all([
      storage.getObjectivesByTenantId(tenantId),
      storage.getKeyResultsByTenantId(tenantId),
      storage.getBigRocksByTenantId(tenantId),
      storage.getTenantById(tenantId),
    ]);
    const activeObjs = objectives.filter(o => !o.deletedAt && o.status !== 'completed' && o.status !== 'closed');
    const krs = keyResults.filter(k => !k.deletedAt);
    const onTrack = krs.filter(k => k.status === 'on_track').length;
    const atRisk = krs.filter(k => k.status === 'at_risk' || k.status === 'behind').length;
    const avgProgress = activeObjs.length
      ? Math.round(
          activeObjs.reduce((acc, o) => acc + (typeof o.progress === 'number' ? o.progress : 0), 0) /
            activeObjs.length,
        )
      : 0;
    return {
      entityType: 'executive_dashboard',
      title: `${tenant?.name ?? 'Organization'} — Strategic Overview`,
      subtitle: 'Live snapshot of objectives, key results, and big rocks',
      progress: avgProgress,
      metrics: [
        { label: 'Active Objectives', value: activeObjs.length },
        { label: 'Key Results', value: krs.length },
        { label: 'On Track', value: onTrack },
        { label: 'At Risk / Behind', value: atRisk },
        { label: 'Big Rocks', value: bigRocks.filter(b => !b.deletedAt).length },
      ],
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

// ----- HTML rendering -------------------------------------------------------

function escape(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'on_track': return '#16a34a';
    case 'at_risk': return '#f59e0b';
    case 'behind': return '#dc2626';
    case 'completed':
    case 'closed': return '#2563eb';
    case 'postponed': return '#9ca3af';
    default: return '#6b7280';
  }
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Not started';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function entityTypeLabel(t: EmbedEntityType): string {
  switch (t) {
    case 'objective': return 'Objective';
    case 'key_result': return 'Key Result';
    case 'big_rock': return 'Big Rock';
    case 'executive_dashboard': return 'Executive Dashboard';
  }
}

const REFRESH_SECONDS = 5 * 60;

function renderCardHtml(card: EmbedCardData, theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0b1220' : '#ffffff';
  const fg = isDark ? '#e5e7eb' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#1f2937' : '#e2e8f0';
  const surface = isDark ? '#111827' : '#f8fafc';

  const progress = typeof card.progress === 'number' ? Math.max(0, Math.min(100, card.progress)) : null;
  const sColor = statusColor(card.status);

  const metricRow = card.metric
    ? `<div class="metric"><span class="metric-current">${escape(String(card.metric.current))}</span><span class="metric-sep">/</span><span class="metric-target">${escape(String(card.metric.target))}</span>${card.metric.unit ? `<span class="metric-unit">${escape(card.metric.unit)}</span>` : ''}</div>`
    : '';

  const metricsList = card.metrics?.length
    ? `<div class="metrics-grid">${card.metrics
        .map((m, i) => `<div class="metric-tile"><div class="metric-label">${escape(m.label)}</div><div class="metric-value" data-testid="embed-metric-${i}">${escape(String(m.value))}</div></div>`)
        .join('')}</div>`
    : '';

  const noteBlock = card.lastCheckInNote
    ? `<div class="note">"${escape(card.lastCheckInNote)}"</div>`
    : '';

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(card.title)} — Vega</title>
<style>
:root { color-scheme: ${isDark ? 'dark' : 'light'}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: ${bg}; color: ${fg};
  padding: 16px; line-height: 1.4;
}
.card {
  border: 1px solid ${border}; border-radius: 8px;
  background: ${surface}; padding: 16px;
}
.eyebrow {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
  color: ${muted}; margin-bottom: 8px;
}
.brand { font-weight: 600; color: ${fg}; }
.title { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; }
.subtitle { font-size: 13px; color: ${muted}; margin: 0 0 12px 0; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 999px;
  background: ${sColor}1a; color: ${sColor};
  font-size: 12px; font-weight: 600;
}
.status-pill::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; background: ${sColor};
}
.owner { font-size: 12px; color: ${muted}; }
.progress-wrap { margin: 8px 0 4px 0; }
.progress-meta {
  display: flex; justify-content: space-between; font-size: 12px;
  color: ${muted}; margin-bottom: 4px;
}
.progress-bar {
  width: 100%; height: 6px; background: ${border}; border-radius: 999px; overflow: hidden;
}
.progress-fill { height: 100%; background: ${sColor}; transition: width 0.4s ease; }
.metric { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.metric-sep { color: ${muted}; margin: 0 4px; }
.metric-target { color: ${muted}; font-weight: 500; }
.metric-unit { color: ${muted}; font-size: 13px; margin-left: 4px; }
.metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px; margin-top: 8px;
}
.metric-tile {
  border: 1px solid ${border}; border-radius: 6px; padding: 8px 10px; background: ${bg};
}
.metric-label { font-size: 11px; color: ${muted}; text-transform: uppercase; letter-spacing: 0.04em; }
.metric-value { font-size: 18px; font-weight: 600; margin-top: 2px; }
.note {
  font-size: 12px; color: ${muted}; font-style: italic;
  border-left: 2px solid ${border}; padding-left: 10px; margin-top: 12px;
}
.footer {
  display: flex; justify-content: space-between; font-size: 11px;
  color: ${muted}; margin-top: 12px;
}
.footer a { color: ${muted}; text-decoration: none; }
</style>
</head>
<body>
<div class="card" data-testid="embed-card">
  <div class="eyebrow">
    <span class="brand">Vega · ${escape(entityTypeLabel(card.entityType))}</span>
    ${card.status ? `<span class="status-pill" data-testid="embed-status">${escape(statusLabel(card.status))}</span>` : ''}
  </div>
  <h1 class="title" data-testid="embed-title">${escape(card.title)}</h1>
  ${card.subtitle ? `<p class="subtitle">${escape(card.subtitle)}</p>` : ''}
  ${card.ownerLabel ? `<div class="row"><span class="owner">Owner: ${escape(card.ownerLabel)}</span></div>` : ''}
  ${metricRow}
  ${progress !== null ? `
    <div class="progress-wrap">
      <div class="progress-meta"><span>Progress</span><span data-testid="embed-progress">${progress}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
    </div>` : ''}
  ${metricsList}
  ${noteBlock}
  <div class="footer">
    <span>${card.updatedAt ? `Updated ${escape(new Date(card.updatedAt).toLocaleString())}` : ''}</span>
    <span>Auto-refreshes every 5 min</span>
  </div>
</div>
<script>
  (function() {
    var refreshSec = ${REFRESH_SECONDS};
    function doRefresh() {
      try {
        var jsonUrl = window.location.href.replace(/([?&])json=1(&|$)/, '$2');
        jsonUrl += (jsonUrl.indexOf('?') === -1 ? '?' : '&') + 'json=1';
        fetch(jsonUrl)
          .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function(data) {
            var t = document.querySelector('[data-testid="embed-title"]');
            if (t && data.title) t.textContent = data.title;
            var p = document.querySelector('[data-testid="embed-progress"]');
            if (p && data.progress != null) p.textContent = data.progress + '%';
            var f = document.querySelector('.progress-fill');
            if (f && data.progress != null) f.style.width = Math.max(0, Math.min(100, data.progress)) + '%';
            var s = document.querySelector('[data-testid="embed-status"]');
            if (s && data.status) s.textContent = data.status.replace(/_/g,' ').replace(/\\b\\w/g,function(c){return c.toUpperCase();});
            // Update the "Updated …" timestamp in the footer.
            var footerSpans = document.querySelectorAll('.footer span');
            if (footerSpans.length > 0 && data.updatedAt) {
              footerSpans[0].textContent = 'Updated ' + new Date(data.updatedAt).toLocaleString();
            }
            // Patch executive-dashboard metric tiles.
            if (Array.isArray(data.metrics)) {
              data.metrics.forEach(function(m, i) {
                var el = document.querySelector('[data-testid="embed-metric-' + i + '"]');
                if (el) el.textContent = String(m.value);
              });
            }
          })
          .catch(function() { window.location.reload(); });
      } catch(e) { window.location.reload(); }
    }
    // Repeat every refreshSec seconds for the lifetime of the iframe.
    setInterval(doRefresh, refreshSec * 1000);
  })();
</script>
</body>
</html>`;
}

function renderError(message: string, theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0b1220' : '#ffffff';
  const fg = isDark ? '#e5e7eb' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#1f2937' : '#e2e8f0';
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Vega embed</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:${bg};color:${fg};padding:16px}.card{border:1px solid ${border};border-radius:8px;padding:24px;text-align:center}.muted{color:${muted};font-size:12px;margin-top:8px}</style>
</head><body><div class="card" data-testid="embed-error"><div>${escape(message)}</div><div class="muted">Vega embed</div></div></body></html>`;
}
