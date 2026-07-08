/**
 * Weekly AI Digest (Task #62)
 *
 * Every Monday at 06:00 in each tenant's local timezone the job picks the
 * opted-in active users in tenants whose admin has enabled the digest, builds
 * an AI-summarized snapshot of their owned objectives + key results, and emails
 * them. Falls back to a deterministic template if AI is unavailable.
 *
 * Idempotency: weekly_digest_sends is unique on (userId, periodStart), so the
 * job can re-run safely within a Monday window without re-sending.
 */
import { storage } from "../storage";
import { jobScheduler } from "./job-scheduler";
import { db } from "../db";
import {
  objectives,
  keyResults,
  checkIns,
  notifications,
  progressSnapshots,
  type Tenant,
  type User,
  type Objective,
  type KeyResult,
  type CheckIn,
} from "@shared/schema";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { sendWeeklyDigestEmail } from "../email";
import { getSimpleCompletion } from "../ai";
import { AI_FEATURES } from "@shared/schema";

const APP_URL = process.env.APP_URL || process.env.PUBLIC_URL || 'https://vega.synozur.com';

// ---------------------------------------------------------------------------
// Time helpers — anchored to a tenant's IANA timezone
// ---------------------------------------------------------------------------

interface TenantLocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun … 1=Mon … 6=Sat
}

export function getTenantLocalParts(timezone: string, when: Date = new Date()): TenantLocalParts {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(when).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
    );
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: parseInt(parts.year ?? '1970', 10),
      month: parseInt(parts.month ?? '1', 10),
      day: parseInt(parts.day ?? '1', 10),
      hour: parseInt(parts.hour === '24' ? '0' : (parts.hour ?? '0'), 10),
      minute: parseInt(parts.minute ?? '0', 10),
      dayOfWeek: wdMap[parts.weekday ?? 'Mon'] ?? 1,
    };
  } catch {
    // Fallback to UTC parts if the timezone string is invalid
    return {
      year: when.getUTCFullYear(),
      month: when.getUTCMonth() + 1,
      day: when.getUTCDate(),
      hour: when.getUTCHours(),
      minute: when.getUTCMinutes(),
      dayOfWeek: when.getUTCDay(),
    };
  }
}

/** YYYY-MM-DD for the Monday that begins the week containing `when` (in tenant local time). */
export function tenantLocalWeekStart(timezone: string, when: Date = new Date()): string {
  const p = getTenantLocalParts(timezone, when);
  // Days back to Monday: Mon→0, Tue→1, ..., Sun→6
  const back = (p.dayOfWeek + 6) % 7;
  // Construct a UTC anchor at the local date noon, then subtract days, then format in tz again.
  // Using noon avoids DST-crossing edge cases when subtracting whole days.
  const anchor = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - back);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(anchor); // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Digest payload
// ---------------------------------------------------------------------------

export interface DigestKrLine {
  id: string;
  title: string;
  progress: number;
  status: string | null;
  paceStatus: string | null;
  reason: string;
  url: string;
}

export interface DigestObjectiveLine {
  id: string;
  title: string;
  progress: number;
  status: string | null;
  url: string;
}

export interface DigestPayload {
  user: { id: string; name: string | null; email: string };
  tenant: { id: string; name: string };
  periodStart: string; // YYYY-MM-DD
  periodLabel: string; // "Week of Mar 4"
  narrative: string;
  needsAttention: DigestKrLine[]; // <=5
  wins: DigestKrLine[]; // <=3
  ownedCount: number;
  ownedObjectives: DigestObjectiveLine[];
  totalCheckInsThisWeek: number;
  aiUsed: boolean;
}

// ---------------------------------------------------------------------------
// Build digest data for a single user
// ---------------------------------------------------------------------------

