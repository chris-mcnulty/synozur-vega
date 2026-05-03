/**
 * Regression tests for the /api/saved-views routes (CRUD + permissions).
 *
 * Run with:
 *   DATABASE_URL=... npx tsx server/__tests__/savedViews.test.ts
 *
 * The saved-views routes enforce:
 *   - Tenant scoping: views from another tenant are invisible (404 on
 *     fetch/edit/delete).
 *   - Private views: owner only.
 *   - Shared views: owner OR a tenant admin.
 *   - At most one default per (tenant, owner, page): toggling a new view to
 *     default unsets the previous one.
 *   - Soft-delete (deletedAt) hides the view from listings.
 *
 * The factory `createSavedViewsRouter(authMiddleware)` is mounted behind a
 * stub auth middleware that simulates an authenticated user via headers,
 * mirroring the trashAndRestore.test.ts pattern.
 *
 * Cases:
 *   1. Create + list (page filter + visibility scoping).
 *   2. Update + URL/filter JSON round-trip.
 *   3. Default toggle: only one default per (owner, page).
 *   4. Soft-delete hides the view + permission rules on delete.
 *   5. Tenant isolation: cannot fetch/edit/delete a view from another tenant.
 *   6. Private view: non-owner non-admin sees 404 on edit/delete.
 *   7. Shared view: non-owner non-admin sees 403 on edit; admin can edit.
 *   8. Validation: invalid page on POST → 400.
 */

