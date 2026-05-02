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

export const dashboardRouter = Router();

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
        ? storage.getCheckInsByTenantId(tenantId)
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
