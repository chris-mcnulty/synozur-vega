import { Router, Request, Response } from "express";
import type {
  Foundation,
  Strategy,
  Team,
  Objective,
  KeyResult,
  BigRock,
  Meeting,
  CheckIn,
  AnnualGoal,
} from "@shared/schema";
import { storage } from "./storage";
import { addPacificDays } from "./services/progress-snapshots";

export const dashboardRouter = Router();
export const execRouter = Router();

// ============================================
// EXEC: Confidence Drops
// ============================================
//
// Returns objectives + key results whose latest owner-reported confidence has
// dropped at least 0.3 below the prior 4-week average. Requires data points in
// at least 4 distinct prior weekly buckets so we don't fire on a single noisy
// reading.
execRouter.get("/confidence-drops", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).effectiveTenantId as string | undefined;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const fromDate = addPacificDays(today, -35);

    const [objSnaps, krSnaps] = await Promise.all([
      storage.getProgressSnapshotsByTenant(tenantId, "objective", fromDate),
      storage.getProgressSnapshotsByTenant(tenantId, "key_result", fromDate),
    ]);

    type Drop = {
      entityType: "objective" | "key_result";
      entityId: string;
      title: string;
      latestConfidence: number;
      averageConfidence: number;
      delta: number;
      bucketsObserved: number;
      latestSnapshotDate: string;
    };

    const drops: Drop[] = [];

    function bucketIndex(snapshotDate: string, anchor: string): number {
      // Number of full pacific days between anchor and snapshotDate.
      // Newest = bucket 0 (most recent 7 days); prior weeks = 1..4.
      const a = new Date(anchor + "T00:00:00Z").getTime();
      const b = new Date(snapshotDate + "T00:00:00Z").getTime();
      const days = Math.floor((a - b) / (24 * 60 * 60 * 1000));
      if (days < 0) return -1;
      return Math.floor(days / 7);
    }

    async function processGroup(
      entityType: "objective" | "key_result",
      snaps: typeof objSnaps,
    ) {
      const byEntity = new Map<string, typeof snaps>();
      for (const s of snaps) {
        if (s.confidence == null) continue;
        const list = byEntity.get(s.entityId) || [];
        list.push(s);
        byEntity.set(s.entityId, list);
      }

      for (const [entityId, list] of Array.from(byEntity.entries())) {
        // Most recent snapshot must be within the last 7 days.
        const sorted = list
          .slice()
          .sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));
        const latest = sorted[0];
        if (!latest || latest.confidence == null) continue;
        const latestBucket = bucketIndex(latest.snapshotDate, today);
        if (latestBucket !== 0) continue;

        // Bucket prior 4 weeks (buckets 1..4): collect averages per bucket.
        const bucketSums = new Map<number, { sum: number; count: number }>();
        for (const s of list) {
          if (s.confidence == null) continue;
          const idx = bucketIndex(s.snapshotDate, today);
          if (idx < 1 || idx > 4) continue;
          const cur = bucketSums.get(idx) || { sum: 0, count: 0 };
          cur.sum += Number(s.confidence);
          cur.count += 1;
          bucketSums.set(idx, cur);
        }

        if (bucketSums.size < 4) continue; // require ≥4 distinct weekly buckets

        const bucketAverages = Array.from(bucketSums.values()).map(
          (b) => b.sum / b.count,
        );
        const avg =
          bucketAverages.reduce((a, b) => a + b, 0) / bucketAverages.length;

        const latestVal = Number(latest.confidence);
        if (latestVal > avg - 0.3) continue;

        let title = entityId;
        try {
          if (entityType === "objective") {
            const obj = await storage.getObjectiveById(entityId);
            if (obj) title = obj.title;
          } else {
            const kr = await storage.getKeyResultById(entityId);
            if (kr) title = kr.title;
          }
        } catch (_e) {
          // best-effort title lookup
        }

        drops.push({
          entityType,
          entityId,
          title,
          latestConfidence: Math.round(latestVal * 100) / 100,
          averageConfidence: Math.round(avg * 100) / 100,
          delta: Math.round((latestVal - avg) * 100) / 100,
          bucketsObserved: bucketSums.size,
          latestSnapshotDate: latest.snapshotDate,
        });
      }
    }

    await processGroup("objective", objSnaps);
    await processGroup("key_result", krSnaps);

    drops.sort((a, b) => a.delta - b.delta);

    res.json({ drops, count: drops.length });
  } catch (error) {
    console.error("[exec/confidence-drops] error:", error);
    res.status(500).json({ error: "Failed to compute confidence drops" });
  }
});

