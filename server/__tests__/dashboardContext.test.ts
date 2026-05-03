/**
 * Server-side tests for the combined dashboard endpoint
 * (`GET /api/dashboard/context`).
 *
 * Run with:
 *   npx tsx server/__tests__/dashboardContext.test.ts
 *
 * The project does not configure a unit-test runner, so this file is a
 * runnable tsx script (matching the pattern in galaxyPortal.test.ts).
 *
 * The dashboard endpoint reads from `server/storage.ts`'s singleton. The
 * tests below replace the methods the route consumes with deterministic
 * in-memory stubs so the suite does not depend on the database schema or
 * any seeded rows. This keeps the test focused on the *router* contract:
 *
 *   - authentication is required
 *   - a tenant is required (header for cross-tenant users)
 *   - scope=company / executive / team affect what is returned
 *   - teamId filters bigRocks (and therefore bigRockTaskCounts)
 *   - quarter / year are forwarded to the storage layer
 *   - scope=executive includes check-ins; company / team do NOT
 *
 * The end of the file runs a single smoke test asserting that for each
 * scope the response contains every field the matching dashboard page
 * (Dashboard.tsx / ExecutiveDashboard.tsx / TeamDashboard.tsx) reads.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'net';
import type {
  Foundation,
  Strategy,
  Team,
  Objective,
  KeyResult,
  BigRock,
  Meeting,
  CheckIn,
  User,
  Tenant,
} from '../../shared/schema';

const { storage } = await import('../storage');
const { dashboardRouter } = await import('../routes-dashboard');
const { loadCurrentUser, requireTenantAccess } = await import('../middleware/rbac');
const { ROLES } = await import('../../shared/rbac');

// ---------------------------------------------------------------------------
// Tiny assertion helper.
// ---------------------------------------------------------------------------

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  FAIL ${msg}`);
    failed += 1;
    process.exitCode = 1;
  } else {
    console.log(`  PASS ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Fixture data — fully in-memory.
// ---------------------------------------------------------------------------

const TENANT_A_ID = 'tenant-A';
const TEAM_X_ID = 'team-X';
const TEAM_Y_ID = 'team-Y';

const REGULAR_USER_ID = 'user-regular';
const ADMIN_USER_ID = 'user-vega-admin';

const fakeUsers: Record<string, User> = {
  [REGULAR_USER_ID]: {
    id: REGULAR_USER_ID,
    email: 'regular@test.invalid',
    name: 'Regular User',
    role: ROLES.TENANT_USER,
    tenantId: TENANT_A_ID,
  } as unknown as User,
  [ADMIN_USER_ID]: {
    id: ADMIN_USER_ID,
    email: 'admin@test.invalid',
    name: 'Vega Admin',
    role: ROLES.VEGA_ADMIN,
    tenantId: null,
  } as unknown as User,
};

const fakeTenant: Tenant = {
  id: TENANT_A_ID,
  name: 'Tenant A',
} as unknown as Tenant;

const fakeFoundation: Foundation = {
  id: 'f1',
  tenantId: TENANT_A_ID,
  // Mixed annualGoals (string + missing year) to exercise migrateAnnualGoals.
  annualGoals: [
    'legacy-string-goal',
    { title: 'goal-no-year', description: '' },
    { title: 'goal-with-year', year: 2024, description: '' },
  ],
} as unknown as Foundation;

function makeObjective(id: string, opts: Partial<Objective> = {}): Objective {
  return {
    id,
    tenantId: TENANT_A_ID,
    title: id,
    level: 'team',
    quarter: 1,
    year: 2025,
    teamId: null,
    ...opts,
  } as unknown as Objective;
}

function makeBigRock(id: string, teamId: string | null): BigRock {
  return {
    id,
    tenantId: TENANT_A_ID,
    title: id,
    quarter: 1,
    year: 2025,
    teamId,
  } as unknown as BigRock;
}

const allBigRocks: BigRock[] = [
  makeBigRock('br-x1', TEAM_X_ID),
  makeBigRock('br-x2', TEAM_X_ID),
  makeBigRock('br-y1', TEAM_Y_ID),
  makeBigRock('br-no-team', null),
];

const taskCounts = new Map<string, { total: number; completed: number }>([
  ['br-x1', { total: 3, completed: 1 }],
  ['br-x2', { total: 2, completed: 2 }],
  ['br-y1', { total: 5, completed: 0 }],
  ['br-no-team', { total: 1, completed: 1 }],
]);

const fakeCheckIns: CheckIn[] = [
  { id: 'ci-1', tenantId: TENANT_A_ID } as unknown as CheckIn,
];

// Track the args passed into storage methods so the tests can verify
// query forwarding (quarter / year / teamId).
interface CallLog {
  getObjectivesByTenantId: unknown[][];
  getKeyResultsByTenantId: unknown[][];
  getBigRocksByTenantId: unknown[][];
  getBigRockTaskCountsByBigRockIds: string[][];
  getCheckInsByTenantId: string[];
}
let calls: CallLog;
function resetCalls() {
  calls = {
    getObjectivesByTenantId: [],
    getKeyResultsByTenantId: [],
    getBigRocksByTenantId: [],
    getBigRockTaskCountsByBigRockIds: [],
    getCheckInsByTenantId: [],
  };
}
resetCalls();

// ---------------------------------------------------------------------------
// Stub the singleton storage methods used by the dashboard route + the auth
// middleware chain. Originals are saved and restored at the end.
// ---------------------------------------------------------------------------

type AnyFn = (...args: unknown[]) => unknown;
const originals: Record<string, AnyFn> = {};
function stub(name: string, fn: AnyFn): void {
  const s = storage as unknown as Record<string, AnyFn>;
  originals[name] = s[name];
  s[name] = fn;
}
function restoreAll(): void {
  const s = storage as unknown as Record<string, AnyFn>;
  for (const k of Object.keys(originals)) s[k] = originals[k];
}

stub('getUser', async (id: unknown) => fakeUsers[id as string]);
stub('getTenantById', async (id: unknown) =>
  id === TENANT_A_ID ? fakeTenant : undefined,
);
stub('hasConsultantAccess', async () => false);
stub('isUserReadOnly', async () => false);

stub('getFoundationByTenantId', async () => fakeFoundation);
stub('getStrategiesByTenantId', async () => [] as Strategy[]);
stub('getTeamsByTenantId', async () => [
  { id: TEAM_X_ID, tenantId: TENANT_A_ID, name: 'X' } as unknown as Team,
  { id: TEAM_Y_ID, tenantId: TENANT_A_ID, name: 'Y' } as unknown as Team,
]);
stub('getObjectivesByTenantId', async (...args: unknown[]) => {
  calls.getObjectivesByTenantId.push(args);
  return [makeObjective('obj-1')];
});
stub('getKeyResultsByTenantId', async (...args: unknown[]) => {
  calls.getKeyResultsByTenantId.push(args);
  return [{ id: 'kr-1', tenantId: TENANT_A_ID } as unknown as KeyResult];
});
stub('getBigRocksByTenantId', async (...args: unknown[]) => {
  calls.getBigRocksByTenantId.push(args);
  return allBigRocks;
});
stub('getBigRockTaskCountsByBigRockIds', async (ids: unknown) => {
  calls.getBigRockTaskCountsByBigRockIds.push(ids as string[]);
  const out = new Map<string, { total: number; completed: number }>();
  for (const id of ids as string[]) {
    const v = taskCounts.get(id);
    if (v) out.set(id, v);
  }
  return out;
});
stub('getMeetingsByTenantId', async () => [] as Meeting[]);
stub('getCheckInsByTenantId', async (tenantId: unknown) => {
  calls.getCheckInsByTenantId.push(tenantId as string);
  return fakeCheckIns;
});

// ---------------------------------------------------------------------------
// Build a tiny Express app that mirrors the production mount, but injects a
// session via the `x-test-user-id` header so we don't need a real session
// store.
// ---------------------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Mirrors the inline middleware in server/routes.ts.
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function testSession(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-test-user-id'];
  // Cast through unknown: express-session augments the Request type at
  // runtime; for tests we only need .userId.
  (req as unknown as { session: { userId?: string } }).session = {
    userId: typeof id === 'string' ? id : undefined,
  };
  next();
}

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(testSession);
  app.use(
    '/api/dashboard',
    requireAuth,
    loadCurrentUser,
    requireTenantAccess,
    dashboardRouter,
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function stopServer(): Promise<void> {
  if (server) await new Promise<void>((r) => server.close(() => r()));
}

interface CallResult<T> {
  status: number;
  body: T | null;
}

async function get<T>(
  path: string,
  opts: { userId?: string; tenantId?: string } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.userId) headers['x-test-user-id'] = opts.userId;
  if (opts.tenantId) headers['x-tenant-id'] = opts.tenantId;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Response shape (used to type test bodies — not exhaustive).
// ---------------------------------------------------------------------------

interface DashboardContextResponse {
  scope: 'company' | 'executive' | 'team';
  tenantId: string;
  teamId: string | null;
  quarter: number | null;
  year: number | null;
  foundation: { annualGoals: Array<{ title: string; year: number }> } | null;
  strategies: unknown[];
  teams: Array<{ id: string }>;
  objectives: Array<{ id: string }>;
  keyResults: Array<{ id: string }>;
  bigRocks: Array<{ id: string; teamId: string | null }>;
  bigRockTaskCounts: Record<string, { total: number; completed: number }>;
  meetings: unknown[];
  checkIns: Array<{ id: string }>;
}
interface ErrorBody {
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseAuthRequired(): Promise<void> {
  console.log('\n[case 1] no session → 401 authentication required');
  const res = await get<ErrorBody>('/api/dashboard/context');
  assert(res.status === 401, `unauthenticated returns 401 (got ${res.status})`);
  assert(
    res.body?.error === 'Authentication required',
    'returns Authentication required error',
  );
}

async function caseTenantHeaderRequiredForMultiTenantUser(): Promise<void> {
  console.log(
    '\n[case 2] vega_admin without x-tenant-id and no home tenant → 400',
  );
  const res = await get<ErrorBody>('/api/dashboard/context', {
    userId: ADMIN_USER_ID,
  });
  assert(res.status === 400, `expected 400 got ${res.status}`);
  assert(
    res.body?.error === 'Tenant selection required',
    'returns Tenant selection required',
  );
}

async function caseScopeCompany(): Promise<void> {
  console.log('\n[case 3] scope=company returns no checkIns');
  resetCalls();
  const res = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company&quarter=1&year=2025',
    { userId: REGULAR_USER_ID },
  );
  assert(res.status === 200, `expected 200 got ${res.status}`);
  assert(res.body?.scope === 'company', 'scope echoed as company');
  assert(res.body?.tenantId === TENANT_A_ID, 'tenantId echoed from context');
  assert(res.body?.quarter === 1, 'quarter echoed');
  assert(res.body?.year === 2025, 'year echoed');
  assert(
    Array.isArray(res.body?.checkIns) && res.body!.checkIns.length === 0,
    'company scope omits check-ins',
  );
  assert(
    calls.getCheckInsByTenantId.length === 0,
    'storage.getCheckInsByTenantId is NOT called for company scope',
  );
  // bigRocks should NOT be filtered when no teamId is supplied.
  assert(res.body?.bigRocks.length === allBigRocks.length, 'all big rocks returned when teamId not supplied');
  assert(
    Object.keys(res.body?.bigRockTaskCounts ?? {}).length === allBigRocks.length,
    'task counts include every returned big rock',
  );
}

async function caseScopeExecutiveIncludesCheckIns(): Promise<void> {
  console.log('\n[case 4] scope=executive includes checkIns');
  resetCalls();
  const res = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=executive',
    { userId: REGULAR_USER_ID },
  );
  assert(res.status === 200, `expected 200 got ${res.status}`);
  assert(res.body?.scope === 'executive', 'scope echoed as executive');
  assert(
    Array.isArray(res.body?.checkIns) && res.body!.checkIns.length === 1,
    'executive scope returns check-ins',
  );
  assert(
    calls.getCheckInsByTenantId.length === 1 &&
      calls.getCheckInsByTenantId[0] === TENANT_A_ID,
    'storage.getCheckInsByTenantId called with tenantId once',
  );
}

async function caseScopeTeamOmitsCheckIns(): Promise<void> {
  console.log('\n[case 5] scope=team omits checkIns');
  resetCalls();
  const res = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=team',
    { userId: REGULAR_USER_ID },
  );
  assert(res.status === 200, `expected 200 got ${res.status}`);
  assert(res.body?.scope === 'team', 'scope echoed as team');
  assert(
    Array.isArray(res.body?.checkIns) && res.body!.checkIns.length === 0,
    'team scope omits check-ins',
  );
  assert(
    calls.getCheckInsByTenantId.length === 0,
    'storage.getCheckInsByTenantId NOT called for team scope',
  );
}

async function caseTeamIdFiltersBigRocksAndTaskCounts(): Promise<void> {
  console.log(
    '\n[case 6] teamId filters bigRocks and limits bigRockTaskCounts',
  );
  resetCalls();
  const res = await get<DashboardContextResponse>(
    `/api/dashboard/context?scope=team&teamId=${TEAM_X_ID}`,
    { userId: REGULAR_USER_ID },
  );
  assert(res.status === 200, `expected 200 got ${res.status}`);
  assert(res.body?.teamId === TEAM_X_ID, 'teamId echoed in response');
  const ids = (res.body?.bigRocks ?? []).map((b) => b.id).sort();
  assert(
    JSON.stringify(ids) === JSON.stringify(['br-x1', 'br-x2']),
    `bigRocks filtered to team X (got ${JSON.stringify(ids)})`,
  );
  assert(
    res.body?.bigRocks.every((b) => b.teamId === TEAM_X_ID) === true,
    'every returned big rock belongs to team X',
  );
  const countKeys = Object.keys(res.body?.bigRockTaskCounts ?? {}).sort();
  assert(
    JSON.stringify(countKeys) === JSON.stringify(['br-x1', 'br-x2']),
    'bigRockTaskCounts limited to filtered ids',
  );
  // teamId is forwarded to objectives/key-results/storage.
  const objArgs = calls.getObjectivesByTenantId[0];
  assert(
    objArgs[0] === TENANT_A_ID && objArgs[4] === TEAM_X_ID,
    'getObjectivesByTenantId receives tenantId + teamId',
  );
  const krArgs = calls.getKeyResultsByTenantId[0];
  assert(
    krArgs[0] === TENANT_A_ID && krArgs[3] === TEAM_X_ID,
    'getKeyResultsByTenantId receives tenantId + teamId',
  );
  // Task counts should only be queried for the filtered ids, not the full set.
  const fetched = calls.getBigRockTaskCountsByBigRockIds[0] ?? [];
  assert(
    fetched.length === 2 && fetched.every((id) => id.startsWith('br-x')),
    `task counts queried only for filtered big rocks (got ${JSON.stringify(fetched)})`,
  );
}

async function caseQuarterAndYearForwarded(): Promise<void> {
  console.log('\n[case 7] quarter / year are forwarded to storage');
  resetCalls();
  const res = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company&quarter=3&year=2024',
    { userId: REGULAR_USER_ID },
  );
  assert(res.status === 200, '200 OK');
  assert(res.body?.quarter === 3 && res.body?.year === 2024, 'echoed quarter/year');
  const objArgs = calls.getObjectivesByTenantId[0];
  assert(objArgs[1] === 3 && objArgs[2] === 2024, 'objectives receive quarter=3 year=2024');
  const brArgs = calls.getBigRocksByTenantId[0];
  assert(brArgs[1] === 3 && brArgs[2] === 2024, 'big rocks receive quarter=3 year=2024');

  // "all" / empty quarter is treated as undefined and not forwarded.
  resetCalls();
  await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company&quarter=all',
    { userId: REGULAR_USER_ID },
  );
  const args2 = calls.getObjectivesByTenantId[0];
  assert(args2[1] === undefined, "quarter='all' is not forwarded");

  // Out-of-range quarter is rejected and not forwarded.
  resetCalls();
  await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company&quarter=99&year=2025',
    { userId: REGULAR_USER_ID },
  );
  const args3 = calls.getObjectivesByTenantId[0];
  assert(args3[1] === undefined, 'out-of-range quarter is dropped');
}

async function caseAnnualGoalsMigration(): Promise<void> {
  console.log('\n[case 8] foundation.annualGoals is migrated to objects-with-year');
  const res = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company',
    { userId: REGULAR_USER_ID },
  );
  const goals = res.body?.foundation?.annualGoals ?? [];
  assert(goals.length === 3, 'all annual goals are returned');
  for (const g of goals) {
    assert(typeof g.year === 'number', `migrated goal has numeric year (${JSON.stringify(g)})`);
    assert(typeof g.title === 'string' && g.title.length > 0, 'migrated goal has a title string');
  }
}

async function caseSmokeAllThreeDashboards(): Promise<void> {
  console.log(
    '\n[case 9] smoke: each scope returns every field its dashboard page consumes',
  );
  // Dashboard.tsx (scope=company): foundation, strategies, teams, objectives, bigRocks, meetings.
  const company = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=company&quarter=1&year=2025',
    { userId: REGULAR_USER_ID },
  );
  for (const f of ['foundation', 'strategies', 'teams', 'objectives', 'bigRocks', 'meetings']) {
    assert(
      Object.prototype.hasOwnProperty.call(company.body ?? {}, f),
      `Dashboard scope=company response has '${f}'`,
    );
  }

  // ExecutiveDashboard.tsx (scope=executive): foundation, teams, objectives, keyResults,
  // bigRocks, bigRockTaskCounts, checkIns.
  const exec = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=executive&quarter=1&year=2025',
    { userId: REGULAR_USER_ID },
  );
  for (const f of [
    'foundation',
    'teams',
    'objectives',
    'keyResults',
    'bigRocks',
    'bigRockTaskCounts',
    'checkIns',
  ]) {
    assert(
      Object.prototype.hasOwnProperty.call(exec.body ?? {}, f),
      `ExecutiveDashboard scope=executive response has '${f}'`,
    );
  }
  assert((exec.body?.checkIns ?? []).length > 0, 'executive scope smoke: check-ins populated');

  // TeamDashboard.tsx (scope=team): foundation, strategies, teams, objectives, keyResults,
  // bigRocks, bigRockTaskCounts.
  const team = await get<DashboardContextResponse>(
    '/api/dashboard/context?scope=team&year=2025',
    { userId: REGULAR_USER_ID },
  );
  for (const f of [
    'foundation',
    'strategies',
    'teams',
    'objectives',
    'keyResults',
    'bigRocks',
    'bigRockTaskCounts',
  ]) {
    assert(
      Object.prototype.hasOwnProperty.call(team.body ?? {}, f),
      `TeamDashboard scope=team response has '${f}'`,
    );
  }
  assert((team.body?.checkIns ?? []).length === 0, 'team scope smoke: no check-ins');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('Dashboard /context endpoint tests');
  await startServer();
  try {
    await caseAuthRequired();
    await caseTenantHeaderRequiredForMultiTenantUser();
    await caseScopeCompany();
    await caseScopeExecutiveIncludesCheckIns();
    await caseScopeTeamOmitsCheckIns();
    await caseTeamIdFiltersBigRocksAndTaskCounts();
    await caseQuarterAndYearForwarded();
    await caseAnnualGoalsMigration();
    await caseSmokeAllThreeDashboards();
  } finally {
    await stopServer();
    restoreAll();
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('\nAll dashboard /context tests passed');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
