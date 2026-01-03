import { useState, useEffect, useMemo, Component, type ErrorInfo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Edit3,
  History,
  Flag,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentQuarter, generateQuarters } from "@/lib/fiscal-utils";
import { format } from "date-fns";
import type { Objective, KeyResult, BigRock, Strategy, Team, Foundation, CheckIn } from "@shared/schema";

// Error Boundary for Team Dashboard
class TeamDashboardErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("TeamDashboard Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-7xl mx-auto space-y-6 p-4">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  There was an error loading Team Mode. Please try refreshing the page.
                </p>
                <Button onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
                {this.state.error && (
                  <p className="text-xs text-muted-foreground mt-4 font-mono">
                    {this.state.error.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// Storage keys are scoped by tenant to prevent cross-tenant team ID conflicts
const getStorageKeys = (tenantId: string) => ({
  TEAM: `vega-team-dashboard-team-${tenantId}`,
  QUARTER: 'vega-team-dashboard-quarter', // Quarter can be shared across tenants
});

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

function TeamDashboardContent() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { t } = useVocabulary();
  const { toast } = useToast();

  // Check-in dialog state
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null);
  const [checkInForm, setCheckInForm] = useState({
    newValue: 0,
    newProgress: 0,
    newStatus: "on_track",
    note: "",
  });
  
  // KR filter state - defaults to showing incomplete
  const [krFilter, setKrFilter] = useState<'all' | 'incomplete' | 'at_risk'>('incomplete');
  
  const { quarter: currentQuarterNum, year: currentYearNum } = getCurrentQuarter();
  
  const getDefaultQuarterId = () => {
    const tenantTimePeriod = currentTenant?.defaultTimePeriod;
    if (tenantTimePeriod?.mode === 'specific' && tenantTimePeriod.year && tenantTimePeriod.quarter) {
      return `q${tenantTimePeriod.quarter}-${tenantTimePeriod.year}`;
    }
    return `q${currentQuarterNum}-${currentYearNum}`;
  };
  
  const defaultQuarterId = getDefaultQuarterId();
  
  // Get tenant-scoped storage keys - memoized to avoid recalculating on every render
  const storageKeys = useMemo(() => {
    if (!currentTenant?.id) return null;
    return getStorageKeys(currentTenant.id);
  }, [currentTenant?.id]);
  
  // Read from localStorage only when tenant is loaded
  const savedQuarter = typeof window !== 'undefined' && storageKeys 
    ? localStorage.getItem(storageKeys.QUARTER) 
    : null;
  const savedTeam = typeof window !== 'undefined' && storageKeys 
    ? localStorage.getItem(storageKeys.TEAM) 
    : null;
  
  const [selectedQuarter, setSelectedQuarter] = useState(savedQuarter || defaultQuarterId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(savedTeam);
  
  // Update state when tenant loads and we have saved values
  useEffect(() => {
    if (storageKeys) {
      const storedQuarter = localStorage.getItem(storageKeys.QUARTER);
      const storedTeam = localStorage.getItem(storageKeys.TEAM);
      if (storedQuarter && !selectedQuarter) {
        setSelectedQuarter(storedQuarter);
      }
      if (storedTeam && !selectedTeamId) {
        setSelectedTeamId(storedTeam);
      }
    }
  }, [storageKeys]);
  
  useEffect(() => {
    if (selectedQuarter && storageKeys) {
      localStorage.setItem(storageKeys.QUARTER, selectedQuarter);
    }
  }, [selectedQuarter, storageKeys]);
  
  useEffect(() => {
    if (selectedTeamId && storageKeys) {
      localStorage.setItem(storageKeys.TEAM, selectedTeamId);
    }
  }, [selectedTeamId, storageKeys]);

  const currentQuarter = quarters.find((q) => q.id === selectedQuarter);

  const { data: teams, isLoading: loadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/okr/teams", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const res = await fetch(`/api/okr/teams?tenantId=${currentTenant.id}`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const userTeams = useMemo(() => {
    if (!teams || !user) return [];
    return teams.filter((team) => {
      const memberIds = team.memberIds as string[] | null;
      return team.leaderId === user.id || (memberIds && memberIds.includes(user.id));
    });
  }, [teams, user]);

  useEffect(() => {
    // Validate that selectedTeamId exists in current tenant's teams
    // If not (e.g., user switched tenants), reset to first available team
    if (selectedTeamId && teams && teams.length > 0) {
      const teamExists = teams.some(t => t.id === selectedTeamId);
      if (!teamExists) {
        // Saved team ID is from a different tenant, reset it
        const firstTeam = userTeams.length > 0 ? userTeams[0] : teams[0];
        setSelectedTeamId(firstTeam?.id || null);
        return;
      }
    }
    // Set default team if none selected
    if (!selectedTeamId && userTeams.length > 0) {
      setSelectedTeamId(userTeams[0].id);
    } else if (!selectedTeamId && teams && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [userTeams, teams, selectedTeamId]);

  const selectedTeam = useMemo(() => {
    return teams?.find((t) => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  const { data: objectives, isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year, selectedTeamId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
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
    enabled: !!currentTenant?.id && !!currentQuarter && !!selectedTeamId,
  });

  const { data: keyResults = [], isLoading: loadingKeyResults } = useQuery<KeyResult[]>({
    queryKey: ["/api/okr/key-results", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year, selectedTeamId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
        ...(selectedTeamId && { teamId: selectedTeamId }),
      });
      const res = await fetch(`/api/okr/key-results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch key results');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter && !!selectedTeamId,
  });

  const { data: allBigRocks, isLoading: loadingBigRocks } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
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

  const bigRocks = useMemo(() => {
    if (!allBigRocks || !selectedTeamId) return [];
    return allBigRocks.filter((br) => br.teamId === selectedTeamId);
  }, [allBigRocks, selectedTeamId]);

  const { data: strategies, isLoading: loadingStrategies } = useQuery<Strategy[]>({
    queryKey: [`/api/strategies/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch foundation for annual goals
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch check-in history for selected KR
  const { data: checkInHistory = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/okr/check-ins", selectedKR?.id],
    queryFn: async () => {
      if (!selectedKR) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=key_result&entityId=${selectedKR.id}`);
      if (!res.ok) throw new Error("Failed to fetch check-ins");
      return res.json();
    },
    enabled: !!selectedKR && historyDialogOpen,
  });

  // Check-in mutation
  const createCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      const checkInData = {
        ...data,
        userId: user?.id,
        userEmail: user?.email,
        tenantId: currentTenant?.id,
        asOfDate: new Date().toISOString(),
      };
      return apiRequest("POST", "/api/okr/check-ins", checkInData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okr/key-results", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives", currentTenant?.id, currentQuarter?.quarter, currentQuarter?.year, selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins"] });
      setCheckInDialogOpen(false);
      setSelectedKR(null);
      toast({ title: "Check-in recorded", description: "Your progress has been saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record check-in", variant: "destructive" });
    },
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

  const annualGoals = foundation?.annualGoals as string[] | undefined;

  // Helper function to open check-in dialog
  const openCheckInDialog = (kr: KeyResult) => {
    setSelectedKR(kr);
    setCheckInForm({
      newValue: kr.currentValue || 0,
      newProgress: kr.progress || 0,
      newStatus: kr.status || "on_track",
      note: "",
    });
    setCheckInDialogOpen(true);
  };

  // Helper function to open history dialog
  const openHistoryDialog = (kr: KeyResult) => {
    setSelectedKR(kr);
    setHistoryDialogOpen(true);
  };

  // Calculate progress from new value
  const calculateProgress = (newValue: number, kr: KeyResult) => {
    const initialValue = kr.initialValue ?? 0;
    const targetValue = kr.targetValue ?? 0;
    const metricType = kr.metricType || "increase";
    
    let progress = 0;
    if (metricType === "increase") {
      const denominator = targetValue - initialValue;
      if (denominator === 0) {
        progress = newValue >= targetValue ? 100 : 0;
      } else if (denominator > 0) {
        progress = ((newValue - initialValue) / denominator) * 100;
      }
    } else if (metricType === "decrease") {
      const denominator = initialValue - targetValue;
      if (denominator === 0) {
        progress = newValue <= targetValue ? 100 : 0;
      } else if (denominator > 0) {
        progress = ((initialValue - newValue) / denominator) * 100;
      }
    }
    
    return Math.max(0, Math.min(100, Math.round(progress)));
  };

  // Handle check-in submission
  const handleCheckIn = () => {
    if (!selectedKR) return;
    createCheckInMutation.mutate({
      entityType: "key_result",
      entityId: selectedKR.id,
      newValue: checkInForm.newValue,
      newProgress: checkInForm.newProgress,
      newStatus: checkInForm.newStatus,
      note: checkInForm.note,
    });
  };

  const isLoading = tenantLoading || loadingTeams || loadingObjectives || loadingKeyResults || loadingBigRocks || loadingStrategies;

  if (isLoading || !currentTenant) {
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

      {/* Annual Goals - Compact Section */}
      {annualGoals && annualGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t('goal', 'plural')}</h2>
              <Badge variant="secondary" className="text-xs">{annualGoals.length}</Badge>
            </div>
            <Link href="/foundations">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="link-goals">
                Manage
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {annualGoals.map((goal, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="py-1.5 px-3 text-sm"
                data-testid={`badge-goal-${index}`}
              >
                {goal}
              </Badge>
            ))}
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('keyResult', 'plural')}</h2>
            <Badge variant="secondary">{keyResults.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={krFilter === 'incomplete' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setKrFilter('incomplete')}
                data-testid="button-filter-incomplete"
              >
                Open
              </Button>
              <Button
                variant={krFilter === 'at_risk' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setKrFilter('at_risk')}
                data-testid="button-filter-at-risk"
              >
                At Risk
              </Button>
              <Button
                variant={krFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setKrFilter('all')}
                data-testid="button-filter-all"
              >
                All
              </Button>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-planning">
                View All OKRs
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {(() => {
          const filteredKRs = keyResults.filter((kr) => {
            const progress = kr.targetValue ? Math.min(100, Math.round((kr.currentValue || 0) / kr.targetValue * 100)) : 0;
            if (krFilter === 'incomplete') {
              return kr.status !== 'completed' && progress < 100;
            }
            if (krFilter === 'at_risk') {
              return kr.status === 'at_risk' || kr.status === 'behind' || progress < 40;
            }
            return true;
          });
          
          return filteredKRs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <p>
                    {krFilter === 'all' 
                      ? `No ${t('keyResult', 'plural').toLowerCase()} found for this team in ${currentQuarter?.label}`
                      : krFilter === 'incomplete'
                        ? `All ${t('keyResult', 'plural').toLowerCase()} are complete!`
                        : `No at-risk ${t('keyResult', 'plural').toLowerCase()} found`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredKRs.map((kr) => {
                const progress = kr.targetValue ? Math.min(100, Math.round((kr.currentValue || 0) / kr.targetValue * 100)) : 0;
                const objective = objectives?.find((o) => o.id === kr.objectiveId);
                const lastUpdate = kr.lastCheckInAt ? new Date(kr.lastCheckInAt) : null;
                return (
                  <Card key={kr.id} className="hover-elevate" data-testid={`card-key-result-${kr.id}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {getStatusIcon(kr.status || 'not_started')}
                            <h3 className="font-medium truncate">{kr.title}</h3>
                            <Badge 
                              variant={kr.status === 'completed' ? 'default' : kr.status === 'at_risk' ? 'destructive' : 'outline'}
                              className="text-xs"
                            >
                              {getStatusLabel(kr.status || 'not_started')}
                            </Badge>
                          </div>
                          {objective && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {t('objective', 'singular')}: {objective.title}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mb-2">
                            <Progress 
                              value={progress} 
                              className={cn("h-2 flex-1", getProgressColor(progress))}
                            />
                            <span className="text-sm font-medium whitespace-nowrap">
                              {kr.currentValue ?? 0} / {kr.targetValue ?? 0} {kr.unit || ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {lastUpdate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated {format(lastUpdate, 'MMM d, yyyy')}
                              </span>
                            )}
                            {kr.lastCheckInNote && (
                              <span className="truncate max-w-[200px]" title={kr.lastCheckInNote}>
                                "{kr.lastCheckInNote}"
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCheckInDialog(kr)}
                            title="Check in"
                            data-testid={`button-checkin-${kr.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openHistoryDialog(kr)}
                            title="View history"
                            data-testid={`button-history-${kr.id}`}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Badge variant="outline" className="font-semibold">
                            {progress}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}
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

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>
              Update progress for: {selectedKR?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-value">
                Current Value {selectedKR?.unit && `(${selectedKR.unit})`}
              </Label>
              <Input
                id="checkin-value"
                type="number"
                value={checkInForm.newValue}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value) || 0;
                  const progress = selectedKR ? calculateProgress(newValue, selectedKR) : 0;
                  setCheckInForm({
                    ...checkInForm,
                    newValue,
                    newProgress: progress,
                  });
                }}
                data-testid="input-checkin-value"
              />
              <p className="text-xs text-muted-foreground">
                Target: {selectedKR?.targetValue ?? 0} {selectedKR?.unit || ''}
              </p>
            </div>
            <div className="p-3 bg-secondary/20 rounded-md">
              <p className="text-sm font-medium">Calculated Progress: {checkInForm.newProgress}%</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkin-status">Status</Label>
              <Select
                value={checkInForm.newStatus}
                onValueChange={(value) => setCheckInForm({ ...checkInForm, newStatus: value })}
              >
                <SelectTrigger data-testid="select-checkin-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="behind">Behind</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkin-note">Note (optional)</Label>
              <Textarea
                id="checkin-note"
                value={checkInForm.note}
                onChange={(e) => setCheckInForm({ ...checkInForm, note: e.target.value })}
                placeholder="Add any context about this update..."
                rows={3}
                data-testid="textarea-checkin-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCheckIn}
              disabled={createCheckInMutation.isPending}
              data-testid="button-save-checkin"
            >
              {createCheckInMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Check-in"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Check-in History</DialogTitle>
            <DialogDescription>
              {selectedKR?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {checkInHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No check-ins recorded yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setHistoryDialogOpen(false);
                    if (selectedKR) openCheckInDialog(selectedKR);
                  }}
                  data-testid="button-first-checkin"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Record First Check-in
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {checkInHistory.map((checkIn) => (
                  <div 
                    key={checkIn.id} 
                    className="border rounded-lg p-4 space-y-2"
                    data-testid={`history-item-${checkIn.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(checkIn.newStatus || 'not_started')}
                        <span className="font-medium">
                          {checkIn.newValue ?? checkIn.newProgress}
                          {selectedKR?.unit && ` ${selectedKR.unit}`}
                        </span>
                        <Badge variant="outline">{checkIn.newProgress}%</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {checkIn.createdAt ? format(new Date(checkIn.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown date'}
                      </span>
                    </div>
                    {checkIn.note && (
                      <p className="text-sm text-muted-foreground">{checkIn.note}</p>
                    )}
                    {checkIn.userEmail && (
                      <p className="text-xs text-muted-foreground">
                        By: {checkIn.userEmail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeamDashboard() {
  return (
    <TeamDashboardErrorBoundary>
      <TeamDashboardContent />
    </TeamDashboardErrorBoundary>
  );
}
