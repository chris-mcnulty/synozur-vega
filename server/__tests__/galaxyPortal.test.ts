/**
 * End-to-end tests for the Galaxy Portal trust boundary.
 *
 * Run with:
 *   DATABASE_URL=... npx tsx server/__tests__/galaxyPortal.test.ts
 *
 * The Galaxy Portal exposes /api/portal/* to Galaxy-issued JWTs. Because the
 * project does not configure a unit-test runner, this file is a runnable tsx
 * script that:
 *
 *   1. Sets Galaxy env vars + a small per-tenant rate limit before importing
 *      the middleware (both are read at module load).
 *   2. Generates an RSA keypair locally and passes it (along with a no-op
 *      SSRF guard) into `validateGalaxyJwt` via its dependency-injection
 *      argument. No mutable hooks are exported from the production validator.
 *   3. Builds an isolated portal router with `createPortalRouter(testAuthMw)`
 *      so the production `requirePortalAuth` (and `validateGalaxyJwt` defaults)
 *      are never called during the test.
 *   4. Seeds two tenants ("A" and "B", plus a third with galaxy_enabled=false)
 *      with objectives / key-results / big rocks / check-ins owned by distinct
 *      emails, then exercises every branch of the trust boundary via fetch().
 *
 * Cases:
 *   1. Valid token → 200, /me + /dashboard return tenant-A-scoped data.
 *   2. Invalid signature → 401.
 *   3. Mismatched issuer → 401.
 *   4. galaxy_enabled=false → 401.
 *   5. Cross-tenant isolation: token resolved to A never sees B's rows.
 *   6. Rate limit exceeded → 429 with Retry-After + X-RateLimit headers.
 *   7. JIT provisioning: portal_user is created on first request only.
 */

// ---- Env setup must run before any module under test is imported -----------
process.env.GALAXY_ISSUER = 'https://galaxy-test.synozur.invalid/';
process.env.GALAXY_AUDIENCE = 'vega-portal-test';
process.env.GALAXY_JWKS_URI = 'https://galaxy-test.synozur.invalid/.well-known/jwks.json';
const RATE_LIMIT_PER_MINUTE = 20;
process.env.PORTAL_RATE_LIMIT_PER_MINUTE = String(RATE_LIMIT_PER_MINUTE);
const WRITE_RATE_LIMIT_PER_MINUTE = 20;
process.env.PORTAL_WRITE_RATE_LIMIT_PER_MINUTE = String(WRITE_RATE_LIMIT_PER_MINUTE);

// IMPORTANT: every server module is loaded via dynamic import below so the
// env vars set above are observed at module-load time (DEFAULT_ISSUER /
// DEFAULT_JWKS_URI in galaxy-jwt and RATE_LIMIT_PER_WINDOW in middleware are
// read once at module load).
import { generateKeyPairSync, type JsonWebKey } from 'crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import type { AddressInfo } from 'net';
import { eq, inArray } from 'drizzle-orm';

const { db, pool } = await import('../db');
const {
  tenants,
  users,
  objectives,
  keyResults,
  bigRocks,
  checkIns,
  portalAuditLogs,
} = await import('../../shared/schema');
const { ROLES } = await import('../../shared/rbac');
const { validateGalaxyJwt } = await import('../portal/galaxy-jwt');
const { createRequirePortalAuth } = await import('../portal/middleware');
const { createPortalRouter } = await import('../routes-portal');

// ---------------------------------------------------------------------------
// Tiny assertion helper. Booleans only — no `any` widening.
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
// Crypto + JWT helpers
// ---------------------------------------------------------------------------

const { privateKey: PRIV_A, publicKey: PUB_A } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const PRIV_A_PEM = PRIV_A.export({ format: 'pem', type: 'pkcs8' }) as string;
const PUB_A_PEM = PUB_A.export({ format: 'pem', type: 'spki' }) as string;
// Acknowledge unused variable so tsc doesn't trip on noUnusedLocals.
void (PUB_A as unknown as JsonWebKey);