import express, { type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'net';
import { eq, inArray } from 'drizzle-orm';

const { db, pool } = await import('../db');
const {
  tenants,
  users,
  savedViews,
} = await import('../../shared/schema');
const { ROLES } = await import('../../shared/rbac');
const { createSavedViewsRouter } = await import('../routes-saved-views');

// ---------------------------------------------------------------------------
// Tiny assertion helper.
// ---------------------------------------------------------------------------

const PASS = 'PASS';
const FAIL = 'FAIL';
let failed = 0;
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const arrA = a as unknown[]; const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((v, i) => deepEqual(v, arrB[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const ka = Object.keys(oa); const kb = Object.keys(ob);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(oa[k], ob[k]));
}

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
const TENANT_A_NAME = `__sv_test_A_${RUN_ID}`;
const TENANT_B_NAME = `__sv_test_B_${RUN_ID}`;

interface Seeded {
  tenantAId: string;
  tenantBId: string;
  aliceId: string;   // tenant A, regular user (owner)
  bobId: string;     // tenant A, regular user (non-owner)
  adminId: string;   // tenant A, tenant_admin
  carolId: string;   // tenant B, regular user
}

const seeded: Seeded = {
  tenantAId: '',
  tenantBId: '',
  aliceId: '',
  bobId: '',
  adminId: '',
  carolId: '',
};

async function setUp(): Promise<void> {
  const [tA] = await db.insert(tenants).values({ name: TENANT_A_NAME }).returning();
  const [tB] = await db.insert(tenants).values({ name: TENANT_B_NAME }).returning();
  seeded.tenantAId = tA.id;
  seeded.tenantBId = tB.id;

  const [alice] = await db.insert(users).values({
    email: `alice-${RUN_ID}@sv-test.invalid`,
    password: 'x',
    name: 'Alice',
    role: ROLES.TENANT_USER,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();
  seeded.aliceId = alice.id;

  const [bob] = await db.insert(users).values({
    email: `bob-${RUN_ID}@sv-test.invalid`,
    password: 'x',
    name: 'Bob',
    role: ROLES.TENANT_USER,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();
  seeded.bobId = bob.id;

  const [admin] = await db.insert(users).values({
    email: `admin-${RUN_ID}@sv-test.invalid`,
    password: 'x',
    name: 'Admin',
    role: ROLES.TENANT_ADMIN,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();
  seeded.adminId = admin.id;

  const [carol] = await db.insert(users).values({
    email: `carol-${RUN_ID}@sv-test.invalid`,
    password: 'x',
    name: 'Carol',
    role: ROLES.TENANT_USER,
    tenantId: tB.id,
    emailVerified: true,
  }).returning();
  seeded.carolId = carol.id;
}

async function tearDown(): Promise<void> {
  const tenantIds = [seeded.tenantAId, seeded.tenantBId].filter(Boolean);
  if (tenantIds.length === 0) return;
  // Saved views & users cascade via tenant FK.
  await db.delete(savedViews).where(inArray(savedViews.tenantId, tenantIds));
  await db.delete(users).where(inArray(users.tenantId, tenantIds));
  await db.delete(tenants).where(inArray(tenants.id, tenantIds));
  await pool.end();
}

// ---------------------------------------------------------------------------
// HTTP harness — stub auth reads identity + tenant from request headers.
// ---------------------------------------------------------------------------

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

const stubAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.header('x-test-user-id') || '';
  const role = req.header('x-test-user-role') || ROLES.TENANT_USER;
  const tenantId = req.header('x-test-tenant-id') || '';
  (req as Request & { user?: { id: string; role: string; tenantId: string } }).user = {
    id: userId,
    role,
    tenantId,
  };
  if (tenantId) req.effectiveTenantId = tenantId;
  next();
};

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/saved-views', createSavedViewsRouter([stubAuth]));
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function stopServer(): Promise<void> {
  if (server) await new Promise<void>(r => server.close(() => r()));
}

interface Actor {
  userId: string;
  role: string;
  tenantId: string;
}

const actorAlice = (): Actor => ({ userId: seeded.aliceId, role: ROLES.TENANT_USER, tenantId: seeded.tenantAId });
const actorBob = (): Actor => ({ userId: seeded.bobId, role: ROLES.TENANT_USER, tenantId: seeded.tenantAId });
const actorAdmin = (): Actor => ({ userId: seeded.adminId, role: ROLES.TENANT_ADMIN, tenantId: seeded.tenantAId });
const actorCarol = (): Actor => ({ userId: seeded.carolId, role: ROLES.TENANT_USER, tenantId: seeded.tenantBId });

function authHeaders(a: Actor): Record<string, string> {
  return {
    'x-test-user-id': a.userId,
    'x-test-user-role': a.role,
    'x-test-tenant-id': a.tenantId,
    'content-type': 'application/json',
  };
}

interface CallResult<T> { status: number; body: T | null }

async function callJson<T = unknown>(
  method: string,
  path: string,
  actor: Actor,
  body?: unknown,
): Promise<CallResult<T>> {
  const init: RequestInit = { method, headers: authHeaders(actor) };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, init);
  let parsed: T | null = null;
  if (res.status !== 204) {
    try { parsed = (await res.json()) as T; } catch { parsed = null; }
  }
  return { status: res.status, body: parsed };
}

interface SavedViewRow {
  id: string;
  tenantId: string;
  ownerUserId: string;
  page: string;
  name: string;
  filterJson: Record<string, unknown>;
  visibility: 'private' | 'shared';
  isDefault: boolean;
  deletedAt: string | null;
}
interface ErrorBody { error: string }

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const created: Record<string, string> = {};

async function caseCreateAndList(): Promise<void> {
  console.log('\n[case 1] create + list with page filter and visibility scoping');

  const filter = {
    filters: { status: ['on_track'] },
    sort: { field: 'name', direction: 'asc' as const },
    groupBy: 'owner',
    search: 'Q1',
  };

  // Alice creates a private view on outcomes.
  const r1 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorAlice(), {
    page: 'outcomes',
    name: 'Alice private outcomes',
    visibility: 'private',
    filterJson: filter,
  });
  assert(r1.status === 201, `create returns 201 (got ${r1.status})`);
  assert(r1.body?.ownerUserId === seeded.aliceId, 'ownerUserId is set from req.user (not body)');
  assert(r1.body?.tenantId === seeded.tenantAId, 'tenantId is set from req.effectiveTenantId');
  assert(r1.body?.visibility === 'private', 'visibility persisted as private');
  assert(deepEqual(r1.body?.filterJson, filter),
    'filterJson round-trips through DB unchanged');
  created.alicePrivate = r1.body!.id;

  // Alice creates a shared view on outcomes.
  const r2 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorAlice(), {
    page: 'outcomes',
    name: 'Alice shared outcomes',
    visibility: 'shared',
    filterJson: { search: 'shared' },
  });
  assert(r2.status === 201, 'shared create returns 201');
  created.aliceShared = r2.body!.id;

  // Alice creates a view on a different page (my_focus) — must not show up
  // under outcomes.
  const r3 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorAlice(), {
    page: 'my_focus',
    name: 'Alice my focus',
    visibility: 'private',
  });
  assert(r3.status === 201, 'my_focus create returns 201');
  created.aliceMyFocus = r3.body!.id;

  // Bob (same tenant) creates a private + shared view on outcomes.
  const r4 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorBob(), {
    page: 'outcomes',
    name: 'Bob private outcomes',
    visibility: 'private',
  });
  assert(r4.status === 201, 'bob private create returns 201');
  created.bobPrivate = r4.body!.id;

  const r5 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorBob(), {
    page: 'outcomes',
    name: 'Bob shared outcomes',
    visibility: 'shared',
  });
  assert(r5.status === 201, 'bob shared create returns 201');
  created.bobShared = r5.body!.id;

  // Alice lists outcomes — sees own private + own shared + Bob shared, but NOT
  // Bob private and NOT my_focus.
  const aliceList = await callJson<SavedViewRow[]>('GET', '/api/saved-views?page=outcomes', actorAlice());
  assert(aliceList.status === 200, 'list returns 200');
  const aliceIds = (aliceList.body ?? []).map(v => v.id);
  assert(aliceIds.includes(created.alicePrivate), 'list includes own private');
  assert(aliceIds.includes(created.aliceShared), 'list includes own shared');
  assert(aliceIds.includes(created.bobShared), 'list includes shared from another owner in same tenant');
  assert(!aliceIds.includes(created.bobPrivate), "list excludes another user's private view");
  assert(!aliceIds.includes(created.aliceMyFocus), 'list excludes views from other pages');
}

async function caseUpdateRoundTrip(): Promise<void> {
  console.log('\n[case 2] update preserves filterJson round-trip and respects partial fields');

  const newFilter = {
    filters: { status: ['at_risk'], owner: ['alice@example.com'] },
    sort: { field: 'updatedAt', direction: 'desc' as const },
    groupBy: 'team',
    search: 'renamed',
    custom: { url: '/outcomes?status=at_risk' },
  };

  const r = await callJson<SavedViewRow>('PATCH', `/api/saved-views/${created.alicePrivate}`, actorAlice(), {
    name: 'Alice private renamed',
    filterJson: newFilter,
  });
  assert(r.status === 200, `owner can update own private (got ${r.status})`);
  assert(r.body?.name === 'Alice private renamed', 'name updated');
  assert(deepEqual(r.body?.filterJson, newFilter),
    'filterJson round-trips on update');

  // page cannot be modified through update (omit on schema)
  const r2 = await callJson<SavedViewRow>('PATCH', `/api/saved-views/${created.alicePrivate}`, actorAlice(), {
    page: 'big_rocks',
  });
  assert(r2.status === 200, 'patch with page is accepted (page silently ignored)');
  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, created.alicePrivate));
  assert(row.page === 'outcomes', 'page is NOT changed by update');
}

