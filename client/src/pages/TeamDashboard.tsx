import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  TrendingUp,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  Mountain,
} from "lucide-react";
import { Link } from "wouter";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { getCurrentQuarter, generateQuarters } from "@/lib/fiscal-utils";
import type { Objective, KeyResult, BigRock, Strategy, Team } from "@shared/schema";

type Quarter = {
  id: string;
  label: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
};

const currentYear = new Date().getFullYear();
const quarters: Quarter[] = [
  ...generateQuarters(currentYear),
  ...generateQuarters(currentYear - 1),
];

const STORAGE_KEYS = {
  TEAM: 'vega-team-dashboard-team',
  QUARTER: 'vega-team-dashboard-quarter',
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'on_track':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'behind':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'at_risk':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'not_started':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'on_track': return 'On Track';
    case 'behind': return 'Behind';
    case 'at_risk': return 'At Risk';
    case 'not_started': return 'Not Started';
    case 'postponed': return 'Postponed';
    default: return status;
  }
}

function getProgressColor(progress: number) {
  if (progress >= 70) return 'bg-green-500';
  if (progress >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function TeamDashboard() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { t } = useVocabulary();
  
  const { quarter: currentQuarterNum, year: currentYearNum } = getCurrentQuarter();
  
  const getDefaultQuarterId = () => {
    const tenantTimePeriod = currentTenant?.defaultTimePeriod;
    if (tenantTimePeriod?.mode === 'specific' && tenantTimePeriod.year && tenantTimePeriod.quarter) {
      return `q${tenantTimePeriod.quarter}-${tenantTimePeriod.year}`;
    }
    return `q${currentQuarterNum}-${currentYearNum}`;
  };
  
  const defaultQuarterId = getDefaultQuarterId();
  
  const savedQuarter = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.QUARTER) : null;
  const savedTeam = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM) : null;
  
  const [selectedQuarter, setSelectedQuarter] = useState(savedQuarter || defaultQuarterId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(savedTeam);
  
  useEffect(() => {
    if (selectedQuarter) {
      localStorage.setItem(STORAGE_KEYS.QUARTER, selectedQuarter);
    }
  }, [selectedQuarter]);
  
  useEffect(() => {
    if (selectedTeamId) {
      localStorage.setItem(STORAGE_KEYS.TEAM, selectedTeamId);
    }
  }, [selectedTeamId]);

  const currentQuarter = quarters.find((q) => q.id === selectedQuarter);

  const { data: teams, isLoading: loadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/okr/teams", currentTenant.id],
    queryFn: async () => {
      const res = await fetch(`/api/okr/teams?tenantId=${currentTenant.id}`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      return res.json();
    },
    enabled: !!currentTenant.id,
  });

  const userTeams = useMemo(() => {
    if (!teams || !user) return [];
    return teams.filter((team) => {
      const memberIds = team.memberIds as string[] | null;
      return team.leaderId === user.id || (memberIds && memberIds.includes(user.id));
    });
  }, [teams, user]);

  useEffect(() => {
    if (!selectedTeamId && userTeams.length > 0) {
      setSelectedTeamId(userTeams[0].id);
    }
  }, [userTeams, selectedTeamId]);

  const selectedTeam = useMemo(() => {
    return teams?.find((t) => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  const { data: objectives, isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant.id, currentQuarter?.quarter, currentQuarter?.year, selectedTeamId],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
        ...(selectedTeamId && { teamId: selectedTeamId }),
      });
      const res = await fetch(`/api/okr/objectives?${params}`);
      if (!res.ok) throw new Error('Failed to fetch objectives');
      return res.json();
    },
    enabled: !!currentTenant.id && !!currentQuarter && !!selectedTeamId,
  });

  const objectiveIds = useMemo(() => objectives?.map((o) => o.id) || [], [objectives]);

  const { data: allKeyResults, isLoading: loadingKeyResults } = useQuery<KeyResult[]>({
    queryKey: ["/api/okr/key-results", currentTenant.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/key-results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch key results');
      return res.json();
    },
    enabled: !!currentTenant.id && !!currentQuarter,
  });

  const keyResults = useMemo(() => {
    if (!allKeyResults || !objectiveIds.length) return [];
    return allKeyResults.filter((kr) => objectiveIds.includes(kr.objectiveId));
  }, [allKeyResults, objectiveIds]);

  const { data: allBigRocks, isLoading: loadingBigRocks } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", currentTenant.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/big-rocks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch big rocks');
      return res.json();
    },
    enabled: !!currentTenant.id && !!currentQuarter,
  });

  const bigRocks = useMemo(() => {
    if (!allBigRocks || !selectedTeamId) return [];
    return allBigRocks.filter((br) => br.teamId === selectedTeamId);
  }, [allBigRocks, selectedTeamId]);

  const { data: strategies, isLoading: loadingStrategies } = useQuery<Strategy[]>({
    queryKey: [`/api/strategies/${currentTenant.id}`],
    enabled: !!currentTenant.id,
  });

  const relevantStrategies = useMemo(() => {
    if (!strategies || !objectives) return [];
    const linkedStrategyIds = new Set<string>();
    objectives.forEach((obj) => {
      const linked = obj.linkedStrategies as string[] | null;
      if (linked) {
        linked.forEach((id) => linkedStrategyIds.add(id));
      }
    });
    return strategies.filter((s) => linkedStrategyIds.has(s.id));
  }, [strategies, objectives]);

  const isLoading = loadingTeams || loadingObjectives || loadingKeyResults || loadingBigRocks || loadingStrategies;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Team View...</p>
        </div>
      </div>
    );
  }

  if (!userTeams.length && !teams?.length) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Team Mode</h1>
          <p className="text-muted-foreground">Simplified view focused on weekly execution</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Teams Found</h3>
              <p className="text-muted-foreground max-w-md">
                Teams haven't been set up for this organization yet. 
                Contact your administrator to create teams and assign members.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedBigRocks = bigRocks.filter((br) => br.status === 'completed').length;
  const totalBigRocks = bigRocks.length;
  const avgKRProgress = keyResults.length 
    ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.currentValue || 0) / (kr.targetValue || 1) * 100, 0) / keyResults.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Team Mode</h1>
          <p className="text-muted-foreground">
            Weekly execution view for {selectedTeam?.name || 'your team'} - {currentQuarter?.label}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedTeamId || ''} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="w-48" data-testid="select-team">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Team" />
            </SelectTrigger>
            <SelectContent>
              {(userTeams.length > 0 ? userTeams : teams)?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-40" data-testid="select-quarter">
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
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">{selectedTeam?.name || 'Team'}</h2>
              <p className="text-muted-foreground">
                {selectedTeam?.description || `${currentQuarter?.label} focus areas`}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center" data-testid="stat-key-results-count">
                <p className="text-3xl font-bold text-primary">{keyResults.length}</p>
                <p className="text-sm text-muted-foreground">{t('keyResult', 'plural')}</p>
              </div>
              <div className="text-center" data-testid="stat-avg-progress">
                <p className="text-3xl font-bold text-primary">{avgKRProgress}%</p>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
              </div>
              <div className="text-center" data-testid="stat-big-rocks-count">
                <p className="text-3xl font-bold text-primary">
                  {completedBigRocks}/{totalBigRocks}
                </p>
                <p className="text-sm text-muted-foreground">{t('bigRock', 'plural')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {relevantStrategies.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Related {t('strategy', 'plural')}</h2>
            </div>
            <Link href="/strategy">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-strategies">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relevantStrategies.slice(0, 3).map((strategy) => (
              <Card key={strategy.id} className="hover-elevate" data-testid={`card-strategy-${strategy.id}`}>
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-2 line-clamp-2">{strategy.title}</h3>
                  {strategy.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {strategy.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('keyResult', 'plural')}</h2>
            <Badge variant="secondary">{keyResults.length}</Badge>
          </div>
          <Link href="/planning">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-planning">
              View All OKRs
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {keyResults.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>No {t('keyResult', 'plural').toLowerCase()} found for this team in {currentQuarter?.label}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {keyResults.map((kr) => {
              const progress = kr.targetValue ? Math.min(100, Math.round((kr.currentValue || 0) / kr.targetValue * 100)) : 0;
              const objective = objectives?.find((o) => o.id === kr.objectiveId);
              return (
                <Card key={kr.id} className="hover-elevate" data-testid={`card-key-result-${kr.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(kr.status || 'not_started')}
                          <h3 className="font-medium truncate">{kr.title}</h3>
                        </div>
                        {objective && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {t('objective', 'singular')}: {objective.title}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <Progress 
                            value={progress} 
                            className={cn("h-2 flex-1", getProgressColor(progress))}
                          />
                          <span className="text-sm font-medium whitespace-nowrap">
                            {kr.currentValue ?? 0} / {kr.targetValue ?? 0} {kr.unit || ''}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {progress}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('bigRock', 'plural')}</h2>
            <Badge variant="secondary">{bigRocks.length}</Badge>
          </div>
          <Link href="/planning">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-big-rocks">
              Manage {t('bigRock', 'plural')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {bigRocks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>No {t('bigRock', 'plural').toLowerCase()} assigned to this team in {currentQuarter?.label}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bigRocks.map((rock) => (
              <Card key={rock.id} className="hover-elevate" data-testid={`card-big-rock-${rock.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(rock.status || 'not_started')}
                        <h3 className="font-medium truncate">{rock.title}</h3>
                      </div>
                      {rock.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {rock.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <Progress 
                          value={rock.completionPercentage || 0} 
                          className="h-2 flex-1"
                        />
                        <span className="text-sm font-medium">
                          {rock.completionPercentage || 0}%
                        </span>
                      </div>
                      {rock.ownerEmail && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Owner: {rock.ownerEmail}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={rock.status === 'completed' ? 'default' : 'outline'}
                      className="shrink-0"
                    >
                      {getStatusLabel(rock.status || 'not_started')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
