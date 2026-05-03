// Galaxy Portal read-only API. Authenticated by Galaxy JWT; results are
// scoped to req.effectiveTenantId (resolved from the JWT client_id) and
// filtered to entities owned by the portal user or their linked Vega user.

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { storage } from './storage';
import { requirePortalAuth } from './portal/middleware';
import type {
  Objective,
  KeyResult,
  BigRock,
  CheckIn,
  Ambition,
} from '@shared/schema';
import type { GalaxyAuthContext } from './portal/galaxy-jwt';

/**
 * Build the portal router. Production calls this with no arguments and the
 * default `requirePortalAuth` (real Galaxy JWT validator) is mounted. Tests
 * pass an in-process middleware that injects an RSA key + skips the SSRF
 * guard, so the test exercises the full handler chain without ever mutating
 * module-level state in the production validator.
 */
export function createPortalRouter(authMiddleware: RequestHandler = requirePortalAuth): Router {
  const portalRouter = Router();
  portalRouter.use(authMiddleware);
  registerPortalRoutes(portalRouter);
  return portalRouter;
}

function registerPortalRoutes(portalRouter: Router): void {

// ----- Identity set used for ownership matching ----------------------------

interface PortalIdentity {
  ids: Set<string>;          // Vega user.id values that count as "me"
  emails: Set<string>;       // email addresses that count as "me" (lowercased)
}

function buildIdentity(req: Request): PortalIdentity {
  const user = req.user!;
  const ctx = req.portalAuth!;
  const ids = new Set<string>([user.id]);
  const emails = new Set<string>();
  if (user.email && !user.email.endsWith('@portal.invalid')) {
    emails.add(user.email.toLowerCase());
  }
  if (ctx.email) emails.add(ctx.email.toLowerCase());
  if (ctx.linkedVegaUser) {
    ids.add(ctx.linkedVegaUser.id);
    emails.add(ctx.linkedVegaUser.email.toLowerCase());
  }
  return { ids, emails };
}

const matchesEmail = (id: PortalIdentity, e: string | null | undefined) =>
  !!e && id.emails.has(e.toLowerCase());

// ----- Ownership predicates (use real schema fields) -----------------------

function ownsObjective(o: Objective, id: PortalIdentity): boolean {
  if (o.ownerId && id.ids.has(o.ownerId)) return true;
  if (matchesEmail(id, o.ownerEmail)) return true;
  if (Array.isArray(o.coOwnerIds) && o.coOwnerIds.some(c => id.ids.has(c))) return true;
  if (o.checkInOwnerId && id.ids.has(o.checkInOwnerId)) return true;
  return false;
}

function ownsKeyResult(k: KeyResult, id: PortalIdentity): boolean {
  return !!k.ownerId && id.ids.has(k.ownerId);
}

function ownsBigRock(b: BigRock, id: PortalIdentity): boolean {
  if (b.ownerId && id.ids.has(b.ownerId)) return true;
  if (b.accountableId && id.ids.has(b.accountableId)) return true;
  if (matchesEmail(id, b.ownerEmail)) return true;
  if (matchesEmail(id, b.accountableEmail)) return true;
  return false;
}

function authoredCheckIn(c: CheckIn, id: PortalIdentity): boolean {
  if (c.userId && id.ids.has(c.userId)) return true;
  if (matchesEmail(id, c.userEmail)) return true;
  return false;
}

const ACTIVE_STATUSES = new Set(['not_started', 'on_track', 'at_risk', 'behind']);
const STALE_CHECKIN_DAYS = 7;

async function loadOwnedEntities(tenantId: string, id: PortalIdentity) {
  const [objectives, keyResults, bigRocks] = await Promise.all([
    storage.getObjectivesByTenantId(tenantId),
    storage.getKeyResultsByTenantId(tenantId),
    storage.getBigRocksByTenantId(tenantId),
  ]);
  const myObjectives = objectives.filter(o => ownsObjective(o, id));
  const myKeyResults = keyResults.filter(k => ownsKeyResult(k, id));
  const myBigRocks = bigRocks.filter(b => ownsBigRock(b, id));
  const ownedIds = new Set<string>([
    ...myObjectives.map(o => o.id),
    ...myKeyResults.map(k => k.id),
    ...myBigRocks.map(b => b.id),
  ]);
  return { myObjectives, myKeyResults, myBigRocks, ownedIds };
}

// ----- /me ------------------------------------------------------------------

portalRouter.get('/me', async (req: Request, res: Response) => {
  const user = req.user!;
  const ctx = req.portalAuth! as GalaxyAuthContext;
  const tenant = ctx.tenant;
  res.json({
    id: user.id,
    email: ctx.email || (user.email.endsWith('@portal.invalid') ? null : user.email),
    name: user.name,
    role: user.role,
    authProvider: user.authProvider,
    galaxyUserId: user.galaxyUserId,
    linkedVegaUserId: ctx.linkedVegaUser?.id ?? null,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      color: tenant.color,
    },
  });
});

// ----- /dashboard -----------------------------------------------------------

