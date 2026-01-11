import { z } from "zod";
import { storage } from "./storage";
import type { Objective, KeyResult, BigRock, Meeting, User, Strategy, Foundation } from "@shared/schema";

// Tool parameter schemas for validation
export const listObjectivesParams = z.object({
  quarter: z.number().min(0).max(4).optional().describe("Quarter (1-4) or 0 for annual objectives"),
  year: z.number().optional().describe("Year (e.g., 2025)"),
  level: z.enum(["organization", "division", "team", "individual", "all"]).optional().describe("Objective level filter"),
  status: z.enum(["not_started", "on_track", "at_risk", "behind", "completed", "closed", "all"]).optional().describe("Status filter"),
  limit: z.number().min(1).max(50).optional().default(20).describe("Maximum number of results"),
});

export const listKeyResultsParams = z.object({
  objectiveId: z.string().optional().describe("Filter by specific objective ID"),
  status: z.enum(["not_started", "on_track", "at_risk", "behind", "completed", "closed", "all"]).optional().describe("Status filter"),
  limit: z.number().min(1).max(50).optional().default(20).describe("Maximum number of results"),
});

export const listBigRocksParams = z.object({
  quarter: z.number().min(1).max(4).optional().describe("Quarter (1-4)"),
  year: z.number().optional().describe("Year (e.g., 2025)"),
  status: z.enum(["not_started", "in_progress", "completed", "blocked", "all"]).optional().describe("Status filter"),
  limit: z.number().min(1).max(50).optional().default(20).describe("Maximum number of results"),
});

export const listMeetingsParams = z.object({
  meetingType: z.enum(["weekly_standup", "monthly_review", "quarterly_planning", "annual_strategy", "all"]).optional().describe("Meeting type filter"),
  limit: z.number().min(1).max(20).optional().default(10).describe("Maximum number of results"),
});

export const getAtRiskItemsParams = z.object({
  entityType: z.enum(["objectives", "key_results", "big_rocks", "all"]).optional().default("all").describe("Type of entities to check"),
  limit: z.number().min(1).max(30).optional().default(15).describe("Maximum number of results"),
});

export const getStatsParams = z.object({
  quarter: z.number().min(0).max(4).optional().describe("Quarter for stats (0 for annual)"),
  year: z.number().optional().describe("Year for stats"),
});

// Phase 2 AI Tools - Strategic Gap Analysis
export const analyzeStrategicGapsParams = z.object({
  quarter: z.number().min(1).max(4).optional().describe("Quarter to analyze (1-4)"),
  year: z.number().optional().describe("Year to analyze"),
});

export const analyzeObjectiveGapsParams = z.object({
  quarter: z.number().min(1).max(4).optional().describe("Quarter to analyze (1-4)"),
  year: z.number().optional().describe("Year to analyze"),
});

export const getFoundationContextParams = z.object({});