async function getOwnedKeyResults(tenantId: string, userId: string, userEmail: string | null) {
  // KRs whose ownerId is the user
  const ownedKrs = await db
    .select()
    .from(keyResults)
    .where(and(eq(keyResults.tenantId, tenantId), eq(keyResults.ownerId, userId)));

  // Objectives owned by user (primary or by email)
  const emailLc = (userEmail ?? '').toLowerCase();
  const ownedObjs = await db
    .select()
    .from(objectives)
    .where(
      and(
        eq(objectives.tenantId, tenantId),
        or(
          eq(objectives.ownerId, userId),
          emailLc ? sql`lower(${objectives.ownerEmail}) = ${emailLc}` : sql`false`
        )
      )
    );

  // Pull KRs that belong to the user-owned objectives even if KR ownerId is set
  // to someone else — narrative cares about objective owner's holistic view.
  const objIds = ownedObjs.map((o) => o.id);
  let krsUnderOwnedObjectives: KeyResult[] = [];
  if (objIds.length > 0) {
    krsUnderOwnedObjectives = await db
      .select()
      .from(keyResults)
      .where(and(eq(keyResults.tenantId, tenantId), inArray(keyResults.objectiveId, objIds)));
  }

  // Merge KRs (dedupe by id)
  const krMap = new Map<string, KeyResult>();
  for (const kr of [...ownedKrs, ...krsUnderOwnedObjectives]) {
    krMap.set(kr.id, kr);
  }
  return { objectives: ownedObjs, keyResults: Array.from(krMap.values()) };
}

function isClosedOrCompleted(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'closed' || s === 'completed' || s === 'done';
}

function urlForObjective(objId: string): string {
  return `${APP_URL}/okrs?objectiveId=${objId}`;
}

function urlForKr(kr: KeyResult): string {
  return `${APP_URL}/okrs?objectiveId=${kr.objectiveId}&keyResultId=${kr.id}`;
}

function pacePriority(p: string | null | undefined): number {
  if (!p) return 0;
  const s = p.toLowerCase();
  if (s.includes('off') || s.includes('behind')) return 3;
  if (s.includes('at-risk') || s.includes('at_risk') || s.includes('at risk')) return 2;
  if (s.includes('on')) return 1;
  return 0;
}

