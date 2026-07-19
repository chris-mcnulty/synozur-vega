import { storage } from "../storage";
import { calculatePaceMetrics, type CheckInData } from "../okr-intelligence";
import { jobScheduler } from "./job-scheduler";
import type { CheckIn, ProgressSnapshot } from "@shared/schema";
import { db } from "../db";
import { progressSnapshots } from "@shared/schema";

/**
 * Returns true if the progress_snapshots table contains at least one row.
 * Used to gate the historical backfill on startup so it only runs against
 * an empty schema.
 */
export async function hasAnyProgressSnapshots(): Promise<boolean> {
  const rows = await db.select({ id: progressSnapshots.id }).from(progressSnapshots).limit(1);
  return rows.length > 0;
}

const PACIFIC_TZ = "America/Los_Angeles";

/**
 * Return the confidence value from the most-recent check-in (by asOfDate)
 * that has a non-null confidence. Returns null when no check-in supplied one.
 */
function latestConfidence(checkInList: CheckIn[]): number | null {
  let bestTs = -Infinity;
  let best: number | null = null;
  for (const c of checkInList) {
    if (c.confidence == null) continue;
    const ts = new Date(c.asOfDate || c.createdAt || 0).getTime();
    if (ts >= bestTs) {
      bestTs = ts;
      best = c.confidence;
    }
  }
  return best;
}

/**
 * Compute today's date string (YYYY-MM-DD) in America/Los_Angeles (Pacific Time).
 * Uses Intl APIs so it follows DST automatically.
 */
export function getPacificDateString(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' formats as YYYY-MM-DD
  return fmt.format(date);
}

/**
 * Returns the milliseconds remaining until the next Pacific 00:05 (5 minutes
 * past midnight) — used to anchor the daily snapshot job to a Pacific-day
 * boundary regardless of when the server started or how many times it has
 * restarted. The 5-minute buffer avoids running before the day flips on the
 * clock of any straggling clients/services.
 */
export function msUntilNextPacificMidnight(now: Date = new Date()): number {
  // Get current Pacific date components
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const pacificH = parseInt(parts.hour ?? '0', 10);
  const pacificM = parseInt(parts.minute ?? '0', 10);
  const pacificS = parseInt(parts.second ?? '0', 10);
  const msSinceMidnight = ((pacificH * 60 + pacificM) * 60 + pacificS) * 1000 + (now.getTime() % 1000);

  const oneDay = 24 * 60 * 60 * 1000;
  const fiveMinBuffer = 5 * 60 * 1000;
  let ms = oneDay - msSinceMidnight + fiveMinBuffer;
  if (ms <= 0) ms += oneDay;
  return ms;
}

/**
 * Capture today's snapshot for one entity (objective or key_result).
 * Idempotent — repeated calls within the same Pacific day update in place.
 */
export async function captureEntitySnapshot(params: {
  tenantId: string;
  entityType: 'objective' | 'key_result';
  entityId: string;
  progress: number;
  status: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  quarter?: number | null;
  year?: number | null;
  targetValue?: number;
  checkIns?: CheckInData[];
  confidence?: number | null;
  source?: string;
  snapshotDate?: string;
}): Promise<ProgressSnapshot> {
  const date = params.snapshotDate || getPacificDateString();

  // Compute paceStatus at capture time so historical pace is preserved
  const pace = calculatePaceMetrics({
    progress: params.progress,
    startDate: params.startDate,
    endDate: params.endDate,
    quarter: params.quarter,
    year: params.year,
    checkIns: params.checkIns ?? [],
    targetValue: params.targetValue,
  });

  return storage.upsertProgressSnapshot({
    tenantId: params.tenantId,
    entityType: params.entityType,
    entityId: params.entityId,
    snapshotDate: date,
    progress: params.progress,
    status: params.status,
    paceStatus: pace.status,
    confidence: params.confidence ?? null,
    source: params.source ?? 'job',
  });
}

/**
 * Daily snapshot job — captures one row per active objective and key result per tenant.
 * Skips entities with status='closed'.
 */
