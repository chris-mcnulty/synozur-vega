// Galaxy Portal read-only API. Authenticated by Galaxy JWT; results are
// scoped to req.effectiveTenantId (resolved from the JWT client_id) and
// filtered to entities owned by the portal user or their linked Vega user.

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { requirePortalAuth, requirePortalWriter } from './portal/middleware';
import type {
  Objective,
  KeyResult,
  BigRock,
  CheckIn,
  Ambition,
  InsertObjective,
  InsertKeyResult,
  InsertBigRock,
  InsertCheckIn,
} from '@shared/schema';
import type { GalaxyAuthContext } from './portal/galaxy-jwt';
import {
  calculateKeyResultProgress,
  calculateObjectiveRollupProgress,
} from './routes-okr';
import { captureEntitySnapshot, getPacificDateString } from './services/progress-snapshots';
import { createNotification, isEmailEnabled } from './services/notification-service';
import { sendPortalCheckInEmail } from './email';

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

// ----- Write actions (portal_user_writer only) -----------------------------

const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const VALID_ENTITY_TYPES = new Set(['objective', 'key_result', 'big_rock']);

// Portal write contract — keeps the public surface small and stable so Galaxy
// can codegen against it. We map these fields to the internal check_ins
// columns server-side.
// Allowed status values are kept in sync with the OpenAPI enum.
const PORTAL_CHECK_IN_STATUS = ['on_track', 'at_risk', 'behind', 'completed', 'blocked'] as const;
const portalStatusSchema = z.enum(PORTAL_CHECK_IN_STATUS);

const portalCheckInCreateSchema = z.object({
  entityType: z.enum(['objective', 'key_result', 'big_rock']),
  entityId: z.string().min(1),
  progress: z.number().min(0).max(100).optional(),
  status: portalStatusSchema.optional(),
  note: z.string().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  asOfDate: z.union([z.string().datetime(), z.date()]).optional(),
});

const portalCheckInPatchSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  status: portalStatusSchema.optional(),
  note: z.string().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  asOfDate: z.union([z.string().datetime(), z.date()]).optional(),
});

type PortalCheckInCreate = z.infer<typeof portalCheckInCreateSchema>;
type PortalCheckInPatch = z.infer<typeof portalCheckInPatchSchema>;

async function loadOwnedEntityForWrite(
  tenantId: string,
  entityType: string,
  entityId: string,
  identity: PortalIdentity,
): Promise<{ ok: true; entity: Objective | KeyResult | BigRock; closed: boolean; closedReason?: string; currentProgress: number | null } | { ok: false; status: number; error: string }> {
  if (entityType === 'objective') {
    const obj = await storage.getObjectiveById(entityId);
    if (!obj || obj.tenantId !== tenantId) return { ok: false, status: 403, error: 'forbidden' };
    if (!ownsObjective(obj, identity)) return { ok: false, status: 403, error: 'forbidden' };
    return {
      ok: true,
      entity: obj,
      closed: obj.status === 'closed',
      closedReason: 'Cannot check in on a closed objective.',
      currentProgress: obj.progress ?? null,
    };
  }
  if (entityType === 'key_result') {
    const kr = await storage.getKeyResultById(entityId);
    if (!kr || kr.tenantId !== tenantId) return { ok: false, status: 403, error: 'forbidden' };
    if (!ownsKeyResult(kr, identity)) return { ok: false, status: 403, error: 'forbidden' };
    if (kr.status === 'closed') {
      return { ok: true, entity: kr, closed: true, closedReason: 'Cannot check in on a closed key result.', currentProgress: kr.progress ?? null };
    }
    if (kr.objectiveId) {
      const parent = await storage.getObjectiveById(kr.objectiveId);
      if (parent?.status === 'closed') {
        return { ok: true, entity: kr, closed: true, closedReason: 'Cannot check in - the parent objective is closed.', currentProgress: kr.progress ?? null };
      }
    }
    return { ok: true, entity: kr, closed: false, currentProgress: kr.progress ?? null };
  }
  if (entityType === 'big_rock') {
    const br = await storage.getBigRockById(entityId);
    if (!br || br.tenantId !== tenantId) return { ok: false, status: 403, error: 'forbidden' };
    if (!ownsBigRock(br, identity)) return { ok: false, status: 403, error: 'forbidden' };
    return {
      ok: true,
      entity: br,
      closed: br.status === 'closed',
      closedReason: 'Cannot check in on a closed Big Rock.',
      currentProgress: br.completionPercentage ?? null,
    };
  }
  return { ok: false, status: 400, error: 'invalid_entity_type' };
}

