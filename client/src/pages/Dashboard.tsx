import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Building2,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Users,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useTenant } from "@/contexts/TenantContext";
import type { Foundation, Strategy, Objective, BigRock, Meeting } from "@shared/schema";

type Quarter = {
  id: string;
  label: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
};

const fiscalYears = [
  { id: "fy2025", label: "FY 2025 (Jan - Dec)", startMonth: 1 },
  { id: "fy2024", label: "FY 2024 (Jan - Dec)", startMonth: 1 },
];

const quarters: Quarter[] = [
  { id: "q1-2025", label: "Q1 2025", year: 2025, quarter: 1, startDate: "Jan 1", endDate: "Mar 31" },
  { id: "q2-2025", label: "Q2 2025", year: 2025, quarter: 2, startDate: "Apr 1", endDate: "Jun 30" },
  { id: "q3-2025", label: "Q3 2025", year: 2025, quarter: 3, startDate: "Jul 1", endDate: "Sep 30" },
  { id: "q4-2025", label: "Q4 2025", year: 2025, quarter: 4, startDate: "Oct 1", endDate: "Dec 31" },
  { id: "q4-2024", label: "Q4 2024", year: 2024, quarter: 4, startDate: "Oct 1", endDate: "Dec 31" },
];

export default function Dashboard() {
  const { currentTenant } = useTenant();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("fy2025");
  const [selectedQuarter, setSelectedQuarter] = useState("q1-2025");

  const currentQuarter = quarters.find((q) => q.id === selectedQuarter);

  // Fetch real data from APIs
  const { data: foundations, isLoading: loadingFoundations, error: foundationsError } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant.id}`],
    enabled: !!currentTenant.id,
  });

  const { data: strategies, isLoading: loadingStrategies, error: strategiesError } = useQuery<Strategy[]>({
    queryKey: [`/api/strategies/${currentTenant.id}`],
    enabled: !!currentTenant.id,
  });

  const { data: objectives, isLoading: loadingObjectives, error: objectivesError } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", currentTenant.id, currentQuarter?.quarter, currentQuarter?.year],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: currentTenant.id,
        ...(currentQuarter?.quarter && { quarter: String(currentQuarter.quarter) }),
        ...(currentQuarter?.year && { year: String(currentQuarter.year) }),
      });
      const res = await fetch(`/api/okr/objectives?${params}`);
      if (!res.ok) throw new Error('Failed to fetch objectives');
      return res.json();
    },
    enabled: !!currentTenant.id && !!currentQuarter,
  });

  const { data: bigRocks, isLoading: loadingBigRocks, error: bigRocksError } = useQuery<BigRock[]>({
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

  const { data: meetings, isLoading: loadingMeetings, error: meetingsError } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/${currentTenant.id}`],
    enabled: !!currentTenant.id,
  });

  const isLoading = loadingFoundations || loadingStrategies || loadingObjectives || loadingBigRocks || loadingMeetings;
  const hasError = foundationsError || strategiesError || objectivesError || bigRocksError || meetingsError;

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

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {foundationsError?.message || strategiesError?.message || objectivesError?.message || 
                   bigRocksError?.message || meetingsError?.message || "Failed to load dashboard data"}
                </p>
                <Button onClick={() => window.location.reload()} data-testid="button-retry">
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Quarter Selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Company Operating System</h1>
          <p className="text-muted-foreground">
            Comprehensive view of foundations, strategies, planning, and focus for{" "}
            {currentQuarter?.label}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
            <SelectTrigger className="w-48" data-testid="select-fiscal-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.label}
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
                <p className="text-sm text-muted-foreground">Active Strategies</p>
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
                <p className="text-sm text-muted-foreground">Rocks Complete</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <div className="h-1 w-8 bg-primary rounded" />
                  Mission
                </h3>
                {foundations?.mission ? (
                  <p className="text-sm text-muted-foreground">{foundations.mission}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not yet defined</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <div className="h-1 w-8 bg-secondary rounded" />
                  Vision
                </h3>
                {foundations?.vision ? (
                  <p className="text-sm text-muted-foreground">{foundations.vision}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not yet defined</p>
                )}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h3 className="font-semibold">Core Values</h3>
              {foundations?.values && foundations.values.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {foundations.values.map((value, idx) => (
                    <Badge key={idx} variant="secondary">
                      {value}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not yet defined</p>
              )}
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h3 className="font-semibold">Annual Goals ({currentQuarter?.year})</h3>
              {foundations?.annualGoals && foundations.annualGoals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {foundations.annualGoals.map((goal, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{goal}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not yet defined</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategies and Planning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategies Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Strategic Priorities</h2>
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
              {strategies && strategies.length > 0 ? (
                strategies.map((strategy) => (
                  <div key={strategy.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{strategy.title}</h3>
                        {strategy.priority && (
                          <Badge
                            variant={
                              strategy.priority === "critical"
                                ? "destructive"
                                : strategy.priority === "high"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs mt-1"
                          >
                            {strategy.priority}
                          </Badge>
                        )}
                      </div>
                      {strategy.status && (
                        <Badge variant="outline" className="text-xs">
                          {strategy.status}
                        </Badge>
                      )}
                    </div>
                    {strategy.description && (
                      <p className="text-xs text-muted-foreground">{strategy.description}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No strategic priorities defined yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quarterly Rocks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Quarterly Rocks</h2>
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
              {bigRocks && bigRocks.length > 0 ? (
                bigRocks.map((rock) => (
                  <div key={rock.id} className="flex items-start gap-3">
                    {rock.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    ) : rock.status === "in_progress" || rock.status === "in-progress" ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary shrink-0 mt-0.5 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm ${
                          rock.status === "completed" ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {rock.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rock.ownerEmail || "Unassigned"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No quarterly rocks for {currentQuarter?.label}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OKRs Section */}
      <div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">OKRs by Department</h2>
            </div>
            <Link href="/planning">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-okrs">
                View Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {objectives && objectives.length > 0 ? (
                objectives.map((okr) => (
                  <div key={okr.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{okr.title}</h3>
                        {okr.ownerEmail && (
                          <p className="text-xs text-muted-foreground">{okr.ownerEmail}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {okr.progress || 0}%
                      </Badge>
                    </div>
                    <Progress value={okr.progress || 0} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No OKRs for {currentQuarter?.label}
                </p>
              )}
            </CardContent>
          </Card>
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
          {meetings && meetings.length > 0 ? (
            meetings.slice(0, 3).map((meeting) => (
              <Card key={meeting.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-sm mb-1">{meeting.title}</h3>
                      {meeting.meetingType && (
                        <p className="text-xs text-muted-foreground mb-2">{meeting.meetingType}</p>
                      )}
                      {meeting.nextMeetingDate && (
                        <div className="flex items-center gap-1 text-xs">
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
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No upcoming meetings scheduled
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
