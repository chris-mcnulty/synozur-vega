import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  Calendar,
  Activity,
  BarChart3,
  Loader2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Trophy,
  Sparkles,
  Info,
  CalendarPlus,
  Eye,
  MessageSquare,
  Circle,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import type { Objective, KeyResult, Team, CheckIn, BigRock } from "@shared/schema";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

function getProgressColor(progress: number, expectedProgress?: number): string {
  if (expectedProgress !== undefined) {
    const gap = progress - expectedProgress;
    if (gap >= -5) return "text-green-600 dark:text-green-400";
    if (gap >= -15) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }
  if (progress >= 70) return "text-green-600 dark:text-green-400";
  if (progress >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getProgressBg(progress: number): string {
  if (progress >= 70) return "bg-green-500";
  if (progress >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    on_track: { variant: "default", label: "On Track" },
    at_risk: { variant: "destructive", label: "At Risk" },
    behind: { variant: "destructive", label: "Behind" },
    completed: { variant: "secondary", label: "Completed" },
    not_started: { variant: "outline", label: "Not Started" },
  };
  const config = variants[status] || { variant: "outline", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk' | 'no_data' | 'completed';
type RiskSignal = 'stalled' | 'attention_needed' | 'none';

interface PaceResult {
  status: PaceStatus;
  projectedEndProgress: number;
  percentageThrough: number;
  expectedProgress: number;
  riskSignal: RiskSignal;
  isPeriodEnded: boolean;
}

function calculatePaceWithProjection(progress: number, quarter: number, year: number, daysSinceLastCheckIn?: number | null): PaceResult {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  if (quarter === 0) {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
  } else {
    const quarterStartMonth = (quarter - 1) * 3;
    startDate = new Date(year, quarterStartMonth, 1);
    endDate = new Date(year, quarterStartMonth + 3, 0);
  }
  
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const rawElapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, Math.min(rawElapsedDays, totalDays));
  const isPeriodEnded = rawElapsedDays > totalDays;
  
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;
  const expectedProgress = percentageThrough;
  const gap = progress - expectedProgress;
  const gapThreshold = 10;
  
  let projectedEndProgress = progress;
  if (!isPeriodEnded && percentageThrough > 0) {
    projectedEndProgress = Math.min((progress / percentageThrough) * 100, 200);
  }
  
  let riskSignal: RiskSignal = 'none';
  if (daysSinceLastCheckIn !== null && daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn >= 14) {
    riskSignal = 'attention_needed';
  } else if (elapsedDays >= 30 && progress === 0) {
    riskSignal = 'stalled';
  }
  
  let status: PaceStatus;
  if (isPeriodEnded) {
    if (progress >= 100) status = 'completed';
    else if (progress >= 70) status = 'on_track';
    else status = 'behind';
  } else if (progress === 0 && elapsedDays < 14) {
    status = 'no_data';
  } else if (gap >= gapThreshold) {
    status = 'ahead';
  } else if (gap <= -gapThreshold * 2) {
    status = 'at_risk';
  } else if (gap <= -gapThreshold) {
    status = 'behind';
  } else {
    status = 'on_track';
  }
  
  return { status, projectedEndProgress: Math.round(projectedEndProgress), percentageThrough: Math.round(percentageThrough), expectedProgress: Math.round(expectedProgress), riskSignal, isPeriodEnded };
}

function calculatePaceStatus(progress: number, quarter: number, year: number): PaceStatus {
  return calculatePaceWithProjection(progress, quarter, year).status;
}

export default function ExecutiveDashboard() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { t } = useVocabulary();
  
  const { selectedQuarter: currentQuarter } = useTimePeriod();

  // Helper to get headers with tenant ID for all API calls
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(currentTenant?.id && { 'x-tenant-id': currentTenant.id }),
  });

  const { data: objectives = [], isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter != null && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year != null && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/objectives?${params}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch objectives');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const { data: keyResultsMap = {}, isLoading: loadingKRs } = useQuery<Record<string, KeyResult[]>>({
    queryKey: ["/api/okr/all-key-results", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant || !currentQuarter) return {};
      // Fetch all key results for the tenant/quarter in a single request
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter.quarter != null && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter.year != null && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/key-results?${params}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) return {};
      const allKeyResults: KeyResult[] = await res.json();
      
      // Group key results by objectiveId
      const results: Record<string, KeyResult[]> = {};
      allKeyResults.forEach(kr => {
        if (!results[kr.objectiveId]) {
          results[kr.objectiveId] = [];
        }
        results[kr.objectiveId].push(kr);
      });
      return results;
    },
    enabled: !!currentTenant?.id && !!currentQuarter?.year,
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: [`/api/okr/teams`, currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const res = await fetch(`/api/okr/teams?tenantId=${currentTenant.id}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: bigRocks = [] } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter != null && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year != null && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/big-rocks?${params}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch big rocks');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const bigRockIds = bigRocks.map(br => br.id);
  const { data: bigRockTaskCounts = {} } = useQuery<Record<string, { total: number; completed: number }>>({
    queryKey: ["/api/okr/big-rocks/task-counts", bigRockIds],
    queryFn: async () => {
      if (bigRockIds.length === 0) return {};
      const res = await fetch(`/api/okr/big-rocks/task-counts`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bigRockIds }),
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: bigRockIds.length > 0,
  });

  const { data: allCheckIns = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/okr/check-ins/all", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const params = new URLSearchParams({ entityType: 'all', entityId: 'all', tenantId: currentTenant.id });
      const res = await fetch(`/api/okr/check-ins?${params}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch foundations to display Ambitions
  const { data: foundations } = useQuery<{
    id: string;
    ambitions?: Array<{ id: string; title: string; description?: string; targetYear: number; status: string; linkedValueTitles?: string[] }>;
  }>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  type ForecastItem = {
    objectiveId: string;
    title: string;
    progress: number;
    ownerEmail: string | null;
    level: string | null;
    status: string | null;
    forecast: {
      completionProbability: number;
      projectedEndValue: number;
      confidenceLow: number;
      confidenceMid: number;
      confidenceHigh: number;
      trend: 'accelerating' | 'steady' | 'decelerating' | 'insufficient_data';
      riskFlag: boolean;
      riskReasons: string[];
      velocity: number | null;
      recentVelocity: number | null;
      daysRemaining: number;
      percentageThrough: number;
    };
  };

  type ForecastResponse = {
    forecasts: ForecastItem[];
    summary: {
      total: number;
      avgProbability: number;
      avgProjected: number;
      atRiskCount: number;
      trendDistribution: { accelerating: number; steady: number; decelerating: number; insufficientData: number };
      probabilityBands: { high: number; medium: number; low: number };
    };
    atRisk: ForecastItem[];
  };

  const { data: forecastData } = useQuery<ForecastResponse>({
    queryKey: ["/api/okr/forecasts", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant || !currentQuarter) return null;
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter.quarter != null && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter.year != null && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/forecasts?${params}`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const isLoading = loadingObjectives || loadingKRs;

  // Helper function to calculate objective progress from its key results (memoized)
  const calculateObjectiveProgress = useCallback((objectiveId: string): number => {
    const krs = keyResultsMap[objectiveId] || [];
    if (krs.length === 0) return 0;
    
    const totalProgress = krs.reduce((sum, kr) => {
      if (!kr.targetValue || kr.targetValue === 0) return sum;
      const progress = Math.min(100, ((kr.currentValue ?? 0) / kr.targetValue) * 100);
      return sum + progress;
    }, 0);
    
    return Math.round(totalProgress / krs.length);
  }, [keyResultsMap]);

  const metrics = useMemo(() => {
    if (!objectives.length) return null;

    const allKRs = Object.values(keyResultsMap).flat();
    
    // Calculate progress for each objective from its key results
    const objectivesWithProgress = objectives.map(obj => ({
      ...obj,
      calculatedProgress: calculateObjectiveProgress(obj.id),
    }));
    
    const avgProgress = objectivesWithProgress.length > 0
      ? Math.round(objectivesWithProgress.reduce((sum, obj) => sum + obj.calculatedProgress, 0) / objectivesWithProgress.length)
      : 0;

    const atRiskObjectives = objectivesWithProgress.filter(obj => {
      if (obj.status === 'at_risk' || obj.status === 'behind') return true;
      if (obj.quarter != null && obj.year) {
        const paceCheck = calculatePaceWithProjection(obj.calculatedProgress, obj.quarter, obj.year);
        return paceCheck.status === 'at_risk';
      }
      return false;
    });

    const completedObjectives = objectivesWithProgress.filter(obj => 
      obj.status === 'completed' || obj.calculatedProgress >= 100
    );

    const onTrackObjectives = objectivesWithProgress.filter(obj => 
      obj.status === 'on_track' || (obj.calculatedProgress >= 50 && obj.status !== 'at_risk')
    );

    // Build KR to objective mapping for check-in attribution
    const krToObjectiveMap = new Map<string, string>();
    objectives.forEach(obj => {
      const krs = keyResultsMap[obj.id] || [];
      krs.forEach(kr => krToObjectiveMap.set(kr.id, obj.id));
    });

    // Count objectives with ANY check-in activity (objective or KR level) or recent updates
    // Only count objectives that are in the current period's objectives list
    const currentObjectiveIds = new Set(objectives.map(obj => obj.id));
    const objectivesWithCheckIns = new Set<string>();
    allCheckIns.forEach(ci => {
      if (ci.entityType === 'objective' && currentObjectiveIds.has(ci.entityId)) {
        objectivesWithCheckIns.add(ci.entityId);
      } else if (ci.entityType === 'key_result') {
        const parentObjId = krToObjectiveMap.get(ci.entityId);
        if (parentObjId && currentObjectiveIds.has(parentObjId)) {
          objectivesWithCheckIns.add(parentObjId);
        }
      }
    });
    objectives.forEach(obj => {
      if (obj.updatedAt && obj.updatedAt !== obj.createdAt) {
        objectivesWithCheckIns.add(obj.id);
      }
      const krs = keyResultsMap[obj.id] || [];
      if (krs.some(kr => kr.updatedAt && kr.updatedAt !== kr.createdAt)) {
        objectivesWithCheckIns.add(obj.id);
      }
    });

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const objectivesCheckedInThisWeek = objectives.filter(obj => {
      if (obj.updatedAt && new Date(obj.updatedAt).getTime() > oneWeekAgo) return true;
      
      const krs = keyResultsMap[obj.id] || [];
      if (krs.some(kr => kr.updatedAt && new Date(kr.updatedAt).getTime() > oneWeekAgo)) return true;
      
      const krIds = new Set(krs.map(kr => kr.id));
      const recentCheckIn = allCheckIns.find(ci => {
        if (!ci.createdAt || new Date(ci.createdAt).getTime() <= oneWeekAgo) return false;
        return ci.entityId === obj.id || krIds.has(ci.entityId);
      });
      return !!recentCheckIn;
    });

    const checkInRate = objectives.length > 0
      ? Math.round((objectivesWithCheckIns.size / objectives.length) * 100)
      : 0;

    const weeklyCheckInRate = objectives.length > 0
      ? Math.round((objectivesCheckedInThisWeek.length / objectives.length) * 100)
      : 0;

    const teamMetrics = teams.map(team => {
      const teamObjs = objectivesWithProgress.filter(obj => obj.teamId === team.id);
      const teamProgress = teamObjs.length > 0
        ? Math.round(teamObjs.reduce((sum, obj) => sum + obj.calculatedProgress, 0) / teamObjs.length)
        : 0;
      const teamAtRisk = teamObjs.filter(obj => 
        obj.status === 'at_risk' || obj.status === 'behind'
      ).length;
      
      return {
        name: team.name,
        objectives: teamObjs.length,
        progress: teamProgress,
        atRisk: teamAtRisk,
      };
    }).filter(tm => tm.objectives > 0);

    const organizationLevelObjectives = objectivesWithProgress.filter(obj => obj.level === 'organization');
    const teamLevelObjectives = objectivesWithProgress.filter(obj => obj.level === 'team');
    const departmentLevelObjectives = objectivesWithProgress.filter(obj => obj.level === 'department');

    const levelBreakdown = [
      { name: 'Organization', value: organizationLevelObjectives.length, color: '#8b5cf6' },
      { name: 'Team', value: teamLevelObjectives.length, color: '#3b82f6' },
      { name: 'Department', value: departmentLevelObjectives.length, color: '#10b981' },
    ].filter(l => l.value > 0);

    const statusBreakdown = [
      { name: 'Completed', value: completedObjectives.length, color: '#10b981' },
      { name: 'On Track', value: onTrackObjectives.length - completedObjectives.length, color: '#3b82f6' },
      { name: 'At Risk', value: atRiskObjectives.length, color: '#ef4444' },
      { name: 'Not Started', value: objectivesWithProgress.filter(o => o.calculatedProgress === 0 && o.status !== 'at_risk').length, color: '#9ca3af' },
    ].filter(s => s.value > 0);

    const bigRocksCompleted = bigRocks.filter(br => br.status === 'completed').length;
    const bigRocksTotal = bigRocks.length;
    const bigRocksProgress = bigRocksTotal > 0 
      ? Math.round((bigRocksCompleted / bigRocksTotal) * 100)
      : 0;

    // Winning highlights - objectives with high performers (>80% progress) or completed
    const winningObjectives = objectivesWithProgress
      .filter(obj => obj.calculatedProgress >= 80 || obj.status === 'completed')
      .sort((a, b) => b.calculatedProgress - a.calculatedProgress)
      .slice(0, 5);

    // Recently completed big rocks
    const recentlyCompletedBigRocks = bigRocks
      .filter(br => br.status === 'completed')
      .slice(0, 3);

    // Progress trend data from check-ins (aggregate by week)
    // Only use key result check-ins from the current selected year
    const trendYear = currentQuarter?.year ?? new Date().getFullYear();
    const weekMap = new Map<string, { totalProgress: number; count: number; timestamp: number }>();
    
    allCheckIns.forEach(ci => {
      if (ci.createdAt && ci.entityType === 'key_result' &&
          new Date(ci.createdAt).getFullYear() === trendYear) {
        const date = new Date(ci.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        // Include year to avoid cross-year collisions
        const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        
        // Normalize progress to 0-100 range (cap at 100)
        const normalizedProgress = Math.min(100, Math.max(0, ci.newProgress || 0));
        
        const existing = weekMap.get(weekKey) || { totalProgress: 0, count: 0, timestamp: weekStart.getTime() };
        existing.totalProgress += normalizedProgress;
        existing.count += 1;
        weekMap.set(weekKey, existing);
      }
    });

    // Convert to array, sort by timestamp (ascending), and take last 8 weeks
    const sortedWeeks = Array.from(weekMap.entries())
      .map(([key, data]) => ({
        week: key.split('-')[1], // Display format without year (e.g., "1/5")
        progress: Math.round(data.totalProgress / data.count),
        checkIns: data.count,
        timestamp: data.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-8); // Most recent 8 weeks

    // Check-in enrichment data
    const totalCheckIns = allCheckIns.length;
    const recentCheckIns = allCheckIns.filter(ci => {
      if (!ci.createdAt) return false;
      return new Date(ci.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
    });
    
    // Find objectives that haven't been updated recently (stale)
    const staleObjectives = objectivesWithProgress.filter(obj => {
      const lastCheckIn = allCheckIns
        .filter(ci => ci.entityId === obj.id || 
          (keyResultsMap[obj.id] || []).some(kr => kr.id === ci.entityId))
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
      
      const lastCheckInTime = lastCheckIn?.createdAt ? new Date(lastCheckIn.createdAt).getTime() : 0;
      const updatedAtTime = obj.updatedAt ? new Date(obj.updatedAt).getTime() : 0;
      const krs = keyResultsMap[obj.id] || [];
      const latestKrUpdate = krs.reduce((latest, kr) => {
        const t = kr.updatedAt ? new Date(kr.updatedAt).getTime() : 0;
        return t > latest ? t : latest;
      }, 0);
      const mostRecentActivity = Math.max(lastCheckInTime, updatedAtTime, latestKrUpdate);
      
      if (mostRecentActivity === 0) return true;
      const daysSince = Math.floor((Date.now() - mostRecentActivity) / (1000 * 60 * 60 * 24));
      return daysSince > 14; // Stale if not updated in 2 weeks
    });

    // Average days since last check-in
    const avgDaysSinceCheckIn = objectivesWithProgress.length > 0
      ? Math.round(objectivesWithProgress.reduce((sum, obj) => {
          const objCheckIns = allCheckIns.filter(ci => 
            ci.entityId === obj.id || 
            (keyResultsMap[obj.id] || []).some(kr => kr.id === ci.entityId)
          );
          const latestCheckInTime = objCheckIns.length > 0
            ? Math.max(...objCheckIns.filter(ci => ci.createdAt).map(ci => new Date(ci.createdAt!).getTime()))
            : 0;
          const updatedAtTime = obj.updatedAt ? new Date(obj.updatedAt).getTime() : 0;
          const avgKrs = keyResultsMap[obj.id] || [];
          const latestAvgKrUpdate = avgKrs.reduce((latest, kr) => {
            const t = kr.updatedAt ? new Date(kr.updatedAt).getTime() : 0;
            return t > latest ? t : latest;
          }, 0);
          const mostRecent = Math.max(latestCheckInTime, updatedAtTime, latestAvgKrUpdate);
          if (mostRecent === 0) return sum + 30;
          return sum + Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24));
        }, 0) / objectivesWithProgress.length)
      : 0;

    // Pace-based metrics - objectives falling behind based on time elapsed vs progress
    const objectivesWithPace = objectivesWithProgress
      .filter(obj => obj.quarter != null && obj.year)
      .map(obj => {
        const lastCheckIn = allCheckIns
          .filter(ci => ci.entityId === obj.id || 
            (keyResultsMap[obj.id] || []).some(kr => kr.id === ci.entityId))
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
        const lastCheckInTime = lastCheckIn?.createdAt ? new Date(lastCheckIn.createdAt).getTime() : 0;
        const objUpdatedAtTime = obj.updatedAt ? new Date(obj.updatedAt).getTime() : 0;
        const paceKrs = keyResultsMap[obj.id] || [];
        const latestPaceKrUpdate = paceKrs.reduce((latest, kr) => {
          const t = kr.updatedAt ? new Date(kr.updatedAt).getTime() : 0;
          return t > latest ? t : latest;
        }, 0);
        const mostRecentActivity = Math.max(lastCheckInTime, objUpdatedAtTime, latestPaceKrUpdate);
        const daysSinceLastCheckIn = mostRecentActivity > 0
          ? Math.floor((Date.now() - mostRecentActivity) / (1000 * 60 * 60 * 24))
          : null;
        const paceResult = calculatePaceWithProjection(obj.calculatedProgress, obj.quarter!, obj.year!, daysSinceLastCheckIn);
        return {
          ...obj,
          paceStatus: paceResult.status,
          projectedEndProgress: paceResult.projectedEndProgress,
          expectedProgress: paceResult.expectedProgress,
          riskSignal: paceResult.riskSignal,
          daysSinceLastCheckIn,
          isPeriodEnded: paceResult.isPeriodEnded,
        };
      });
    
    const behindPaceObjectives = objectivesWithPace
      .filter(obj => obj.paceStatus === 'behind' || obj.paceStatus === 'at_risk')
      .sort((a, b) => {
        if (a.paceStatus === 'at_risk' && b.paceStatus !== 'at_risk') return -1;
        if (b.paceStatus === 'at_risk' && a.paceStatus !== 'at_risk') return 1;
        return a.calculatedProgress - b.calculatedProgress;
      });
    
    // Count risk signals for overview
    const stalledObjectivesCount = objectivesWithPace.filter(obj => obj.riskSignal === 'stalled').length;
    const attentionNeededCount = objectivesWithPace.filter(obj => obj.riskSignal === 'attention_needed').length;

    // Pace distribution for forecast card
    const paceDistribution = {
      ahead: objectivesWithPace.filter(obj => obj.paceStatus === 'ahead').length,
      onTrack: objectivesWithPace.filter(obj => obj.paceStatus === 'on_track').length,
      behind: objectivesWithPace.filter(obj => obj.paceStatus === 'behind').length,
      atRisk: objectivesWithPace.filter(obj => obj.paceStatus === 'at_risk').length,
      noData: objectivesWithPace.filter(obj => obj.paceStatus === 'no_data').length,
      completed: objectivesWithPace.filter(obj => obj.paceStatus === 'completed').length,
    };
    
    // Average projected progress at end of quarter
    const avgProjectedProgress = objectivesWithPace.length > 0
      ? Math.round(objectivesWithPace.reduce((sum, obj) => sum + Math.min(obj.projectedEndProgress, 100), 0) / objectivesWithPace.length)
      : 0;

    // Average expected progress based on time elapsed in period
    const avgExpectedProgress = objectivesWithPace.length > 0
      ? Math.round(objectivesWithPace.reduce((sum, obj) => sum + obj.expectedProgress, 0) / objectivesWithPace.length)
      : undefined;

    return {
      totalObjectives: objectives.length,
      totalKRs: allKRs.length,
      avgProgress,
      avgExpectedProgress,
      atRiskCount: atRiskObjectives.length,
      atRiskObjectives,
      completedCount: completedObjectives.length,
      onTrackCount: onTrackObjectives.length,
      checkInRate,
      weeklyCheckInRate,
      teamMetrics,
      levelBreakdown,
      statusBreakdown,
      bigRocksCompleted,
      bigRocksTotal,
      bigRocksProgress,
      bigRocksList: bigRocks.slice(0, 8), // Top 8 for display
      winningObjectives,
      recentlyCompletedBigRocks,
      trendData: sortedWeeks,
      // Check-in enrichment
      totalCheckIns,
      recentCheckInsCount: recentCheckIns.length,
      staleObjectivesCount: staleObjectives.length,
      staleObjectives: staleObjectives.slice(0, 5),
      avgDaysSinceCheckIn,
      behindPaceObjectives: behindPaceObjectives.slice(0, 5),
      behindPaceCount: behindPaceObjectives.length,
      stalledSignalCount: stalledObjectivesCount,
      attentionNeededCount,
      paceDistribution,
      avgProjectedProgress,
    };
  }, [objectives, keyResultsMap, teams, allCheckIns, bigRocks, currentQuarter]);
  
  // Extract pace distribution for easier access in JSX
  const paceDistribution = metrics?.paceDistribution || { ahead: 0, onTrack: 0, behind: 0, atRisk: 0, noData: 0, completed: 0 };
  const avgProjectedProgress = metrics?.avgProjectedProgress || 0;

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Organization Access</h2>
          <p className="text-muted-foreground">Please select an organization to view the executive dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Executive Dashboard...</p>
        </div>
      </div>
    );
  }

  const isAnnualPeriod = currentQuarter?.quarter === 0;
  const periodStart = currentQuarter 
    ? isAnnualPeriod 
      ? new Date(currentQuarter.year, 0, 1) 
      : new Date(currentQuarter.year, (currentQuarter.quarter - 1) * 3, 1)
    : new Date();
  const periodEnd = currentQuarter 
    ? isAnnualPeriod 
      ? new Date(currentQuarter.year, 11, 31)
      : new Date(currentQuarter.year, currentQuarter.quarter * 3, 0)
    : new Date();
  const daysInQuarter = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const dayOfQuarter = currentQuarter ? Math.min(
    Math.max(0, Math.floor((Date.now() - periodStart.getTime()) / (1000 * 60 * 60 * 24))),
    daysInQuarter
  ) : 0;
  const daysRemaining = Math.max(0, daysInQuarter - dayOfQuarter);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-executive-title">Executive Dashboard</h1>
          <p className="text-muted-foreground">
            Strategic overview and organizational health for {currentQuarter?.label}
          </p>
        </div>
      </div>

      {/* Ambitions Section - Long-term strategic targets */}
      {(() => {
        const ambitions = foundations?.ambitions;
        const activeAmbitions = ambitions?.filter(a => a.status === 'active') || [];
        if (activeAmbitions.length > 0) {
          return (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Strategic Ambitions</CardTitle>
                  <Badge variant="secondary" className="ml-auto">{activeAmbitions.length} Active</Badge>
                </div>
                <CardDescription>3-5 year strategic targets guiding organizational direction</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeAmbitions.map((ambition) => (
                    <div key={ambition.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                      <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{ambition.title}</span>
                          <Badge variant="outline" className="text-xs">{ambition.targetYear}</Badge>
                        </div>
                        {ambition.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ambition.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Card className="cursor-help hover-elevate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className={cn("text-3xl font-bold", getProgressColor(metrics.avgProgress, metrics.avgExpectedProgress))} data-testid="text-overall-progress">
                          {metrics.avgProgress}%
                        </p>
                      </div>
                      {(() => {
                        const isAheadOfPace = metrics.avgExpectedProgress !== undefined 
                          ? metrics.avgProgress >= metrics.avgExpectedProgress - 5
                          : metrics.avgProgress >= 50;
                        return (
                          <div className={cn("p-3 rounded-full", isAheadOfPace ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900")}>
                            <TrendingUp className={cn("h-6 w-6", isAheadOfPace ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")} />
                          </div>
                        );
                      })()}
                    </div>
                    <Progress value={metrics.avgProgress} className="mt-4 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {metrics.totalObjectives} {t('objective', 'plural').toLowerCase()} • {metrics.totalKRs} key results
                    </p>
                  </CardContent>
                </Card>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-semibold">Why it matters</h4>
                  <p className="text-sm text-muted-foreground">
                    Shows average completion across all objectives based on Key Result progress. Color reflects pace: green means on or ahead of schedule relative to time elapsed in the period.
                  </p>
                  <Separator />
                  <h4 className="font-semibold">How to act</h4>
                  <p className="text-sm text-muted-foreground">
                    {metrics.avgProgress < 40 
                      ? "Progress is lagging. Review at-risk objectives and consider resource reallocation."
                      : metrics.avgProgress >= 70
                      ? "Strong progress! Consider stretching targets or accelerating timelines."
                      : "On track. Continue regular check-ins and monitor for blockers."}
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>

            <HoverCard>
              <HoverCardTrigger asChild>
                <Card className="cursor-help hover-elevate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-muted-foreground">At Risk</p>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="text-at-risk-count">
                          {metrics.atRiskCount}
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      {metrics.atRiskCount > 0 
                        ? `${Math.round((metrics.atRiskCount / metrics.totalObjectives) * 100)}% of objectives need attention`
                        : "All objectives on track"}
                    </p>
                  </CardContent>
                </Card>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-semibold">Why it matters</h4>
                  <p className="text-sm text-muted-foreground">
                    Objectives explicitly marked as "Behind" or "At Risk", or those significantly behind expected pace for their period.
                  </p>
                  <Separator />
                  <h4 className="font-semibold">How to act</h4>
                  <p className="text-sm text-muted-foreground">
                    {metrics.atRiskCount === 0 
                      ? "Great! No objectives at risk. Keep monitoring progress."
                      : metrics.atRiskCount <= 2
                      ? "Schedule 1:1s with objective owners to identify blockers and provide support."
                      : "Multiple objectives at risk. Consider an executive review meeting to realign priorities."}
                  </p>
                  {metrics.atRiskCount > 0 && (
                    <Link href="/planning">
                      <Button size="sm" variant="outline" className="w-full mt-2">
                        <Eye className="h-4 w-4 mr-2" />
                        Review At-Risk Objectives
                      </Button>
                    </Link>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>

            <HoverCard>
              <HoverCardTrigger asChild>
                <Card className="cursor-help hover-elevate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Check-in Rate</p>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className={cn("text-3xl font-bold", metrics.checkInRate >= 70 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")} data-testid="text-checkin-rate">
                          {metrics.checkInRate}%
                        </p>
                      </div>
                      <div className={cn("p-3 rounded-full", metrics.checkInRate >= 70 ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900")}>
                        <Activity className="h-6 w-6 text-current" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {metrics.weeklyCheckInRate}% checked in this week
                      </p>
                      {metrics.staleObjectivesCount > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {metrics.staleObjectivesCount} objectives stale (no updates in 2+ weeks)
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-semibold">Why it matters</h4>
                  <p className="text-sm text-muted-foreground">
                    Regular check-ins indicate active engagement. Objectives without updates become "blind spots" that may derail.
                  </p>
                  <Separator />
                  <h4 className="font-semibold">How to act</h4>
                  <p className="text-sm text-muted-foreground">
                    {metrics.checkInRate >= 80 
                      ? "Excellent engagement! Team is actively tracking progress."
                      : metrics.checkInRate >= 50
                      ? "Moderate engagement. Remind owners to update weekly."
                      : "Low engagement. Consider adding check-ins to your weekly rhythm meetings."}
                  </p>
                  <div className="text-xs mt-2 p-2 bg-muted rounded">
                    <p><strong>Avg. days since update:</strong> {metrics.avgDaysSinceCheckIn} days</p>
                    <p><strong>Recent check-ins:</strong> {metrics.recentCheckInsCount} this week</p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>

            <HoverCard>
              <HoverCardTrigger asChild>
                <Card className="cursor-help hover-elevate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Days Remaining</p>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-3xl font-bold" data-testid="text-days-remaining">
                          {daysRemaining}
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                        <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <Progress value={(dayOfQuarter / daysInQuarter) * 100} className="mt-4 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Day {dayOfQuarter} of {daysInQuarter}
                    </p>
                  </CardContent>
                </Card>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-semibold">Why it matters</h4>
                  <p className="text-sm text-muted-foreground">
                    Compare progress % against time elapsed. If 50% through quarter, aim for ~50% progress.
                  </p>
                  <Separator />
                  <h4 className="font-semibold">How to act</h4>
                  <p className="text-sm text-muted-foreground">
                    {daysRemaining > 60 
                      ? "Early in quarter. Focus on clearing blockers and building momentum."
                      : daysRemaining > 30
                      ? "Mid-quarter checkpoint. Assess if current trajectory will hit targets."
                      : daysRemaining > 14
                      ? "Final push. Prioritize critical objectives and remove distractions."
                      : "Quarter end approaching. Focus on completion and documenting learnings."}
                  </p>
                  {daysRemaining <= 30 && metrics.avgProgress < 70 && (
                    <Link href="/focus-rhythm">
                      <Button size="sm" variant="outline" className="w-full mt-2">
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Schedule Review Meeting
                      </Button>
                    </Link>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>

          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800" data-testid="card-predictive-forecast">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Completion Forecast
                  </CardTitle>
                  <CardDescription>Velocity-based completion projections with confidence bands</CardDescription>
                </div>
                {forecastData?.summary && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant={forecastData.summary.avgProbability >= 70 ? "default" : forecastData.summary.avgProbability >= 50 ? "secondary" : "destructive"}>
                      {forecastData.summary.avgProbability}% avg. probability
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {forecastData?.summary ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-muted-foreground">High Confidence</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-forecast-high">
                        {forecastData.summary.probabilityBands.high}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">75%+ likely to hit target</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Minus className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-medium text-muted-foreground">Moderate</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-forecast-medium">
                        {forecastData.summary.probabilityBands.medium}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">50-74% completion probability</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-medium text-muted-foreground">At Risk</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-forecast-low">
                        {forecastData.summary.probabilityBands.low}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">&lt;50% likely without intervention</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-medium text-muted-foreground">Projected Completion</span>
                      </div>
                      <p className="text-2xl font-bold" data-testid="text-forecast-projected">
                        {forecastData.summary.avgProjected}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg. end-of-period projection</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-muted-foreground block mb-2">Velocity Trends</span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-sm">{forecastData.summary.trendDistribution.accelerating} accelerating</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Minus className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-sm">{forecastData.summary.trendDistribution.steady} steady</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ArrowDown className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-sm">{forecastData.summary.trendDistribution.decelerating} decelerating</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-muted-foreground block mb-2">Probability Distribution</span>
                      <div className="flex items-center gap-1 h-5">
                        {forecastData.summary.total > 0 && (
                          <>
                            {forecastData.summary.probabilityBands.high > 0 && (
                              <div
                                className="h-full bg-green-500 rounded-l-sm"
                                style={{ width: `${(forecastData.summary.probabilityBands.high / forecastData.summary.total) * 100}%` }}
                                title={`${forecastData.summary.probabilityBands.high} high confidence`}
                              />
                            )}
                            {forecastData.summary.probabilityBands.medium > 0 && (
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: `${(forecastData.summary.probabilityBands.medium / forecastData.summary.total) * 100}%` }}
                                title={`${forecastData.summary.probabilityBands.medium} moderate`}
                              />
                            )}
                            {forecastData.summary.probabilityBands.low > 0 && (
                              <div
                                className="h-full bg-red-500 rounded-r-sm"
                                style={{ width: `${(forecastData.summary.probabilityBands.low / forecastData.summary.total) * 100}%` }}
                                title={`${forecastData.summary.probabilityBands.low} at risk`}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {forecastData.atRisk.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          Risk-Flagged Objectives ({forecastData.atRisk.length})
                        </span>
                        <Link href="/planning">
                          <Button size="sm" variant="outline" className="shrink-0">
                            <Eye className="h-4 w-4 mr-1" />
                            Review All
                          </Button>
                        </Link>
                      </div>
                      <div className="space-y-1.5">
                        {forecastData.atRisk.slice(0, 5).map((item) => (
                          <div key={item.objectiveId} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">{item.progress}% progress</span>
                                <Badge variant="destructive" className="text-xs">{item.forecast.completionProbability}% probability</Badge>
                                {item.forecast.trend === 'decelerating' && (
                                  <Badge variant="outline" className="text-xs"><ArrowDown className="h-3 w-3 mr-0.5" />Decelerating</Badge>
                                )}
                                {item.forecast.riskReasons.length > 0 && (
                                  <span className="text-xs text-red-600 dark:text-red-400">{item.forecast.riskReasons[0]}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">{item.forecast.confidenceLow}-{Math.round(Math.min(item.forecast.confidenceHigh, 100))}%</p>
                              <p className="text-xs text-muted-foreground">confidence range</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-muted-foreground">On Track to Complete</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-forecast-on-track">
                      {paceDistribution.ahead + paceDistribution.onTrack}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-muted-foreground">May Miss Target</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {paceDistribution.behind}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-muted-foreground">Projected Completion</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {avgProjectedProgress}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Performance
                </CardTitle>
                <CardDescription>Progress comparison across teams</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.teamMetrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.teamMetrics} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, 'Progress']}
                        contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
                      />
                      <Bar 
                        dataKey="progress" 
                        fill="#8b5cf6" 
                        radius={[0, 4, 4, 0]}
                        name="Progress"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <p>No team data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Status Overview
                </CardTitle>
                <CardDescription>Objective status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.statusBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={metrics.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {metrics.statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <p>No status data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {(metrics.atRiskObjectives.length > 0 || metrics.winningObjectives.length > 0) && (
          <div className={cn(
            "grid gap-4",
            metrics.atRiskObjectives.length > 0 && metrics.winningObjectives.length > 0 
              ? "grid-cols-1 lg:grid-cols-2" 
              : "grid-cols-1"
          )}>
            {metrics.atRiskObjectives.length > 0 && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Needs Attention
                  </CardTitle>
                  <CardDescription>Objectives that require immediate focus</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.atRiskObjectives.slice(0, 5).map((obj) => {
                      const team = teams.find(t => t.id === obj.teamId);
                      return (
                        <div 
                          key={obj.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30"
                          data-testid={`item-at-risk-${obj.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{obj.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {team && <Badge variant="outline" className="text-xs">{team.name}</Badge>}
                              {getStatusBadge(obj.status || 'at_risk')}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={cn("text-lg font-bold", getProgressColor(obj.calculatedProgress))}>
                                {obj.calculatedProgress}%
                              </p>
                            </div>
                            <Link href="/planning">
                              <Button size="sm" variant="outline" data-testid={`button-view-obj-${obj.id}`}>
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    {metrics.atRiskObjectives.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        + {metrics.atRiskObjectives.length - 5} more at-risk objectives
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {metrics.winningObjectives.length > 0 && (
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Trophy className="h-5 w-5" />
                    Winning Highlights
                  </CardTitle>
                  <CardDescription>Top performing objectives and achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.winningObjectives.map((obj) => {
                      const team = teams.find(t => t.id === obj.teamId);
                      const isComplete = obj.calculatedProgress >= 100 || obj.status === 'completed';
                      return (
                        <div 
                          key={obj.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30"
                          data-testid={`item-winning-${obj.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{obj.title}</p>
                              {isComplete && <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {team && <Badge variant="outline" className="text-xs">{team.name}</Badge>}
                              {obj.status === 'completed' && (
                                <Badge className="bg-green-500 text-xs">Completed</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                {obj.calculatedProgress}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {metrics.recentlyCompletedBigRocks.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Recently Completed Big Rocks</p>
                        {metrics.recentlyCompletedBigRocks.map((br) => (
                          <div key={br.id} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="truncate">{br.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {metrics.behindPaceCount > 0 && (
            <Card className="border-amber-200 dark:border-amber-800" data-testid="card-behind-pace-alerts">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <TrendingDown className="h-5 w-5" />
                  Behind Pace
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
                    {metrics.behindPaceCount}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Objectives where progress is lagging behind the expected pace for this point in the quarter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.behindPaceObjectives.map((obj) => {
                    const team = teams.find(t => t.id === obj.teamId);
                    const isAtRisk = obj.paceStatus === 'at_risk';
                    return (
                      <div 
                        key={obj.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg",
                          isAtRisk 
                            ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" 
                            : "bg-amber-50 dark:bg-amber-950/30"
                        )}
                        data-testid={`item-behind-pace-${obj.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{obj.title}</p>
                            {isAtRisk && (
                              <Badge variant="destructive" className="text-xs">Critical</Badge>
                            )}
                            {obj.riskSignal === 'stalled' && (
                              <Badge variant="destructive" className="text-xs">Stalled</Badge>
                            )}
                            {obj.riskSignal === 'attention_needed' && (
                              <Badge variant="secondary" className="text-xs text-amber-600">{obj.daysSinceLastCheckIn}d no check-in</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {team && <Badge variant="outline" className="text-xs">{team.name}</Badge>}
                            <span className="text-xs text-muted-foreground">
                              {obj.isPeriodEnded 
                                ? `${obj.calculatedProgress}% achieved (period ended)`
                                : `${obj.calculatedProgress}% progress (expected: ${obj.expectedProgress}%)`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={cn(
                              "text-lg font-bold",
                              isAtRisk ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                            )}>
                              {obj.calculatedProgress}%
                            </p>
                            {!obj.isPeriodEnded && (
                              <p className="text-xs text-muted-foreground">
                                of {obj.expectedProgress}% expected
                              </p>
                            )}
                          </div>
                          <Link href="/planning">
                            <Button size="sm" variant="outline" data-testid={`button-view-pace-${obj.id}`}>
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                  {metrics.behindPaceCount > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      + {metrics.behindPaceCount - 5} more behind pace
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>How to act:</strong> These objectives need acceleration. Schedule check-ins with owners to identify blockers and reallocate resources if needed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {metrics.staleObjectivesCount > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                  Stale Objectives
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
                    {metrics.staleObjectivesCount}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  No updates in 2+ weeks. These may be blind spots that need attention.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.staleObjectives.map((obj) => {
                    const team = teams.find(t => t.id === obj.teamId);
                    return (
                      <div 
                        key={obj.id}
                        className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{obj.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {team && <Badge variant="outline" className="text-xs">{team.name}</Badge>}
                            <span className="text-xs text-muted-foreground">
                              {obj.calculatedProgress}% complete
                            </span>
                          </div>
                        </div>
                        <Link href="/planning">
                          <Button size="sm" variant="ghost" className="text-amber-600">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    <strong>Suggested Action:</strong> Reach out to objective owners for status updates
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Executive Actions
              </CardTitle>
              <CardDescription>Recommended next steps based on current data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metrics.atRiskCount > 0 && (
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-sm">Risk Review</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {metrics.atRiskCount} objectives need attention. Schedule a review to address blockers.
                    </p>
                    <Link href="/focus-rhythm">
                      <Button size="sm" variant="outline" className="w-full">
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Schedule Review
                      </Button>
                    </Link>
                  </div>
                )}
                
                {metrics.staleObjectivesCount > 0 && (
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Check-in Reminder</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {metrics.staleObjectivesCount} objectives haven't been updated. Send a check-in reminder.
                    </p>
                    <Link href="/planning">
                      <Button size="sm" variant="outline" className="w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Stale Items
                      </Button>
                    </Link>
                  </div>
                )}
                
                {daysRemaining <= 30 && (
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Quarter Close</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {daysRemaining} days remaining. Start planning next quarter and closing reviews.
                    </p>
                    <Link href="/planning">
                      <Button size="sm" variant="outline" className="w-full">
                        <Eye className="h-4 w-4 mr-2" />
                        Plan Next Quarter
                      </Button>
                    </Link>
                  </div>
                )}

                {metrics.winningObjectives.length > 0 && (
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">Celebrate Wins</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {metrics.winningObjectives.length} high performers. Recognize achievements to boost morale.
                    </p>
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Coming Soon
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {metrics.trendData.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Progress Trend
                </CardTitle>
                <CardDescription>Weekly average progress from key result check-ins</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'progress' ? `${value}%` : value,
                        name === 'progress' ? 'Avg Progress' : 'Check-ins'
                      ]}
                      contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="progress" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                      name="progress"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Objective Levels
                </CardTitle>
                <CardDescription>Distribution by organizational level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.levelBreakdown.map((level) => (
                    <div key={level.name} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium">{level.name}</div>
                      <div className="flex-1">
                        <div className="h-4 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${(level.value / metrics.totalObjectives) * 100}%`,
                              backgroundColor: level.color 
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right text-sm font-medium">{level.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Big Rocks Progress
                </CardTitle>
                <CardDescription>
                  {metrics.bigRocksCompleted} of {metrics.bigRocksTotal} key priorities completed ({metrics.bigRocksProgress}%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.bigRocksList.length > 0 ? (
                  <div className="space-y-3">
                    {metrics.bigRocksList.map((br) => {
                      const taskCount = bigRockTaskCounts[br.id];
                      const progress = br.completionPercentage || 0;
                      return (
                        <div 
                          key={br.id}
                          className={cn(
                            "p-3 rounded-lg",
                            br.status === 'completed' 
                              ? "bg-green-50 dark:bg-green-950/30" 
                              : "bg-muted/50"
                          )}
                          data-testid={`item-bigrock-${br.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {br.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : br.status === 'in_progress' ? (
                              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className={cn(
                              "text-sm truncate flex-1",
                              br.status === 'completed' && "line-through text-muted-foreground"
                            )}>
                              {br.title}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground flex-shrink-0" data-testid={`text-bigrock-progress-${br.id}`}>
                              {progress}%
                            </span>
                            <Badge 
                              variant={br.status === 'completed' ? 'secondary' : 'outline'} 
                              className="text-xs flex-shrink-0"
                            >
                              {br.status === 'completed' ? 'Done' : br.status === 'in_progress' ? 'Active' : 'Pending'}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            {taskCount && taskCount.total > 0 && (
                              <span className="text-xs text-muted-foreground flex-shrink-0" data-testid={`text-bigrock-tasks-${br.id}`}>
                                {taskCount.completed}/{taskCount.total} tasks
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {metrics.bigRocksTotal > 8 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {metrics.bigRocksTotal - 8} more big rocks
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p>No big rocks for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Health Summary
              </CardTitle>
              <CardDescription>Quick view of team status and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Team</th>
                      <th className="text-center py-3 px-4 font-medium">Objectives</th>
                      <th className="text-center py-3 px-4 font-medium">Progress</th>
                      <th className="text-center py-3 px-4 font-medium">At Risk</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.teamMetrics.map((team) => (
                      <tr key={team.name} className="border-b hover-elevate" data-testid={`row-team-${team.name}`}>
                        <td className="py-3 px-4 font-medium">{team.name}</td>
                        <td className="py-3 px-4 text-center">{team.objectives}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Progress value={team.progress} className="w-20 h-2" />
                            <span className={cn("text-sm font-medium", getProgressColor(team.progress))}>
                              {team.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {team.atRisk > 0 ? (
                            <Badge variant="destructive">{team.atRisk}</Badge>
                          ) : (
                            <Badge variant="secondary">0</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {team.progress >= 70 ? (
                            <Badge className="bg-green-500">Healthy</Badge>
                          ) : team.progress >= 40 ? (
                            <Badge className="bg-amber-500">Moderate</Badge>
                          ) : (
                            <Badge variant="destructive">Needs Focus</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {metrics.teamMetrics.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No team data available for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!metrics && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground mb-4">
              No objectives found for {currentQuarter?.label}. Create objectives in Outcomes to see executive metrics.
            </p>
            <Link href="/planning">
              <Button data-testid="button-go-to-outcomes">Go to Outcomes</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