portalRouter.get('/dashboard', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId!;
  const identity = buildIdentity(req);

  const { myObjectives, myKeyResults, myBigRocks, ownedIds } = await loadOwnedEntities(tenantId, identity);
  const allCheckIns = await storage.getCheckInsByTenantId(tenantId);

  // Visible check-ins: authored by this user OR for an entity they own.
  const visibleCheckIns = allCheckIns.filter(c =>
    authoredCheckIn(c, identity) || (c.entityId && ownedIds.has(c.entityId))
  );

  const sortedCheckIns = [...visibleCheckIns].sort((a, b) => {
    const aTs = (a.createdAt ?? a.asOfDate ?? new Date(0)).valueOf();
    const bTs = (b.createdAt ?? b.asOfDate ?? new Date(0)).valueOf();
    return bTs - aTs;
  });

  const isActive = (status: string | null | undefined) => !status || ACTIVE_STATUSES.has(status);
  const onTrack = myKeyResults.filter(kr => kr.status === 'on_track').length;
  const atRisk = myKeyResults.filter(kr => kr.status === 'at_risk' || kr.status === 'behind').length;

  // Upcoming check-ins: active owned entities whose last check-in is missing
  // or older than STALE_CHECKIN_DAYS days (i.e. due/overdue for an update).
  const staleCutoff = Date.now() - STALE_CHECKIN_DAYS * 24 * 60 * 60 * 1000;
  const isUpcoming = (status: string | null | undefined, lastCheckInAt: Date | null | undefined) =>
    isActive(status) && (!lastCheckInAt || lastCheckInAt.valueOf() < staleCutoff);

  const upcomingCheckInsCount =
    myObjectives.filter(o => isUpcoming(o.status, o.lastCheckInAt)).length +
    myKeyResults.filter(k => isUpcoming(k.status, k.lastCheckInAt)).length +
    myBigRocks.filter(b => isUpcoming(b.status, b.lastCheckInAt)).length;

  const recentActivity = sortedCheckIns.slice(0, 10).map(c => ({
    id: c.id,
    type: 'check-in',
    entityType: c.entityType,
    entityId: c.entityId,
    newProgress: c.newProgress,
    newStatus: c.newStatus,
    note: c.note,
    asOfDate: c.asOfDate,
    createdAt: c.createdAt,
    userEmail: c.userEmail,
  }));

  res.json({
    activeObjectivesCount: myObjectives.filter(o => isActive(o.status)).length,
    activeKeyResultsCount: myKeyResults.filter(k => isActive(k.status)).length,
    activeBigRocksCount: myBigRocks.filter(b => isActive(b.status)).length,
    onTrackCount: onTrack,
    atRiskCount: atRisk,
    upcomingCheckInsCount,
    recentActivity,
  });
});

// ----- /objectives ----------------------------------------------------------

portalRouter.get('/objectives', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const objectives = await storage.getObjectivesByTenantId(req.effectiveTenantId!);
  res.json(objectives.filter(o => ownsObjective(o, identity)));
});

portalRouter.get('/objectives/:id', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const objectives = await storage.getObjectivesByTenantId(req.effectiveTenantId!);
  const item = objectives.find(o => o.id === req.params.id);
  if (!item || !ownsObjective(item, identity)) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json(item);
});

// ----- /key-results ---------------------------------------------------------

portalRouter.get('/key-results', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const krs = await storage.getKeyResultsByTenantId(req.effectiveTenantId!);
  res.json(krs.filter(k => ownsKeyResult(k, identity)));
});

portalRouter.get('/key-results/:id', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const krs = await storage.getKeyResultsByTenantId(req.effectiveTenantId!);
  const item = krs.find(k => k.id === req.params.id);
  if (!item || !ownsKeyResult(item, identity)) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json(item);
});

// ----- /big-rocks -----------------------------------------------------------

portalRouter.get('/big-rocks', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const rocks = await storage.getBigRocksByTenantId(req.effectiveTenantId!);
  res.json(rocks.filter(b => ownsBigRock(b, identity)));
});

portalRouter.get('/big-rocks/:id', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const rocks = await storage.getBigRocksByTenantId(req.effectiveTenantId!);
  const item = rocks.find(b => b.id === req.params.id);
  if (!item || !ownsBigRock(item, identity)) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json(item);
});

// ----- /ambitions -----------------------------------------------------------

portalRouter.get('/ambitions', async (req: Request, res: Response) => {
  const identity = buildIdentity(req);
  const foundation = await storage.getFoundationByTenantId(req.effectiveTenantId!);
  const ambitions: Ambition[] = foundation?.ambitions ?? [];
  const mine = ambitions.filter(a => a.ownerId && identity.ids.has(a.ownerId));
  res.json(mine);
});

// ----- /check-ins -----------------------------------------------------------

portalRouter.get('/check-ins', async (req: Request, res: Response) => {
  const tenantId = req.effectiveTenantId!;
  const identity = buildIdentity(req);
  let checkIns = await storage.getCheckInsByTenantId(tenantId);

  const since = req.query.since;
  if (typeof since === 'string') {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      checkIns = checkIns.filter(c => {
        const ts = (c.createdAt ?? c.asOfDate ?? new Date(0)).valueOf();
        return ts >= sinceDate.getTime();
      });
    }
  }

  const { ownedIds } = await loadOwnedEntities(tenantId, identity);
  const filtered = checkIns.filter(c =>
    authoredCheckIn(c, identity) || (c.entityId && ownedIds.has(c.entityId))
  );
  res.json(filtered);
});

} // end registerPortalRoutes

/**
 * Default production portal router, bound to the real Galaxy JWT validator.
 */
export const portalRouter = createPortalRouter();