export async function buildDigestForUser(params: {
  user: User;
  tenant: Tenant;
  periodStart: string; // Monday YYYY-MM-DD (tenant-local)
  weekStartDate: Date; // UTC Date corresponding to the Monday 00:00 tenant-local — used for filtering
}): Promise<DigestPayload> {
  const { user, tenant, periodStart, weekStartDate } = params;

  const { objectives: ownedObjs, keyResults: ownedKrs } = await getOwnedKeyResults(
    tenant.id,
    user.id,
    user.email
  );
  const activeObjs = ownedObjs.filter((o) => !isClosedOrCompleted(o.status));
  const activeKrs = ownedKrs.filter((k) => !isClosedOrCompleted(k.status));

  // Latest snapshot per KR for paceStatus
  let snapMap = new Map<string, { paceStatus: string | null; progress: number | null }>();
  if (activeKrs.length > 0) {
    const krIds = activeKrs.map((k) => k.id);
    const rows = await db
      .select({
        entityId: progressSnapshots.entityId,
        paceStatus: progressSnapshots.paceStatus,
        progress: progressSnapshots.progress,
        snapshotDate: progressSnapshots.snapshotDate,
      })
      .from(progressSnapshots)
      .where(
        and(
          eq(progressSnapshots.tenantId, tenant.id),
          eq(progressSnapshots.entityType, 'key_result'),
          inArray(progressSnapshots.entityId, krIds)
        )
      )
      .orderBy(desc(progressSnapshots.snapshotDate));
    for (const r of rows) {
      if (!snapMap.has(r.entityId)) {
        snapMap.set(r.entityId, { paceStatus: r.paceStatus, progress: r.progress ?? null });
      }
    }
  }

  // Check-ins in the last 7 days (per KR + total count)
  const since = new Date(weekStartDate.getTime() - 7 * 24 * 60 * 60 * 1000); // include prior week for delta
  const krIds = activeKrs.map((k) => k.id);
  let recentCheckIns: CheckIn[] = [];
  if (krIds.length > 0) {
    recentCheckIns = await db
      .select()
      .from(checkIns)
      .where(
        and(
          eq(checkIns.tenantId, tenant.id),
          eq(checkIns.entityType, 'key_result'),
          inArray(checkIns.entityId, krIds),
          gte(checkIns.createdAt, since)
        )
      )
      .orderBy(desc(checkIns.createdAt));
  }
  const checkInsThisWeek = recentCheckIns.filter((c) => (c.createdAt ?? new Date(0)) >= weekStartDate);

  // Build candidate KR lines
  const krLines: DigestKrLine[] = activeKrs.map((kr) => {
    const snap = snapMap.get(kr.id);
    const progress = Math.round((kr.progress ?? snap?.progress ?? 0) * 10) / 10;
    const paceStatus = snap?.paceStatus ?? null;
    return {
      id: kr.id,
      title: kr.title,
      progress,
      status: kr.status,
      paceStatus,
      reason: '',
      url: urlForKr(kr),
    };
  });

  // Needs attention: behind-pace + low-progress, top 5
  const needsAttention = [...krLines]
    .map((line) => {
      const pacePri = pacePriority(line.paceStatus);
      // Score combines pace severity and lack of progress. Higher = more attention.
      const score = pacePri * 100 + (100 - Math.min(100, line.progress));
      let reason = '';
      if (pacePri >= 3) reason = `Off pace (${line.progress}%)`;
      else if (pacePri === 2) reason = `At risk (${line.progress}%)`;
      else if (line.progress < 25) reason = `Low progress (${line.progress}%)`;
      else reason = `Needs attention (${line.progress}%)`;
      return { line, score, reason };
    })
    .filter((x) => x.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ line, reason }) => ({ ...line, reason }));

  // Wins: KRs with biggest positive progress delta this week, top 3
  const deltas = new Map<string, number>();
  for (const ci of recentCheckIns) {
    if ((ci.createdAt ?? new Date(0)) < weekStartDate) continue;
    const delta = (ci.newProgress ?? 0) - (ci.previousProgress ?? 0);
    if (delta > 0) {
      deltas.set(ci.entityId, (deltas.get(ci.entityId) ?? 0) + delta);
    }
  }
  const wins: DigestKrLine[] = krLines
    .map((line) => ({ line, delta: deltas.get(line.id) ?? 0 }))
    .filter((x) => x.delta >= 5 || x.line.progress >= 90)
    .sort((a, b) => b.delta - a.delta || b.line.progress - a.line.progress)
    .slice(0, 3)
    .map(({ line, delta }) => ({
      ...line,
      reason:
        delta >= 5
          ? `+${Math.round(delta)}% this week`
          : `Strong: ${line.progress}% complete`,
    }));

  // Ownership summary
  const ownedObjLines: DigestObjectiveLine[] = activeObjs.slice(0, 8).map((o) => ({
    id: o.id,
    title: o.title,
    progress: Math.round((o.progress ?? 0) * 10) / 10,
    status: o.status,
    url: urlForObjective(o.id),
  }));

  // Period label "Week of Mar 4"
  const [py, pm, pd] = periodStart.split('-').map((x) => parseInt(x, 10));
  const periodLabel = new Date(Date.UTC(py, pm - 1, pd)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: tenant.weeklyDigestTimezone,
  });

  // AI narrative (with deterministic fallback)
  const baseFacts = {
    name: user.name ?? user.email,
    ownedObjectives: activeObjs.length,
    ownedKeyResults: activeKrs.length,
    needsAttention: needsAttention.map((x) => `${x.title} — ${x.reason}`),
    wins: wins.map((x) => `${x.title} — ${x.reason}`),
    checkInsThisWeek: checkInsThisWeek.length,
  };

  let narrative: string;
  let aiUsed = false;
  try {
    const systemPrompt =
      'You are Vega, a concise OKR coach. Write a 2-3 sentence personal weekly summary in second person ("you"). ' +
      'Acknowledge wins where they exist; gently surface what needs attention. Plain text only. No markdown, no lists, no emojis. ' +
      'Keep it warm but professional and under 60 words.';
    const userMessage =
      `User: ${baseFacts.name}\nTenant: ${tenant.name}\nWeek of: ${periodLabel}\n` +
      `Owned objectives: ${baseFacts.ownedObjectives}\nOwned key results: ${baseFacts.ownedKeyResults}\n` +
      `Check-ins this week: ${baseFacts.checkInsThisWeek}\n` +
      `Wins:\n${baseFacts.wins.length ? baseFacts.wins.map((w) => `- ${w}`).join('\n') : '- (none yet)'}\n` +
      `Needs attention:\n${
        baseFacts.needsAttention.length ? baseFacts.needsAttention.map((w) => `- ${w}`).join('\n') : '- (none)'
      }`;

    const aiText = await getSimpleCompletion(
      systemPrompt,
      userMessage,
      { tenantId: tenant.id, maxTokens: 1000 }, // Increased for GPT-5 reasoning tokens
      AI_FEATURES.CHAT
    );
    narrative = (aiText || '').trim();
    if (!narrative) throw new Error('Empty AI response');
    aiUsed = true;
  } catch (err) {
    console.warn('[WeeklyDigest] AI narrative failed, using deterministic fallback:', (err as Error).message);
    const winText = wins.length ? `${wins.length} win${wins.length === 1 ? '' : 's'} this week` : 'no logged wins yet this week';
    const needText = needsAttention.length
      ? `${needsAttention.length} item${needsAttention.length === 1 ? '' : 's'} need${needsAttention.length === 1 ? 's' : ''} attention`
      : 'nothing flagged for attention';
    narrative = `Here's your weekly summary, ${baseFacts.name}. You logged ${baseFacts.checkInsThisWeek} check-in${
      baseFacts.checkInsThisWeek === 1 ? '' : 's'
    } across ${baseFacts.ownedKeyResults} key result${baseFacts.ownedKeyResults === 1 ? '' : 's'}, with ${winText} and ${needText}.`;
  }

  return {
    user: { id: user.id, name: user.name ?? null, email: user.email },
    tenant: { id: tenant.id, name: tenant.name },
    periodStart,
    periodLabel: `Week of ${periodLabel}`,
    narrative,
    needsAttention,
    wins,
    ownedCount: activeObjs.length + activeKrs.length,
    ownedObjectives: ownedObjLines,
    totalCheckInsThisWeek: checkInsThisWeek.length,
    aiUsed,
  };
}