// OpenAI function definitions for tool calling
export const AI_TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}> = [
  {
    type: "function",
    function: {
      name: "listObjectives",
      description: "List objectives for the organization with optional filters. Use this when the user asks about objectives, OKRs, goals for a period, or what the team is working on.",
      parameters: {
        type: "object",
        properties: {
          quarter: { type: "number", description: "Quarter (1-4) or 0 for annual objectives" },
          year: { type: "number", description: "Year (e.g., 2025)" },
          level: { type: "string", enum: ["organization", "division", "team", "individual", "all"], description: "Objective level filter" },
          status: { type: "string", enum: ["not_started", "on_track", "at_risk", "behind", "completed", "closed", "all"], description: "Status filter" },
          limit: { type: "number", description: "Maximum results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listKeyResults",
      description: "List key results with optional filters. Use this when the user asks about metrics, KRs, key results, or measurable outcomes.",
      parameters: {
        type: "object",
        properties: {
          objectiveId: { type: "string", description: "Filter by specific objective ID" },
          status: { type: "string", enum: ["not_started", "on_track", "at_risk", "behind", "completed", "closed", "all"], description: "Status filter" },
          limit: { type: "number", description: "Maximum results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listBigRocks",
      description: "List Big Rocks (initiatives/projects). Use this when the user asks about initiatives, projects, Big Rocks, or major work items.",
      parameters: {
        type: "object",
        properties: {
          quarter: { type: "number", description: "Quarter (1-4)" },
          year: { type: "number", description: "Year (e.g., 2025)" },
          status: { type: "string", enum: ["not_started", "in_progress", "completed", "blocked", "all"], description: "Status filter" },
          limit: { type: "number", description: "Maximum results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listMeetings",
      description: "List meetings with optional type filter. Use this when the user asks about meetings, reviews, standups, or planning sessions.",
      parameters: {
        type: "object",
        properties: {
          meetingType: { type: "string", enum: ["weekly_standup", "monthly_review", "quarterly_planning", "annual_strategy", "all"], description: "Meeting type filter" },
          limit: { type: "number", description: "Maximum results (default 10, max 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAtRiskItems",
      description: "Get items that are at risk, behind schedule, or need attention. Use this when the user asks about problems, risks, items needing attention, or what's behind.",
      parameters: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["objectives", "key_results", "big_rocks", "all"], description: "Type of entities to check" },
          limit: { type: "number", description: "Maximum results (default 15, max 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStats",
      description: "Get summary statistics for the organization. Use this when the user asks for an overview, summary, dashboard stats, or overall progress.",
      parameters: {
        type: "object",
        properties: {
          quarter: { type: "number", description: "Quarter for stats (0 for annual)" },
          year: { type: "number", description: "Year for stats" },
        },
      },
    },
  },
  // Phase 2: Strategic Gap Analysis Tools
  {
    type: "function",
    function: {
      name: "analyzeStrategicGaps",
      description: "Analyze strategic gaps to find strategies and objectives that lack corresponding Big Rocks (initiatives). Use this when the user asks about execution gaps, missing initiatives, what Big Rocks to create, or strategic priorities needing action.",
      parameters: {
        type: "object",
        properties: {
          quarter: { type: "number", description: "Quarter to analyze (1-4)" },
          year: { type: "number", description: "Year to analyze" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyzeObjectiveGaps",
      description: "Analyze objective gaps to find annual goals and strategies that lack corresponding quarterly objectives. Use this when the user asks about goal coverage, objective gaps, strategic alignment issues, or what objectives to create.",
      parameters: {
        type: "object",
        properties: {
          quarter: { type: "number", description: "Quarter to analyze (1-4)" },
          year: { type: "number", description: "Year to analyze" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFoundationContext",
      description: "Get the organization's foundation elements (mission, vision, values, annual goals) for context. Use this when the user asks about organizational purpose, culture, strategic direction, or needs context for suggestions.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// Result types for AI tool responses
export interface AIObjectiveSummary {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  status: string | null;
  progress: number;
  quarter: number | null;
  year: number | null;
  owner: string | null;
  keyResultCount: number;
}

export interface AIKeyResultSummary {
  id: string;
  title: string;
  objectiveTitle: string;
  status: string | null;
  progress: number;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  metricType: string | null;
}

export interface AIBigRockSummary {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  progress: number;
  quarter: number | null;
  year: number | null;
  owner: string | null;
}

export interface AIMeetingSummary {
  id: string;
  title: string;
  meetingType: string | null;
  meetingDate: Date | null;
  facilitator: string | null;
  summary: string | null;
}

export interface AIStats {
  objectives: { total: number; onTrack: number; atRisk: number; behind: number; completed: number };
  keyResults: { total: number; onTrack: number; atRisk: number; behind: number; completed: number };
  bigRocks: { total: number; inProgress: number; completed: number; blocked: number };
  meetings: { total: number; thisWeek: number };
  overallProgress: number;
}

// Phase 2: Strategic Gap Analysis Types
export interface StrategicGapAnalysis {
  strategiesWithoutBigRocks: Array<{
    id: string;
    title: string;
    description: string | null;
    linkedGoalTitles: string[];
  }>;
  objectivesWithoutBigRocks: Array<{
    id: string;
    title: string;
    level: string | null;
    progress: number;
    quarter: number | null;
    year: number | null;
  }>;
  totalStrategies: number;
  totalObjectives: number;
  coveragePercentage: number;
}

export interface ObjectiveGapAnalysis {
  goalsWithoutObjectives: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
  }>;
  strategiesWithoutObjectives: Array<{
    id: string;
    title: string;
    description: string | null;
    linkedGoalTitles: string[];
  }>;
  totalGoals: number;
  totalStrategies: number;
  objectiveCoverage: number;
}

export interface FoundationContext {
  mission: string | null;
  vision: string | null;
  values: Array<{ title: string; description: string | null }>;
  goals: Array<{ id: string; title: string; description: string | null; category: string | null }>;
  strategies: Array<{ id: string; title: string; description: string | null }>;
}

// Helper to compute status from progress
function computeStatus(progress: number, status: string | null): string {
  if (status === "closed" || status === "completed") return status;
  if (progress >= 100) return "completed";
  if (progress >= 70) return "on_track";
  if (progress >= 40) return "at_risk";
  if (progress > 0) return "behind";
  return "not_started";
}

// Tool execution functions
export async function executeListObjectives(
  tenantId: string,
  params: z.infer<typeof listObjectivesParams>
): Promise<AIObjectiveSummary[]> {
  const { quarter, year, level, status, limit = 20 } = params;
  
  const objectives = await storage.getObjectivesByTenantId(
    tenantId,
    quarter,
    year,
    level === "all" ? undefined : level
  );
  
  // Get key result counts for each objective
  const summaries: AIObjectiveSummary[] = await Promise.all(
    objectives.map(async (obj) => {
      const keyResults = await storage.getKeyResultsByObjectiveId(obj.id);
      return {
        id: obj.id,
        title: obj.title,
        description: obj.description,
        level: obj.level,
        status: computeStatus(obj.progress || 0, obj.status),
        progress: obj.progress || 0,
        quarter: obj.quarter,
        year: obj.year,
        owner: obj.ownerId,
        keyResultCount: keyResults.length,
      };
    })
  );
  
  // Filter by status if specified
  let filtered = summaries;
  if (status && status !== "all") {
    filtered = summaries.filter((s) => s.status === status);
  }
  
  return filtered.slice(0, limit);
}

export async function executeListKeyResults(
  tenantId: string,
  params: z.infer<typeof listKeyResultsParams>
): Promise<AIKeyResultSummary[]> {
  const { objectiveId, status, limit = 20 } = params;
  
  let keyResults: KeyResult[] = [];
  let objectiveMap: Map<string, Objective> = new Map();
  
  if (objectiveId) {
    keyResults = await storage.getKeyResultsByObjectiveId(objectiveId);
    const obj = await storage.getObjectiveById(objectiveId);
    if (obj) objectiveMap.set(obj.id, obj);
  } else {
    // Get all objectives for tenant and their key results
    const objectives = await storage.getObjectivesByTenantId(tenantId);
    for (const obj of objectives) {
      objectiveMap.set(obj.id, obj);
      const krs = await storage.getKeyResultsByObjectiveId(obj.id);
      keyResults.push(...krs);
    }
  }
  
  const summaries: AIKeyResultSummary[] = keyResults.map((kr) => {
    const objective = objectiveMap.get(kr.objectiveId);
    return {
      id: kr.id,
      title: kr.title,
      objectiveTitle: objective?.title || "Unknown Objective",
      status: computeStatus(kr.progress || 0, kr.status),
      progress: kr.progress || 0,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      metricType: kr.metricType,
    };
  });
  
  let filtered = summaries;
  if (status && status !== "all") {
    filtered = summaries.filter((s) => s.status === status);
  }
  
  return filtered.slice(0, limit);
}

export async function executeListBigRocks(
  tenantId: string,
  params: z.infer<typeof listBigRocksParams>
): Promise<AIBigRockSummary[]> {
  const { quarter, year, status, limit = 20 } = params;
  
  const bigRocks = await storage.getBigRocksByTenantId(tenantId, quarter, year);
  
  const summaries: AIBigRockSummary[] = bigRocks.map((br) => ({
    id: br.id,
    title: br.title,
    description: br.description,
    status: br.status,
    progress: (br as any).progress || 0,
    quarter: br.quarter,
    year: br.year,
    owner: br.ownerId,
  }));
  
  let filtered = summaries;
  if (status && status !== "all") {
    filtered = summaries.filter((s) => s.status === status);
  }
  
  return filtered.slice(0, limit);
}

export async function executeListMeetings(
  tenantId: string,
  params: z.infer<typeof listMeetingsParams>
): Promise<AIMeetingSummary[]> {
  const { meetingType, limit = 10 } = params;
  
  const meetings = await storage.getMeetingsByTenantId(tenantId);
  
  const summaries: AIMeetingSummary[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    meetingType: m.meetingType,
    meetingDate: m.date,
    facilitator: m.facilitator,
    summary: m.summary,
  }));
  
  let filtered = summaries;
  if (meetingType && meetingType !== "all") {
    filtered = summaries.filter((s) => s.meetingType === meetingType);
  }
  
  // Sort by date descending
  filtered.sort((a, b) => {
    if (!a.meetingDate) return 1;
    if (!b.meetingDate) return -1;
    return new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime();
  });
  
  return filtered.slice(0, limit);
}

export async function executeGetAtRiskItems(
  tenantId: string,
  params: z.infer<typeof getAtRiskItemsParams>
): Promise<{
  objectives: AIObjectiveSummary[];
  keyResults: AIKeyResultSummary[];
  bigRocks: AIBigRockSummary[];
}> {
  const { entityType = "all", limit = 15 } = params;
  
  const result: {
    objectives: AIObjectiveSummary[];
    keyResults: AIKeyResultSummary[];
    bigRocks: AIBigRockSummary[];
  } = {
    objectives: [],
    keyResults: [],
    bigRocks: [],
  };
  
  if (entityType === "all" || entityType === "objectives") {
    const objs = await executeListObjectives(tenantId, { status: "at_risk", limit });
    const behindObjs = await executeListObjectives(tenantId, { status: "behind", limit });
    result.objectives = [...objs, ...behindObjs].slice(0, limit);
  }
  
  if (entityType === "all" || entityType === "key_results") {
    const krs = await executeListKeyResults(tenantId, { status: "at_risk", limit });
    const behindKrs = await executeListKeyResults(tenantId, { status: "behind", limit });
    result.keyResults = [...krs, ...behindKrs].slice(0, limit);
  }
  
  if (entityType === "all" || entityType === "big_rocks") {
    const brs = await executeListBigRocks(tenantId, { status: "blocked", limit });
    result.bigRocks = brs.slice(0, limit);
  }
  
  return result;
}

export async function executeGetStats(
  tenantId: string,
  params: z.infer<typeof getStatsParams>
): Promise<AIStats> {
  const { quarter, year } = params;
  
  const objectives = await storage.getObjectivesByTenantId(tenantId, quarter, year);
  const meetings = await storage.getMeetingsByTenantId(tenantId);
  const bigRocks = await storage.getBigRocksByTenantId(tenantId, quarter, year);
  
  // Get all key results
  let allKeyResults: KeyResult[] = [];
  for (const obj of objectives) {
    const krs = await storage.getKeyResultsByObjectiveId(obj.id);
    allKeyResults.push(...krs);
  }
  
  // Compute objective stats
  const objStats = {
    total: objectives.length,
    onTrack: objectives.filter((o) => computeStatus(o.progress || 0, o.status) === "on_track").length,
    atRisk: objectives.filter((o) => computeStatus(o.progress || 0, o.status) === "at_risk").length,
    behind: objectives.filter((o) => computeStatus(o.progress || 0, o.status) === "behind").length,
    completed: objectives.filter((o) => computeStatus(o.progress || 0, o.status) === "completed" || o.status === "closed").length,
  };
  
  // Compute key result stats
  const krStats = {
    total: allKeyResults.length,
    onTrack: allKeyResults.filter((kr) => computeStatus(kr.progress || 0, kr.status) === "on_track").length,
    atRisk: allKeyResults.filter((kr) => computeStatus(kr.progress || 0, kr.status) === "at_risk").length,
    behind: allKeyResults.filter((kr) => computeStatus(kr.progress || 0, kr.status) === "behind").length,
    completed: allKeyResults.filter((kr) => computeStatus(kr.progress || 0, kr.status) === "completed" || kr.status === "closed").length,
  };
  
  // Compute big rock stats
  const brStats = {
    total: bigRocks.length,
    inProgress: bigRocks.filter((br) => br.status === "in_progress").length,
    completed: bigRocks.filter((br) => br.status === "completed").length,
    blocked: bigRocks.filter((br) => br.status === "blocked").length,
  };
  
  // Meetings this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const meetingsThisWeek = meetings.filter((m) => 
    m.date && new Date(m.date) >= weekStart
  ).length;
  
  // Overall progress (average of objective progress, capped at 100% each to avoid inflated averages)
  const overallProgress = objectives.length > 0
    ? Math.round(objectives.reduce((sum, o) => sum + Math.min(o.progress || 0, 100), 0) / objectives.length)
    : 0;
  
  return {
    objectives: objStats,
    keyResults: krStats,
    bigRocks: brStats,
    meetings: { total: meetings.length, thisWeek: meetingsThisWeek },
    overallProgress,
  };
}

// Phase 2: Strategic Gap Analysis Functions
export async function executeAnalyzeStrategicGaps(
  tenantId: string,
  params: z.infer<typeof analyzeStrategicGapsParams>
): Promise<StrategicGapAnalysis> {
  const { quarter, year } = params;
  
  // Get all strategies for tenant
  const strategies = await storage.getStrategiesByTenantId(tenantId);
  
  // Get all objectives for tenant (filtered by quarter/year if specified)
  const objectives = await storage.getObjectivesByTenantId(tenantId, quarter, year);
  
  // Get all big rocks for tenant
  const bigRocks = await storage.getBigRocksByTenantId(tenantId, quarter, year);
  
  // Get all goals for context
  const foundation = await storage.getFoundationByTenantId(tenantId);
  const goals = ((foundation?.annualGoals || []) as unknown) as Array<{ id: string; title: string; description?: string; category?: string }>;
  
  // Create a set of strategy IDs that have Big Rocks linked
  const strategiesWithBigRocks = new Set<string>();
  for (const br of bigRocks) {
    const linkedStrategies = (br as any).linkedStrategies || [];
    linkedStrategies.forEach((sid: string) => strategiesWithBigRocks.add(sid));
  }
  
  // Create a set of objective IDs that have Big Rocks linked
  // Check each objective for linked Big Rocks via the many-to-many relationship
  const objectivesWithBigRocks = new Set<string>();
  for (const obj of objectives) {
    const linkedBigRocks = await storage.getBigRocksLinkedToObjective(obj.id);
    if (linkedBigRocks.length > 0) {
      objectivesWithBigRocks.add(obj.id);
    }
  }
  
  // Find strategies without Big Rocks
  const strategiesWithoutBigRocks = strategies
    .filter(s => !strategiesWithBigRocks.has(s.id))
    .map(s => {
      const linkedGoalIds = (s.linkedGoals || []) as string[];
      const linkedGoalTitles = linkedGoalIds
        .map(gid => goals.find(g => g.id === gid)?.title || "Unknown Goal")
        .filter(Boolean);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        linkedGoalTitles,
      };
    });
  
  // Find objectives without Big Rocks (only those not already closed)
  const objectivesWithoutBigRocks = objectives
    .filter(o => !objectivesWithBigRocks.has(o.id) && o.status !== "closed")
    .map(o => ({
      id: o.id,
      title: o.title,
      level: o.level,
      progress: o.progress || 0,
      quarter: o.quarter,
      year: o.year,
    }));
  
  // Calculate coverage percentage
  const totalWithCoverage = strategiesWithBigRocks.size + objectivesWithBigRocks.size;
  const totalItems = strategies.length + objectives.filter(o => o.status !== "closed").length;
  const coveragePercentage = totalItems > 0 ? Math.round((totalWithCoverage / totalItems) * 100) : 100;
  
  return {
    strategiesWithoutBigRocks,
    objectivesWithoutBigRocks,
    totalStrategies: strategies.length,
    totalObjectives: objectives.filter(o => o.status !== "closed").length,
    coveragePercentage,
  };
}

export async function executeAnalyzeObjectiveGaps(
  tenantId: string,
  params: z.infer<typeof analyzeObjectiveGapsParams>
): Promise<ObjectiveGapAnalysis> {
  const { quarter, year } = params;
  
  // Get foundation with goals
  const foundation = await storage.getFoundationByTenantId(tenantId);
  const goals = ((foundation?.annualGoals || []) as unknown) as Array<{ id: string; title: string; description?: string; category?: string }>;
  
  // Get all strategies
  const strategies = await storage.getStrategiesByTenantId(tenantId);
  
  // Get all objectives (filtered by quarter/year if specified)
  const objectives = await storage.getObjectivesByTenantId(tenantId, quarter, year);
  
  // Create a set of goal IDs that have objectives linked
  // Objectives use linkedGoals (array) not linkedGoalId
  const goalsWithObjectives = new Set<string>();
  for (const obj of objectives) {
    const linkedGoals = (obj.linkedGoals || []) as string[];
    linkedGoals.forEach(gid => goalsWithObjectives.add(gid));
  }
  
  // Create a set of strategy IDs that have objectives linked
  // Objectives use linkedStrategies (array) not linkedStrategyId
  const strategiesWithObjectives = new Set<string>();
  for (const obj of objectives) {
    const linkedStrategies = (obj.linkedStrategies || []) as string[];
    linkedStrategies.forEach(sid => strategiesWithObjectives.add(sid));
  }
  
  // Find goals without objectives
  const goalsWithoutObjectives = goals
    .filter((g: { id: string; title: string; description?: string; category?: string }) => !goalsWithObjectives.has(g.id))
    .map((g: { id: string; title: string; description?: string; category?: string }) => ({
      id: g.id,
      title: g.title,
      description: g.description || null,
      category: g.category || null,
    }));
  
  // Find strategies without objectives
  const strategiesWithoutObjectives = strategies
    .filter(s => !strategiesWithObjectives.has(s.id))
    .map(s => {
      const linkedGoalIds = (s.linkedGoals || []) as string[];
      const linkedGoalTitles = linkedGoalIds
        .map((gid: string) => goals.find((g: { id: string; title: string }) => g.id === gid)?.title || "Unknown Goal")
        .filter(Boolean);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        linkedGoalTitles,
      };
    });
  
  // Calculate coverage
  const totalCovered = goalsWithObjectives.size + strategiesWithObjectives.size;
  const totalItems = goals.length + strategies.length;
  const objectiveCoverage = totalItems > 0 ? Math.round((totalCovered / totalItems) * 100) : 100;
  
  return {
    goalsWithoutObjectives,
    strategiesWithoutObjectives,
    totalGoals: goals.length,
    totalStrategies: strategies.length,
    objectiveCoverage,
  };
}

export async function executeGetFoundationContext(
  tenantId: string,
  _params: z.infer<typeof getFoundationContextParams>
): Promise<FoundationContext> {
  // Get foundation
  const foundation = await storage.getFoundationByTenantId(tenantId);
  
  // Get strategies
  const strategies = await storage.getStrategiesByTenantId(tenantId);
  
  // Parse values from foundation
  const rawValues = foundation?.values || [];
  const values = rawValues.map((v: any) => ({
    title: typeof v === "string" ? v : v.title || "Unknown",
    description: typeof v === "string" ? null : v.description || null,
  }));
  
  // Parse goals from foundation
  const rawGoals = foundation?.annualGoals || [];
  const goals = (rawGoals as any[]).map((g: any) => ({
    id: g.id || "",
    title: g.title || "Unknown",
    description: g.description || null,
    category: g.category || null,
  }));
  
  return {
    mission: foundation?.mission || null,
    vision: foundation?.vision || null,
    values,
    goals,
    strategies: strategies.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
    })),
  };
}

// Main tool executor
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  tenantId: string
): Promise<any> {
  switch (toolName) {
    case "listObjectives":
      return executeListObjectives(tenantId, listObjectivesParams.parse(args));
    case "listKeyResults":
      return executeListKeyResults(tenantId, listKeyResultsParams.parse(args));
    case "listBigRocks":
      return executeListBigRocks(tenantId, listBigRocksParams.parse(args));
    case "listMeetings":
      return executeListMeetings(tenantId, listMeetingsParams.parse(args));
    case "getAtRiskItems":
      return executeGetAtRiskItems(tenantId, getAtRiskItemsParams.parse(args));
    case "getStats":
      return executeGetStats(tenantId, getStatsParams.parse(args));
    // Phase 2 tools
    case "analyzeStrategicGaps":
      return executeAnalyzeStrategicGaps(tenantId, analyzeStrategicGapsParams.parse(args));
    case "analyzeObjectiveGaps":
      return executeAnalyzeObjectiveGaps(tenantId, analyzeObjectiveGapsParams.parse(args));
    case "getFoundationContext":
      return executeGetFoundationContext(tenantId, getFoundationContextParams.parse(args));
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Format tool results for the AI to narrate
export function formatToolResult(toolName: string, result: any): string {
  switch (toolName) {
    case "listObjectives": {
      const objs = result as AIObjectiveSummary[];
      if (objs.length === 0) return "No objectives found matching the criteria.";
      return `Found ${objs.length} objective(s):\n${objs.map((o) => 
        `- **${o.title}** (${o.level || "team"} level, ${o.status}, ${o.progress}% progress, ${o.keyResultCount} key results)`
      ).join("\n")}`;
    }
    case "listKeyResults": {
      const krs = result as AIKeyResultSummary[];
      if (krs.length === 0) return "No key results found matching the criteria.";
      return `Found ${krs.length} key result(s):\n${krs.map((kr) => 
        `- **${kr.title}** (${kr.status}, ${kr.progress}% progress${kr.currentValue !== null ? `, ${kr.currentValue}/${kr.targetValue} ${kr.unit || ""}` : ""})\n  For: ${kr.objectiveTitle}`
      ).join("\n")}`;
    }
    case "listBigRocks": {
      const brs = result as AIBigRockSummary[];
      if (brs.length === 0) return "No Big Rocks found matching the criteria.";
      return `Found ${brs.length} Big Rock(s):\n${brs.map((br) => 
        `- **${br.title}** (${br.status || "not started"}, ${br.progress}% progress${br.owner ? `, Owner: ${br.owner}` : ""})`
      ).join("\n")}`;
    }
    case "listMeetings": {
      const meetings = result as AIMeetingSummary[];
      if (meetings.length === 0) return "No meetings found matching the criteria.";
      return `Found ${meetings.length} meeting(s):\n${meetings.map((m) => 
        `- **${m.title}** (${m.meetingType || "general"}${m.meetingDate ? `, ${new Date(m.meetingDate).toLocaleDateString()}` : ""}${m.facilitator ? `, Facilitator: ${m.facilitator}` : ""})`
      ).join("\n")}`;
    }
    case "getAtRiskItems": {
      const items = result as { objectives: AIObjectiveSummary[]; keyResults: AIKeyResultSummary[]; bigRocks: AIBigRockSummary[] };
      const parts: string[] = [];
      if (items.objectives.length > 0) {
        parts.push(`**At-Risk/Behind Objectives (${items.objectives.length}):**\n${items.objectives.map((o) => 
          `- ${o.title} (${o.status}, ${o.progress}%)`
        ).join("\n")}`);
      }
      if (items.keyResults.length > 0) {
        parts.push(`**At-Risk/Behind Key Results (${items.keyResults.length}):**\n${items.keyResults.map((kr) => 
          `- ${kr.title} (${kr.status}, ${kr.progress}%)`
        ).join("\n")}`);
      }
      if (items.bigRocks.length > 0) {
        parts.push(`**Blocked Big Rocks (${items.bigRocks.length}):**\n${items.bigRocks.map((br) => 
          `- ${br.title} (${br.status})`
        ).join("\n")}`);
      }
      if (parts.length === 0) return "No at-risk or blocked items found. Everything appears to be on track!";
      return parts.join("\n\n");
    }
    case "getStats": {
      const stats = result as AIStats;
      return `**Organization Summary:**
- **Overall Progress:** ${stats.overallProgress}%
- **Objectives:** ${stats.objectives.total} total (${stats.objectives.onTrack} on track, ${stats.objectives.atRisk} at risk, ${stats.objectives.behind} behind, ${stats.objectives.completed} completed)
- **Key Results:** ${stats.keyResults.total} total (${stats.keyResults.onTrack} on track, ${stats.keyResults.atRisk} at risk, ${stats.keyResults.behind} behind, ${stats.keyResults.completed} completed)
- **Big Rocks:** ${stats.bigRocks.total} total (${stats.bigRocks.inProgress} in progress, ${stats.bigRocks.completed} completed, ${stats.bigRocks.blocked} blocked)
- **Meetings:** ${stats.meetings.total} total, ${stats.meetings.thisWeek} this week`;
    }
    // Phase 2: Strategic Gap Analysis formatters
    case "analyzeStrategicGaps": {
      const gaps = result as StrategicGapAnalysis;
      const parts: string[] = [];
      parts.push(`**Strategic Gap Analysis** (${gaps.coveragePercentage}% initiative coverage)`);
      parts.push(`- Total Strategies: ${gaps.totalStrategies}`);
      parts.push(`- Total Active Objectives: ${gaps.totalObjectives}`);
      
      if (gaps.strategiesWithoutBigRocks.length > 0) {
        parts.push(`\n**Strategies Needing Initiatives (${gaps.strategiesWithoutBigRocks.length}):**`);
        gaps.strategiesWithoutBigRocks.forEach(s => {
          const goalContext = s.linkedGoalTitles.length > 0 ? ` (supports: ${s.linkedGoalTitles.join(", ")})` : "";
          parts.push(`- **${s.title}**${goalContext}`);
        });
      }
      
      if (gaps.objectivesWithoutBigRocks.length > 0) {
        parts.push(`\n**Objectives Needing Initiatives (${gaps.objectivesWithoutBigRocks.length}):**`);
        gaps.objectivesWithoutBigRocks.forEach(o => {
          parts.push(`- **${o.title}** (${o.level || "team"} level, Q${o.quarter || "?"} ${o.year || ""}, ${o.progress}% progress)`);
        });
      }
      
      if (gaps.strategiesWithoutBigRocks.length === 0 && gaps.objectivesWithoutBigRocks.length === 0) {
        parts.push("\nAll strategies and objectives have corresponding Big Rocks. Excellent execution alignment!");
      }
      
      return parts.join("\n");
    }
    case "analyzeObjectiveGaps": {
      const gaps = result as ObjectiveGapAnalysis;
      const parts: string[] = [];
      parts.push(`**Objective Coverage Analysis** (${gaps.objectiveCoverage}% coverage)`);
      parts.push(`- Total Annual Goals: ${gaps.totalGoals}`);
      parts.push(`- Total Strategies: ${gaps.totalStrategies}`);
      
      if (gaps.goalsWithoutObjectives.length > 0) {
        parts.push(`\n**Goals Without Quarterly Objectives (${gaps.goalsWithoutObjectives.length}):**`);
        gaps.goalsWithoutObjectives.forEach(g => {
          const categoryLabel = g.category ? ` [${g.category}]` : "";
          parts.push(`- **${g.title}**${categoryLabel}`);
        });
      }
      
      if (gaps.strategiesWithoutObjectives.length > 0) {
        parts.push(`\n**Strategies Without Linked Objectives (${gaps.strategiesWithoutObjectives.length}):**`);
        gaps.strategiesWithoutObjectives.forEach(s => {
          const goalContext = s.linkedGoalTitles.length > 0 ? ` (supports: ${s.linkedGoalTitles.join(", ")})` : "";
          parts.push(`- **${s.title}**${goalContext}`);
        });
      }
      
      if (gaps.goalsWithoutObjectives.length === 0 && gaps.strategiesWithoutObjectives.length === 0) {
        parts.push("\nAll goals and strategies have corresponding objectives. Strong strategic alignment!");
      }
      
      return parts.join("\n");
    }
    case "getFoundationContext": {
      const context = result as FoundationContext;
      const parts: string[] = [];
      
      parts.push("**Organization Foundation:**");
      if (context.mission) parts.push(`\n**Mission:** ${context.mission}`);
      if (context.vision) parts.push(`\n**Vision:** ${context.vision}`);
      
      if (context.values.length > 0) {
        parts.push(`\n**Values (${context.values.length}):**`);
        context.values.forEach(v => {
          parts.push(`- **${v.title}**${v.description ? `: ${v.description}` : ""}`);
        });
      }
      
      if (context.goals.length > 0) {
        parts.push(`\n**Annual Goals (${context.goals.length}):**`);
        context.goals.forEach(g => {
          const categoryLabel = g.category ? ` [${g.category}]` : "";
          parts.push(`- **${g.title}**${categoryLabel}`);
        });
      }
      
      if (context.strategies.length > 0) {
        parts.push(`\n**Strategies (${context.strategies.length}):**`);
        context.strategies.forEach(s => {
          parts.push(`- **${s.title}**`);
        });
      }
      
      return parts.join("\n");
    }
    default:
      return JSON.stringify(result, null, 2);
  }
}