async function applyCheckInToEntity(checkIn: CheckIn): Promise<void> {
  const { entityType, entityId } = checkIn;
  const hasProgress = checkIn.newProgress !== undefined && checkIn.newProgress !== null;

  if (entityType === 'objective') {
    const updateData: Partial<InsertObjective> = {
      lastCheckInAt: checkIn.createdAt ?? undefined,
    };
    if (checkIn.note) updateData.lastCheckInNote = checkIn.note;
    if (hasProgress) updateData.progress = checkIn.newProgress as number;
    if (checkIn.newStatus) {
      updateData.status = checkIn.newStatus;
      updateData.statusOverride = 'true';
    }
    await storage.updateObjective(entityId, updateData);
    return;
  }

  if (entityType === 'key_result') {
    const keyResult = await storage.getKeyResultById(entityId);
    const hasNewValue = checkIn.newValue !== undefined && checkIn.newValue !== null;

    let calculatedProgress: number | undefined;
    if (keyResult && hasNewValue) {
      calculatedProgress = calculateKeyResultProgress(
        checkIn.newValue as number,
        keyResult.targetValue ?? 0,
        keyResult.initialValue ?? 0,
        keyResult.metricType || 'increase',
      );
    } else if (hasProgress) {
      calculatedProgress = checkIn.newProgress as number;
    }

    const krUpdate: Partial<InsertKeyResult> = {
      lastCheckInAt: checkIn.createdAt ?? undefined,
    };
    if (checkIn.newStatus) krUpdate.status = checkIn.newStatus;
    if (checkIn.note) krUpdate.lastCheckInNote = checkIn.note;
    if (hasNewValue) krUpdate.currentValue = checkIn.newValue as number;
    if (calculatedProgress !== undefined) krUpdate.progress = calculatedProgress;
    await storage.updateKeyResult(entityId, krUpdate);

    if (keyResult && keyResult.objectiveId && (hasNewValue || hasProgress)) {
      const objective = await storage.getObjectiveById(keyResult.objectiveId);
      if (objective && objective.progressMode === 'rollup') {
        const newProgress = await calculateObjectiveRollupProgress(keyResult.objectiveId);
        await storage.updateObjective(keyResult.objectiveId, { progress: newProgress });
      }
    }
    return;
  }

  if (entityType === 'big_rock') {
    const brUpdate: Partial<InsertBigRock> = {
      lastCheckInAt: checkIn.createdAt ?? undefined,
    };
    if (checkIn.newStatus) brUpdate.status = checkIn.newStatus;
    if (checkIn.note) brUpdate.lastCheckInNote = checkIn.note;
    if (hasProgress) brUpdate.completionPercentage = checkIn.newProgress as number;
    await storage.updateBigRock(entityId, brUpdate);
  }
}

// Map the portal's public contract onto the internal check_ins columns.
function mapPortalCreateToInsert(
  portal: PortalCheckInCreate,
  ctx: { tenantId: string; userId: string; userEmail: string | null; currentProgress: number | null },
): InsertCheckIn {
  const previousProgress = ctx.currentProgress ?? 0;
  let newProgress = portal.progress ?? previousProgress;
  // Safety net: marking objective/big-rock 'completed' implies 100%.
  if (
    portal.status === 'completed' &&
    (portal.entityType === 'objective' || portal.entityType === 'big_rock') &&
    newProgress < 100
  ) {
    newProgress = 100;
  }
  const asOfDate =
    portal.asOfDate instanceof Date
      ? portal.asOfDate
      : portal.asOfDate
      ? new Date(portal.asOfDate)
      : undefined;

  // confidence is part of the public contract for forward-compat but not yet
  // persisted on check_ins (no column today). We accept-and-ignore so Galaxy
  // can adopt it before the column is added.
  void portal.confidence;

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userEmail: ctx.userEmail ?? undefined,
    entityType: portal.entityType,
    entityId: portal.entityId,
    previousProgress,
    newProgress,
    newStatus: portal.status,
    note: portal.note,
    asOfDate,
    source: 'galaxy_portal',
  };
}

