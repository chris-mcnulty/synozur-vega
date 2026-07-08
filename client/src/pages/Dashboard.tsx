import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Users,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { Link } from "wouter";
import { useTenant } from "@/contexts/TenantContext";
import { useVocabulary } from "@/contexts/VocabularyContext";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import type { Foundation, Strategy, Objective, BigRock, Meeting, Team } from "@shared/schema";
import { ValueBadges } from "@/components/ValueBadges";
import { ExpandableText } from "@/components/ExpandableText";
import { CompanyOSExportDialog } from "@/components/CompanyOSExportDialog";
import { StrategicAlignmentSankey } from "@/components/StrategicAlignmentSankey";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { FileDown, Flag } from "lucide-react";

const STORAGE_KEYS = {
  TEAM_FILTER: 'vega-dashboard-team-filter',
};

// Per-objective confidence chip in the Outcomes table. Resolves the
// objective-level latest confidence from the same /api/reporting/summary
// payload (cached) so each row gets a colored badge without N+1 fetches.
function ObjectiveConfidenceChip({
  objectiveId,
  tenantId,
  quarter,
  year,
}: {
  objectiveId: string;
  tenantId: string | undefined;
  quarter: number | undefined;
  year: number | undefined;
}) {
  const { data } = useQuery<{
    objectiveConfidence?: Array<{
      objectiveId: string;
      confidenceLatest: number | null;
    }>;
  }>({
    queryKey: ["/api/reporting/summary", tenantId, quarter, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (quarter != null) params.set("quarter", String(quarter));
      if (year != null) params.set("year", String(year));
      const res = await fetch(`/api/reporting/summary?${params}`);
      if (!res.ok) throw new Error("summary failed");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const row = data?.objectiveConfidence?.find((r) => r.objectiveId === objectiveId);
  const latest = row?.confidenceLatest;
  if (latest == null) return null;
  const variant: "default" | "secondary" | "destructive" =
    latest <= 0.4 ? "destructive" : latest <= 0.6 ? "secondary" : "default";
  return (
    <Badge
      variant={variant}
      className="text-xs"
      data-testid={`badge-objective-confidence-${objectiveId}`}
    >
      C {latest.toFixed(1)}
    </Badge>
  );
}

// Compact owner-confidence chip for the Outcomes block. Reads the summary
// endpoint and renders a single bucketed badge with the underlying value.
function OutcomesConfidenceChip({
  tenantId,
  quarter,
  year,
}: {
  tenantId: string | undefined;
  quarter: number | undefined;
  year: number | undefined;
}) {
  const { data } = useQuery<{ summary: { averageConfidence: number | null } }>({
    queryKey: ["/api/reporting/summary", tenantId, quarter, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (quarter != null) params.set("quarter", String(quarter));
      if (year != null) params.set("year", String(year));
      const res = await fetch(`/api/reporting/summary?${params}`);
      if (!res.ok) throw new Error("summary failed");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const avg = data?.summary?.averageConfidence;
  if (avg == null) return null;
  const display = Math.round(avg * 10) / 10;
  const label =
    avg <= 0.4 ? "Low confidence" : avg <= 0.6 ? "Medium confidence" : "High confidence";
  const variant: "default" | "secondary" | "destructive" =
    avg <= 0.4 ? "destructive" : avg <= 0.6 ? "secondary" : "default";
  return (
    <Badge variant={variant} data-testid="badge-outcomes-confidence">
      {label}: {display.toFixed(1)}
    </Badge>
  );
}

export default function Dashboard() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { t } = useVocabulary();
  
  const { selectedQuarter: currentQuarter } = useTimePeriod();
  
  const savedTeamFilter = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TEAM_FILTER) : null;
  
  const [identityOpen, setIdentityOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>(savedTeamFilter || 'all');
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TEAM_FILTER, selectedTeam);
  }, [selectedTeam]);

  // Combined dashboard context (single round trip - replaces 6 separate queries)
  type DashboardContext = {
    foundation: Foundation | null;
    strategies: Strategy[];
    teams: Team[];
    objectives: Objective[];
    bigRocks: BigRock[];
    meetings: Meeting[];
  };

  const {
    data: dashboardContext,
    isLoading: loadingContext,
    error: contextError,
  } = useQuery<DashboardContext>({
    queryKey: [
      "/api/dashboard/context",
      currentTenant?.id,
      "company",
      currentQuarter?.quarter,
      currentQuarter?.year,
    ],
    queryFn: async () => {
      if (!currentTenant) {
        return {
          foundation: null,
          strategies: [],
          teams: [],
          objectives: [],
          bigRocks: [],
          meetings: [],
        };
      }
      const params = new URLSearchParams({ scope: "company" });
      if (currentQuarter?.quarter != null) params.set("quarter", String(currentQuarter.quarter));
      if (currentQuarter?.year != null) params.set("year", String(currentQuarter.year));
      const res = await fetch(`/api/dashboard/context?${params}`, {
        credentials: "include",
        headers: { "x-tenant-id": currentTenant.id },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard context");
      return res.json();
    },
    enabled: !!currentTenant?.id && !!currentQuarter,
    retry: false,
  });

  const foundations = dashboardContext?.foundation ?? undefined;
  const strategies = dashboardContext?.strategies ?? [];
  const objectives = dashboardContext?.objectives;
  const bigRocks = dashboardContext?.bigRocks;
  const meetings = dashboardContext?.meetings ?? [];
  const teams = dashboardContext?.teams ?? [];
  const objectivesError = contextError;
  const bigRocksError = contextError;
  const loadingFoundations = loadingContext;
  const isLoading = loadingContext;

  // Wait for tenant to load before rendering
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show message if user has no tenant access
  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Organization Access</h2>
          <p className="text-muted-foreground mb-6">
            Your account is not yet associated with an organization. Please contact your administrator to be added to an organization, or wait for your account setup to complete.
          </p>
          <Link href="/my-settings">
            <Button variant="outline">Go to My Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Company OS...</p>
        </div>
      </div>
    );
  }

  const isNewUser = !loadingFoundations && (
    !foundations?.mission && 
    !foundations?.vision && 
    (!foundations?.values || foundations.values.length === 0)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Helmet><title>Dashboard | Vega</title></Helmet>
      <WelcomeDialog isNewUser={isNewUser} />
      {/* Header with Quarter Selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold mb-2 cosmic-text">Company Operating System</h1>
          <p className="text-muted-foreground">
            Comprehensive view of foundations, strategies, planning, and focus for{" "}
            {currentQuarter?.label}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <CompanyOSExportDialog
            trigger={
              <Button variant="outline" data-testid="button-export-company-os">
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
            }
          />
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-44" aria-label="Team" data-testid="select-team">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Organizational Identity Collapsible */}
      {(foundations?.tagline || foundations?.cultureStatement) && (
        <Collapsible open={identityOpen} onOpenChange={setIdentityOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-4 h-auto hover-elevate"
                data-testid="button-toggle-identity"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-semibold text-base">Organizational Identity</h3>
                    {foundations?.tagline && (
                      <p className="text-sm text-muted-foreground font-normal">{foundations.tagline}</p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    identityOpen ? "transform rotate-180" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                <Separator />
                {foundations?.tagline && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Tagline</h4>
                    <p className="text-sm text-muted-foreground">{foundations.tagline}</p>
                  </div>
                )}
                {foundations?.cultureStatement && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Culture Statement</h4>
                    <div
                      className="text-sm text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: foundations.cultureStatement }}
                    />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Period Overview Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">{currentQuarter?.label}</h2>
              <p className="text-muted-foreground">
                {currentQuarter?.startDate} - {currentQuarter?.endDate}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{(strategies || []).length}</p>
                <p className="text-sm text-muted-foreground">Active {t('strategy', 'plural')}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{objectives?.length || 0}</p>
                <p className="text-sm text-muted-foreground">OKRs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">
                  {bigRocks?.filter((r) => r.status === "completed").length || 0}/
                  {bigRocks?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">{t('bigRock', 'plural')} Complete</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foundations Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Foundations (Evergreen)</h2>
          </div>
          <Link href="/foundations">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-foundations">
              View Details
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            {(
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <div className="h-1 w-8 bg-primary rounded" />
                      Mission
                    </h3>
                    {foundations?.mission ? (
                      <ExpandableText 
                        text={foundations.mission} 
                        maxLines={3}
                        className="text-base text-muted-foreground"
                      />
                    ) : (
                      <p className="text-base text-muted-foreground">Not yet defined</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <div className="h-1 w-8 bg-secondary rounded" />
                      Vision
                    </h3>
                    {foundations?.vision ? (
                      <ExpandableText 
                        text={foundations.vision} 
                        maxLines={3}
                        className="text-base text-muted-foreground"
                      />
                    ) : (
                      <p className="text-base text-muted-foreground">Not yet defined</p>
                    )}
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h3 className="font-semibold">Core Values</h3>
                  {foundations?.values && foundations.values.length > 0 ? (
                    <div className="space-y-3">
                      {foundations.values.map((value: any, idx) => {
                        const title = typeof value === "string" ? value : value.title;
                        const description = typeof value === "string" ? "" : value.description;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="font-medium text-base">{title}</div>
                            {description && (
                              <ExpandableText 
                                text={description} 
                                maxLines={2}
                                className="text-sm text-muted-foreground"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-base text-muted-foreground">Not yet defined</p>
                  )}
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h3 className="font-semibold">Ambitions (3-5 Year Targets)</h3>
                  {(() => {
                    const ambitions = foundations?.ambitions as Array<{ id: string; title: string; description?: string; targetYear: number; status: string; linkedValueTitles?: string[] }> | null;
                    const activeAmbitions = ambitions?.filter(a => a.status === 'active') || [];
                    if (activeAmbitions.length > 0) {
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeAmbitions.map((ambition) => (
                            <div key={ambition.id} className="flex items-start gap-2 text-base p-2 rounded-lg bg-muted/50">
                              <Sparkles className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{ambition.title}</span>
                                  <Badge variant="outline" className="text-xs">{ambition.targetYear}</Badge>
                                </div>
                                {ambition.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ambition.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return <p className="text-base text-muted-foreground">No active ambitions defined</p>;
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ==================== STRATEGIES BLOCK ==================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('strategy', 'plural')}</h2>
          </div>
          <Link href="/strategy">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-strategy">
              View Details
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {strategies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategies.map((strategy) => (
                  <div key={strategy.id} className="space-y-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-base">{strategy.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {strategy.priority && (
                            <Badge
                              variant={
                                strategy.priority === "critical"
                                  ? "destructive"
                                  : strategy.priority === "high"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {strategy.priority}
                            </Badge>
                          )}
                          <ValueBadges entityType="strategy" entityId={strategy.id} />
                        </div>
                      </div>
                      {strategy.status && (
                        <Badge variant="outline" className="text-xs">
                          {strategy.status}
                        </Badge>
                      )}
                    </div>
                    {strategy.description && (
                      <ExpandableText 
                        text={strategy.description} 
                        maxLines={2}
                        className="text-sm text-muted-foreground"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No strategies defined yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ==================== OUTCOMES BLOCK ==================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Outcomes</h2>
            <OutcomesConfidenceChip
              tenantId={currentTenant?.id}
              quarter={currentQuarter?.quarter}
              year={currentQuarter?.year}
            />
          </div>
          <Link href="/planning">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-outcomes">
              View Planning
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        {/* Annual Goals */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Annual {t('goal', 'plural')} ({currentQuarter?.year})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(() => {
              const selectedYear = currentQuarter?.year;
              const filteredGoals = (foundations?.annualGoals || []).filter((goal: any) => {
                const goalYear = typeof goal === "string" ? undefined : goal.year;
                return !selectedYear || !goalYear || goalYear === selectedYear;
              });
              if (filteredGoals.length > 0) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {filteredGoals.map((goal: any, idx: number) => {
                      const title = typeof goal === "string" ? goal : goal.title;
                      return (
                        <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                          <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return <p className="text-sm text-muted-foreground">No annual goals defined for {selectedYear}</p>;
            })()}
          </CardContent>
        </Card>

        {/* Big Rocks and OKRs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Big Rocks */}
          <div>
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">{t('bigRock', 'plural')}</h2>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-rocks">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              {bigRocksError ? (
                <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <p>Unable to load {t('bigRock', 'plural').toLowerCase()}</p>
                </div>
              ) : bigRocks && bigRocks.length > 0 ? (
                bigRocks.map((rock) => {
                  // Derive effective status from completion percentage if status is not set or is "not_started"
                  const isStaleCheckIn = (lastCheckInAt?: string | null): boolean => {
                    if (!lastCheckInAt) return false;
                    const daysSinceCheckIn = (Date.now() - new Date(lastCheckInAt).getTime()) / (1000 * 60 * 60 * 24);
                    return daysSinceCheckIn > 30;
                  };
                  
                  const deriveEffectiveStatus = (status?: string | null, completion?: number | null, lastCheckInAt?: string | null): string => {
                    const pct = completion || 0;
                    const stale = isStaleCheckIn(lastCheckInAt);
                    // If status is explicitly set to something meaningful, use it
                    if (status && status !== 'not_started') {
                      if (status === 'completed') return status;
                      // Staleness guard: only override on_track to behind when stale
                      if (status === 'on_track' && stale) return 'behind';
                      return status;
                    }
                    // Auto-derive status from completion percentage
                    if (pct >= 100) return 'completed';
                    if (pct > 0) {
                      // Staleness guard: if last check-in is >30 days ago, override to behind
                      if (stale) return 'behind';
                      return 'on_track';
                    }
                    // not_started: staleness guard also applies
                    if (stale) return 'behind';
                    return 'not_started';
                  };
                  
                  const isStale = rock.status !== 'completed' &&
                    (rock.completionPercentage || 0) < 100 &&
                    isStaleCheckIn(rock.lastCheckInAt);
                  
                  const effectiveStatus = deriveEffectiveStatus(rock.status, rock.completionPercentage, rock.lastCheckInAt);
                  
                  const getStatusColor = (status?: string | null) => {
                    switch (status) {
                      case "completed": return "bg-green-500";
                      case "on_track": return "bg-blue-500";
                      case "behind": return "bg-yellow-500";
                      case "at_risk": return "bg-red-500";
                      case "postponed": case "closed": return "bg-gray-500";
                      default: return "bg-gray-400";
                    }
                  };
                  const getStatusBadgeVariant = (status?: string | null): "default" | "secondary" | "destructive" | "outline" => {
                    switch (status) {
                      case "completed": return "default";
                      case "on_track": return "secondary";
                      case "at_risk": return "destructive";
                      default: return "outline";
                    }
                  };
                  return (
                    <div key={rock.id} className="space-y-2" data-testid={`rock-${rock.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {effectiveStatus === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : effectiveStatus === "on_track" ? (
                            <div className="h-5 w-5 rounded-full border-2 border-blue-500 shrink-0 mt-0.5 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-blue-500" />
                            </div>
                          ) : effectiveStatus === "at_risk" || effectiveStatus === "behind" ? (
                            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p
                              className={`text-base ${
                                effectiveStatus === "completed" ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {rock.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {rock.accountableEmail || rock.ownerEmail || "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(effectiveStatus)} className="text-xs">
                            {effectiveStatus.replace("_", " ")}
                          </Badge>
                          {isStale && (
                            <span className="text-xs text-muted-foreground" data-testid={`status-stale-${rock.id}`}>stale</span>
                          )}
                          <span className="text-sm font-medium">{rock.completionPercentage || 0}%</span>
                        </div>
                      </div>
                      <div className="ml-8">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn("h-full transition-all", getStatusColor(effectiveStatus))}
                            style={{ width: `${rock.completionPercentage || 0}%` }}
                          />
                        </div>
                        {rock.lastCheckInAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last check-in: {new Date(rock.lastCheckInAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No quarterly rocks for {currentQuarter?.label}
                </p>
              )}
            </CardContent>
          </Card>
          </div>

          {/* OKRs - Second column */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  {selectedTeam === 'all' ? `${t('objective', 'plural')} by Team` : `${teams?.find(team => team.id === selectedTeam)?.name || 'Team'} ${t('objective', 'plural')}`}
                </h2>
              </div>
              <Link href="/planning">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-okrs">
                  View Details
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
        
        {objectivesError ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p>Unable to load objectives</p>
              </div>
            </CardContent>
          </Card>
        ) : objectives && objectives.length > 0 ? (
          (() => {
            // Build set of all objective IDs in current results
            const objectiveIds = new Set(objectives.map(o => o.id));
            
            // Filter objectives: root-level only, exclude garbage, and apply team filter
            const rootObjectives = objectives.filter(obj => 
              (!obj.parentId || !objectiveIds.has(obj.parentId)) &&
              !obj.title?.startsWith('[Imported]') &&
              (selectedTeam === 'all' || obj.teamId === selectedTeam)
            );
            
            // Create team lookup
            const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);
            
            // If filtering by specific team, show flat list; otherwise group by team
            if (selectedTeam !== 'all') {
              // Single team view - flat list sorted by title
              const sortedObjectives = [...rootObjectives].sort((a, b) => 
                (a.title || '').localeCompare(b.title || '')
              );
              
              const teamName = teams?.find(t => t.id === selectedTeam)?.name || 'Selected Team';
              
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{teamName}</CardTitle>
                      <Badge variant="secondary" className="ml-auto">
                        {sortedObjectives.length} objective{sortedObjectives.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    {sortedObjectives.length > 0 ? sortedObjectives.map((okr) => (
                      <div key={okr.id} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{okr.title}</h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <ObjectiveConfidenceChip
                              objectiveId={okr.id}
                              tenantId={currentTenant?.id}
                              quarter={currentQuarter?.quarter}
                              year={currentQuarter?.year}
                            />
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                (okr.progress || 0) >= 100 && "bg-green-500/10 text-green-600",
                                (okr.progress || 0) >= 70 && (okr.progress || 0) < 100 && "bg-blue-500/10 text-blue-600",
                                (okr.progress || 0) < 70 && (okr.progress || 0) > 0 && "bg-yellow-500/10 text-yellow-600"
                              )}
                            >
                              {okr.progress || 0}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={Math.min(okr.progress || 0, 100)} className="h-1.5" />
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No objectives for this team
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            }
            
            // All teams view - group by team (with special handling for org-level objectives)
            const byTeam = new Map<string, Objective[]>();
            for (const obj of rootObjectives) {
              // Organization-level objectives without a team should be grouped as 'organization'
              const teamKey = obj.teamId || (obj.level === 'organization' ? 'organization' : 'no-team');
              if (!byTeam.has(teamKey)) {
                byTeam.set(teamKey, []);
              }
              byTeam.get(teamKey)!.push(obj);
            }
            
            // Sort teams alphabetically, put "organization" first and "no-team" last
            const sortedTeamKeys = Array.from(byTeam.keys()).sort((a, b) => {
              if (a === 'organization') return -1;
              if (b === 'organization') return 1;
              if (a === 'no-team') return 1;
              if (b === 'no-team') return -1;
              const nameA = teamMap.get(a) || a;
              const nameB = teamMap.get(b) || b;
              return nameA.localeCompare(nameB);
            });
            
            // Sort objectives within each team by title
            byTeam.forEach((objs) => {
              objs.sort((a: Objective, b: Objective) => (a.title || '').localeCompare(b.title || ''));
            });
            
            return (
              <div className="space-y-4">
                {sortedTeamKeys.map(teamKey => {
                  const teamObjectives = byTeam.get(teamKey) || [];
                  const teamName = teamKey === 'organization' ? 'Organization' : 
                                   teamKey === 'no-team' ? 'Unassigned' : 
                                   (teamMap.get(teamKey) || 'Unknown Team');
                  
                  return (
                    <Card key={teamKey}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          {teamKey === 'organization' ? (
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className="text-base">{teamName}</CardTitle>
                          <Badge variant="secondary" className="ml-auto">
                            {teamObjectives.length} objective{teamObjectives.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2 space-y-3">
                        {teamObjectives.map((okr) => (
                          <div key={okr.id} className="space-y-1.5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{okr.title}</h4>
                              </div>
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "text-xs shrink-0",
                                  (okr.progress || 0) >= 100 && "bg-green-500/10 text-green-600",
                                  (okr.progress || 0) >= 70 && (okr.progress || 0) < 100 && "bg-blue-500/10 text-blue-600",
                                  (okr.progress || 0) < 70 && (okr.progress || 0) > 0 && "bg-yellow-500/10 text-yellow-600"
                                )}
                              >
                                {okr.progress || 0}%
                              </Badge>
                            </div>
                            <Progress value={Math.min(okr.progress || 0, 100)} className="h-1.5" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()
        ) : (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                No objectives for {currentQuarter?.label}
              </p>
            </CardContent>
          </Card>
          )}
          </div>
        </div>
      </div>

      {/* Focus Rhythm */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Focus Rhythm - Upcoming Meetings</h2>
          </div>
          <Link href="/focus-rhythm">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-focus">
              View Schedule
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {meetings.length > 0 ? (
            meetings.slice(0, 3).map((meeting) => (
              <Card key={meeting.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-base mb-1">{meeting.title}</h3>
                      {meeting.meetingType && (
                        <p className="text-sm text-muted-foreground mb-2">{meeting.meetingType}</p>
                      )}
                      {meeting.nextMeetingDate && (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(meeting.nextMeetingDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming meetings scheduled
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Strategic Alignment Flow */}
      <StrategicAlignmentSankey 
        year={currentQuarter?.year || new Date().getFullYear()} 
        quarter={currentQuarter?.quarter}
      />
    </div>
  );
}
