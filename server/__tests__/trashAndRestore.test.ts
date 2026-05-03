/**
 * Regression tests for the soft-delete + trash + restore + 30-day purge flow.
 *
 * Run with:
 *   DATABASE_URL=... npx tsx server/__tests__/trashAndRestore.test.ts
 *
 * Two layers are exercised:
 *   1. Storage methods directly (deleteObjective / deleteKeyResult,
 *      restoreObjective / restoreKeyResult, getTrashItemsByTenantId,
 *      purgeOldDeletedItems, getObjectivesByTenantId / getKeyResultsByObjectiveId).
 *   2. The HTTP trash router (createTrashRouter from server/routes-trash.ts)
 *      mounted behind a stub auth middleware that simulates an authenticated
 *      tenant admin — verifying the actual route contract used in production.
 *
 * Cases (mapped to task acceptance criteria):
 *   a. deleteObjective sets deletedAt and cascades to its key results.
 *   b. GET /api/trash returns items only for the user's tenant.
 *   c. POST /api/trash/:type/:id/restore clears deletedAt and the item
 *      reappears in normal listings.
 *   d. Cross-tenant restore attempts are denied (returns 404 and does not
 *      mutate the row).
 *   e. purgeOldDeletedItems(30) only removes items older than the cutoff.
 */

