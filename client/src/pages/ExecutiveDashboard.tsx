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
    queryKey: [`/api/okr/teams`],
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

  const metrics = useMemo(() => {
    if (!objectives.length) return null;

    const allKRs = Object.values(keyResultsMap).flat();
    
    const avgProgress = objectives.length > 0
      ? Math.round(objectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / objectives.length)
      : 0;

    const atRiskObjectives = objectives.filter(obj => 
      obj.status === 'at_risk' || obj.status === 'behind' || (obj.progress || 0) < 30
    );

    const completedObjectives = objectives.filter(obj => 
      obj.status === 'completed' || (obj.progress || 0) >= 100
    );

    const onTrackObjectives = objectives.filter(obj => 
      obj.status === 'on_track' || ((obj.progress || 0) >= 50 && obj.status !== 'at_risk')
    );

    const objectivesWithCheckIns = new Set<string>();
    allCheckIns.forEach(ci => {
      if (ci.entityType === 'objective') {
        objectivesWithCheckIns.add(ci.entityId);
      }
    });

    const objectivesCheckedInThisWeek = objectives.filter(obj => {
      const recentCheckIn = allCheckIns.find(ci => 
        ci.entityId === obj.id && 
        ci.entityType === 'objective' &&
        new Date(ci.createdAt!).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      return !!recentCheckIn;
    });

    const checkInRate = objectives.length > 0
      ? Math.round((objectivesWithCheckIns.size / objectives.length) * 100)
      : 0;

    const weeklyCheckInRate = objectives.length > 0
      ? Math.round((objectivesCheckedInThisWeek.length / objectives.length) * 100)
      : 0;

    const teamMetrics = teams.map(team => {
      const teamObjectives = objectives.filter(obj => obj.teamId === team.id);
      const teamProgress = teamObjectives.length > 0
        ? Math.round(teamObjectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / teamObjectives.length)
        : 0;
      const teamAtRisk = teamObjectives.filter(obj => 
        obj.status === 'at_risk' || obj.status === 'behind'
      ).length;
      
      return {
        name: team.name,
        objectives: teamObjectives.length,
        progress: teamProgress,
        atRisk: teamAtRisk,
      };
    }).filter(tm => tm.objectives > 0);

    const companyLevelObjectives = objectives.filter(obj => obj.level === 'company');
    const departmentLevelObjectives = objectives.filter(obj => obj.level === 'department');
    const individualLevelObjectives = objectives.filter(obj => obj.level === 'individual');

    const levelBreakdown = [
      { name: 'Company', value: companyLevelObjectives.length, color: '#8b5cf6' },
      { name: 'Department', value: departmentLevelObjectives.length, color: '#3b82f6' },
      { name: 'Individual', value: individualLevelObjectives.length, color: '#10b981' },
    ].filter(l => l.value > 0);

    const statusBreakdown = [
      { name: 'Completed', value: completedObjectives.length, color: '#10b981' },
      { name: 'On Track', value: onTrackObjectives.length - completedObjectives.length, color: '#3b82f6' },
      { name: 'At Risk', value: atRiskObjectives.length, color: '#ef4444' },
      { name: 'Not Started', value: objectives.filter(o => (o.progress || 0) === 0 && o.status !== 'at_risk').length, color: '#9ca3af' },
    ].filter(s => s.value > 0);

    const bigRocksCompleted = bigRocks.filter(br => br.status === 'completed').length;
    const bigRocksTotal = bigRocks.length;
    const bigRocksProgress = bigRocksTotal > 0 
      ? Math.round((bigRocksCompleted / bigRocksTotal) * 100)
      : 0;

    // Winning highlights - objectives exceeding 100% or high performers (>80% progress)
    const winningObjectives = objectives
      .filter(obj => (obj.progress || 0) >= 80 || obj.status === 'completed')
      .sort((a, b) => (b.progress || 0) - (a.progress || 0))
      .slice(0, 5);

    // Recently completed big rocks
    const recentlyCompletedBigRocks = bigRocks
      .filter(br => br.status === 'completed')
      .slice(0, 3);

    // Progress trend data from check-ins (aggregate by week)
    const trendData: { week: string; progress: number; checkIns: number }[] = [];
    const weekMap = new Map<string, { totalProgress: number; count: number }>();
    
    allCheckIns.forEach(ci => {
      if (ci.createdAt) {
        const date = new Date(ci.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        
        const existing = weekMap.get(weekKey) || { totalProgress: 0, count: 0 };
        existing.totalProgress += ci.newProgress || 0;
        existing.count += 1;
        weekMap.set(weekKey, existing);
      }
    });

    // Convert to array and sort by date
    const sortedWeeks = Array.from(weekMap.entries())
      .map(([week, data]) => ({
        week,
        progress: Math.round(data.totalProgress / data.count),
        checkIns: data.count,
      }))
      .slice(-8); // Last 8 weeks

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
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
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

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">At Risk</p>
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

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Check-in Rate</p>
                    <p className={cn("text-3xl font-bold", metrics.checkInRate >= 70 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")} data-testid="text-checkin-rate">
                      {metrics.checkInRate}%
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-full", metrics.checkInRate >= 70 ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900")}>
                    <Activity className="h-6 w-6 text-current" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {metrics.weeklyCheckInRate}% checked in this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Days Remaining</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                              <p className={cn("text-lg font-bold", getProgressColor(obj.progress || 0))}>
                                {obj.progress || 0}%
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
                      const isExceeding = (obj.progress || 0) > 100;
                      return (
                        <div 
                          key={obj.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30"
                          data-testid={`item-winning-${obj.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{obj.title}</p>
                              {isExceeding && <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />}
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
                                {obj.progress || 0}%
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

          {metrics.trendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Progress Trend
                </CardTitle>
                <CardDescription>Weekly average progress from check-ins</CardDescription>
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
              No objectives found for {currentQuarter?.label}. Create objectives in Planning to see executive metrics.
            </p>
            <Link href="/planning">
              <Button data-testid="button-go-to-planning">Go to Planning</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