async function caseDefaultToggle(): Promise<void> {
  console.log('\n[case 3] default toggle: only one default per (tenant, owner, page)');

  // Mark Alice's private outcomes view as default.
  const r1 = await callJson<SavedViewRow>('PATCH', `/api/saved-views/${created.alicePrivate}`, actorAlice(), {
    isDefault: true,
  });
  assert(r1.status === 200, 'first default set returns 200');
  assert(r1.body?.isDefault === true, 'isDefault is true after toggle');

  // Now mark Alice's shared outcomes view as default — the private one must
  // be cleared.
  const r2 = await callJson<SavedViewRow>('PATCH', `/api/saved-views/${created.aliceShared}`, actorAlice(), {
    isDefault: true,
  });
  assert(r2.status === 200, 'second default set returns 200');
  assert(r2.body?.isDefault === true, 'newly toggled view is default');

  const [prev] = await db.select().from(savedViews).where(eq(savedViews.id, created.alicePrivate));
  assert(prev.isDefault === false, 'previous default is cleared (single default per page+owner)');

  const [curr] = await db.select().from(savedViews).where(eq(savedViews.id, created.aliceShared));
  assert(curr.isDefault === true, 'new default persists');
}

async function caseSoftDeleteHidesFromList(): Promise<void> {
  console.log('\n[case 4] soft-delete hides the view from list and clears default');

  // Bob soft-deletes his shared view (he is the owner).
  const r = await callJson<null>('DELETE', `/api/saved-views/${created.bobShared}`, actorBob());
  assert(r.status === 204, `owner can delete own shared (got ${r.status})`);

  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, created.bobShared));
  assert(row.deletedAt instanceof Date, 'deletedAt is set on the row');
  assert(row.isDefault === false, 'soft-delete clears isDefault');

  const list = await callJson<SavedViewRow[]>('GET', '/api/saved-views?page=outcomes', actorAlice());
  const ids = (list.body ?? []).map(v => v.id);
  assert(!ids.includes(created.bobShared), 'soft-deleted view is hidden from list');

  // PATCH/DELETE on a soft-deleted view returns 404.
  const r2 = await callJson<ErrorBody>('PATCH', `/api/saved-views/${created.bobShared}`, actorBob(), { name: 'x' });
  assert(r2.status === 404, 'patch on soft-deleted view returns 404');
  const r3 = await callJson<null>('DELETE', `/api/saved-views/${created.bobShared}`, actorBob());
  assert(r3.status === 404, 'delete on soft-deleted view returns 404');
}

