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
  Sparkles,
  Check,
  X,
  Link2,
  CheckSquare,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getQuarterElapsedPercent, getYearElapsedPercent, getRelativeProgressColor, assessRelativeProgress } from "@/lib/fiscal-utils";
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

// Storage keys are scoped by tenant to prevent cross-tenant team ID conflicts
const getStorageKeys = (tenantId: string) => ({
  TEAM: `vega-team-dashboard-team-${tenantId}`,
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

// Time-relative progress color - compares actual progress to expected progress for this point in time
function getTimeRelativeProgressColor(progress: number, quarter: number, year: number) {
  const expectedProgress = getQuarterElapsedPercent(quarter, year);
  return getRelativeProgressColor(progress, expectedProgress);
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

  // Big Rock check-in dialog state
  const [bigRockCheckInOpen, setBigRockCheckInOpen] = useState(false);
  const [bigRockHistoryOpen, setBigRockHistoryOpen] = useState(false);
  const [selectedBigRock, setSelectedBigRock] = useState<BigRock | null>(null);
  const [bigRockCheckInForm, setBigRockCheckInForm] = useState({
    newProgress: 0,
    newStatus: "on_track",
    note: "",
  });
  
  // AI Check-in Rewrite state
  const [aiRewriteState, setAiRewriteState] = useState<{
    isRewriting: boolean;
    suggestion: string | null;
    error: string | null;
    mode: 'polish' | 'expand' | 'full';
  }>({
    isRewriting: false,
    suggestion: null,
    error: null,
    mode: 'polish',
  });
  
  // KR filter state - defaults to showing incomplete
  const [krFilter, setKrFilter] = useState<'all' | 'incomplete' | 'at_risk'>('incomplete');
  
  const { selectedQuarter: currentQuarter, selectedQuarters: selectedQuartersList, year: globalYear } = useTimePeriod();
  
  const storageKeys = useMemo(() => {
    if (!currentTenant?.id) return null;
    return getStorageKeys(currentTenant.id);
  }, [currentTenant?.id]);
  
  const savedTeam = typeof window !== 'undefined' && storageKeys 
    ? localStorage.getItem(storageKeys.TEAM) 
    : null;
  
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(savedTeam);
  
  useEffect(() => {
    if (storageKeys) {
      const storedTeam = localStorage.getItem(storageKeys.TEAM);
      if (storedTeam && !selectedTeamId) {
        setSelectedTeamId(storedTeam);
      }
    }
  }, [storageKeys]);
  
  useEffect(() => {
    if (selectedTeamId && storageKeys) {
      localStorage.setItem(storageKeys.TEAM, selectedTeamId);
    }
  }, [selectedTeamId, storageKeys]);

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

  const isMultiPeriod = selectedQuartersList.length > 1;
  const selectedQuarterNums = useMemo(() => selectedQuartersList.map(q => q.quarter), [selectedQuartersList]);
  const hasAnnualSelected = selectedQuarterNums.includes(0);
  const shouldFetchAllQuarters = hasAnnualSelected || isMultiPeriod;

  const { data: rawObjectives, isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant?.id, shouldFetchAllQuarters ? 'all' : currentQuarter?.quarter, globalYear, selectedTeamId, selectedQuarterNums.join(',')],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        year: String(globalYear),
        ...(selectedTeamId && { teamId: selectedTeamId }),
      });
      if (!shouldFetchAllQuarters && currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/objectives?${params}`);
      if (!res.ok) throw new Error('Failed to fetch objectives');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter && !!selectedTeamId,
  });

  const objectives = useMemo(() => {
    if (!rawObjectives) return [];
    if (hasAnnualSelected) return rawObjectives;
    if (!isMultiPeriod) return rawObjectives;
    return rawObjectives.filter((obj: any) => selectedQuarterNums.includes(obj.quarter));
  }, [rawObjectives, isMultiPeriod, selectedQuarterNums, hasAnnualSelected]);

  const { data: rawKeyResults = [], isLoading: loadingKeyResults } = useQuery<KeyResult[]>({
    queryKey: ["/api/okr/key-results", currentTenant?.id, shouldFetchAllQuarters ? 'all' : currentQuarter?.quarter, globalYear, selectedTeamId, selectedQuarterNums.join(',')],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        year: String(globalYear),
        ...(selectedTeamId && { teamId: selectedTeamId }),
      });
      if (!shouldFetchAllQuarters && currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/key-results?${params}`);
      if (!res.ok) throw new Error('Failed to fetch key results');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter && !!selectedTeamId,
  });

  const keyResults = useMemo(() => {
    if (hasAnnualSelected) return rawKeyResults;
    if (!isMultiPeriod) return rawKeyResults;
    return rawKeyResults.filter((kr: any) => selectedQuarterNums.includes(kr.quarter));
  }, [rawKeyResults, isMultiPeriod, selectedQuarterNums, hasAnnualSelected]);

  const { data: allBigRocks, isLoading: loadingBigRocks } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", currentTenant?.id, shouldFetchAllQuarters ? 'all' : currentQuarter?.quarter, globalYear, selectedQuarterNums.join(',')],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        year: String(globalYear),
      });
      if (!shouldFetchAllQuarters && currentQuarter?.quarter != null && currentQuarter.quarter !== 0) {
        params.set('quarter', String(currentQuarter.quarter));
      }
      const res = await fetch(`/api/okr/big-rocks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch big rocks');
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
  });

  const bigRocks = useMemo(() => {
    if (!allBigRocks || !selectedTeamId) return [];
    let filtered = allBigRocks.filter((br) => br.teamId === selectedTeamId);
    if (!hasAnnualSelected && isMultiPeriod) {
      filtered = filtered.filter((br: any) => selectedQuarterNums.includes(br.quarter));
    }
    return filtered;
  }, [allBigRocks, selectedTeamId, isMultiPeriod, selectedQuarterNums, hasAnnualSelected]);

  const { data: strategies, isLoading: loadingStrategies } = useQuery<Strategy[]>({
    queryKey: [`/api/strategies/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch foundation for annual goals
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch task counts for big rocks
  const bigRockIds = useMemo(() => bigRocks.map((br) => br.id), [bigRocks]);
  const { data: taskCounts } = useQuery<Record<string, { total: number; completed: number }>>({
    queryKey: ["/api/okr/big-rocks/task-counts", bigRockIds.join(',')],
    queryFn: async () => {
      if (bigRockIds.length === 0) return {};
      const res = await fetch('/api/okr/big-rocks/task-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bigRockIds }),
        credentials: 'include',
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: bigRockIds.length > 0,
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
      queryClient.invalidateQueries({ queryKey: ["/api/okr/key-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins"] });
      setCheckInDialogOpen(false);
      setSelectedKR(null);
      toast({ title: "Check-in recorded", description: "Your progress has been saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record check-in", variant: "destructive" });
    },
  });

  // Big Rock check-in mutation
  const createBigRockCheckInMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/okr/big-rocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins"] });
      setBigRockCheckInOpen(false);
      setSelectedBigRock(null);
      toast({ title: "Check-in recorded", description: "Big Rock progress has been saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record check-in", variant: "destructive" });
    },
  });

  // Fetch check-in history for selected Big Rock
  const { data: bigRockCheckInHistory = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/okr/check-ins", "big_rock", selectedBigRock?.id],
    queryFn: async () => {
      if (!selectedBigRock) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=big_rock&entityId=${selectedBigRock.id}`);
      if (!res.ok) throw new Error("Failed to fetch check-ins");
      return res.json();
    },
    enabled: !!selectedBigRock && bigRockHistoryOpen,
  });

  const openBigRockCheckIn = (rock: BigRock) => {
    setSelectedBigRock(rock);
    setBigRockCheckInForm({
      newProgress: rock.completionPercentage || 0,
      newStatus: rock.status || "on_track",
      note: "",
    });
    setBigRockCheckInOpen(true);
  };

  const openBigRockHistory = (rock: BigRock) => {
    setSelectedBigRock(rock);
    setBigRockHistoryOpen(true);
  };

  const handleBigRockCheckIn = () => {
    if (!selectedBigRock) return;
    createBigRockCheckInMutation.mutate({
      entityType: "big_rock",
      entityId: selectedBigRock.id,
      newProgress: bigRockCheckInForm.newProgress,
      newStatus: bigRockCheckInForm.newStatus,
      note: bigRockCheckInForm.note,
    });
  };

  // Clear selected big rock when dialogs close
  useEffect(() => {
    if (!bigRockCheckInOpen && !bigRockHistoryOpen) {
      setSelectedBigRock(null);
    }
  }, [bigRockCheckInOpen, bigRockHistoryOpen]);

  // Reset AI rewrite state when dialog closes
  useEffect(() => {
    if (!checkInDialogOpen) {
      setAiRewriteState({
        isRewriting: false,
        suggestion: null,
        error: null,
        mode: 'polish',
      });
    }
  }, [checkInDialogOpen]);

  // AI Rewrite check-in note mutation
  const rewriteCheckInMutation = useMutation({
    mutationFn: async (data: { note: string; context: string; mode: 'polish' | 'expand' | 'full' }) => {
      const response = await apiRequest('POST', '/api/ai/rewrite-checkin', data);
      return response.json();
    },
    onSuccess: (data) => {
      setAiRewriteState(prev => ({
        ...prev,
        isRewriting: false,
        suggestion: data.rewrittenNote || data.suggestion,
        error: null,
      }));
    },
    onError: (error: any) => {
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Failed to rewrite note';
      console.error('[AI Rewrite] Error:', errorMessage, error);
      setAiRewriteState(prev => ({
        ...prev,
        isRewriting: false,
        error: errorMessage,
      }));
      toast({
        title: "Rewrite Failed",
        description: errorMessage || "Could not rewrite the check-in note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRewriteNote = () => {
    if (!checkInForm.note.trim() || !selectedKR) return;
    
    const context = `Key Result: ${selectedKR.title}
Current Value: ${checkInForm.newValue} / ${selectedKR.targetValue} ${selectedKR.unit || ''}
Progress: ${checkInForm.newProgress}%
Status: ${checkInForm.newStatus}`;

    setAiRewriteState(prev => ({ ...prev, isRewriting: true, suggestion: null, error: null }));
    
    rewriteCheckInMutation.mutate({
      note: checkInForm.note,
      context,
      mode: aiRewriteState.mode,
    });
  };

  const acceptRewriteSuggestion = () => {
    if (aiRewriteState.suggestion) {
      setCheckInForm(prev => ({ ...prev, note: aiRewriteState.suggestion! }));
      setAiRewriteState(prev => ({ ...prev, suggestion: null }));
    }
  };

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

  // Annual goals can be either strings (legacy) or objects with {title, year, description}
  const annualGoals = foundation?.annualGoals as Array<string | { title: string; year?: number; description?: string }> | undefined;

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
            {annualGoals.map((goal, index) => {
              const goalTitle = typeof goal === 'string' ? goal : goal.title;
              return (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="py-1.5 px-3 text-sm"
                  data-testid={`badge-goal-${index}`}
                >
                  {goalTitle}
                </Badge>
              );
            })}
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
              // Use time-relative assessment instead of absolute thresholds
              const expectedProgress = currentQuarter ? getQuarterElapsedPercent(currentQuarter.quarter, currentQuarter.year) : 50;
              const relativeStatus = assessRelativeProgress(progress, expectedProgress);
              return kr.status === 'at_risk' || kr.status === 'behind' || relativeStatus === 'at_risk' || relativeStatus === 'behind';
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
                              className={cn("h-2 flex-1", currentQuarter ? getTimeRelativeProgressColor(progress, currentQuarter.quarter, currentQuarter.year) : 'bg-gray-500')}
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
                <p>No {t('bigRock', 'plural').toLowerCase()} assigned to this team for the selected period</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bigRocks.map((rock) => {
              const effectiveStatus = (() => {
                const pct = rock.completionPercentage || 0;
                if (rock.status && rock.status !== 'not_started') return rock.status;
                if (pct >= 100) return 'completed';
                if (pct > 0) return 'on_track';
                return 'not_started';
              })();
              const statusColor = (() => {
                switch (effectiveStatus) {
                  case 'completed': return 'bg-green-500';
                  case 'on_track': return 'bg-blue-500';
                  case 'behind': return 'bg-yellow-500';
                  case 'at_risk': return 'bg-red-500';
                  case 'postponed': return 'bg-gray-500';
                  case 'closed': return 'bg-gray-700';
                  default: return 'bg-gray-400';
                }
              })();
              const statusBadgeVariant = (() => {
                switch (effectiveStatus) {
                  case 'completed': return 'default' as const;
                  case 'on_track': return 'secondary' as const;
                  case 'at_risk': return 'destructive' as const;
                  case 'behind': return 'outline' as const;
                  default: return 'secondary' as const;
                }
              })();
              const linkedObjTitle = rock.objectiveId ? rawObjectives?.find((o: any) => o.id === rock.objectiveId)?.title : null;
              const linkedStrategyTitles = (rock.linkedStrategies || []).map((sid: string) => {
                const s = strategies?.find((st: any) => st.id === sid);
                return s?.title || sid;
              });
              const hasPlannerSync = (rock as any).plannerSyncEnabled || (rock as any).plannerPlanId;
              return (
                <Card key={rock.id} className="hover-elevate" data-testid={`card-big-rock-${rock.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg leading-tight">{rock.title}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {rock.quarter === 0 ? 'Annual' : `Q${rock.quarter}`} {rock.year}
                          </Badge>
                          {hasPlannerSync && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-planner-linked-${rock.id}`}>
                              <Link2 className="h-3 w-3 mr-1" />
                              Planner
                            </Badge>
                          )}
                        </div>
                        {linkedObjTitle && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <Target className="h-3 w-3 inline mr-1" />
                            {t('objective', 'singular')}: {linkedObjTitle}
                          </p>
                        )}
                        {rock.accountableEmail && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Accountable: {rock.accountableEmail}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openBigRockCheckIn(rock)}
                          title="Check in"
                          data-testid={`button-checkin-bigrock-${rock.id}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openBigRockHistory(rock)}
                          title="View history"
                          data-testid={`button-history-bigrock-${rock.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {rock.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{rock.description}</p>
                    )}
                    {linkedStrategyTitles.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {linkedStrategyTitles.map((title: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Completion</span>
                        <span className="font-medium">{rock.completionPercentage || 0}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${statusColor}`}
                          style={{ width: `${rock.completionPercentage || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={statusBadgeVariant}
                            data-testid={`badge-status-${rock.id}`}
                          >
                            {effectiveStatus.replace('_', ' ')}
                          </Badge>
                          {taskCounts?.[rock.id] && taskCounts[rock.id].total > 0 && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-tasks-${rock.id}`}>
                              <CheckSquare className="h-3 w-3 mr-1" />
                              {taskCounts[rock.id].completed}/{taskCounts[rock.id].total} tasks
                            </Badge>
                          )}
                        </div>
                        {rock.lastCheckInAt && (
                          <span className="text-xs text-muted-foreground">
                            Last check-in: {new Date(rock.lastCheckInAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {rock.lastCheckInNote && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mt-2">
                          &ldquo;{rock.lastCheckInNote.length > 100 ? rock.lastCheckInNote.substring(0, 100) + '...' : rock.lastCheckInNote}&rdquo;
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="checkin-note">Note (optional)</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={aiRewriteState.mode}
                    onValueChange={(value: 'polish' | 'expand' | 'full') => 
                      setAiRewriteState(prev => ({ ...prev, mode: value }))
                    }
                  >
                    <SelectTrigger className="w-[110px] h-7 text-xs" data-testid="select-rewrite-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polish">Polish</SelectItem>
                      <SelectItem value="expand">Expand</SelectItem>
                      <SelectItem value="full">Full Rewrite</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRewriteNote}
                    disabled={aiRewriteState.isRewriting || !checkInForm.note.trim()}
                    className="h-7"
                    data-testid="button-ai-rewrite-note"
                  >
                    {aiRewriteState.isRewriting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span className="text-xs ml-1">AI Rewrite</span>
                  </Button>
                </div>
              </div>
              <Textarea
                id="checkin-note"
                value={checkInForm.note}
                onChange={(e) => setCheckInForm({ ...checkInForm, note: e.target.value })}
                placeholder="Add any context about this update..."
                rows={3}
                data-testid="textarea-checkin-note"
              />
              
              {/* AI Suggestion */}
              {aiRewriteState.suggestion && (
                <div className="p-3 bg-primary/5 rounded-md border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    AI Suggestion
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {aiRewriteState.suggestion}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAiRewriteState(prev => ({ ...prev, suggestion: null }))}
                      data-testid="button-reject-suggestion"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={acceptRewriteSuggestion}
                      data-testid="button-accept-suggestion"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Use This
                    </Button>
                  </div>
                </div>
              )}
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

      {/* Big Rock Check-in Dialog */}
      <Dialog open={bigRockCheckInOpen} onOpenChange={setBigRockCheckInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bigRock', 'singular')} Check In</DialogTitle>
            <DialogDescription>
              Update progress for: {selectedBigRock?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="br-checkin-progress">Completion Percentage</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="br-checkin-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={bigRockCheckInForm.newProgress}
                  onChange={(e) => setBigRockCheckInForm(prev => ({ ...prev, newProgress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="w-24"
                  data-testid="input-bigrock-checkin-progress"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Progress value={bigRockCheckInForm.newProgress} className="flex-1 h-2" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="br-checkin-status">Status</Label>
              <Select
                value={bigRockCheckInForm.newStatus}
                onValueChange={(value) => setBigRockCheckInForm(prev => ({ ...prev, newStatus: value }))}
              >
                <SelectTrigger data-testid="select-bigrock-checkin-status">
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
            {selectedBigRock && (selectedBigRock as any).plannerSyncEnabled && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">Planner Sync Active</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Progress is synced with Microsoft Planner tasks. Manual updates here will be reconciled on next sync.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="br-checkin-note">Note (optional)</Label>
              <Textarea
                id="br-checkin-note"
                value={bigRockCheckInForm.note}
                onChange={(e) => setBigRockCheckInForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Add context about this update..."
                rows={3}
                data-testid="textarea-bigrock-checkin-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBigRockCheckInOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBigRockCheckIn}
              disabled={createBigRockCheckInMutation.isPending}
              data-testid="button-save-bigrock-checkin"
            >
              {createBigRockCheckInMutation.isPending ? (
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

      {/* Big Rock History Dialog */}
      <Dialog open={bigRockHistoryOpen} onOpenChange={setBigRockHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('bigRock', 'singular')} Check-in History</DialogTitle>
            <DialogDescription>
              {selectedBigRock?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {bigRockCheckInHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No check-ins recorded yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setBigRockHistoryOpen(false);
                    if (selectedBigRock) openBigRockCheckIn(selectedBigRock);
                  }}
                  data-testid="button-first-bigrock-checkin"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Record First Check-in
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bigRockCheckInHistory.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="border rounded-lg p-4 space-y-2"
                    data-testid={`br-history-item-${checkIn.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(checkIn.newStatus || 'not_started')}
                        <Badge variant="outline">{checkIn.newProgress}%</Badge>
                        <Badge variant={checkIn.newStatus === 'completed' ? 'default' : checkIn.newStatus === 'at_risk' ? 'destructive' : 'secondary'}>
                          {getStatusLabel(checkIn.newStatus || 'not_started')}
                        </Badge>
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
            <Button variant="outline" onClick={() => setBigRockHistoryOpen(false)}>
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