function mapPortalPatchToUpdate(
  patch: PortalCheckInPatch,
  existing: CheckIn,
): Partial<InsertCheckIn> {
  const update: Partial<InsertCheckIn> = {};
  if (patch.progress !== undefined) update.newProgress = patch.progress;
  if (patch.status !== undefined) update.newStatus = patch.status;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.asOfDate !== undefined) {
    update.asOfDate =
      patch.asOfDate instanceof Date ? patch.asOfDate : new Date(patch.asOfDate);
  }
  // Status=completed safety net mirrors POST behavior.
  const effectiveStatus = patch.status ?? existing.newStatus;
  const effectiveProgress = update.newProgress ?? existing.newProgress ?? 0;
  if (
    effectiveStatus === 'completed' &&
    (existing.entityType === 'objective' || existing.entityType === 'big_rock') &&
    Number(effectiveProgress) < 100
  ) {
    update.newProgress = 100;
  }
  void patch.confidence;
  return update;
}

async function captureSnapshotForCheckIn(checkIn: CheckIn): Promise<void> {
  if (checkIn.entityType !== 'objective' && checkIn.entityType !== 'key_result') return;
  try {
    await captureEntitySnapshot({
      tenantId: checkIn.tenantId,
      entityType: checkIn.entityType,
      entityId: checkIn.entityId,
      progress: checkIn.newProgress ?? 0,
      status: checkIn.newStatus,
      source: 'galaxy_portal',
      snapshotDate: getPacificDateString(),
    });
  } catch (err) {
    console.error('[Portal] Failed to capture progress snapshot:', err);
  }
}

async function notifyOwnersOfCheckIn(checkIn: CheckIn, actorUserId: string): Promise<void> {
  try {
    let ownerIds: (string | null | undefined)[] = [];
    let entityTitle = '';
    if (checkIn.entityType === 'objective') {
      const o = await storage.getObjectiveById(checkIn.entityId);
      if (o) {
        ownerIds = [o.ownerId, o.checkInOwnerId, ...(o.coOwnerIds || [])];
        entityTitle = o.title;
      }
    } else if (checkIn.entityType === 'key_result') {
      const k = await storage.getKeyResultById(checkIn.entityId);
      if (k) {
        ownerIds = [k.ownerId];
        entityTitle = k.title;
      }
    } else if (checkIn.entityType === 'big_rock') {
      const b = await storage.getBigRockById(checkIn.entityId);
      if (b) {
        ownerIds = [b.ownerId, b.accountableId];
        entityTitle = b.title;
      }
    }
    // Match the entity deep-link convention used by comment notifications
    // (server/routes-comments.ts) so links open the right entity in the app.
    const linkUrl = `/planning?entityType=${encodeURIComponent(checkIn.entityType)}&entityId=${encodeURIComponent(checkIn.entityId)}`;
    const recipients = Array.from(new Set(ownerIds.filter((id): id is string => !!id && id !== actorUserId)));
    if (recipients.length === 0) return;

    const entityTypeLabel = checkIn.entityType.replace('_', ' ');
    const actor = await storage.getUser(actorUserId);
    const actorName = actor?.name || actor?.email || checkIn.userEmail || 'A portal user';

    await Promise.all(recipients.map(async (userId) => {
      await createNotification({
        tenantId: checkIn.tenantId,
        userId,
        type: 'assigned',
        title: 'New check-in from Galaxy Portal',
        body: checkIn.note || `A ${entityTypeLabel} was updated via Galaxy Portal.`,
        entityType: checkIn.entityType,
        entityId: checkIn.entityId,
        linkUrl,
      });
      try {
        if (await isEmailEnabled(userId, 'assigned')) {
          const recipient = await storage.getUser(userId);
          if (recipient?.email && !recipient.email.endsWith('@portal.invalid')) {
            await sendPortalCheckInEmail(
              recipient.email,
              recipient.name || recipient.email,
              actorName,
              entityTypeLabel,
              entityTitle || `your ${entityTypeLabel}`,
              checkIn.note ?? null,
              checkIn.newStatus ?? null,
              checkIn.newProgress ?? null,
              linkUrl,
            );
          }
        }
      } catch (e) {
        console.error('[Portal] check-in email failed:', e);
      }
    }));
  } catch (err) {
    console.error('[Portal] Failed to send check-in notifications:', err);
  }
}

