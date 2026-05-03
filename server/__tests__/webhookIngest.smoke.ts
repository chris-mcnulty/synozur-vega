/**
 * Smoke test for the KR webhook auto-update endpoint.
 *
 * Run with the dev server already running on PORT 5000:
 *   DATABASE_URL=... npx tsx server/__tests__/webhookIngest.smoke.ts
 */
import crypto from 'crypto';
import { db, pool } from '../db';
import { keyResults, krWebhookTokens, webhookIngestLogs, checkIns } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import { encryptToken } from '../utils/encryption';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function hmac(secret: string, body: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

let pass = 0;
let fail = 0;
function assert(cond: any, msg: string) {
  if (cond) { console.log('  PASS', msg); pass++; }
  else { console.error('  FAIL', msg); fail++; }
}

async function main() {
  // Find any active KR with a numeric target.
  const [kr] = await db
    .select()
    .from(keyResults)
    .where(eq(keyResults.metricType, 'increase'))
    .limit(1);
  if (!kr) throw new Error('No KR available for smoke test');

  console.log(`Using KR ${kr.id} (tenant ${kr.tenantId})`);

  // Insert a token directly so we have the plaintext token+secret for testing.
  const publicToken = crypto.randomBytes(32).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const [token] = await db.insert(krWebhookTokens).values({
    tenantId: kr.tenantId,
    keyResultId: kr.id,
    label: `smoke-test ${Date.now()}`,
    tokenHash: sha256(publicToken),
    secretHash: encryptToken(secret),
    enabled: true,
  }).returning();

  try {
    // ---- Case 1: valid HMAC → 200, check-in created with source:webhook
    const body = JSON.stringify({ value: 42, note: 'smoke test' });
    const sig = `sha256=${hmac(secret, body)}`;
    let r = await fetch(`${BASE}/api/ingest/v1/kr/${publicToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vega-Signature': sig },
      body,
    });
    assert(r.status === 200, `valid request returns 200 (got ${r.status})`);
    const okJson = await r.json();
    assert(okJson.ok === true, 'response body has ok=true');
    assert(typeof okJson.checkInId === 'string', 'response has checkInId');
    assert(okJson.value === 42, 'response echoes value');

    const [ci] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.id, okJson.checkInId))
      .limit(1);
    assert(!!ci, 'check-in row exists');
    assert(ci?.source === 'webhook', `check-in source=webhook (got ${ci?.source})`);
    assert(ci?.entityType === 'key_result', 'check-in entityType=key_result');
    assert(Number(ci?.newValue) === 42, 'check-in newValue=42');

    const [krAfter] = await db.select().from(keyResults).where(eq(keyResults.id, kr.id));
    assert(Number(krAfter?.currentValue) === 42, `KR currentValue updated to 42 (got ${krAfter?.currentValue})`);
    const krStatusOk = krAfter?.status && ['on_track','at_risk','behind','completed','not_started'].includes(krAfter.status);
    assert(!!krStatusOk, `KR status is a pace-derived value (got ${krAfter?.status})`);
    assert(ci?.newStatus !== undefined, `check-in row has newStatus column populated`);

    // ---- Case 2: tampered signature → 401, failure incremented
    const tampered = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0');
    r = await fetch(`${BASE}/api/ingest/v1/kr/${publicToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vega-Signature': tampered },
      body,
    });
    assert(r.status === 401, `tampered signature → 401 (got ${r.status})`);
    const errJson = await r.json();
    assert(errJson.error === 'invalid_token', `generic invalid_token body (got ${errJson.error})`);

    // ---- Case 3: missing signature → 401
    r = await fetch(`${BASE}/api/ingest/v1/kr/${publicToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert(r.status === 401, `missing signature → 401 (got ${r.status})`);

    // ---- Case 4: unknown token → 401
    const fakeToken = crypto.randomBytes(32).toString('hex');
    r = await fetch(`${BASE}/api/ingest/v1/kr/${fakeToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vega-Signature': 'sha256=0' },
      body,
    });
    assert(r.status === 401, `unknown token → 401 (got ${r.status})`);

    // ---- Case 5: disabled token → 403
    await db.update(krWebhookTokens).set({ enabled: false }).where(eq(krWebhookTokens.id, token.id));
    const sig2 = `sha256=${hmac(secret, body)}`;
    r = await fetch(`${BASE}/api/ingest/v1/kr/${publicToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vega-Signature': sig2 },
      body,
    });
    assert(r.status === 403, `disabled token → 403 (got ${r.status})`);

    // ---- Case 6: counters bumped + audit log rows present
    const [t2] = await db.select().from(krWebhookTokens).where(eq(krWebhookTokens.id, token.id));
    assert((t2?.successCount ?? 0) >= 1, `successCount >= 1 (got ${t2?.successCount})`);
    assert((t2?.failureCount ?? 0) >= 2, `failureCount >= 2 (got ${t2?.failureCount})`);
    assert(t2?.lastUsedAt instanceof Date, 'lastUsedAt is set');

    const logs = await db
      .select()
      .from(webhookIngestLogs)
      .where(eq(webhookIngestLogs.tokenId, token.id))
      .orderBy(desc(webhookIngestLogs.requestedAt));
    assert(logs.length >= 4, `audit log has >=4 entries (got ${logs.length})`);
    assert(logs.some((l) => l.statusCode === 200), 'has 200 audit row');
    assert(logs.some((l) => l.statusCode === 401 && l.errorCode === 'invalid_signature'), 'has invalid_signature audit row');
  } finally {
    // cleanup
    await db.delete(webhookIngestLogs).where(eq(webhookIngestLogs.tokenId, token.id));
    // delete check-ins from our run with source=webhook tied to this kr
    await db.delete(checkIns).where(and(eq(checkIns.entityId, kr.id), eq(checkIns.source, 'webhook')));
    await db.delete(krWebhookTokens).where(eq(krWebhookTokens.id, token.id));
    // restore KR
    await db.update(keyResults).set({ currentValue: kr.currentValue, progress: kr.progress }).where(eq(keyResults.id, kr.id));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  if (fail > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