async function caseTenantIsolation(): Promise<void> {
  console.log('\n[case 5] tenant isolation: views from another tenant are invisible');

  // Carol creates a view in tenant B.
  const r0 = await callJson<SavedViewRow>('POST', '/api/saved-views', actorCarol(), {
    page: 'outcomes',
    name: 'Carol shared outcomes',
    visibility: 'shared',
  });
  assert(r0.status === 201, 'carol create returns 201');
  const carolViewId = r0.body!.id;

  // Alice (tenant A) cannot see/patch/delete it.
  const aliceList = await callJson<SavedViewRow[]>('GET', '/api/saved-views?page=outcomes', actorAlice());
  const ids = (aliceList.body ?? []).map(v => v.id);
  assert(!ids.includes(carolViewId), 'tenant A list excludes tenant B views');

  const patch = await callJson<ErrorBody>('PATCH', `/api/saved-views/${carolViewId}`, actorAlice(), { name: 'hax' });
  assert(patch.status === 404, 'cross-tenant patch returns 404');

  const del = await callJson<ErrorBody>('DELETE', `/api/saved-views/${carolViewId}`, actorAlice());
  assert(del.status === 404, 'cross-tenant delete returns 404');

  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, carolViewId));
  assert(row.name === 'Carol shared outcomes' && !row.deletedAt,
    'cross-tenant attempts did not mutate the row');
}

async function casePrivatePermissions(): Promise<void> {
  console.log('\n[case 6] private view: non-owner non-admin gets 404 on edit/delete');

  // Bob attempts to patch Alice's private view.
  const r1 = await callJson<ErrorBody>('PATCH', `/api/saved-views/${created.alicePrivate}`, actorBob(), {
    name: 'Bob hijack',
  });
  assert(r1.status === 404, 'non-owner non-admin patch on private → 404');

  const r2 = await callJson<ErrorBody>('DELETE', `/api/saved-views/${created.alicePrivate}`, actorBob());
  assert(r2.status === 404, 'non-owner non-admin delete on private → 404');

  // Even tenant admin cannot edit a PRIVATE view they don't own (private = owner only).
  const r3 = await callJson<ErrorBody>('PATCH', `/api/saved-views/${created.alicePrivate}`, actorAdmin(), {
    name: 'Admin private hijack',
  });
  assert(r3.status === 404, 'tenant admin patch on private (non-owner) → 404');

  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, created.alicePrivate));
  assert(row.name === 'Alice private renamed', 'private view unchanged after non-owner attempts');
}