export async function runDailySnapshotJob(opts?: { tenantId?: string }): Promise<{ summary: string; details: any }> {
  const today = getPacificDateString();
  const tenants = opts?.tenantId
    ? [await storage.getTenantById(opts.tenantId)].filter((t): t is NonNullable<typeof t> => !!t)
    : await storage.getAllTenants();

  let objectiveCount = 0;
  let keyResultCount = 0;
  let tenantCount = 0;
  const failures: Array<{ entity: string; error: string }> = [];

  for (const tenant of tenants) {
    try {
      const objectives = await storage.getObjectivesByTenantId(tenant.id);
      const activeObjectives = objectives.filter(o => o.status !== 'closed');
      if (activeObjectives.length === 0) continue;
      tenantCount++;

      const objectiveIds = activeObjectives.map(o => o.id);
      const objectiveCheckInsMap = await storage.getCheckInsByEntityIds('objective', objectiveIds);

      for (const obj of activeObjectives) {
        try {
          const checkIns = objectiveCheckInsMap.get(obj.id) || [];
          await captureEntitySnapshot({
            tenantId: tenant.id,
            entityType: 'objective',
            entityId: obj.id,
            progress: obj.progress ?? 0,
            status: obj.status ?? null,
            startDate: obj.startDate,
            endDate: obj.endDate,
            quarter: obj.quarter,
            year: obj.year,
            targetValue: 100,
            checkIns: checkIns.map(c => ({
              asOfDate: c.asOfDate || c.createdAt!,
              newProgress: c.newProgress ?? 0,
              previousProgress: c.previousProgress ?? 0,
              confidence: c.confidence ?? null,
            })),
            confidence: latestConfidence(checkIns),
            source: 'job',
            snapshotDate: today,
          });
          objectiveCount++;
        } catch (err: any) {
          failures.push({ entity: `objective:${obj.id}`, error: err?.message || String(err) });
        }
      }

      const allKRs = await storage.getKeyResultsByTenantId(tenant.id);
      const activeKRs = allKRs.filter(kr => kr.status !== 'closed');
      if (activeKRs.length === 0) continue;

      const krIds = activeKRs.map(kr => kr.id);
      const krCheckInsMap = await storage.getCheckInsByEntityIds('key_result', krIds);
      const objMap = new Map(activeObjectives.map(o => [o.id, o]));

      for (const kr of activeKRs) {
        try {
          const parent = kr.objectiveId ? objMap.get(kr.objectiveId) : undefined;
          const checkIns = krCheckInsMap.get(kr.id) || [];
          await captureEntitySnapshot({
            tenantId: tenant.id,
            entityType: 'key_result',
            entityId: kr.id,
            progress: kr.progress ?? 0,
            status: kr.status ?? null,
            startDate: parent?.startDate,
            endDate: parent?.endDate,
            quarter: parent?.quarter,
            year: parent?.year,
            // kr.progress is already a 0-100 percentage; use 100 so pace math
            // operates on the same scale as the progress value.
            targetValue: 100,
            checkIns: checkIns.map(c => ({
              asOfDate: c.asOfDate || c.createdAt!,
              newProgress: c.newProgress ?? 0,
              previousProgress: c.previousProgress ?? 0,
              confidence: c.confidence ?? null,
            })),
            confidence: latestConfidence(checkIns),
            source: 'job',
            snapshotDate: today,
          });
          keyResultCount++;
        } catch (err: any) {
          failures.push({ entity: `key_result:${kr.id}`, error: err?.message || String(err) });
        }
      }
    } catch (err: any) {
      failures.push({ entity: `tenant:${tenant.id}`, error: err?.message || String(err) });
    }
  }

  const total = objectiveCount + keyResultCount;
  const tenantLevelFailures = failures.filter(f => f.entity.startsWith('tenant:')).length;
  const attempted = total + failures.length;

  // Build an accurate summary that distinguishes three distinct outcomes:
  //  A) Genuine empty: all tenants were visited but had no active OKRs → no-op success
  //  B) Systemic error: every tenant-level query failed (e.g. missing DB column) → failures.length > 0, total = 0
  //  C) Partial success: some snapshots captured, some failed
  const summary = total > 0
    ? `Captured ${total} snapshots (${objectiveCount} objectives, ${keyResultCount} key results) across ${tenantCount} tenants for ${today}${failures.length > 0 ? ` — ${failures.length} failures` : ''}`
    : failures.length > 0
      ? `Snapshot job failed for all ${tenantLevelFailures} tenant(s) — no snapshots captured (${failures[0]?.error ?? 'unknown error'})`
      : 'No active OKRs to snapshot';

  const details = { snapshotDate: today, tenantCount, objectiveCount, keyResultCount, failures: failures.slice(0, 25) };

  // Surface material failures to the job scheduler so the dashboard alerts
  // accurately. Threshold: any tenant-level failure, or >5% entity failures,
  // or zero successes when entities were attempted.
  // NOTE: total=0 with failures=0 (case A above) is a valid no-op — don't throw.
  const failureRatio = attempted > 0 ? failures.length / attempted : 0;
  const allFailed = attempted > 0 && total === 0;
  if (tenantLevelFailures > 0 || failureRatio > 0.05 || allFailed) {
    const err = new Error(
      `Daily snapshot job had material failures: ${failures.length} failures of ${attempted} attempts ` +
      `(tenant-level: ${tenantLevelFailures}). ${summary}`,
    );
    (err as any).details = details;
    throw err;
  }

  return { summary, details };
}

