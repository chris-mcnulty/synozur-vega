import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { getCurrentQuarter, generateQuarters } from "@/lib/fiscal-utils";
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

type Quarter = {
  id: string;
  label: string;
  year: number;
  quarter: number;
};

const currentYear = new Date().getFullYear();
const quarters: Quarter[] = [
  ...generateQuarters(currentYear + 1),
  ...generateQuarters(currentYear),
  ...generateQuarters(currentYear - 1),
];

function getProgressColor(progress: number): string {
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
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);
  const endDate = new Date(year, quarterStartMonth + 3, 0);
  
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
  
  const { quarter: currentQuarterNum, year: currentYearNum } = getCurrentQuarter();
  const defaultQuarterId = `q${currentQuarterNum}-${currentYearNum}`;
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarterId);
  
  const currentQuarter = quarters.find((q) => q.id === selectedQuarter);

  const { data: objectives = [], isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/objectives?${params}`);
      if (!res.ok) throw new Error('Failed to fetch objectives');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const { data: keyResultsMap = {}, isLoading: loadingKRs } = useQuery<Record<string, KeyResult[]>>({
    queryKey: ["/api/okr/all-key-results", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!objectives.length) return {};
      const results: Record<string, KeyResult[]> = {};
      await Promise.all(
        objectives.map(async (obj) => {
          try {
            const res = await fetch(`/api/okr/objectives/${obj.id}/key-results`);
            if (res.ok) {
              results[obj.id] = await res.json();
            }
          } catch (e) {
            results[obj.id] = [];
          }
        })
      );
      return results;
    },
    enabled: objectives.length > 0,
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: [`/api/okr/teams`, currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const res = await fetch(`/api/okr/teams?tenantId=${currentTenant.id}`);
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
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/big-rocks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch big rocks');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const { data: allCheckIns = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/okr/check-ins/all", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=all&entityId=all`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const isLoading = loadingObjectives || loadingKRs;

  // Helper function to calculate objective progress from its key results
  const calculateObjectiveProgress = (objectiveId: string): number => {
    const krs = keyResultsMap[objectiveId] || [];
    if (krs.length === 0) return 0;
    
    const totalProgress = krs.reduce((sum, kr) => {
      if (!kr.targetValue || kr.targetValue === 0) return sum;
      const progress = Math.min(100, ((kr.currentValue ?? 0) / kr.targetValue) * 100);
      return sum + progress;
    }, 0);
    
    return Math.round(totalProgress / krs.length);
  };

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

    const atRiskObjectives = objectivesWithProgress.filter(obj => 
      obj.status === 'at_risk' || obj.status === 'behind' || obj.calculatedProgress < 30
    );

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

    // Count objectives with ANY check-in activity (objective or KR level)
    const objectivesWithCheckIns = new Set<string>();
    allCheckIns.forEach(ci => {
      if (ci.entityType === 'objective') {
        objectivesWithCheckIns.add(ci.entityId);
      } else if (ci.entityType === 'key_result') {
        const parentObjId = krToObjectiveMap.get(ci.entityId);
        if (parentObjId) {
          objectivesWithCheckIns.add(parentObjId);
        }
      }
    });

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const objectivesCheckedInThisWeek = objectives.filter(obj => {
      const krs = keyResultsMap[obj.id] || [];
      const krIds = new Set(krs.map(kr => kr.id));
      
      // Check for any recent check-in on this objective OR its key results
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
    // Only use key result check-ins as they have reliable progress data
    const weekMap = new Map<string, { totalProgress: number; count: number; timestamp: number }>();
    
    allCheckIns.forEach(ci => {
      if (ci.createdAt && ci.entityType === 'key_result') {
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
      
      if (!lastCheckIn) return true;
      const daysSince = Math.floor((Date.now() - new Date(lastCheckIn.createdAt!).getTime()) / (1000 * 60 * 60 * 24));
      return daysSince > 14; // Stale if not updated in 2 weeks
    });

    // Average days since last check-in
    const avgDaysSinceCheckIn = objectivesWithProgress.length > 0
      ? Math.round(objectivesWithProgress.reduce((sum, obj) => {
          const checkIns = allCheckIns.filter(ci => 
            ci.entityId === obj.id || 
            (keyResultsMap[obj.id] || []).some(kr => kr.id === ci.entityId)
          );
          if (checkIns.length === 0) return sum + 30; // Default to 30 if no check-ins
          const latest = checkIns.sort((a, b) => 
            new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
          )[0];
          return sum + Math.floor((Date.now() - new Date(latest.createdAt!).getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / objectivesWithProgress.length)
      : 0;

    // Pace-based metrics - objectives falling behind based on time elapsed vs progress
    const objectivesWithPace = objectivesWithProgress
      .filter(obj => obj.quarter && obj.quarter > 0 && obj.year)
      .map(obj => {
        const lastCheckIn = allCheckIns
          .filter(ci => ci.entityId === obj.id || 
            (keyResultsMap[obj.id] || []).some(kr => kr.id === ci.entityId))
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
        const daysSinceLastCheckIn = lastCheckIn 
          ? Math.floor((Date.now() - new Date(lastCheckIn.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
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

    return {
      totalObjectives: objectives.length,
      totalKRs: allKRs.length,
      avgProgress,
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
    };
  }, [objectives, keyResultsMap, teams, allCheckIns, bigRocks]);

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

  const daysInQuarter = 90;
  const dayOfQuarter = currentQuarter ? Math.min(
    Math.floor((Date.now() - new Date(currentQuarter.year, (currentQuarter.quarter - 1) * 3, 1).getTime()) / (1000 * 60 * 60 * 24)),
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
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger className="w-40" data-testid="select-exec-quarter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                {q.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                        <p className={cn("text-3xl font-bold", getProgressColor(metrics.avgProgress))} data-testid="text-overall-progress">
                          {metrics.avgProgress}%
                        </p>
                      </div>
                      <div className={cn("p-3 rounded-full", metrics.avgProgress >= 50 ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900")}>
                        <TrendingUp className={cn("h-6 w-6", metrics.avgProgress >= 50 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")} />
                      </div>
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
                    Shows average completion across all objectives based on Key Result progress. At mid-quarter, aim for 40-50%.
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
                    Objectives with less than 30% progress or marked as "Behind" or "At Risk" need immediate attention.
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

          {metrics.trendData.length > 0 && (
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
                <CardDescription>Key priorities completion status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${metrics.bigRocksProgress * 3.52} 352`}
                          className="text-primary"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <p className="text-2xl font-bold">{metrics.bigRocksCompleted}/{metrics.bigRocksTotal}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                    </div>
                  </div>
                </div>
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