type DashboardScope = "company" | "executive" | "team";

type BigRockTaskCount = { total: number; completed: number };

type DashboardContextResponse = {
  scope: DashboardScope;
  tenantId: string;
  teamId: string | null;
  quarter: number | null;
  year: number | null;
  foundation: Foundation | null;
  strategies: Strategy[];
  teams: Team[];
  objectives: Objective[];
  keyResults: KeyResult[];
  bigRocks: BigRock[];
  bigRockTaskCounts: Record<string, BigRockTaskCount>;
  meetings: Meeting[];
  checkIns: CheckIn[];
};

function parseScope(value: unknown): DashboardScope {
  return value === "executive" || value === "team" ? value : "company";
}

// The Executive Dashboard consumes check-ins to compute (a) recent-activity
// metrics (weekly check-in rate, "days since last check-in", staleness) that
// are always relative to "now", and (b) per-objective metrics for the
// objectives in the requested period (any-check-in count, pace/forecast).
//
// We bound the response by deriving a window from the requested quarter/year
// (when supplied) plus a small buffer on each side, falling back to a fixed
// lookback when no period is given. The filter runs on `createdAt` to match
// the client's recency semantics — a backdated check-in recorded recently is
// still considered recent activity by the client and must not be excluded.
const EXECUTIVE_PERIOD_BUFFER_BEFORE_DAYS = 14;
const EXECUTIVE_PERIOD_BUFFER_AFTER_DAYS = 30;
const EXECUTIVE_FALLBACK_LOOKBACK_DAYS = 120;
const EXECUTIVE_RECENT_LOOKBACK_DAYS = 30;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

// Returns one or more disjoint date windows on `checkIns.createdAt` that
// together cover everything the Executive Dashboard needs:
//  - A "period" window around the requested quarter/year so per-objective
//    metrics (e.g. checkInRate, pace/forecast) for those objectives have
//    their relevant history. The upper bound is dropped when the period is
//    current so newly-recorded check-ins are always included.
//  - A "recent" window covering the last 30 days, so "recent activity"
//    widgets (weekly rate, days-since-last-check-in, staleness) — which are
//    always relative to "now" — keep working for historical and future
//    period selections too.
function executiveCheckInsWindows(
  quarter: number | undefined,
  year: number | undefined,
): Array<{ from?: Date; to?: Date }> {
  const recentWindow = { from: daysAgo(EXECUTIVE_RECENT_LOOKBACK_DAYS) };

  // No period selected: just cap how far back we go from "now".
  if (year == null) {
    return [{ from: daysAgo(EXECUTIVE_FALLBACK_LOOKBACK_DAYS) }];
  }

  let periodStart: Date;
  let periodEnd: Date;
  if (quarter == null || quarter === 0) {
    // Annual view (or year-only).
    periodStart = new Date(Date.UTC(year, 0, 1));
    periodEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  } else {
    const startMonth = (quarter - 1) * 3;
    periodStart = new Date(Date.UTC(year, startMonth, 1));
    periodEnd = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
  }

  const periodFrom = new Date(periodStart);
  periodFrom.setUTCDate(
    periodFrom.getUTCDate() - EXECUTIVE_PERIOD_BUFFER_BEFORE_DAYS,
  );
  const periodTo = new Date(periodEnd);
  periodTo.setUTCDate(
    periodTo.getUTCDate() + EXECUTIVE_PERIOD_BUFFER_AFTER_DAYS,
  );

  const now = new Date();
  // Upper bound is only applied when the period sits in the past. For the
  // current period this collapses to the recent window; we still keep both
  // entries (the storage helper ORs them) for consistency.
  const periodWindow: { from?: Date; to?: Date } =
    periodTo.getTime() < now.getTime()
      ? { from: periodFrom, to: periodTo }
      : { from: periodFrom };

  return [periodWindow, recentWindow];
}
// Exported for use in tests.
export const __executiveCheckInsWindowsForTests = executiveCheckInsWindows;

