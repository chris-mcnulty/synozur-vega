/**
 * Server-side tests for the comments + @mention pipeline.
 *
 * Run with:
 *   npx tsx server/__tests__/commentsAndMentions.test.ts
 *
 * These tests exercise the contract of `commentsRouter` (server/routes-comments.ts)
 * with the singleton `storage` and the `@sendgrid/mail` module patched in-memory.
 * They focus on the behaviors described in task #69:
 *
 *   - GET /api/comments respects tenant isolation (cross-tenant entity → 404).
 *   - POST /api/comments parses @[name](id) tokens server-side, drops mentions
 *     for users in other tenants, and fans out one createNotification('mention')
 *     and one sendCommentMentionEmail per validated recipient with email enabled.
 *   - PATCH /api/comments/:id enforces author-only and the 15-minute edit window.
 *   - DELETE /api/comments/:id soft-deletes for author OR tenant admin, but
 *     forbids non-author non-admin and cross-tenant access.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'net';

const sgMailMod = await import('@sendgrid/mail');
const sgMail = (sgMailMod as any).default ?? sgMailMod;

// SendGrid is loaded lazily via getUncachableSendGridClient; provide minimal env.
process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'test-key';
process.env.SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@test.invalid';

const { storage } = await import('../storage');
const { commentsRouter } = await import('../routes-comments');
const { loadCurrentUser, requireTenantAccess } = await import('../middleware/rbac');
const { ROLES } = await import('../../shared/rbac');

import type { EntityComment, User, Tenant, Objective, KeyResult, BigRock } from '../../shared/schema';

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

const TENANT_A = 'tenant-A';
const TENANT_B = 'tenant-B';

// Mention regex requires hex/dash IDs of 8+ chars: /@\[name\]\(([0-9a-fA-F\-]{8,})\)/.
const USER_AUTHOR = '11111111-1111-1111-1111-111111111111';
const USER_MENTIONED = '22222222-2222-2222-2222-222222222222';
const USER_OTHER = '33333333-3333-3333-3333-333333333333';
const USER_ADMIN = '44444444-4444-4444-4444-444444444444';
const USER_CROSS_TENANT = '55555555-5555-5555-5555-555555555555';

const fakeUsers: Record<string, User> = {
  [USER_AUTHOR]: {
    id: USER_AUTHOR, email: 'author@test.invalid', name: 'Author User',
    role: ROLES.TENANT_USER, tenantId: TENANT_A,
  } as unknown as User,
  [USER_MENTIONED]: {
    id: USER_MENTIONED, email: 'mention@test.invalid', name: 'Mentioned User',
    role: ROLES.TENANT_USER, tenantId: TENANT_A,
  } as unknown as User,
  [USER_OTHER]: {
    id: USER_OTHER, email: 'other@test.invalid', name: 'Other User',
    role: ROLES.TENANT_USER, tenantId: TENANT_A,
  } as unknown as User,
  [USER_ADMIN]: {
    id: USER_ADMIN, email: 'admin@test.invalid', name: 'Tenant Admin',
    role: ROLES.TENANT_ADMIN, tenantId: TENANT_A,
  } as unknown as User,
  [USER_CROSS_TENANT]: {
    id: USER_CROSS_TENANT, email: 'b@test.invalid', name: 'Other Tenant User',
    role: ROLES.TENANT_USER, tenantId: TENANT_B,
  } as unknown as User,
};

const fakeTenants: Record<string, Tenant> = {
  [TENANT_A]: { id: TENANT_A, name: 'A' } as unknown as Tenant,
  [TENANT_B]: { id: TENANT_B, name: 'B' } as unknown as Tenant,
};

const OBJ_A = 'obj-A';
const OBJ_B = 'obj-B';
const fakeObjectives: Record<string, Objective> = {
  [OBJ_A]: { id: OBJ_A, tenantId: TENANT_A, title: 'Obj in A' } as unknown as Objective,
  [OBJ_B]: { id: OBJ_B, tenantId: TENANT_B, title: 'Obj in B' } as unknown as Objective,
};

// In-memory comments store, keyed by id.
const commentsById = new Map<string, EntityComment>();
function makeComment(c: Partial<EntityComment> & { tenantId: string; entityType: string; entityId: string; authorUserId: string; body: string }): EntityComment {
  const id = c.id ?? `c-${Math.random().toString(36).slice(2, 10)}`;
  const created: EntityComment = {
    id,
    tenantId: c.tenantId,
    entityType: c.entityType,
    entityId: c.entityId,
    parentCommentId: c.parentCommentId ?? null,
    authorUserId: c.authorUserId,
    body: c.body,
    mentionedUserIds: c.mentionedUserIds ?? [],
    createdAt: c.createdAt ?? new Date(),
    editedAt: c.editedAt ?? null,
    deletedAt: c.deletedAt ?? null,
  } as EntityComment;
  commentsById.set(id, created);
  return created;
}

// Track invocations so the assertions can verify the mention pipeline.
interface CallLog {
  createNotification: any[];
  notificationPrefLookups: Array<{ userId: string; eventType: string }>;
  sendgridSends: any[];
}
let calls: CallLog;
function resetCalls() {
  calls = { createNotification: [], notificationPrefLookups: [], sendgridSends: [] };
}
resetCalls();

// ---------------------------------------------------------------------------
// Stub storage + sendgrid.
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
stub('getTenantById', async (id: unknown) => fakeTenants[id as string]);
stub('hasConsultantAccess', async () => false);
stub('isUserReadOnly', async () => false);

stub('getObjectiveById', async (id: unknown) => fakeObjectives[id as string]);
stub('getKeyResultById', async () => undefined as unknown as KeyResult | undefined);
stub('getBigRockById', async () => undefined as unknown as BigRock | undefined);
stub('getCheckInById', async () => undefined);

stub('getCommentsByEntity', async (tenantId: unknown, entityType: unknown, entityId: unknown) => {
  return Array.from(commentsById.values())
    .filter(c => c.tenantId === tenantId && c.entityType === entityType && c.entityId === entityId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
});
stub('getCommentById', async (id: unknown) => commentsById.get(id as string));
stub('getCommentCountsByEntities', async () => new Map());
stub('createComment', async (input: unknown) => {
  const i = input as Partial<EntityComment>;
  return makeComment({
    tenantId: i.tenantId!, entityType: i.entityType!, entityId: i.entityId!,
    authorUserId: i.authorUserId!, body: i.body!,
    mentionedUserIds: i.mentionedUserIds ?? [], parentCommentId: i.parentCommentId ?? null,
  });
});
stub('updateComment', async (id: unknown, body: unknown, mentionedUserIds: unknown) => {
  const c = commentsById.get(id as string);
  if (!c) return undefined;
  const updated = { ...c, body: body as string, mentionedUserIds: mentionedUserIds as string[], editedAt: new Date() };
  commentsById.set(c.id, updated as EntityComment);
  return updated;
});
stub('softDeleteComment', async (id: unknown) => {
  const c = commentsById.get(id as string);
  if (!c) return undefined;
  const updated = { ...c, deletedAt: new Date() };
  commentsById.set(c.id, updated as EntityComment);
  return updated;
});

// notification pipeline.
stub('getNotificationPreference', async (userId: unknown, eventType: unknown) => {
  calls.notificationPrefLookups.push({ userId: userId as string, eventType: eventType as string });
  // Default-enabled (return undefined so isEmailEnabled returns true).
  return undefined;
});
stub('createNotification', async (notification: unknown) => {
  calls.createNotification.push(notification);
  return { id: `n-${calls.createNotification.length}`, ...(notification as object) } as any;
});

// Patch SendGrid send so emails don't actually fly.
const originalSend = sgMail.send?.bind(sgMail);
sgMail.send = async (msg: any) => {
  calls.sendgridSends.push(msg);
  return [{ statusCode: 202, body: '', headers: {} }, {}] as any;
};

// ---------------------------------------------------------------------------
// Build a minimal Express app that mirrors the production mount.
// ---------------------------------------------------------------------------

function testSession(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-test-user-id'];
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
  app.use('/api/comments', commentsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
}
async function stopServer(): Promise<void> {
  if (server) await new Promise<void>((r) => server.close(() => r()));
}

interface CallResult<T> { status: number; body: T | null; }
async function call<T>(method: string, path: string, opts: { userId?: string; tenantId?: string; body?: any } = {}): Promise<CallResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.userId) headers['x-test-user-id'] = opts.userId;
  if (opts.tenantId) headers['x-tenant-id'] = opts.tenantId;
  const res = await fetch(`${baseUrl}${path}`, {
    method, headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: T | null = null;
  try { body = (await res.json()) as T; } catch { body = null; }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseAuthRequired() {
  console.log('\n[case 1] GET without session → 401');
  const res = await call<{ error?: string }>('GET', `/api/comments?entityType=objective&entityId=${OBJ_A}`);
  assert(res.status === 401, `expected 401 got ${res.status}`);
}

async function caseGetTenantIsolation() {
  console.log('\n[case 2] cross-tenant GET on entity in another tenant → 404');
  const res = await call<{ error?: string }>('GET', `/api/comments?entityType=objective&entityId=${OBJ_B}`, { userId: USER_AUTHOR });
  assert(res.status === 404, `expected 404 for cross-tenant entity, got ${res.status}`);
}

async function caseGetReturnsTenantComments() {
  console.log('\n[case 3] GET returns only comments for tenant + entity');
  // Plant comments in both tenants on the same entityType, including a soft-deleted one.
  commentsById.clear();
  makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'hi from A' });
  const deleted = makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'secret', deletedAt: new Date() });
  // A comment in tenant B on a different entity — should never be returned for A.
  makeComment({ tenantId: TENANT_B, entityType: 'objective', entityId: OBJ_B, authorUserId: USER_CROSS_TENANT, body: 'hi from B' });

  const res = await call<any[]>('GET', `/api/comments?entityType=objective&entityId=${OBJ_A}`, { userId: USER_AUTHOR });
  assert(res.status === 200, `expected 200 got ${res.status}`);
  assert(Array.isArray(res.body) && res.body.length === 2, `expected 2 comments got ${res.body?.length}`);
  const all = res.body!;
  assert(all.every((c: any) => c.tenantId === TENANT_A), 'all returned comments belong to tenant A');
  const blanked = all.find((c: any) => c.id === deleted.id);
  assert(blanked && blanked.body === '', 'soft-deleted comment body is hidden');
}

async function caseCreateComment() {
  console.log('\n[case 4] POST creates a comment, scoped to tenant');
  resetCalls();
  commentsById.clear();
  const res = await call<any>('POST', '/api/comments', {
    userId: USER_AUTHOR,
    body: { entityType: 'objective', entityId: OBJ_A, body: 'plain comment' },
  });
  assert(res.status === 201, `expected 201 got ${res.status}`);
  assert(res.body?.tenantId === TENANT_A, 'created comment has correct tenantId');
  assert(res.body?.authorUserId === USER_AUTHOR, 'authorUserId from session user');
  assert(calls.createNotification.length === 0, 'no mentions → no notifications fanned out');
  assert(calls.sendgridSends.length === 0, 'no mentions → no emails sent');
}

async function caseCreateCommentCrossTenantEntity() {
  console.log('\n[case 5] POST against an entity in another tenant → 404');
  const res = await call<{ error?: string }>('POST', '/api/comments', {
    userId: USER_AUTHOR,
    body: { entityType: 'objective', entityId: OBJ_B, body: 'sneaky' },
  });
  assert(res.status === 404, `expected 404 got ${res.status}`);
}

async function caseMentionPipeline() {
  console.log('\n[case 6] POST with @mention fans out createNotification + sendCommentMentionEmail per recipient');
  resetCalls();
  commentsById.clear();
  // Body mentions: a same-tenant user (valid), a cross-tenant user (filtered out),
  // and a self-mention (skipped from fan-out).
  const body =
    `Hey @[Mentioned User](${USER_MENTIONED}) and ` +
    `@[Cross Tenant](${USER_CROSS_TENANT}) and self @[Author User](${USER_AUTHOR})`;
  const res = await call<any>('POST', '/api/comments', {
    userId: USER_AUTHOR,
    body: { entityType: 'objective', entityId: OBJ_A, body },
  });
  assert(res.status === 201, `expected 201 got ${res.status}`);

  const stored = res.body;
  // Cross-tenant mention is dropped, self-mention is recorded but not notified.
  const mentioned: string[] = stored.mentionedUserIds || [];
  assert(mentioned.includes(USER_MENTIONED), 'same-tenant mention persisted');
  assert(!mentioned.includes(USER_CROSS_TENANT), 'cross-tenant mention dropped');

  assert(
    calls.createNotification.length === 1,
    `expected exactly 1 mention notification (for valid same-tenant non-self mention), got ${calls.createNotification.length}`,
  );
  const n = calls.createNotification[0];
  assert(n.type === 'mention', 'notification type is mention');
  assert(n.userId === USER_MENTIONED, 'notification recipient is the validated mention');
  assert(n.tenantId === TENANT_A, 'notification tenant matches author tenant');
  assert(typeof n.linkUrl === 'string' && n.linkUrl.includes('focusComment='), 'linkUrl includes focusComment for deep linking');

  assert(
    calls.sendgridSends.length === 1,
    `expected exactly 1 email send (recipient has email enabled), got ${calls.sendgridSends.length}`,
  );
  const msg = calls.sendgridSends[0];
  assert(msg.to === fakeUsers[USER_MENTIONED].email, 'email addressed to mentioned user');
  assert(typeof msg.subject === 'string' && msg.subject.includes('mentioned you'), 'email subject mentions @mention');
}

async function caseEditWindow() {
  console.log('\n[case 7] PATCH respects 15-minute author edit window');
  resetCalls();
  commentsById.clear();
  const fresh = makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'fresh' });
  const stale = makeComment({
    tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR,
    body: 'stale', createdAt: new Date(Date.now() - 16 * 60 * 1000),
  });

  const okRes = await call<any>('PATCH', `/api/comments/${fresh.id}`, {
    userId: USER_AUTHOR, body: { body: 'edited' },
  });
  assert(okRes.status === 200, `author within window → 200 (got ${okRes.status})`);
  assert(commentsById.get(fresh.id)?.body === 'edited', 'comment body updated');

  const lateRes = await call<{ error?: string }>('PATCH', `/api/comments/${stale.id}`, {
    userId: USER_AUTHOR, body: { body: 'too late' },
  });
  assert(lateRes.status === 403, `author past window → 403 (got ${lateRes.status})`);
  assert(/15 minutes/i.test(lateRes.body?.error || ''), 'error mentions 15 minutes');

  const wrongAuthor = await call<{ error?: string }>('PATCH', `/api/comments/${fresh.id}`, {
    userId: USER_OTHER, body: { body: 'not mine' },
  });
  assert(wrongAuthor.status === 403, `non-author edit → 403 (got ${wrongAuthor.status})`);

  const crossTenant = makeComment({ tenantId: TENANT_B, entityType: 'objective', entityId: OBJ_B, authorUserId: USER_CROSS_TENANT, body: 'B' });
  const crossRes = await call<{ error?: string }>('PATCH', `/api/comments/${crossTenant.id}`, {
    userId: USER_AUTHOR, body: { body: 'cross' },
  });
  assert(crossRes.status === 404, `cross-tenant edit → 404 (got ${crossRes.status})`);
}

async function caseDeletePermissions() {
  console.log('\n[case 8] DELETE: author OR tenant admin can soft-delete; others get 403');
  commentsById.clear();
  const a = makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'mine' });
  const b = makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'admin-target' });
  const c = makeComment({ tenantId: TENANT_A, entityType: 'objective', entityId: OBJ_A, authorUserId: USER_AUTHOR, body: 'forbidden' });
  const d = makeComment({ tenantId: TENANT_B, entityType: 'objective', entityId: OBJ_B, authorUserId: USER_CROSS_TENANT, body: 'B' });

  const r1 = await call<any>('DELETE', `/api/comments/${a.id}`, { userId: USER_AUTHOR });
  assert(r1.status === 200, `author delete → 200 (got ${r1.status})`);
  assert(commentsById.get(a.id)?.deletedAt != null, 'author-deleted comment is soft-deleted');

  const r2 = await call<any>('DELETE', `/api/comments/${b.id}`, { userId: USER_ADMIN });
  assert(r2.status === 200, `tenant admin delete → 200 (got ${r2.status})`);
  assert(commentsById.get(b.id)?.deletedAt != null, 'admin-deleted comment is soft-deleted');

  const r3 = await call<{ error?: string }>('DELETE', `/api/comments/${c.id}`, { userId: USER_OTHER });
  assert(r3.status === 403, `non-author non-admin delete → 403 (got ${r3.status})`);
  assert(commentsById.get(c.id)?.deletedAt == null, 'forbidden delete left comment intact');

  const r4 = await call<{ error?: string }>('DELETE', `/api/comments/${d.id}`, { userId: USER_AUTHOR });
  assert(r4.status === 404, `cross-tenant delete → 404 (got ${r4.status})`);
  assert(commentsById.get(d.id)?.deletedAt == null, 'cross-tenant delete left comment intact');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('Comments + @mention pipeline tests');
  await startServer();
  try {
    await caseAuthRequired();
    await caseGetTenantIsolation();
    await caseGetReturnsTenantComments();
    await caseCreateComment();
    await caseCreateCommentCrossTenantEntity();
    await caseMentionPipeline();
    await caseEditWindow();
    await caseDeletePermissions();
  } finally {
    await stopServer();
    restoreAll();
    if (originalSend) sgMail.send = originalSend;
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log('\nAll comments + mention tests passed');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