// ---------------------------------------------------------------------------
// Per-user send (idempotent via weekly_digest_sends unique(userId, periodStart))
// ---------------------------------------------------------------------------

export async function sendDigestForUser(params: {
  user: User;
  tenant: Tenant;
  periodStart: string;
  weekStartDate: Date;
  force?: boolean;
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string; aiUsed?: boolean }> {
  const { user, tenant, periodStart, weekStartDate, force } = params;

  if (!force) {
    const existing = await storage.getWeeklyDigestSend(user.id, periodStart);
    if (existing && existing.status === 'sent') {
      return { status: 'skipped', reason: 'already-sent' };
    }
  }

  if (!user.notifPrefWeeklyDigest) {
    await storage.recordWeeklyDigestSend({
      tenantId: tenant.id,
      userId: user.id,
      periodStart,
      status: 'skipped',
      aiUsed: false,
      errorMessage: 'user-opted-out',
    });
    return { status: 'skipped', reason: 'user-opted-out' };
  }

  try {
    const payload = await buildDigestForUser({ user, tenant, periodStart, weekStartDate });
    await sendWeeklyDigestEmail(user.email, payload);
    await storage.recordWeeklyDigestSend({
      tenantId: tenant.id,
      userId: user.id,
      periodStart,
      status: 'sent',
      aiUsed: payload.aiUsed,
      errorMessage: null,
    });
    return { status: 'sent', aiUsed: payload.aiUsed };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[WeeklyDigest] Send failed for user ${user.id}:`, msg);
    try {
      await storage.recordWeeklyDigestSend({
        tenantId: tenant.id,
        userId: user.id,
        periodStart,
        status: 'failed',
        aiUsed: false,
        errorMessage: msg.slice(0, 500),
      });
    } catch (_) {}
    return { status: 'failed', reason: msg };
  }
}

// ---------------------------------------------------------------------------
// Job: hourly tick. For each enabled tenant, if local time is Monday 06:00–06:59,
// enqueue digest sends for opted-in active users.
// ---------------------------------------------------------------------------

const SEND_HOUR_LOCAL = 6; // 6am local — gives clients delivery time before 7am

export async function runWeeklyDigestJob(opts: { force?: boolean; nowOverride?: Date } = {}) {
  const now = opts.nowOverride ?? new Date();
  const tenantsAll = await storage.getAllTenants();
  const enabled = tenantsAll.filter((t) => t.weeklyDigestEnabled);

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const tenantDetails: any[] = [];

  for (const tenant of enabled) {
    const tz = tenant.weeklyDigestTimezone || 'America/Los_Angeles';
    const parts = getTenantLocalParts(tz, now);
    const isWindow = parts.dayOfWeek === 1 && parts.hour === SEND_HOUR_LOCAL;
    if (!opts.force && !isWindow) {
      tenantDetails.push({
        tenant: tenant.name,
        skipped: true,
        reason: `not in send window (local ${parts.dayOfWeek === 1 ? 'Mon' : 'day=' + parts.dayOfWeek} ${parts.hour}:00)`,
      });
      continue;
    }

    const periodStart = tenantLocalWeekStart(tz, now);
    // Compute UTC anchor for the local Monday 00:00 to use as week-start filter.
    const [py, pm, pd] = periodStart.split('-').map((x) => parseInt(x, 10));
    const weekStartUtc = new Date(Date.UTC(py, pm - 1, pd, 0, 0, 0));

    const tenantUsers = await storage.getAllUsers(tenant.id);
    const activeUsers = tenantUsers.filter(
      (u) => !!u.email && u.role !== 'inactive' && (u as any).deletedAt == null && u.notifPrefWeeklyDigest
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const userDetails: any[] = [];
    for (const user of activeUsers) {
      const res = await sendDigestForUser({
        user,
        tenant,
        periodStart,
        weekStartDate: weekStartUtc,
        force: opts.force,
      });
      if (res.status === 'sent') sent++;
      else if (res.status === 'skipped') skipped++;
      else failed++;
      userDetails.push({ email: user.email, ...res });
    }

    totalSent += sent;
    totalSkipped += skipped;
    totalFailed += failed;
    tenantDetails.push({
      tenant: tenant.name,
      tenantId: tenant.id,
      timezone: tz,
      periodStart,
      eligible: activeUsers.length,
      sent,
      skipped,
      failed,
      users: userDetails,
    });
  }

  return {
    summary:
      enabled.length === 0
        ? 'No tenants have weekly digest enabled'
        : `Weekly digest: ${totalSent} sent, ${totalSkipped} skipped, ${totalFailed} failed across ${enabled.length} tenant(s)`,
    details: { sent: totalSent, skipped: totalSkipped, failed: totalFailed, tenants: tenantDetails },
  };
}

// ---------------------------------------------------------------------------
// Schedule helpers — run at top of every hour so we hit the local 6am window
// ---------------------------------------------------------------------------

let weeklyDigestTimer: NodeJS.Timeout | null = null;

function msUntilNextHourTopPlus1Min(): number {
  const now = new Date();
  const ms =
    (60 - now.getMinutes() - 1) * 60 * 1000 +
    (60 - now.getSeconds()) * 1000 +
    (1000 - (now.getMilliseconds() % 1000));
  // fire at HH:01 of the next hour to safely cross the boundary
  return ms > 0 ? ms : 60 * 60 * 1000;
}

export function startWeeklyDigestScheduler(): void {
  if (weeklyDigestTimer) {
    clearTimeout(weeklyDigestTimer);
    weeklyDigestTimer = null;
  }
  const armNext = async () => {
    const ms = msUntilNextHourTopPlus1Min();
    const nextRunAt = new Date(Date.now() + ms);
    weeklyDigestTimer = setTimeout(async () => {
      try {
        await jobScheduler.runJob('weekly-digest', 'schedule');
      } catch (err) {
        console.error('[WeeklyDigest] hourly invocation failed:', err);
      } finally {
        armNext();
      }
    }, ms);
    try {
      const job = await storage.getScheduledJobByName('weekly-digest');
      if (job) {
        await storage.updateScheduledJob(job.id, { nextRunAt });
      }
    } catch (_) {}
    console.log(`[WeeklyDigest] Next hourly check in ${Math.round(ms / 60000)}min (~${nextRunAt.toISOString()})`);
  };
  armNext();
}