/**
 * Add `days` whole calendar days to a Pacific YYYY-MM-DD string and return the
 * resulting Pacific YYYY-MM-DD string. Anchored at noon Pacific to avoid DST
 * boundary issues.
 */
export function addPacificDays(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00-08:00`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return getPacificDateString(anchor);
}

/**
 * Backfill snapshots from existing check-in history.
 *
 * Produces a *continuous* daily history from each entity's first activity
 * through today: for any day without an explicit check-in, the previous day's
 * progress is carried forward. Pace status is recomputed for each day using
 * only the check-ins that existed up to that day.
 *
 * Always idempotent (uses upsert). Recoverable — re-running covers any gaps
 * that were missed previously without reprocessing rows that are already in
 * the desired state. By default only fills missing days; pass
 * `force: true` to recompute every snapshot regardless of what is on disk.
 */
export async function backfillSnapshotsFromCheckIns(opts?: {
  force?: boolean;
  tenantId?: string;
}): Promise<{ summary: string; details: any }> {
  const tenants = opts?.tenantId
    ? [await storage.getTenantById(opts.tenantId)].filter((t): t is NonNullable<typeof t> => !!t)
    : await storage.getAllTenants();
  const force = !!opts?.force;
  const today = getPacificDateString();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let tenantsBackfilled = 0;
  const failures: Array<{ tenant: string; entity?: string; error: string }> = [];

  for (const tenant of tenants) {
    try {
      const checkIns = await storage.getCheckInsByTenantId(tenant.id);
      if (checkIns.length === 0) continue;

      const objectives = await storage.getObjectivesByTenantId(tenant.id);
      const objectiveById = new Map(objectives.map(o => [o.id, o]));
      const allKRs = await storage.getKeyResultsByTenantId(tenant.id);
      const krById = new Map(allKRs.map(kr => [kr.id, kr]));

      // Group check-ins by (entityType, entityId)
      const grouped = new Map<string, CheckIn[]>();
      for (const ci of checkIns) {
        if (ci.entityType !== 'objective' && ci.entityType !== 'key_result') continue;
        const key = `${ci.entityType}::${ci.entityId}`;
        const list = grouped.get(key) || [];
        list.push(ci);
        grouped.set(key, list);
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const [key, entityCheckIns] of Array.from(grouped.entries())) {
        const [entityType, entityId] = key.split('::') as ['objective' | 'key_result', string];

        try {
          // Sort ascending by asOfDate
          const sorted = [...entityCheckIns].sort((a, b) => {
            const ad = new Date(a.asOfDate || a.createdAt || 0).getTime();
            const bd = new Date(b.asOfDate || b.createdAt || 0).getTime();
            return ad - bd;
          });

          // For each Pacific day, find the latest check-in with date <= that day.
          // Build a map of explicit-check-in days to use as anchors.
          const explicitDays = new Map<string, CheckIn>();
          for (const ci of sorted) {
            const dt = ci.asOfDate || ci.createdAt;
            if (!dt) continue;
            const dateStr = getPacificDateString(new Date(dt));
            // Last write wins so the latest check-in on a given Pacific day is the
            // authoritative progress for that day.
            explicitDays.set(dateStr, ci);
          }
          if (explicitDays.size === 0) continue;

          // Determine date range: from first check-in's day through today
          const firstDay = getPacificDateString(new Date(sorted[0].asOfDate || sorted[0].createdAt!));
          const startDay = firstDay;
          const endDay = today;

          // Pre-compute the full check-in series for pace calculation
          const allCheckInData: CheckInData[] = sorted.map(c => ({
            asOfDate: new Date(c.asOfDate || c.createdAt!),
            newProgress: c.newProgress ?? 0,
            previousProgress: c.previousProgress ?? 0,
            confidence: c.confidence ?? null,
          }));

          // Resolve entity context (period dates / target / quarter) for pace calc
          let periodStart: Date | string | null | undefined;
          let periodEnd: Date | string | null | undefined;
          let quarter: number | null | undefined;
          let year: number | null | undefined;
          let targetValue = 100;

          if (entityType === 'objective') {
            const obj = objectiveById.get(entityId);
            if (!obj) continue;
            periodStart = obj.startDate;
            periodEnd = obj.endDate;
            quarter = obj.quarter;
            year = obj.year;
          } else {
            const kr = krById.get(entityId);
            if (!kr) continue;
            // progress (from check-ins) is already a 0-100 percentage, so
            // targetValue must also be 100 so the pace gap math is on the same scale.
            targetValue = 100;
            const parent = kr.objectiveId ? objectiveById.get(kr.objectiveId) : undefined;
            periodStart = parent?.startDate;
            periodEnd = parent?.endDate;
            quarter = parent?.quarter;
            year = parent?.year;
          }

          // Find existing snapshots for this entity so we only fill missing days
          // (unless force=true). Keyed by snapshotDate.
          const existingSnapshots = await storage.getProgressSnapshotsByEntity(entityType, entityId);
          const existingByDate = new Map(existingSnapshots.map(s => [s.snapshotDate, s]));

          // Walk every Pacific day from startDay → endDay, carrying forward the
          // most recent check-in's progress when no check-in exists for that day.
          let currentStatus: string | null = null;
          let currentProgress = 0;
          let currentConfidence: number | null = null;
          let dateStr = startDay;
          let safety = 0;
          while (safety++ < 4000) { // ~10y safety bound; far more than any realistic OKR period
            const explicit = explicitDays.get(dateStr);
            if (explicit) {
              currentProgress = explicit.newProgress ?? currentProgress;
              currentStatus = explicit.newStatus ?? currentStatus;
              if (explicit.confidence != null) currentConfidence = explicit.confidence;
            }

            const existing = existingByDate.get(dateStr);
            const shouldWrite = force || !existing;

            if (shouldWrite) {
              const dayEndMs = new Date(`${dateStr}T23:59:59.999-08:00`).getTime();
              const checkInsUpToDay = allCheckInData.filter(c => c.asOfDate.getTime() <= dayEndMs);

              await captureEntitySnapshot({
                tenantId: tenant.id,
                entityType,
                entityId,
                progress: currentProgress,
                status: currentStatus,
                startDate: periodStart,
                endDate: periodEnd,
                quarter,
                year,
                targetValue,
                checkIns: checkInsUpToDay,
                confidence: currentConfidence,
                source: 'backfill',
                snapshotDate: dateStr,
              });
              if (existing) updated++;
              else inserted++;
            } else {
              skipped++;
            }

            if (dateStr === endDay) break;
            dateStr = addPacificDays(dateStr, 1);
          }
        } catch (err: any) {
          failures.push({
            tenant: tenant.id,
            entity: `${entityType}:${entityId}`,
            error: err?.message || String(err),
          });
        }
      }

      // Second pass: derive objective snapshots from KR history for any
      // objective that lacks direct check-in coverage. OKR workflows commonly
      // update KRs and let the objective progress roll up; without this pass
      // those objectives would have no historical snapshots even though their
      // KRs do, defeating the purpose of stable forecast/velocity history.
      try {
        // Build per-KR daily progress (carry-forward) series from check-ins.
        const krDailyProgress = new Map<string, Map<string, number>>(); // krId -> (date -> progress)
        for (const kr of allKRs) {
          if (kr.status === 'closed') continue;
          const krCheckIns = (grouped.get(`key_result::${kr.id}`) || []).slice().sort((a, b) => {
            const ad = new Date(a.asOfDate || a.createdAt || 0).getTime();
            const bd = new Date(b.asOfDate || b.createdAt || 0).getTime();
            return ad - bd;
          });
          if (krCheckIns.length === 0) continue;
          const firstDay = getPacificDateString(new Date(krCheckIns[0].asOfDate || krCheckIns[0].createdAt!));
          const explicit = new Map<string, number>();
          for (const ci of krCheckIns) {
            const d = ci.asOfDate || ci.createdAt;
            if (!d) continue;
            explicit.set(getPacificDateString(new Date(d)), ci.newProgress ?? 0);
          }
          const series = new Map<string, number>();
          let cur = 0;
          let day = firstDay;
          let s = 0;
          while (s++ < 4000) {
            const ex = explicit.get(day);
            if (ex !== undefined) cur = ex;
            series.set(day, cur);
            if (day === today) break;
            day = addPacificDays(day, 1);
          }
          krDailyProgress.set(kr.id, series);
        }

        for (const obj of objectives) {
          if (obj.status === 'closed') continue;
          // Skip if this objective already had direct check-in history that
          // produced snapshots (the main loop already wrote those).
          const hadDirect = grouped.has(`objective::${obj.id}`);
          if (hadDirect) continue;

          const objKRs = allKRs.filter(kr => kr.objectiveId === obj.id && kr.status !== 'closed');
          const krSeries = objKRs
            .map(kr => krDailyProgress.get(kr.id))
            .filter((s): s is Map<string, number> => !!s);
          if (krSeries.length === 0) continue;

          // Determine date range = earliest KR-history day → today
          let earliest: string | null = null;
          for (const s of krSeries) {
            for (const d of Array.from(s.keys())) {
              if (!earliest || d < earliest) earliest = d;
            }
          }
          if (!earliest) continue;

          const existingSnapshots = await storage.getProgressSnapshotsByEntity('objective', obj.id);
          const existingByDate = new Map(existingSnapshots.map(snap => [snap.snapshotDate, snap]));

          let day = earliest;
          let s = 0;
          while (s++ < 4000) {
            const existing = existingByDate.get(day);
            if (force || !existing) {
              // Average KR progress as-of `day` (carry-forward; KRs without
              // any history yet contribute 0, matching live derivation).
              let sum = 0;
              for (const ser of krSeries) {
                // Find latest entry with key <= day
                let latest = 0;
                for (const [k, v] of Array.from(ser.entries())) {
                  if (k <= day) latest = v;
                  else break;
                }
                sum += Math.min(100, Math.max(0, latest));
              }
              const derived = Math.round(sum / krSeries.length);

              try {
                await captureEntitySnapshot({
                  tenantId: tenant.id,
                  entityType: 'objective',
                  entityId: obj.id,
                  progress: derived,
                  status: obj.status ?? null,
                  startDate: obj.startDate,
                  endDate: obj.endDate,
                  quarter: obj.quarter,
                  year: obj.year,
                  targetValue: 100,
                  checkIns: [], // pace metrics fall back to status-only when no series available
                  source: 'backfill_derived',
                  snapshotDate: day,
                });
                if (existing) updated++; else inserted++;
              } catch (err: any) {
                failures.push({
                  tenant: tenant.id,
                  entity: `objective:${obj.id}`,
                  error: err?.message || String(err),
                });
              }
            } else {
              skipped++;
            }
            if (day === today) break;
            day = addPacificDays(day, 1);
          }
        }
      } catch (err: any) {
        failures.push({ tenant: tenant.id, error: `derived-objective-pass: ${err?.message || String(err)}` });
      }

      totalInserted += inserted;
      totalUpdated += updated;
      totalSkipped += skipped;
      if (inserted > 0 || updated > 0) tenantsBackfilled++;
    } catch (err: any) {
      failures.push({ tenant: tenant.id, error: err?.message || String(err) });
    }
  }

  const totalWritten = totalInserted + totalUpdated;
  return {
    summary: totalWritten > 0
      ? `Backfilled ${totalInserted} new + ${totalUpdated} updated snapshots across ${tenantsBackfilled} tenants (${totalSkipped} already up to date)`
      : `No backfill needed (${totalSkipped} snapshots already in place)`,
    details: { totalInserted, totalUpdated, totalSkipped, tenantsBackfilled, force, failures: failures.slice(0, 25) },
  };
}

/**
 * Convert progress snapshots into the CheckInData shape consumed by
 * calculatePaceMetrics / calculateCompletionForecast.
 *
 * Each snapshot becomes a synthetic data point: asOfDate = snapshot day at noon Pacific,
 * newProgress = snapshot.progress, previousProgress = previous snapshot's progress (or 0).
 */
export function snapshotsToCheckInData(snapshots: ProgressSnapshot[]): CheckInData[] {
  if (snapshots.length === 0) return [];
  // snapshots are already returned ascending by snapshotDate
  const result: CheckInData[] = [];
  let prev = 0;
  for (const s of snapshots) {
    const asOfDate = new Date(`${s.snapshotDate}T12:00:00-08:00`);
    const newProgress = s.progress ?? 0;
    result.push({
      asOfDate,
      newProgress,
      previousProgress: prev,
      confidence: s.confidence ?? null,
    });
    prev = newProgress;
  }
  return result;
}

/**
 * Build the trend series for one entity. Prefers daily progress snapshots
 * (stable, edit-proof history). Falls back to raw check-ins when no snapshots
 * have been captured yet for this entity.
 */
export async function getTrendSeriesForEntity(
  entityType: 'objective' | 'key_result',
  entityId: string
): Promise<CheckInData[]> {
  const snapshots = await storage.getProgressSnapshotsByEntity(entityType, entityId);
  if (snapshots.length > 0) {
    return snapshotsToCheckInData(snapshots);
  }
  // Storage returns check-ins in descending date order; trend consumers
  // (chart, pace, forecast) all expect ascending. Sort before returning.
  const checkIns = await storage.getCheckInsByEntityId(entityType, entityId);
  return checkIns
    .map(c => ({
      asOfDate: c.asOfDate || c.createdAt!,
      newProgress: c.newProgress ?? 0,
      previousProgress: c.previousProgress ?? 0,
      confidence: c.confidence ?? null,
    }))
    .sort((a, b) => new Date(a.asOfDate).getTime() - new Date(b.asOfDate).getTime());
}

/**
 * Batched version of getTrendSeriesForEntity. Returns a Map keyed by entityId.
 */
export async function getTrendSeriesForEntities(
  entityType: 'objective' | 'key_result',
  entityIds: string[]
): Promise<Map<string, CheckInData[]>> {
  const result = new Map<string, CheckInData[]>();
  if (entityIds.length === 0) return result;

  const snapshotMap = await storage.getProgressSnapshotsByEntityIds(entityType, entityIds);
  const missingIds: string[] = [];
  for (const id of entityIds) {
    const snaps = snapshotMap.get(id);
    if (snaps && snaps.length > 0) {
      result.set(id, snapshotsToCheckInData(snaps));
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    const checkInMap = await storage.getCheckInsByEntityIds(entityType, missingIds);
    for (const id of missingIds) {
      const checkIns = checkInMap.get(id) || [];
      result.set(
        id,
        checkIns
          .map(c => ({
            asOfDate: c.asOfDate || c.createdAt!,
            newProgress: c.newProgress ?? 0,
            previousProgress: c.previousProgress ?? 0,
            confidence: c.confidence ?? null,
          }))
          .sort((a, b) => new Date(a.asOfDate).getTime() - new Date(b.asOfDate).getTime()),
      );
    }
  }
  return result;
}

let pacificMidnightTimer: NodeJS.Timeout | null = null;

/**
 * Schedule the daily snapshot job to run at the next Pacific 00:05 and then
 * every 24 Pacific hours after that. Uses a self-rescheduling setTimeout so
 * the next fire is recomputed against Pacific time after each run — keeping
 * the schedule anchored to a Pacific-day boundary across DST transitions.
 *
 * The timer runs in process; if the server restarts, this function is called
 * again on startup to re-anchor to the next Pacific midnight.
 */
export function startPacificMidnightScheduler(): void {
  if (pacificMidnightTimer) {
    clearTimeout(pacificMidnightTimer);
    pacificMidnightTimer = null;
  }

  const armNext = async () => {
    const ms = msUntilNextPacificMidnight();
    const nextRunAt = new Date(Date.now() + ms);
    pacificMidnightTimer = setTimeout(async () => {
      try {
        await jobScheduler.runJob('daily-progress-snapshots', 'schedule');
      } catch (err) {
        console.error('[ProgressSnapshots] Pacific-midnight job invocation failed:', err);
      } finally {
        // Re-arm against the *new* current time to stay anchored to Pacific
        armNext();
      }
    }, ms);
    // Persist the real next-run time so the Jobs dashboard reflects the
    // actual Pacific-anchored schedule rather than "now + intervalMs".
    try {
      const job = await storage.getScheduledJobByName('daily-progress-snapshots');
      if (job) {
        await storage.updateScheduledJob(job.id, { nextRunAt });
      }
    } catch (err) {
      console.error('[ProgressSnapshots] Failed to persist nextRunAt:', err);
    }
    console.log(`[ProgressSnapshots] Next Pacific-midnight run in ${Math.round(ms / 60000)}min (~${nextRunAt.toISOString()})`);
  };

  armNext();
}