// A second keypair used only to sign the "invalid signature" token. The
// validator will still try to verify against PUB_A_PEM and reject it.
const { privateKey: PRIV_B } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIV_B_PEM = PRIV_B.export({ format: 'pem', type: 'pkcs8' }) as string;

interface SignOpts {
  issuer?: string;
  audience?: string;
  clientId?: string;
  sub?: string;
  email?: string;
  name?: string;
  privateKeyPem?: string;
}

function signToken(opts: SignOpts): string {
  const payload: Record<string, unknown> = {
    iss: opts.issuer ?? process.env.GALAXY_ISSUER,
    aud: opts.audience ?? process.env.GALAXY_AUDIENCE,
    sub: opts.sub ?? 'galaxy-sub-default',
    client_id: opts.clientId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  if (opts.email) payload.email = opts.email;
  if (opts.name) payload.name = opts.name;
  return jwt.sign(payload, opts.privateKeyPem ?? PRIV_A_PEM, {
    algorithm: 'RS256',
    header: { alg: 'RS256', kid: 'test-kid-1' },
  });
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TENANT_A_NAME = `__galaxy_test_A_${RUN_ID}`;
const TENANT_B_NAME = `__galaxy_test_B_${RUN_ID}`;
const TENANT_DISABLED_NAME = `__galaxy_test_D_${RUN_ID}`;
const CLIENT_A = `galaxy-client-A-${RUN_ID}`;
const CLIENT_B = `galaxy-client-B-${RUN_ID}`;
const CLIENT_DISABLED = `galaxy-client-D-${RUN_ID}`;

const PORTAL_EMAIL_A = `alice-${RUN_ID}@portal-test.invalid`;
const PORTAL_EMAIL_B = `bob-${RUN_ID}@portal-test.invalid`;
const SUB_A = `galaxy-sub-alice-${RUN_ID}`;
const SUB_B = `galaxy-sub-bob-${RUN_ID}`;
const SUB_FRESH = `galaxy-sub-fresh-${RUN_ID}`;

const seeded = {
  tenantAId: '',
  tenantBId: '',
  tenantDisabledId: '',
  objectiveAId: '',
  objectiveBId: '',
  krAId: '',
  bigRockAId: '',
  checkInAId: '',
};

async function setUp(): Promise<void> {
  const [tA] = await db.insert(tenants).values({
    name: TENANT_A_NAME,
    galaxyClientId: CLIENT_A,
    galaxyEnabled: true,
  }).returning();
  const [tB] = await db.insert(tenants).values({
    name: TENANT_B_NAME,
    galaxyClientId: CLIENT_B,
    galaxyEnabled: true,
  }).returning();
  const [tD] = await db.insert(tenants).values({
    name: TENANT_DISABLED_NAME,
    galaxyClientId: CLIENT_DISABLED,
    galaxyEnabled: false,
  }).returning();
  seeded.tenantAId = tA.id;
  seeded.tenantBId = tB.id;
  seeded.tenantDisabledId = tD.id;

  const [objA] = await db.insert(objectives).values({
    tenantId: tA.id,
    title: `A objective ${RUN_ID}`,
    level: 'team',
    ownerEmail: PORTAL_EMAIL_A,
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.objectiveAId = objA.id;

  // A second objective in tenant A NOT owned by Alice — should be filtered
  // out by ownership even within her own tenant.
  await db.insert(objectives).values({
    tenantId: tA.id,
    title: `A objective other ${RUN_ID}`,
    level: 'team',
    ownerEmail: 'someone-else@portal-test.invalid',
    quarter: 1,
    year: 2025,
    status: 'on_track',
  });

  const [krA] = await db.insert(keyResults).values({
    tenantId: tA.id,
    objectiveId: objA.id,
    title: `A KR ${RUN_ID}`,
    metricType: 'increase',
    targetValue: 100,
    status: 'on_track',
  }).returning();
  seeded.krAId = krA.id;

  const [brA] = await db.insert(bigRocks).values({
    tenantId: tA.id,
    title: `A bigrock ${RUN_ID}`,
    ownerEmail: PORTAL_EMAIL_A,
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.bigRockAId = brA.id;

  // A Vega user row to satisfy check_ins.user_id NOT NULL FK. Not linked to
  // the Galaxy email; the check-in is visible only via entity-ownership.
  const [authorUser] = await db.insert(users).values({
    email: `author-${RUN_ID}@portal-test.invalid`,
    password: 'x',
    name: 'Author',
    role: ROLES.TENANT_USER,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();

  const [ciA] = await db.insert(checkIns).values({
    tenantId: tA.id,
    entityType: 'objective',
    entityId: objA.id,
    userId: authorUser.id,
    userEmail: authorUser.email,
    note: 'A check-in',
    previousProgress: 0,
    newProgress: 10,
    previousValue: 0,
    newValue: 10,
    confidence: 0.7,
  }).returning();
  seeded.checkInAId = ciA.id;

  // Tenant B parallel objective owned by PORTAL_EMAIL_A. If the trust
  // boundary leaks, Alice's tenant-A token would see this row.
  const [objB] = await db.insert(objectives).values({
    tenantId: tB.id,
    title: `B objective ${RUN_ID}`,
    level: 'team',
    ownerEmail: PORTAL_EMAIL_A,
    quarter: 1,
    year: 2025,
    status: 'on_track',
  }).returning();
  seeded.objectiveBId = objB.id;
}

async function tearDown(): Promise<void> {
  const ids = [seeded.tenantAId, seeded.tenantBId, seeded.tenantDisabledId].filter(Boolean);
  if (ids.length) {
    await db.delete(portalAuditLogs).where(inArray(portalAuditLogs.tenantId, ids));
    await db.delete(tenants).where(inArray(tenants.id, ids));
  }
  await pool.end();
}

// ---------------------------------------------------------------------------
// HTTP harness
// ---------------------------------------------------------------------------

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

async function startServer(): Promise<void> {
  // Test-only validator: inject our RSA public key + no-op SSRF guard via the
  // function's deps argument. validateGalaxyJwt has no mutable state — these
  // overrides only apply to this call site.
  const testValidator = (token: string) => validateGalaxyJwt(token, {
    resolveSigningKey: async () => PUB_A_PEM,
    validateJwksUri: async () => { /* skip SSRF guard for non-routable test URI */ },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/portal', createPortalRouter(createRequirePortalAuth(testValidator)));
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function stopServer(): Promise<void> {
  if (server) await new Promise<void>(r => server.close(() => r()));
}

interface CallResult<T> {
  status: number;
  headers: Headers;
  body: T | null;
}

async function call<T = unknown>(path: string, token?: string): Promise<CallResult<T>> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function callJson<T = unknown>(
  method: 'POST' | 'PATCH',
  path: string,
  token: string,
  body: unknown,
): Promise<CallResult<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let parsed: T | null = null;
  try { parsed = (await res.json()) as T; } catch { parsed = null; }
  return { status: res.status, headers: res.headers, body: parsed };
}

// ---------------------------------------------------------------------------
// Response shapes (typed instead of `any`)
// ---------------------------------------------------------------------------

interface MeResponse {
  id: string;
  email: string | null;
  name: string;
  role: string;
  authProvider: string | null;
  galaxyUserId: string | null;
  linkedVegaUserId: string | null;
  tenant: { id: string; name: string; color: string | null };
}

interface IdRow { id: string; confidence?: number | null }
interface DashboardResponse {
  activeObjectivesCount: number;
  activeKeyResultsCount: number;
  activeBigRocksCount: number;
  onTrackCount: number;
  atRiskCount: number;
  upcomingCheckInsCount: number;
}
interface ErrorBody { error: string }

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseValidTokenReturnsTenantScopedData(): Promise<void> {
  console.log('\n[case 1] valid token → 200 with tenant-scoped data');
  const token = signToken({
    clientId: CLIENT_A,
    sub: SUB_A,
    email: PORTAL_EMAIL_A,
    name: 'Alice',
  });

  const me = await call<MeResponse>('/api/portal/me', token);
  assert(me.status === 200, `/me returns 200 (got ${me.status})`);
  assert(me.body?.tenant?.id === seeded.tenantAId, '/me tenant.id is tenant A');
  assert(me.body?.email === PORTAL_EMAIL_A, '/me email comes from JWT');
  assert(me.body?.role === ROLES.PORTAL_USER, '/me role is portal_user');

  const objs = await call<IdRow[]>('/api/portal/objectives', token);
  assert(objs.status === 200, `/objectives returns 200 (got ${objs.status})`);
  assert(Array.isArray(objs.body), '/objectives returns an array');
  const ids = (objs.body ?? []).map(o => o.id);
  assert(ids.includes(seeded.objectiveAId), '/objectives includes Alice-owned A row');
  assert(!ids.includes(seeded.objectiveBId), '/objectives excludes tenant-B rows');
  assert(ids.length === 1, '/objectives returns only the Alice-owned row');

  const kr = await call<IdRow[]>('/api/portal/key-results', token);
  assert(kr.status === 200, '/key-results returns 200');
  // KR ownership is by user.id only; Alice's email does not match an ownerId,
  // so the list is empty. This proves email-based ownership is NOT applied
  // where the schema doesn't carry an ownerEmail column.
  assert(Array.isArray(kr.body) && kr.body.length === 0, '/key-results filters out KRs without owner match');

  const br = await call<IdRow[]>('/api/portal/big-rocks', token);
  assert(br.status === 200, `/big-rocks returns 200 (got ${br.status})`);
  const brIds = (br.body ?? []).map(b => b.id);
  assert(brIds.includes(seeded.bigRockAId), '/big-rocks includes Alice-owned big rock');

  const ci = await call<IdRow[]>('/api/portal/check-ins', token);
  assert(ci.status === 200, '/check-ins returns 200');
  const ciIds = (ci.body ?? []).map(c => c.id);
  assert(ciIds.includes(seeded.checkInAId), '/check-ins includes check-in for owned objective');
  const ownedCi = (ci.body ?? []).find(c => c.id === seeded.checkInAId);
  assert(
    typeof ownedCi?.confidence === 'number' && Math.abs(ownedCi.confidence - 0.7) < 1e-9,
    '/check-ins pass-through includes owner-reported confidence',
  );

  const dash = await call<DashboardResponse>('/api/portal/dashboard', token);
  assert(dash.status === 200, '/dashboard returns 200');
  assert(typeof dash.body?.activeObjectivesCount === 'number', '/dashboard returns activeObjectivesCount');
  assert(dash.body?.activeObjectivesCount === 1, '/dashboard counts only owned objectives');
}

async function caseInvalidSignature(): Promise<void> {
  console.log('\n[case 2] invalid signature → 401');
  const token = signToken({
    clientId: CLIENT_A,
    sub: SUB_A,
    email: PORTAL_EMAIL_A,
    privateKeyPem: PRIV_B_PEM,
  });
  const res = await call<ErrorBody>('/api/portal/me', token);
  assert(res.status === 401, `expected 401 got ${res.status}`);
  assert(res.body?.error === 'invalid_token', 'returns invalid_token error');
}

async function caseMismatchedIssuer(): Promise<void> {
  console.log('\n[case 3] mismatched issuer → 401');
  const token = signToken({
    clientId: CLIENT_A,
    sub: SUB_A,
    issuer: 'https://attacker.example.com/',
  });
  const res = await call<ErrorBody>('/api/portal/me', token);
  assert(res.status === 401, `expected 401 got ${res.status}`);
}

async function caseGalaxyDisabledTenant(): Promise<void> {
  console.log('\n[case 4] galaxy_enabled=false → 401');
  const token = signToken({
    clientId: CLIENT_DISABLED,
    sub: `galaxy-sub-disabled-${RUN_ID}`,
    email: 'disabled@portal-test.invalid',
  });
  const res = await call<ErrorBody>('/api/portal/me', token);
  assert(res.status === 401, `expected 401 got ${res.status}`);
}

async function caseCrossTenantIsolation(): Promise<void> {
  console.log('\n[case 5] cross-tenant isolation: tenant-B token never sees tenant-A rows');
  const token = signToken({
    clientId: CLIENT_B,
    sub: SUB_B,
    email: PORTAL_EMAIL_B,
    name: 'Bob',
  });
  const me = await call<MeResponse>('/api/portal/me', token);
  assert(me.status === 200, '/me returns 200 for tenant-B token');
  assert(me.body?.tenant?.id === seeded.tenantBId, '/me resolved to tenant B');

  const objs = await call<IdRow[]>('/api/portal/objectives', token);
  assert(objs.status === 200, '/objectives returns 200');
  const ids = (objs.body ?? []).map(o => o.id);
  assert(!ids.includes(seeded.objectiveAId), 'tenant-A objective not visible to tenant-B token');
  // Bob doesn't own the B objective (it's owned by Alice's email but resolved
  // into tenant B). Bob's identity does not match it.
  assert(!ids.includes(seeded.objectiveBId), 'tenant-B objective not visible to a non-owner Bob');

  // Also: a missing bearer token returns 401.
  const noAuth = await call<ErrorBody>('/api/portal/me');
  assert(noAuth.status === 401, 'missing bearer token → 401');
}

async function caseRateLimit(): Promise<void> {
  console.log(`\n[case 6] rate limit returns 429 after ${RATE_LIMIT_PER_MINUTE} requests/minute`);
  // Tenant A's bucket already has requests from earlier cases, so we simply
  // hammer until we hit 429 — well within `RATE_LIMIT_PER_MINUTE` extra
  // requests. The bucket is per-tenant with a sliding 60s window.
  const token = signToken({
    clientId: CLIENT_A,
    sub: SUB_A,
    email: PORTAL_EMAIL_A,
  });
  let saw429 = false;
  let lastStatus = 0;
  for (let i = 0; i < RATE_LIMIT_PER_MINUTE + 5; i += 1) {
    const r = await call<ErrorBody>('/api/portal/me', token);
    lastStatus = r.status;
    if (r.status === 429) {
      saw429 = true;
      assert(r.body?.error === 'rate_limit_exceeded', '429 body has rate_limit_exceeded');
      assert(r.headers.get('retry-after') !== null, '429 sets Retry-After header');
      assert(
        r.headers.get('x-ratelimit-limit') === String(RATE_LIMIT_PER_MINUTE),
        `X-RateLimit-Limit reflects configured cap of ${RATE_LIMIT_PER_MINUTE}`,
      );
      break;
    }
  }
  assert(saw429, `expected at least one 429 within burst (last status ${lastStatus})`);
}

async function caseJitProvisioning(): Promise<void> {
  console.log('\n[case 7] JIT provisioning creates portal_user only on first request');
  const beforeRows = await db.select().from(users).where(eq(users.galaxyUserId, SUB_FRESH));
  assert(beforeRows.length === 0, 'no portal_user exists before first request');

  const email = `fresh-${RUN_ID}@portal-test.invalid`;
  const token = signToken({
    clientId: CLIENT_B,
    sub: SUB_FRESH,
    email,
    name: 'Fresh User',
  });

  const first = await call<MeResponse>('/api/portal/me', token);
  assert(first.status === 200, `first request returns 200 (got ${first.status})`);

  const afterRows = await db.select().from(users).where(eq(users.galaxyUserId, SUB_FRESH));
  assert(afterRows.length === 1, 'exactly one portal_user is created');
  const created = afterRows[0];
  assert(created.tenantId === seeded.tenantBId, 'JIT user is scoped to resolved tenant B');
  assert(created.role === ROLES.PORTAL_USER, 'JIT user has portal_user role');
  assert(created.authProvider === 'galaxy', 'JIT user has authProvider=galaxy');
  assert(created.galaxyUserId === SUB_FRESH, 'JIT user carries Galaxy sub');

  // Second call must NOT create a duplicate.
  const second = await call<MeResponse>('/api/portal/me', token);
  assert(second.status === 200, 'second request also returns 200');
  const stillRows = await db.select().from(users).where(eq(users.galaxyUserId, SUB_FRESH));
  assert(stillRows.length === 1, 'second request does not create another portal_user');
  assert(stillRows[0].id === created.id, 'second request reuses the same row');
}

interface CheckInRow {
  id: string;
  source: string;
  newProgress: number | null;
  entityId: string;
  userId: string;
}

async function caseWriterReadOnlyBlocked(): Promise<void> {
  console.log('\n[case 8] portal_user (no writer role) cannot POST /check-ins → 403');
  const token = signToken({ clientId: CLIENT_A, sub: SUB_A, email: PORTAL_EMAIL_A });
  const res = await callJson<ErrorBody>('POST', '/api/portal/check-ins', token, {
    entityType: 'objective',
    entityId: seeded.objectiveAId,
    note: 'should be blocked',
    newProgress: 25,
  });
  assert(res.status === 403, `read-only portal_user blocked (got ${res.status})`);
  assert(res.body?.error === 'forbidden', '403 error code is forbidden');
}

let writerCheckInId = '';
let writerUserId = '';

async function caseWriterCanCreateCheckIn(): Promise<void> {
  console.log('\n[case 9] portal_user_writer can POST /check-ins (source=galaxy_portal)');
  // Promote Alice's JIT user to writer.
  const aliceRows = await db.select().from(users).where(eq(users.galaxyUserId, SUB_A));
  assert(aliceRows.length === 1, 'Alice JIT user exists from earlier cases');
  writerUserId = aliceRows[0].id;
  await db.update(users).set({ role: ROLES.PORTAL_USER_WRITER }).where(eq(users.id, writerUserId));

  const token = signToken({ clientId: CLIENT_A, sub: SUB_A, email: PORTAL_EMAIL_A });
  const res = await callJson<CheckInRow>('POST', '/api/portal/check-ins', token, {
    entityType: 'objective',
    entityId: seeded.objectiveAId,
    note: 'portal write',
    progress: 42,
    status: 'on_track',
    confidence: 80,
  });
  assert(res.status === 201, `writer POST returns 201 (got ${res.status})`);
  assert(res.body?.source === 'galaxy_portal', "check-in source is 'galaxy_portal'");
  assert(res.body?.newProgress === 42, 'progress persisted as newProgress=42');
  assert(res.body?.userId === writerUserId, 'check-in linked to portal user id');
  // Write rate-limit headers must accompany every successful write.
  assert(
    res.headers.get('x-ratelimit-write-limit') === String(WRITE_RATE_LIMIT_PER_MINUTE),
    'X-RateLimit-Write-Limit reflects configured cap',
  );
  assert(
    res.headers.get('x-ratelimit-write-remaining') !== null,
    'X-RateLimit-Write-Remaining is set',
  );
  writerCheckInId = res.body!.id;

  // Confirm objective progress was applied.
  const objs = await call<Array<{ id: string; progress: number | null }>>('/api/portal/objectives', token);
  const owned = (objs.body ?? []).find(o => o.id === seeded.objectiveAId);
  assert(owned?.progress === 42, 'objective progress updated to 42');
}

async function caseWriterCrossTenantBlocked(): Promise<void> {
  console.log('\n[case 10] writer cannot check in on cross-tenant entityId → 403');
  const token = signToken({ clientId: CLIENT_A, sub: SUB_A, email: PORTAL_EMAIL_A });
  const res = await callJson<ErrorBody>('POST', '/api/portal/check-ins', token, {
    entityType: 'objective',
    entityId: seeded.objectiveBId, // tenant B objective
    note: 'cross-tenant attack',
    progress: 99,
  });
  assert(res.status === 403, `cross-tenant POST blocked (got ${res.status})`);
  assert(res.body?.error === 'forbidden', '403 error is forbidden');
}

async function caseWriterEditWindow(): Promise<void> {
  console.log('\n[case 11] author can PATCH within 30-min window; expired returns 403');
  const token = signToken({ clientId: CLIENT_A, sub: SUB_A, email: PORTAL_EMAIL_A });

  const ok = await callJson<CheckInRow>('PATCH', `/api/portal/check-ins/${writerCheckInId}`, token, {
    note: 'edited within window',
    progress: 55,
  });
  assert(ok.status === 200, `PATCH within window returns 200 (got ${ok.status})`);
  assert(ok.body?.newProgress === 55, 'PATCH applied progress=55');

  // Note-only PATCH must succeed (all fields are optional in the patch contract).
  const noteOnly = await callJson<CheckInRow>(
    'PATCH',
    `/api/portal/check-ins/${writerCheckInId}`,
    token,
    { note: 'note-only edit' },
  );
  assert(noteOnly.status === 200, `note-only PATCH returns 200 (got ${noteOnly.status})`);
  assert(noteOnly.body?.note === 'note-only edit', 'note-only PATCH applied');
  assert(noteOnly.body?.newProgress === 55, 'note-only PATCH preserves prior progress');

  // Backdate the row past the 30-min edit window.
  const past = new Date(Date.now() - 31 * 60 * 1000);
  await db.update(checkIns).set({ createdAt: past }).where(eq(checkIns.id, writerCheckInId));

  const expired = await callJson<ErrorBody>('PATCH', `/api/portal/check-ins/${writerCheckInId}`, token, {
    note: 'too late',
  });
  assert(expired.status === 403, `PATCH after 30 min returns 403 (got ${expired.status})`);
  assert(expired.body?.error === 'edit_window_expired', '403 error is edit_window_expired');
}

async function caseWriteRateLimit(): Promise<void> {
  console.log(`\n[case 12] write rate limit returns 429 after ${WRITE_RATE_LIMIT_PER_MINUTE}/min`);
  const token = signToken({ clientId: CLIENT_A, sub: SUB_A, email: PORTAL_EMAIL_A });
  let saw429 = false;
  let lastStatus = 0;
  for (let i = 0; i < WRITE_RATE_LIMIT_PER_MINUTE + 5; i += 1) {
    const r = await callJson<ErrorBody>('POST', '/api/portal/check-ins', token, {
      entityType: 'objective',
      entityId: seeded.objectiveAId,
      progress: 50 + i,
    });
    lastStatus = r.status;
    if (r.status === 429) {
      saw429 = true;
      assert(r.body?.error === 'rate_limit_exceeded', '429 body has rate_limit_exceeded');
      assert(r.headers.get('retry-after') !== null, '429 sets Retry-After header');
      assert(
        r.headers.get('x-ratelimit-write-limit') === String(WRITE_RATE_LIMIT_PER_MINUTE),
        'X-RateLimit-Write-Limit set on 429',
      );
      break;
    }
  }
  assert(saw429, `expected 429 within burst (last status ${lastStatus})`);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log(`Galaxy Portal e2e — run id ${RUN_ID}`);
  await setUp();
  await startServer();
  try {
    await caseValidTokenReturnsTenantScopedData();
    await caseInvalidSignature();
    await caseMismatchedIssuer();
    await caseGalaxyDisabledTenant();
    await caseCrossTenantIsolation();
    // JIT before rate-limit so case-6 exhausting tenant-A's bucket doesn't
    // also exhaust tenant-B's.
    await caseJitProvisioning();
    await caseWriterReadOnlyBlocked();
    await caseWriterCanCreateCheckIn();
    await caseWriterCrossTenantBlocked();
    await caseWriterEditWindow();
    await caseRateLimit();
    await caseWriteRateLimit();
  } finally {
    await stopServer();
    await tearDown();
  }
  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('\nAll Galaxy Portal trust-boundary cases passed.');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal:', err);
  // Best-effort cleanup so we don't leave tenants behind on crash.
  tearDown().catch(() => {});
  process.exit(1);
});