import express, { type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'net';
import { eq, inArray } from 'drizzle-orm';

const { db, pool } = await import('../db');
const {
  tenants,
  objectives,
  keyResults,
  users,
  savedViews,
} = await import('../../shared/schema');
type PageFilterState = import('../../shared/schema').PageFilterState;
const { storage } = await import('../storage');
const { ROLES } = await import('../../shared/rbac');
const { createTrashRouter } = await import('../routes-trash');

// ---------------------------------------------------------------------------
// Tiny assertion helper — same shape as galaxyPortal.test.ts.
// ---------------------------------------------------------------------------

const PASS = 'PASS';
const FAIL = 'FAIL';
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  ${FAIL} ${msg}`);
    failed += 1;
    process.exitCode = 1;
  } else {
    console.log(`  ${PASS} ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TENANT_A_NAME = `__trash_test_A_${RUN_ID}`;
const TENANT_B_NAME = `__trash_test_B_${RUN_ID}`;

interface Seeded {
  tenantAId: string;
  tenantBId: string;
  objAId: string;
  krA1Id: string;
  krA2Id: string;
  objA2Id: string;
  krA2OnlyId: string;
  objBId: string;
  krBId: string;
}

const seeded: Seeded = {
  tenantAId: '',
  tenantBId: '',
  objAId: '',
  krA1Id: '',
  krA2Id: '',
  objA2Id: '',
  krA2OnlyId: '',
  objBId: '',
  krBId: '',
};

async function setUp(): Promise<void> {
  const [tA] = await db.insert(tenants).values({ name: TENANT_A_NAME }).returning();
  const [tB] = await db.insert(tenants).values({ name: TENANT_B_NAME }).returning();
  seeded.tenantAId = tA.id;
  seeded.tenantBId = tB.id;

  const [objA] = await db.insert(objectives).values({
    tenantId: tA.id,
    title: `A obj ${RUN_ID}`,
    level: 'team',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.objAId = objA.id;

  const [krA1] = await db.insert(keyResults).values({
    tenantId: tA.id,
    objectiveId: objA.id,
    title: `A KR1 ${RUN_ID}`,
    metricType: 'increase',
    targetValue: 100,
    status: 'on_track',
  }).returning();
  seeded.krA1Id = krA1.id;

  const [krA2] = await db.insert(keyResults).values({
    tenantId: tA.id,
    objectiveId: objA.id,
    title: `A KR2 ${RUN_ID}`,
    metricType: 'increase',
    targetValue: 200,
    status: 'on_track',
  }).returning();
  seeded.krA2Id = krA2.id;

  const [objA2] = await db.insert(objectives).values({
    tenantId: tA.id,
    title: `A obj2 ${RUN_ID}`,
    level: 'team',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.objA2Id = objA2.id;
  const [krA2Only] = await db.insert(keyResults).values({
    tenantId: tA.id,
    objectiveId: objA2.id,
    title: `A2 KR ${RUN_ID}`,
    metricType: 'increase',
    targetValue: 50,
    status: 'on_track',
  }).returning();
  seeded.krA2OnlyId = krA2Only.id;

  const [objB] = await db.insert(objectives).values({
    tenantId: tB.id,
    title: `B obj ${RUN_ID}`,
    level: 'team',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.objBId = objB.id;
  const [krB] = await db.insert(keyResults).values({
    tenantId: tB.id,
    objectiveId: objB.id,
    title: `B KR ${RUN_ID}`,
    metricType: 'increase',
    targetValue: 100,
    status: 'on_track',
  }).returning();
  seeded.krBId = krB.id;
}

async function tearDown(): Promise<void> {
  const tenantIds = [seeded.tenantAId, seeded.tenantBId].filter(Boolean);
  if (tenantIds.length === 0) return;
  const objIds = [seeded.objAId, seeded.objA2Id, seeded.objBId].filter(Boolean);
  if (objIds.length) {
    await db.delete(keyResults).where(inArray(keyResults.objectiveId, objIds));
    await db.delete(objectives).where(inArray(objectives.id, objIds));
  }
  await db.delete(tenants).where(inArray(tenants.id, tenantIds));
  await pool.end();
}

// ---------------------------------------------------------------------------
// HTTP harness — mount createTrashRouter behind a stub auth middleware that
// simulates an authenticated tenant admin scoped to the tenantId supplied via
// `x-test-tenant-id`. This is the same pattern the production routes get from
// the real `adminOnly` stack (it sets `req.user` and `req.effectiveTenantId`).
// ---------------------------------------------------------------------------

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

const stubAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = req.header('x-test-tenant-id') || '';
  // Minimal shape the route handlers read.
  (req as Request & { user?: { role: string } }).user = { role: ROLES.TENANT_ADMIN };
  if (tenantId) req.effectiveTenantId = tenantId;
  next();
};

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/trash', createTrashRouter([stubAuth]));
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function stopServer(): Promise<void> {
  if (server) await new Promise<void>(r => server.close(() => r()));
}

interface CallResult<T> { status: number; body: T | null }

async function getTrash<T = unknown>(tenantId: string): Promise<CallResult<T>> {
  const res = await fetch(`${baseUrl}/api/trash`, {
    headers: { 'x-test-tenant-id': tenantId },
  });
  let body: T | null = null;
  try { body = (await res.json()) as T; } catch { body = null; }
  return { status: res.status, body };
}

async function postRestore<T = unknown>(
  tenantId: string,
  type: string,
  id: string,
): Promise<CallResult<T>> {
  const res = await fetch(`${baseUrl}/api/trash/${type}/${id}/restore`, {
    method: 'POST',
    headers: { 'x-test-tenant-id': tenantId, 'content-type': 'application/json' },
    body: '{}',
  });
  let body: T | null = null;
  try { body = (await res.json()) as T; } catch { body = null; }
  return { status: res.status, body };
}

interface TrashListResponse {
  objectives: Array<{ id: string }>;
  keyResults: Array<{ id: string }>;
  bigRocks: Array<{ id: string }>;
  strategies: Array<{ id: string }>;
  ambitions: Array<{ id: string }>;
}

interface RestoreResponse { success: boolean; item: { id: string; deletedAt: string | null } }
interface ErrorBody { error: string }

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseDeleteCascadesToKeyResults(): Promise<void> {
  console.log('\n[case a] deleteObjective sets deletedAt and cascades to its key results');

  await storage.deleteObjective(seeded.objAId);

  const [obj] = await db.select().from(objectives).where(eq(objectives.id, seeded.objAId));
  assert(!!obj && obj.deletedAt instanceof Date, 'objective.deletedAt is set');

  const krs = await db.select().from(keyResults).where(
    inArray(keyResults.id, [seeded.krA1Id, seeded.krA2Id])
  );
  assert(krs.length === 2, 'both child key results still exist (soft-delete, not hard-delete)');
  assert(krs.every(kr => kr.deletedAt instanceof Date), 'both child key results have deletedAt set');
  const parentDeletedAt = obj!.deletedAt!.getTime();
  assert(
    krs.every(kr => kr.deletedAt!.getTime() === parentDeletedAt),
    'child KRs share the parent objective deletedAt timestamp (enables cascade-restore)'
  );

  // Normal listings must hide the soft-deleted objective + its KRs.
  const liveObjs = await storage.getObjectivesByTenantId(seeded.tenantAId);
  assert(!liveObjs.some(o => o.id === seeded.objAId),
    'soft-deleted objective is hidden from getObjectivesByTenantId');
  const liveKrs = await storage.getKeyResultsByObjectiveId(seeded.objAId);
  assert(!liveKrs.some(k => k.id === seeded.krA1Id || k.id === seeded.krA2Id),
    'cascaded KRs are hidden from getKeyResultsByObjectiveId');
}

async function caseTrashRouteIsTenantScoped(): Promise<void> {
  console.log('\n[case b] GET /api/trash returns items only for the user\'s tenant');

  // Soft-delete a tenant-B item too so both tenants have trash.
  await storage.deleteObjective(seeded.objBId);

  const aRes = await getTrash<TrashListResponse>(seeded.tenantAId);
  const bRes = await getTrash<TrashListResponse>(seeded.tenantBId);
  assert(aRes.status === 200, `GET /api/trash for tenant A returns 200 (got ${aRes.status})`);
  assert(bRes.status === 200, `GET /api/trash for tenant B returns 200 (got ${bRes.status})`);

  const aObjIds = (aRes.body?.objectives ?? []).map(o => o.id);
  const bObjIds = (bRes.body?.objectives ?? []).map(o => o.id);
  assert(aObjIds.includes(seeded.objAId), 'tenant A trash includes its own deleted objective');
  assert(!aObjIds.includes(seeded.objBId), 'tenant A trash does NOT include tenant B objective');
  assert(bObjIds.includes(seeded.objBId), 'tenant B trash includes its own deleted objective');
  assert(!bObjIds.includes(seeded.objAId), 'tenant B trash does NOT include tenant A objective');

  const aKrIds = (aRes.body?.keyResults ?? []).map(k => k.id);
  const bKrIds = (bRes.body?.keyResults ?? []).map(k => k.id);
  assert(aKrIds.includes(seeded.krA1Id) && aKrIds.includes(seeded.krA2Id),
    "tenant A trash includes A's cascaded key results");
  assert(!aKrIds.includes(seeded.krBId), 'tenant A trash does NOT include tenant B KRs');
  assert(bKrIds.includes(seeded.krBId), "tenant B trash includes B's cascaded key result");
  assert(!bKrIds.includes(seeded.krA1Id) && !bKrIds.includes(seeded.krA2Id),
    'tenant B trash does NOT include tenant A KRs');

  // Missing tenant header → 400.
  const noTenantRes = await fetch(`${baseUrl}/api/trash`);
  assert(noTenantRes.status === 400,
    `GET /api/trash without tenant context returns 400 (got ${noTenantRes.status})`);
}

async function caseRouteRestoreReinstatesItem(): Promise<void> {
  console.log('\n[case c] POST /api/trash/:type/:id/restore clears deletedAt and item reappears in normal lists');

  // Restore the parent objective via the route — KRs should cascade-restore.
  const restoreRes = await postRestore<RestoreResponse>(
    seeded.tenantAId, 'objective', seeded.objAId,
  );
  assert(restoreRes.status === 200, `restore returns 200 (got ${restoreRes.status})`);
  assert(restoreRes.body?.success === true, 'restore body indicates success');
  assert(restoreRes.body?.item.deletedAt === null, 'restored item has deletedAt = null');

  // After restore: the objective is back in the normal listing.
  const liveObjs = await storage.getObjectivesByTenantId(seeded.tenantAId);
  assert(liveObjs.some(o => o.id === seeded.objAId),
    'restored objective reappears in getObjectivesByTenantId');

  // Cascade: KRs are restored and back in the normal listing.
  const liveKrs = await storage.getKeyResultsByObjectiveId(seeded.objAId);
  const liveKrIds = liveKrs.map(k => k.id);
  assert(liveKrIds.includes(seeded.krA1Id) && liveKrIds.includes(seeded.krA2Id),
    'cascaded KRs reappear in getKeyResultsByObjectiveId after parent restore');

  // After restore: trash listing no longer contains them.
  const trashAfter = await getTrash<TrashListResponse>(seeded.tenantAId);
  assert(!trashAfter.body?.objectives.some(o => o.id === seeded.objAId),
    'restored objective is gone from /api/trash');
  assert(!trashAfter.body?.keyResults.some(k => k.id === seeded.krA1Id || k.id === seeded.krA2Id),
    'restored KRs are gone from /api/trash');

  // Restore a single KR via the route (independent of parent cascade).
  await storage.deleteKeyResult(seeded.krA1Id);
  const krRestoreRes = await postRestore<RestoreResponse>(
    seeded.tenantAId, 'key-result', seeded.krA1Id,
  );
  assert(krRestoreRes.status === 200, 'KR restore via route returns 200');
  assert(krRestoreRes.body?.item.deletedAt === null, 'route returns KR with deletedAt = null');
  const liveKrsAfter = await storage.getKeyResultsByObjectiveId(seeded.objAId);
  assert(liveKrsAfter.some(k => k.id === seeded.krA1Id),
    'restored KR reappears in getKeyResultsByObjectiveId');

  // Unknown type → 400.
  const badType = await postRestore<ErrorBody>(seeded.tenantAId, 'made-up', 'xxx');
  assert(badType.status === 400, `unknown type returns 400 (got ${badType.status})`);
}

async function caseCrossTenantRestoreDenied(): Promise<void> {
  console.log('\n[case d] cross-tenant restore attempts are denied (HTTP 404)');

  await storage.deleteObjective(seeded.objA2Id);
  const [before] = await db.select().from(objectives).where(eq(objectives.id, seeded.objA2Id));
  assert(before.deletedAt instanceof Date, 'tenant A objective2 starts soft-deleted');

  // Tenant B tries to restore tenant A's row → 404 + no mutation.
  const wrongTenant = await postRestore<ErrorBody>(
    seeded.tenantBId, 'objective', seeded.objA2Id,
  );
  assert(wrongTenant.status === 404,
    `cross-tenant restore returns 404 (got ${wrongTenant.status})`);
  assert(wrongTenant.body?.error === 'Item not found in trash',
    'cross-tenant 404 does not disclose existence');

  const [after] = await db.select().from(objectives).where(eq(objectives.id, seeded.objA2Id));
  assert(after.deletedAt instanceof Date,
    'objective remains soft-deleted after cross-tenant restore attempt (no mutation)');

  // Same for KRs.
  const wrongKr = await postRestore<ErrorBody>(
    seeded.tenantBId, 'key-result', seeded.krA2OnlyId,
  );
  assert(wrongKr.status === 404, 'cross-tenant KR restore returns 404');
  const [krAfter] = await db.select().from(keyResults).where(eq(keyResults.id, seeded.krA2OnlyId));
  assert(krAfter.deletedAt instanceof Date,
    'KR remains soft-deleted after cross-tenant restore attempt (no mutation)');

  // Sanity: the rightful tenant CAN restore.
  const ok = await postRestore<RestoreResponse>(seeded.tenantAId, 'objective', seeded.objA2Id);
  assert(ok.status === 200 && ok.body?.item.deletedAt === null,
    'rightful tenant can still restore the objective');
}

async function casePurgeOnlyRemovesItemsOlderThanCutoff(): Promise<void> {
  console.log('\n[case e] purgeOldDeletedItems(30) only removes items older than the cutoff');

  const [recent] = await db.insert(objectives).values({
    tenantId: seeded.tenantAId,
    title: `purge recent ${RUN_ID}`,
    level: 'team',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  const [old] = await db.insert(objectives).values({
    tenantId: seeded.tenantAId,
    title: `purge old ${RUN_ID}`,
    level: 'team',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();

  const now = new Date();
  const longAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

  await db.update(objectives).set({ deletedAt: now }).where(eq(objectives.id, recent.id));
  await db.update(objectives).set({ deletedAt: longAgo }).where(eq(objectives.id, old.id));

  const result = await storage.purgeOldDeletedItems(30);
  assert(typeof result.objectives === 'number', 'purge result reports an objective count');
  assert(result.objectives >= 1, 'at least the back-dated objective was purged');

  const remaining = await db.select().from(objectives).where(
    inArray(objectives.id, [recent.id, old.id])
  );
  const recentRow = remaining.find(o => o.id === recent.id);
  const oldRow = remaining.find(o => o.id === old.id);
  assert(!!recentRow, 'recently-deleted objective is preserved (within retention window)');
  assert(!oldRow, 'objective deleted >30 days ago is hard-deleted from the table');

  // Cleanup.
  await db.delete(objectives).where(eq(objectives.id, recent.id));

  // ---- Saved views purge sub-case ----
  console.log('\n[case e2] purgeOldDeletedItems(30) purges saved_views older than cutoff');

  const [owner] = await db.insert(users).values({
    email: `purge_owner_${RUN_ID}@example.test`,
    password: 'x',
    name: 'Purge Owner',
    role: 'tenant_admin',
    tenantId: seeded.tenantAId,
  }).returning();

  const emptyFilter: PageFilterState = {};
  const [recentView] = await db.insert(savedViews).values({
    tenantId: seeded.tenantAId,
    ownerUserId: owner.id,
    page: 'outcomes',
    name: `recent view ${RUN_ID}`,
    filterJson: emptyFilter,
    visibility: 'private',
  }).returning();
  const [oldView] = await db.insert(savedViews).values({
    tenantId: seeded.tenantAId,
    ownerUserId: owner.id,
    page: 'outcomes',
    name: `old view ${RUN_ID}`,
    filterJson: emptyFilter,
    visibility: 'private',
  }).returning();
  const [liveView] = await db.insert(savedViews).values({
    tenantId: seeded.tenantAId,
    ownerUserId: owner.id,
    page: 'outcomes',
    name: `live view ${RUN_ID}`,
    filterJson: emptyFilter,
    visibility: 'private',
  }).returning();

  const nowSv = new Date();
  const longAgoSv = new Date(nowSv.getTime() - 31 * 24 * 60 * 60 * 1000);
  await db.update(savedViews).set({ deletedAt: nowSv }).where(eq(savedViews.id, recentView.id));
  await db.update(savedViews).set({ deletedAt: longAgoSv }).where(eq(savedViews.id, oldView.id));

  const svResult = await storage.purgeOldDeletedItems(30);
  assert(typeof svResult.savedViews === 'number', 'purge result reports a savedViews count');
  assert(svResult.savedViews >= 1, 'at least the back-dated saved view was purged');

  const remainingViews = await db.select().from(savedViews).where(
    inArray(savedViews.id, [recentView.id, oldView.id, liveView.id])
  );
  assert(remainingViews.some(v => v.id === recentView.id),
    'recently-deleted saved view is preserved (within retention window)');
  assert(!remainingViews.some(v => v.id === oldView.id),
    'saved view deleted >30 days ago is hard-deleted from the table');
  assert(remainingViews.some(v => v.id === liveView.id),
    'non-deleted saved view is untouched by purge');

  // Cleanup.
  await db.delete(savedViews).where(inArray(savedViews.id, [recentView.id, liveView.id]));
  await db.delete(users).where(eq(users.id, owner.id));
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Trash & restore regression tests');
  console.log('================================');
  try {
    await setUp();
    await startServer();
    await caseDeleteCascadesToKeyResults();
    await caseTrashRouteIsTenantScoped();
    await caseRouteRestoreReinstatesItem();
    await caseCrossTenantRestoreDenied();
    await casePurgeOnlyRemovesItemsOlderThanCutoff();
  } finally {
    try { await stopServer(); } catch (e) { console.error('stopServer error:', e); }
    try { await tearDown(); } catch (e) { console.error('tearDown error:', e); }
  }
  console.log('\n--------------------------------');
  if (failed > 0) {
    console.error(`${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('All trash & restore tests passed.');
  }
}

await main();