function parseQuarter(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 4) return undefined;
  return n;
}

function parseYear(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseTeamId(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value;
}

function migrateAnnualGoals(foundation: Foundation): Foundation {
  if (!Array.isArray(foundation.annualGoals)) return foundation;
  const defaultYear = new Date().getFullYear() - 1;
  const migrated: AnnualGoal[] = foundation.annualGoals.map((goal) => {
    if (typeof goal === "string") {
      return { title: goal as string, year: defaultYear, description: "" };
    }
    if (
      typeof goal.year !== "number" ||
      goal.year < 2000 ||
      goal.year > 2100
    ) {
      return { ...goal, year: defaultYear };
    }
    return goal;
  });
  return { ...foundation, annualGoals: migrated };
}

dashboardRouter.get("/context", async (req: Request, res: Response) => {
  try {
    // Tenant scoping is fully delegated to authWithTenant middleware. The
    // route never reads tenantId from the query string — that would let
    // users with broad cross-tenant roles read tenants they were not
    // granted access to.
    const tenantId = req.effectiveTenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }

    const scope = parseScope(req.query.scope);
    const teamId = parseTeamId(req.query.teamId);
    const quarter = parseQuarter(req.query.quarter);
    const year = parseYear(req.query.year);

    const [
      foundationRaw,
      strategies,
      teams,
      objectives,
      keyResultsAll,
      bigRocksAll,
      meetings,
      checkIns,
    ] = await Promise.all([
      storage.getFoundationByTenantId(tenantId),
      storage.getStrategiesByTenantId(tenantId),
      storage.getTeamsByTenantId(tenantId),
      storage.getObjectivesByTenantId(tenantId, quarter, year, undefined, teamId),
      storage.getKeyResultsByTenantId(tenantId, quarter, year, teamId),
      storage.getBigRocksByTenantId(tenantId, quarter, year),
      storage.getMeetingsByTenantId(tenantId),
      scope === "executive"
        ? storage.getCheckInsByTenantId(tenantId, {
            createdAtWindows: executiveCheckInsWindows(quarter, year),
          })
        : Promise.resolve<CheckIn[]>([]),
    ]);

    // When teamId is supplied, filter bigRocks to that team to match the
    // documented endpoint contract.
    const bigRocks = teamId
      ? bigRocksAll.filter((br) => br.teamId === teamId)
      : bigRocksAll;

    const bigRockIds = bigRocks.map((br) => br.id);
    const taskCountsMap = bigRockIds.length
      ? await storage.getBigRockTaskCountsByBigRockIds(bigRockIds)
      : new Map<string, BigRockTaskCount>();
    const bigRockTaskCounts: Record<string, BigRockTaskCount> = {};
    taskCountsMap.forEach((value, key) => {
      bigRockTaskCounts[key] = value;
    });

    const foundation = foundationRaw ? migrateAnnualGoals(foundationRaw) : null;

    const response: DashboardContextResponse = {
      scope,
      tenantId,
      teamId: teamId ?? null,
      quarter: quarter ?? null,
      year: year ?? null,
      foundation,
      strategies,
      teams,
      objectives,
      keyResults: keyResultsAll,
      bigRocks,
      bigRockTaskCounts,
      meetings,
      checkIns,
    };

    res.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard context";
    console.error("[dashboard/context] error:", error);
    res.status(500).json({ error: message });
  }
});