portalRouter.post('/check-ins', requirePortalWriter, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const user = req.user!;
    const ctx = req.portalAuth!;
    const identity = buildIdentity(req);

    const parsed = portalCheckInCreateSchema.parse(req.body);
    if (!VALID_ENTITY_TYPES.has(parsed.entityType)) {
      return res.status(400).json({ error: 'invalid_entity_type' });
    }

    const owned = await loadOwnedEntityForWrite(tenantId, parsed.entityType, parsed.entityId, identity);
    if (!owned.ok) return res.status(owned.status).json({ error: owned.error });
    if (owned.closed) {
      return res.status(403).json({ error: 'entity_closed', error_description: owned.closedReason });
    }

    const insertValues = mapPortalCreateToInsert(parsed, {
      tenantId,
      userId: user.id,
      userEmail: ctx.email || (user.email && !user.email.endsWith('@portal.invalid') ? user.email : null),
      currentProgress: owned.currentProgress,
    });

    const checkIn = await storage.createCheckIn(insertValues);
    await applyCheckInToEntity(checkIn);
    await captureSnapshotForCheckIn(checkIn);
    notifyOwnersOfCheckIn(checkIn, user.id).catch(() => {});

    res.status(201).json(checkIn);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_error', details: err.errors });
    }
    console.error('[Portal] POST /check-ins failed:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

portalRouter.patch('/check-ins/:id', requirePortalWriter, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const user = req.user!;
    const identity = buildIdentity(req);

    const existing = await storage.getCheckInById(req.params.id);
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: 'not_found' });
    }
    // Author-only edits.
    if (!authoredCheckIn(existing, identity)) {
      return res.status(403).json({ error: 'forbidden', error_description: 'Only the author may edit this check-in' });
    }
    // 30-minute edit window from creation.
    const createdAtMs = (existing.createdAt ?? new Date(0)).valueOf();
    if (Date.now() - createdAtMs > EDIT_WINDOW_MS) {
      return res.status(403).json({ error: 'edit_window_expired', error_description: 'Check-ins can only be edited within 30 minutes of creation' });
    }
    // Re-verify entity ownership in case ownership changed since creation.
    const owned = await loadOwnedEntityForWrite(tenantId, existing.entityType, existing.entityId, identity);
    if (!owned.ok) return res.status(owned.status).json({ error: owned.error });
    if (owned.closed) {
      return res.status(403).json({ error: 'entity_closed', error_description: owned.closedReason });
    }

    const parsed = portalCheckInPatchSchema.parse(req.body);
    const updateData = mapPortalPatchToUpdate(parsed, existing);
    const checkIn = await storage.updateCheckIn(req.params.id, updateData);
    await applyCheckInToEntity(checkIn);
    await captureSnapshotForCheckIn(checkIn);

    res.json(checkIn);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_error', details: err.errors });
    }
    console.error('[Portal] PATCH /check-ins/:id failed:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

} // end registerPortalRoutes

/**
 * Default production portal router, bound to the real Galaxy JWT validator.
 */
export const portalRouter = createPortalRouter();