async function caseSharedPermissions(): Promise<void> {
  console.log('\n[case 7] shared view: non-owner non-admin gets 403; admin can edit');

  // Bob (regular user, not owner) tries to edit Alice's shared view → 403.
  const r1 = await callJson<ErrorBody>('PATCH', `/api/saved-views/${created.aliceShared}`, actorBob(), {
    name: 'Bob shared hijack',
  });
  assert(r1.status === 403, `non-owner non-admin patch on shared → 403 (got ${r1.status})`);
  assert(typeof r1.body?.error === 'string' && r1.body.error.includes('admin'),
    '403 body explains admin/creator-only rule');

  const r2 = await callJson<ErrorBody>('DELETE', `/api/saved-views/${created.aliceShared}`, actorBob());
  assert(r2.status === 403, 'non-owner non-admin delete on shared → 403');

  // Tenant admin CAN edit a shared view they don't own.
  const r3 = await callJson<SavedViewRow>('PATCH', `/api/saved-views/${created.aliceShared}`, actorAdmin(), {
    name: 'Renamed by tenant admin',
  });
  assert(r3.status === 200, `tenant admin patch on shared returns 200 (got ${r3.status})`);
  assert(r3.body?.name === 'Renamed by tenant admin', 'tenant admin successfully renamed shared view');

  // Tenant admin CAN delete a shared view they don't own.
  const r4 = await callJson<null>('DELETE', `/api/saved-views/${created.aliceShared}`, actorAdmin());
  assert(r4.status === 204, 'tenant admin delete on shared returns 204');
  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, created.aliceShared));
  assert(row.deletedAt instanceof Date, 'tenant-admin delete soft-deletes the row');
}

async function caseValidation(): Promise<void> {
  console.log('\n[case 8] validation: bad page parameter / body returns 400');

  // List with invalid page → 400.
  const list = await callJson<ErrorBody>('GET', '/api/saved-views?page=not_a_page', actorAlice());
  assert(list.status === 400, `list with bad page → 400 (got ${list.status})`);

  // List with no page → 400.
  const noPage = await callJson<ErrorBody>('GET', '/api/saved-views', actorAlice());
  assert(noPage.status === 400, 'list without page → 400');

  // Create with invalid page enum → 400 (Zod issues).
  const create = await callJson<{ error: string; issues: unknown }>('POST', '/api/saved-views', actorAlice(), {
    page: 'made_up_page',
    name: 'should fail',
  });
  assert(create.status === 400, `create with bad page → 400 (got ${create.status})`);
  assert(create.body?.error === 'Validation failed', 'create returns Validation failed');

  // Create with empty name → 400.
  const emptyName = await callJson<ErrorBody>('POST', '/api/saved-views', actorAlice(), {
    page: 'outcomes',
    name: '   ',
  });
  assert(emptyName.status === 400, 'create with empty name → 400');
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Saved Views API tests');
  console.log('=====================');
  try {
    await setUp();
    await startServer();
    await caseCreateAndList();
    await caseUpdateRoundTrip();
    await caseDefaultToggle();
    await caseSoftDeleteHidesFromList();
    await caseTenantIsolation();
    await casePrivatePermissions();
    await caseSharedPermissions();
    await caseValidation();
  } finally {
    try { await stopServer(); } catch (e) { console.error('stopServer error:', e); }
    try { await tearDown(); } catch (e) { console.error('tearDown error:', e); }
  }
  console.log('\n---------------------');
  if (failed > 0) {
    console.error(`${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('All saved views tests passed.');
  }
}

await main();
