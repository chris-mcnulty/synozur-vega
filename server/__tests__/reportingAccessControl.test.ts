/**
 * Regression tests for tenant/object authorization on the reporting &
 * export routes (server/routes-reporting.ts).
 *
 * Run with:
 *   npx tsx server/__tests__/reportingAccessControl.test.ts
 *
 * Prior to the fix, the ID-based handlers (`/snapshots/:id`, `/templates/:id`,
 * `/reports/:id`, `/reports/:id/pdf`, `/reports/:id/pptx`) fetched rows by
 * primary key without ever comparing the row's tenantId to the requester's
 * effective tenant, and `/reports/generate` copied an arbitrary snapshotId's
 * data without ownership checks. Any authenticated user who knew (or
 * enumerated) a UUID could read/edit/delete another tenant's reporting data,
 * or tamper with global (tenantId = null) report templates shared by every
 * tenant.
 *
 * Cases:
 *   1. Snapshot: cross-tenant GET/PATCH/DELETE -> 404, no mutation.
 *   2. Report instance: cross-tenant GET/DELETE/PDF/PPTX -> 404.
 *   3. POST /reports/generate with a snapshotId owned by another tenant -> 403.
 *   4. Tenant-owned template: cross-tenant GET -> 404; owner tenant GET/PATCH/DELETE -> 200/204.
 *   5. Global template (tenantId = null): any tenant user can GET, but PATCH/DELETE
 *      require a platform-admin role (global_admin / vega_admin).
 *   6. Same-tenant CRUD continues to work (no regression).
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'net';
import { inArray } from 'drizzle-orm';

const { db, pool } = await import('../db');
const {
  tenants,
  users,
  reviewSnapshots,
  reportTemplates,
  reportInstances,
} = await import('../../shared/schema');
const { ROLES } = await import('../../shared/rbac');
const reportingRouter = (await import('../routes-reporting')).default;

// ---------------------------------------------------------------------------
// Tiny assertion helper.
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
const TENANT_A_NAME = `__rpt_test_A_${RUN_ID}`;
const TENANT_B_NAME = `__rpt_test_B_${RUN_ID}`;

interface Seeded {
  tenantAId: string;
  tenantBId: string;
  userAId: string;   // tenant A, regular user
  userBId: string;   // tenant B, regular user
  platformAdminId: string; // global_admin, cross-tenant
  snapshotAId: string;
  snapshotBId: string;
  reportAId: string;
  reportBId: string;
  templateAId: string; // owned by tenant A
  globalTemplateId: string; // tenantId = null
}

const seeded: Seeded = {
  tenantAId: '', tenantBId: '', userAId: '', userBId: '', platformAdminId: '',
  snapshotAId: '', snapshotBId: '', reportAId: '', reportBId: '',
  templateAId: '', globalTemplateId: '',
};

async function setUp(): Promise<void> {
  const [tA] = await db.insert(tenants).values({ name: TENANT_A_NAME }).returning();
  const [tB] = await db.insert(tenants).values({ name: TENANT_B_NAME }).returning();
  seeded.tenantAId = tA.id;
  seeded.tenantBId = tB.id;

  const [userA] = await db.insert(users).values({
    email: `usera-${RUN_ID}@rpt-test.invalid`,
    password: 'x',
    name: 'User A',
    role: ROLES.TENANT_USER,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();
  seeded.userAId = userA.id;

  const [userB] = await db.insert(users).values({
    email: `userb-${RUN_ID}@rpt-test.invalid`,
    password: 'x',
    name: 'User B',
    role: ROLES.TENANT_USER,
    tenantId: tB.id,
    emailVerified: true,
  }).returning();
  seeded.userBId = userB.id;

  const [platformAdmin] = await db.insert(users).values({
    email: `pa-${RUN_ID}@rpt-test.invalid`,
    password: 'x',
    name: 'Platform Admin',
    role: ROLES.GLOBAL_ADMIN,
    tenantId: tA.id,
    emailVerified: true,
  }).returning();
  seeded.platformAdminId = platformAdmin.id;

  const now = new Date();

  const [snapA] = await db.insert(reviewSnapshots).values({
    tenantId: tA.id,
    title: 'Tenant A Snapshot',
    reviewType: 'quarterly',
    year: 2026,
    snapshotDate: now,
    status: 'draft',
  }).returning();
  seeded.snapshotAId = snapA.id;

  const [snapB] = await db.insert(reviewSnapshots).values({
    tenantId: tB.id,
    title: 'Tenant B Snapshot',
    reviewType: 'quarterly',
    year: 2026,
    snapshotDate: now,
    status: 'draft',
  }).returning();
  seeded.snapshotBId = snapB.id;

  const [reportA] = await db.insert(reportInstances).values({
    tenantId: tA.id,
    title: 'Tenant A Report',
    reportType: 'qbr',
    periodType: 'quarter',
    periodStart: now,
    periodEnd: now,
    year: 2026,
    status: 'completed',
    reportData: { summary: {} } as any,
  }).returning();
  seeded.reportAId = reportA.id;

  const [reportB] = await db.insert(reportInstances).values({
    tenantId: tB.id,
    title: 'Tenant B Report',
    reportType: 'qbr',
    periodType: 'quarter',
    periodStart: now,
    periodEnd: now,
    year: 2026,
    status: 'completed',
    reportData: { summary: {} } as any,
  }).returning();
  seeded.reportBId = reportB.id;

  const [templateA] = await db.insert(reportTemplates).values({
    tenantId: tA.id,
    name: 'Tenant A Template',
    templateType: 'custom',
  }).returning();
  seeded.templateAId = templateA.id;

  const [globalTemplate] = await db.insert(reportTemplates).values({
    tenantId: null,
    name: 'Global Template',
    templateType: 'custom',
  }).returning();
  seeded.globalTemplateId = globalTemplate.id;
}

async function tearDown(): Promise<void> {
  const tenantIds = [seeded.tenantAId, seeded.tenantBId].filter(Boolean);
  if (seeded.globalTemplateId) {
    await db.delete(reportTemplates).where(inArray(reportTemplates.id, [seeded.globalTemplateId]));
  }
  if (tenantIds.length > 0) {
    await db.delete(reportInstances).where(inArray(reportInstances.tenantId, tenantIds));
    await db.delete(reviewSnapshots).where(inArray(reviewSnapshots.tenantId, tenantIds));
    await db.delete(reportTemplates).where(inArray(reportTemplates.tenantId, tenantIds));
    await db.delete(users).where(inArray(users.tenantId, tenantIds));
    await db.delete(tenants).where(inArray(tenants.id, tenantIds));
  }
  await pool.end();
}

// ---------------------------------------------------------------------------
// HTTP harness — stub session, real requireValidatedTenant/storage.getUser.
// ---------------------------------------------------------------------------

let baseUrl = '';
let server: ReturnType<express.Application['listen']>;

const stubSession = (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.header('x-test-user-id');
  (req as any).session = userId ? { userId } : {};
  const tenantHeader = req.header('x-tenant-id');
  if (tenantHeader) {
    (req.headers as any)['x-tenant-id'] = tenantHeader;
  }
  next();
};

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(stubSession);
  app.use('/api/reporting', reportingRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function stopServer(): Promise<void> {
  if (server) await new Promise<void>(r => server.close(() => r()));
}

interface Actor { userId: string; tenantId: string }
const actorA = (): Actor => ({ userId: seeded.userAId, tenantId: seeded.tenantAId });
const actorB = (): Actor => ({ userId: seeded.userBId, tenantId: seeded.tenantBId });
const actorPlatformAdmin = (): Actor => ({ userId: seeded.platformAdminId, tenantId: seeded.tenantAId });

function authHeaders(a: Actor): Record<string, string> {
  return {
    'x-test-user-id': a.userId,
    'x-tenant-id': a.tenantId,
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
  const contentType = res.headers.get('content-type') || '';
  if (res.status !== 204 && contentType.includes('application/json')) {
    try { parsed = (await res.json()) as T; } catch { parsed = null; }
  }
  return { status: res.status, body: parsed };
}

interface ErrorBody { error: string }

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseSnapshotIsolation(): Promise<void> {
  console.log('\n[case 1] snapshot: cross-tenant GET/PATCH/DELETE -> 404, no mutation');

  const crossGet = await callJson<ErrorBody>('GET', `/api/reporting/snapshots/${seeded.snapshotAId}`, actorB());
  assert(crossGet.status === 404, `cross-tenant GET snapshot -> 404 (got ${crossGet.status})`);

  const crossPatch = await callJson<ErrorBody>('PATCH', `/api/reporting/snapshots/${seeded.snapshotAId}`, actorB(), { title: 'Hacked' });
  assert(crossPatch.status === 404, `cross-tenant PATCH snapshot -> 404 (got ${crossPatch.status})`);

  const crossDelete = await callJson<ErrorBody>('DELETE', `/api/reporting/snapshots/${seeded.snapshotAId}`, actorB());
  assert(crossDelete.status === 404, `cross-tenant DELETE snapshot -> 404 (got ${crossDelete.status})`);

  const [row] = await db.select().from(reviewSnapshots).where(inArray(reviewSnapshots.id, [seeded.snapshotAId]));
  assert(!!row, 'snapshot still exists after cross-tenant delete attempt');
  assert(row?.title === 'Tenant A Snapshot', 'snapshot title unchanged after cross-tenant patch attempt');

  const ownGet = await callJson('GET', `/api/reporting/snapshots/${seeded.snapshotAId}`, actorA());
  assert(ownGet.status === 200, `own-tenant GET snapshot -> 200 (got ${ownGet.status})`);
}

async function caseReportIsolation(): Promise<void> {
  console.log('\n[case 2] report instance: cross-tenant GET/DELETE/PDF/PPTX -> 404');

  const crossGet = await callJson<ErrorBody>('GET', `/api/reporting/reports/${seeded.reportAId}`, actorB());
  assert(crossGet.status === 404, `cross-tenant GET report -> 404 (got ${crossGet.status})`);

  const crossPdf = await callJson<ErrorBody>('GET', `/api/reporting/reports/${seeded.reportAId}/pdf`, actorB());
  assert(crossPdf.status === 404, `cross-tenant PDF export -> 404 (got ${crossPdf.status})`);

  const crossPptx = await callJson<ErrorBody>('GET', `/api/reporting/reports/${seeded.reportAId}/pptx`, actorB());
  assert(crossPptx.status === 404, `cross-tenant PPTX export -> 404 (got ${crossPptx.status})`);

  const crossDelete = await callJson<ErrorBody>('DELETE', `/api/reporting/reports/${seeded.reportAId}`, actorB());
  assert(crossDelete.status === 404, `cross-tenant DELETE report -> 404 (got ${crossDelete.status})`);

  const [row] = await db.select().from(reportInstances).where(inArray(reportInstances.id, [seeded.reportAId]));
  assert(!!row, 'report still exists after cross-tenant delete attempt');

  const ownGet = await callJson('GET', `/api/reporting/reports/${seeded.reportAId}`, actorA());
  assert(ownGet.status === 200, `own-tenant GET report -> 200 (got ${ownGet.status})`);
}

async function caseGenerateFromForeignSnapshot(): Promise<void> {
  console.log('\n[case 3] POST /reports/generate with a foreign snapshotId -> 403');

  const res = await callJson<ErrorBody>('POST', '/api/reporting/reports/generate', actorB(), {
    snapshotId: seeded.snapshotAId,
    periodType: 'quarter',
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    quarter: 1,
    year: 2026,
  });
  assert(res.status === 403, `generate with foreign snapshotId -> 403 (got ${res.status})`);
}

async function caseTemplateTenantIsolation(): Promise<void> {
  console.log('\n[case 4] tenant-owned template: cross-tenant GET -> 404; owner CRUD works');

  const crossGet = await callJson<ErrorBody>('GET', `/api/reporting/templates/${seeded.templateAId}`, actorB());
  assert(crossGet.status === 404, `cross-tenant GET template -> 404 (got ${crossGet.status})`);

  const crossPatch = await callJson<ErrorBody>('PATCH', `/api/reporting/templates/${seeded.templateAId}`, actorB(), { name: 'Hacked' });
  assert(crossPatch.status === 404, `cross-tenant PATCH template -> 404 (got ${crossPatch.status})`);

  const crossDelete = await callJson<ErrorBody>('DELETE', `/api/reporting/templates/${seeded.templateAId}`, actorB());
  assert(crossDelete.status === 404, `cross-tenant DELETE template -> 404 (got ${crossDelete.status})`);

  const [row] = await db.select().from(reportTemplates).where(inArray(reportTemplates.id, [seeded.templateAId]));
  assert(row?.name === 'Tenant A Template', 'template name unchanged after cross-tenant patch attempt');

  const ownGet = await callJson('GET', `/api/reporting/templates/${seeded.templateAId}`, actorA());
  assert(ownGet.status === 200, `own-tenant GET template -> 200 (got ${ownGet.status})`);

  const ownPatch = await callJson<{ name: string }>('PATCH', `/api/reporting/templates/${seeded.templateAId}`, actorA(), { name: 'Renamed A' });
  assert(ownPatch.status === 200, `own-tenant PATCH template -> 200 (got ${ownPatch.status})`);
  assert(ownPatch.body?.name === 'Renamed A', 'own-tenant PATCH updated the name');
}

async function caseGlobalTemplatePermissions(): Promise<void> {
  console.log('\n[case 5] global template: any tenant can GET; only platform admin can PATCH/DELETE');

  const getAsB = await callJson('GET', `/api/reporting/templates/${seeded.globalTemplateId}`, actorB());
  assert(getAsB.status === 200, `regular tenant user GET global template -> 200 (got ${getAsB.status})`);

  const patchAsB = await callJson<ErrorBody>('PATCH', `/api/reporting/templates/${seeded.globalTemplateId}`, actorB(), { name: 'Tampered' });
  assert(patchAsB.status === 403, `regular tenant user PATCH global template -> 403 (got ${patchAsB.status})`);

  const deleteAsB = await callJson<ErrorBody>('DELETE', `/api/reporting/templates/${seeded.globalTemplateId}`, actorB());
  assert(deleteAsB.status === 403, `regular tenant user DELETE global template -> 403 (got ${deleteAsB.status})`);

  const [row] = await db.select().from(reportTemplates).where(inArray(reportTemplates.id, [seeded.globalTemplateId]));
  assert(row?.name === 'Global Template', 'global template unchanged after non-admin tamper attempts');

  const patchAsAdmin = await callJson<{ name: string }>('PATCH', `/api/reporting/templates/${seeded.globalTemplateId}`, actorPlatformAdmin(), { name: 'Updated Global' });
  assert(patchAsAdmin.status === 200, `platform admin PATCH global template -> 200 (got ${patchAsAdmin.status})`);
  assert(patchAsAdmin.body?.name === 'Updated Global', 'platform admin update applied');
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Reporting access control tests');
  console.log('===============================');
  try {
    await setUp();
    await startServer();
    await caseSnapshotIsolation();
    await caseReportIsolation();
    await caseGenerateFromForeignSnapshot();
    await caseTemplateTenantIsolation();
    await caseGlobalTemplatePermissions();
  } finally {
    try { await stopServer(); } catch (e) { console.error('stopServer error:', e); }
    try { await tearDown(); } catch (e) { console.error('tearDown error:', e); }
  }
  console.log('\n-------------------------------');
  if (failed > 0) {
    console.error(`${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('All reporting access control tests passed.');
  }
}

await main();
