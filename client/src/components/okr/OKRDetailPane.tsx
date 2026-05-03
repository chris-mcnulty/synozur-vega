import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Gauge, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  User,
  Calendar,
  Link2,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Pencil,
  Scale,
  Lock,
  Edit2,
  Trash2,
  MessageSquare
} from "lucide-react";
import { format, startOfYear, endOfYear, startOfQuarter, endOfQuarter, differenceInDays, addMonths } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { CheckIn, Objective, KeyResult, Strategy, BigRock } from "@shared/schema";
import { MilestoneTimeline, type PhasedTargets } from "./MilestoneTimeline";
import { ForecastingPanel } from "./ForecastingPanel";
import { TrendChart, parseTrendDate, type TrendPoint } from "./TrendChart";
import { PlannerProgressMapping } from "@/components/planner/PlannerProgressMapping";
import { PlannerTaskLinkPanel } from "@/components/planner/PlannerTaskLinkPanel";
import { DiscussionPanel } from "@/components/DiscussionPanel";
import { CommentCountBadge } from "@/components/CommentCountBadge";
import { WebhookTokensPanel } from "./WebhookTokensPanel";
import { usePermissions } from "@/hooks/use-permissions";
import { EmbedDialog } from "@/components/EmbedDialog";
import { Code } from "lucide-react";

// Renders the owner-reported confidence as a small standalone sparkline plus
// a "latest" colored chip. Kept separate from the progress chart so the two
// signals (objective progress vs. owner confidence) don't visually collide.
function ConfidenceTrendCard({
  series,
  hasSeries,
}: {
  series: Array<{ date: string; progress: number; confidence?: number | null }>;
  hasSeries: boolean;
}) {
  if (!hasSeries) return null;

  const points = series
    .filter((p) => typeof p.confidence === "number")
    .map((p) => ({
      date: format(parseTrendDate(p.date), "MMM d"),
      confidence: Math.round((p.confidence as number) * 100) / 100,
    }));

  const latest = points[points.length - 1]?.confidence ?? null;

  // Bucketize the latest value into a colored chip.
  function chipVariant(v: number): "default" | "secondary" | "destructive" {
    if (v <= 0.4) return "destructive";
    if (v <= 0.6) return "secondary";
    return "default";
  }
  function chipLabel(v: number): string {
    if (v <= 0.2) return "Very Low";
    if (v <= 0.4) return "Low";
    if (v <= 0.6) return "Medium";
    if (v <= 0.8) return "High";
    return "Very High";
  }

  return (
    <Card data-testid="card-confidence-trend">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            Owner Confidence
          </CardTitle>
          {latest != null && (
            <Badge
              variant={chipVariant(latest)}
              data-testid="badge-confidence-latest"
            >
              {chipLabel(latest)}: {latest.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {points.length > 1 ? (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 1]} hide />
                <Tooltip
                  formatter={(value: number) => [value.toFixed(1)]}
                  labelStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ fill: "#a78bfa", r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not enough data yet for a trend.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface OKRDetailPaneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "objective" | "key_result";
  entity: {
    id: string;
    title: string;
    description?: string;
    progress: number;
    status: string;
    ownerEmail?: string;
    ownerId?: string;
    createdBy?: string;
    quarter?: number;
    year?: number;
    targetValue?: number;
    currentValue?: number;
    startValue?: number;
    initialValue?: number;
    unit?: string;
    metricType?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    phasedTargets?: PhasedTargets | null;
    weight?: number;
    isWeightLocked?: boolean;
  } | null;
  alignedStrategies?: Strategy[];
  alignedObjectives?: Objective[];
  linkedBigRocks?: BigRock[];
  onCheckIn?: () => void;
  onEdit?: () => void;
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "on_track":
    case "on track":
      return "bg-green-500";
    case "behind":
      return "bg-yellow-500";
    case "at_risk":
    case "at risk":
      return "bg-red-500";
    case "completed":
      return "bg-blue-500";
    case "not_started":
    case "not started":
    default:
      return "bg-gray-400";
  }
}

function getStatusLabel(status: string): string {
  switch (status?.toLowerCase()) {
    case "on_track":
      return "On Track";
    case "at_risk":
      return "At Risk";
    case "behind":
      return "Behind";
    case "completed":
      return "Completed";
    case "not_started":
      return "Not Started";
    default:
      return status || "Not Set";
  }
}

function getMetricIcon(metricType?: string) {
  switch (metricType) {
    case "increase":
      return <ArrowUp className="h-3 w-3" />;
    case "decrease":
      return <ArrowDown className="h-3 w-3" />;
    case "maintain":
      return <Minus className="h-3 w-3" />;
    default:
      return null;
  }
}

function getMetricLabel(metricType?: string): string {
  switch (metricType) {
    case "increase":
      return "Increase to";
    case "decrease":
      return "Decrease to";
    case "maintain":
      return "Maintain at";
    case "complete":
      return "Complete";
    default:
      return "Reach";
  }
}

function formatValue(value: number | undefined, unit?: string): string {
  if (value === undefined) return "-";
  if (unit === "%" || unit === "percent") return `${value}%`;
  if (unit === "$" || unit === "currency" || unit === "USD") return `$${value.toLocaleString()}`;
  if (unit && unit.toLowerCase() !== "number") return `${value.toLocaleString()} ${unit}`;
  return value.toLocaleString();
}

export function OKRDetailPane({
  open,
  onOpenChange,
  entityType,
  entity,
  alignedStrategies = [],
  alignedObjectives = [],
  linkedBigRocks = [],
  onCheckIn,
  onEdit,
}: OKRDetailPaneProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedCheckInComments, setExpandedCheckInComments] = useState<Set<string>>(new Set());
  const [embedOpen, setEmbedOpen] = useState(false);

  // When a deep link points at a comment on this entity, switch to the
  // Discussion tab (or expand the relevant check-in's comments) so
  // DiscussionPanel can scroll/highlight the focused comment.
  useEffect(() => {
    if (typeof window === "undefined" || !open) return;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focusComment");
    const fEntityType = params.get("entityType");
    const fEntityId = params.get("entityId");
    if (!focus) return;
    if (fEntityId === entity?.id && (fEntityType === "objective" || fEntityType === "key_result")) {
      setActiveTab("discussion");
    } else if (fEntityType === "check_in") {
      setActiveTab("activity");
      if (fEntityId) {
        setExpandedCheckInComments((prev) => {
          const next = new Set(prev);
          next.add(fEntityId);
          return next;
        });
      }
    }
  }, [open, entity?.id]);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [editFormData, setEditFormData] = useState({
    newValue: 0,
    newProgress: 0,
    note: "",
  });
  const permissions = usePermissions();
  const { toast } = useToast();
  
  // Check if user can modify this entity
  const canModify = permissions.canModifyOKR(entity?.ownerId, entity?.createdBy) || 
                    permissions.canModifyByEmail(entity?.ownerEmail);

  const { data: checkInHistory = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/okr/check-ins", entity?.id, entityType],
    queryFn: async () => {
      if (!entity?.id) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=${entityType}&entityId=${entity.id}`);
      if (!res.ok) throw new Error("Failed to fetch check-in history");
      return res.json();
    },
    enabled: !!entity?.id && open,
  });

  // Aligned objectives and linked big rocks come from the page-level
  // subtree query in the parent (PlanningEnhanced). The detail pane
  // simply renders whatever the parent supplies — keeping the data
  // ownership in one place avoids duplicate fetches and stale flashes.
  const resolvedAlignedObjectives = alignedObjectives;
  const resolvedLinkedBigRocks = linkedBigRocks;

  // Snapshot-backed trend series for the chart. Independent from the editable
  // check-in list above so chart/forecast history stays stable when users
  // edit or delete individual check-ins.
  const trendPath = entityType === "key_result" ? "key-results" : "objectives";
  const { data: trendSeries = [] } = useQuery<TrendPoint[]>({
    queryKey: ["/api/okr", trendPath, entity?.id, "trend"],
    queryFn: async () => {
      if (!entity?.id) return [];
      const res = await fetch(`/api/okr/${trendPath}/${entity.id}/trend`);
      if (!res.ok) throw new Error("Failed to fetch trend series");
      const data = await res.json();
      return data.series ?? [];
    },
    enabled: !!entity?.id && open,
  });

  // Mutation for updating check-ins
  const updateCheckInMutation = useMutation({
    mutationFn: async (data: { id: string; newValue?: number; newProgress: number; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/okr/check-ins/${data.id}`, {
        newValue: data.newValue,
        newProgress: data.newProgress,
        note: data.note,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Check-in updated", description: "The check-in has been corrected successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins", entity?.id, entityType] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/key-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/context"] });
      setEditingCheckIn(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update check-in", variant: "destructive" });
    },
  });

  // Mutation for deleting check-ins
  const deleteCheckInMutation = useMutation({
    mutationFn: async (checkInId: string) => {
      const res = await apiRequest("DELETE", `/api/okr/check-ins/${checkInId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Check-in deleted", description: "The check-in has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins", entity?.id, entityType] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/key-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/context"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete check-in", variant: "destructive" });
    },
  });

  const handleDeleteCheckIn = (checkIn: CheckIn) => {
    if (confirm("Are you sure you want to delete this check-in? This action cannot be undone.")) {
      deleteCheckInMutation.mutate(checkIn.id);
    }
  };

  const handleEditCheckIn = (checkIn: CheckIn) => {
    setEditFormData({
      newValue: checkIn.newValue || 0,
      newProgress: checkIn.newProgress || 0,
      note: checkIn.note || "",
    });
    setEditingCheckIn(checkIn);
  };

  const handleSaveCheckInEdit = () => {
    if (!editingCheckIn || !entity) return;
    
    // For Key Results, calculate progress from actual value using proper formula
    let calculatedProgress = editFormData.newProgress || 0;
    if (entityType === "key_result" && entity.targetValue !== undefined) {
      const newValue = editFormData.newValue;
      const initialValue = entity.initialValue ?? entity.startValue ?? 0;
      const targetValue = entity.targetValue;
      const metricType = entity.metricType || "increase";
      
      if (metricType === "increase") {
        const denom = targetValue - initialValue;
        if (denom === 0) {
          calculatedProgress = newValue >= targetValue ? 100 : 0;
        } else if (denom > 0) {
          calculatedProgress = Math.round(((newValue - initialValue) / denom) * 100);
        } else {
          calculatedProgress = 0;
        }
      } else if (metricType === "decrease") {
        const denom = initialValue - targetValue;
        if (denom === 0) {
          calculatedProgress = newValue <= targetValue ? 100 : 0;
        } else if (denom > 0) {
          calculatedProgress = Math.round(((initialValue - newValue) / denom) * 100);
        } else {
          calculatedProgress = 0;
        }
      } else if (metricType === "maintain") {
        if (targetValue === 0) {
          calculatedProgress = Math.abs(newValue) <= 0.05 ? 100 : 0;
        } else {
          const deviation = Math.abs(newValue - targetValue) / Math.abs(targetValue);
          calculatedProgress = Math.round(deviation <= 0.05 ? 100 : Math.max(0, 100 - (deviation * 100)));
        }
      } else {
        // Default: simple percentage (current / target)
        if (targetValue > 0) {
          calculatedProgress = Math.round((newValue / targetValue) * 100);
        }
      }
    }
    
    // Ensure progress is always a valid non-negative number
    if (typeof calculatedProgress !== 'number' || isNaN(calculatedProgress)) {
      calculatedProgress = 0;
    }
    calculatedProgress = Math.max(0, calculatedProgress);
    
    updateCheckInMutation.mutate({
      id: editingCheckIn.id,
      newValue: entityType === "key_result" ? editFormData.newValue : undefined,
      newProgress: calculatedProgress,
      note: editFormData.note,
    });
  };

  if (!entity) return null;

  const latestCheckIn = checkInHistory[0];

  // Determine period start and end dates based on quarter/year
  const getPeriodDates = () => {
    const year = entity.year || new Date().getFullYear();
    const quarter = entity.quarter;
    
    if (quarter === 0 || quarter === undefined) {
      // Annual goal: Jan 1 to Dec 31
      return {
        periodStart: new Date(year, 0, 1), // Jan 1
        periodEnd: new Date(year, 11, 31), // Dec 31
      };
    } else {
      // Quarterly goal
      const qStartMonth = (quarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
      return {
        periodStart: new Date(year, qStartMonth, 1),
        periodEnd: new Date(year, qStartMonth + 3, 0), // Last day of quarter
      };
    }
  };
  
  const { periodStart, periodEnd } = getPeriodDates();
  const totalPeriodDays = Math.max(1, differenceInDays(periodEnd, periodStart));
  const today = new Date();
  
  // Calculate expected progress for a given date (linear progression over the period)
  const getExpectedProgress = (date: Date): number => {
    const daysSinceStart = differenceInDays(date, periodStart);
    if (daysSinceStart <= 0) return 0;
    if (daysSinceStart >= totalPeriodDays) return 100;
    return Math.round((daysSinceStart / totalPeriodDays) * 100);
  };

  // Whether the trend has any owner-reported confidence values (used to gate
  // the separate ConfidenceTrendCard sparkline below the main chart).
  const hasConfidenceSeries = trendSeries.some(
    (p) => typeof p.confidence === "number",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col"
        data-testid="sheet-okr-detail"
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {entityType === "objective" ? (
                <Target className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <Gauge className="h-5 w-5 text-primary flex-shrink-0" />
              )}
              <SheetTitle className="text-left truncate" data-testid="text-detail-title">
                {entity.title}
              </SheetTitle>
              <CommentCountBadge entityType={entityType} entityId={entity.id} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onEdit && canModify && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onEdit}
                  data-testid="button-detail-edit"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                onClick={() => setEmbedOpen(true)}
                title="Embed this item"
                data-testid="button-detail-embed"
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                onClick={onCheckIn}
                data-testid="button-detail-checkin"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Check-in
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(entity.status)}`} />
                  <span className="font-medium">{getStatusLabel(entity.status)}</span>
                  <span className="text-2xl font-bold ml-auto">
                    {entity.unit === '%' || entity.unit === 'percent' ? (
                      entity.progress > 100 
                        ? `100%+` 
                        : `${Math.round(entity.progress)}%`
                    ) : (
                      formatValue(entity.currentValue ?? entity.progress, entity.unit)
                    )}
                  </span>
                </div>

                <Progress value={Math.min(entity.progress, 100)} className="h-2" />

                {entity.targetValue !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getMetricIcon(entity.metricType)}
                    <span>
                      {getMetricLabel(entity.metricType)}: {formatValue(entity.targetValue, entity.unit)}
                    </span>
                    {entity.currentValue !== undefined && (
                      <>
                        <span className="mx-1">|</span>
                        <span>Current: {formatValue(entity.currentValue, entity.unit)}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <TrendChart
                    series={trendSeries}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    fallbackProgress={entity.progress}
                  />
                </div>
              </CardContent>
            </Card>

            <ConfidenceTrendCard
              series={trendSeries}
              hasSeries={hasConfidenceSeries}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview" data-testid="tab-detail-overview">Overview</TabsTrigger>
                <TabsTrigger value="forecast" data-testid="tab-detail-forecast">Forecast</TabsTrigger>
                <TabsTrigger value="activity" data-testid="tab-detail-activity">Activity</TabsTrigger>
                <TabsTrigger value="discussion" data-testid="tab-detail-discussion">Discussion</TabsTrigger>
                {entityType === "objective" && (
                  <TabsTrigger value="bigrocks" data-testid="tab-detail-bigrocks">Big Rocks</TabsTrigger>
                )}
                {entityType === "key_result" && (
                  <TabsTrigger value="autoupdate" data-testid="tab-detail-autoupdate">Auto-update</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Milestones Timeline */}
                {entity.phasedTargets && entity.phasedTargets.targets && entity.phasedTargets.targets.length > 0 && (
                  <MilestoneTimeline
                    phasedTargets={entity.phasedTargets}
                    currentValue={entity.currentValue ?? entity.progress}
                    targetValue={entity.targetValue ?? 100}
                    initialValue={entity.initialValue ?? entity.startValue ?? 0}
                    unit={entity.unit}
                    metricType={entity.metricType as 'increase' | 'decrease' | 'maintain' | 'complete' | undefined}
                    startDate={entity.startDate}
                    endDate={entity.endDate}
                  />
                )}

                {latestCheckIn && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Last Check-in Note</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(latestCheckIn.asOfDate || latestCheckIn.createdAt || new Date()), "MMM d, yyyy")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {latestCheckIn.achievements && (latestCheckIn.achievements as string[]).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Highlights:</p>
                          <ul className="text-sm space-y-1">
                            {(latestCheckIn.achievements as string[]).map((item, i) => (
                              <li key={i} className="text-muted-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {latestCheckIn.challenges && (latestCheckIn.challenges as string[]).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Lowlights:</p>
                          <ul className="text-sm space-y-1">
                            {(latestCheckIn.challenges as string[]).map((item, i) => (
                              <li key={i} className="text-muted-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {latestCheckIn.nextSteps && (latestCheckIn.nextSteps as string[]).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Next Steps:</p>
                          <ul className="text-sm space-y-1">
                            {(latestCheckIn.nextSteps as string[]).map((item, i) => (
                              <li key={i} className="text-muted-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {latestCheckIn.note && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Note:</p>
                          <p className="text-sm">{latestCheckIn.note}</p>
                        </div>
                      )}
                      {!latestCheckIn.achievements?.length && 
                       !latestCheckIn.challenges?.length && 
                       !latestCheckIn.nextSteps?.length && 
                       !latestCheckIn.note && (
                        <p className="text-sm text-muted-foreground">No notes recorded</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {(alignedStrategies.length > 0 || resolvedAlignedObjectives.length > 0) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Aligned to
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {alignedStrategies.map((strategy) => (
                        <div 
                          key={strategy.id} 
                          className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                        >
                          <Target className="h-4 w-4 text-primary" />
                          <span>{strategy.title}</span>
                        </div>
                      ))}
                      {resolvedAlignedObjectives.map((obj) => (
                        <div 
                          key={obj.id} 
                          className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                        >
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span>{obj.title}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {entity.ownerEmail && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Owner</p>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {entity.ownerEmail.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{entity.ownerEmail}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {entity.quarter !== undefined && entity.year && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Time Period</p>
                          <span className="text-sm">
                            {entity.quarter === 0 ? "Annual" : `Q${entity.quarter}`} {entity.year}
                          </span>
                        </div>
                      </div>
                    )}
                    {entityType === "key_result" && entity.weight !== undefined && (
                      <div className="flex items-center gap-3">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Contribution Weight</p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className="text-sm"
                              data-testid="badge-kr-weight"
                            >
                              {entity.weight}%
                            </Badge>
                            {entity.isWeightLocked && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              of parent objective progress
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {entity.description && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{entity.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {entityType === "key_result" && (
                  <PlannerProgressMapping
                    entityType="keyresult"
                    entityId={entity.id}
                    entityTitle={entity.title}
                  />
                )}

                {entityType === "objective" && (
                  <PlannerTaskLinkPanel
                    entityType="objective"
                    entityId={entity.id}
                    entityTitle={entity.title}
                  />
                )}
              </TabsContent>

              <TabsContent value="forecast" className="mt-4">
                <ForecastingPanel
                  entity={entity}
                  checkIns={checkInHistory}
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Check-in History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {checkInHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No check-ins recorded yet
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {checkInHistory.map((checkIn) => (
                          <div key={checkIn.id} className="border-l-2 border-muted pl-4 pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {(checkIn.userEmail || "?").charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">
                                  {checkIn.userEmail?.split("@")[0] || "Unknown"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(checkIn.asOfDate || checkIn.createdAt || new Date()), "MMM d, yyyy")}
                                </span>
                                {canModify && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleEditCheckIn(checkIn)}
                                    data-testid={`button-edit-checkin-${checkIn.id}`}
                                    title="Edit check-in"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                )}
                                {(checkIn.userId === permissions.user?.id || permissions.isAdmin || permissions.isPlatformAdmin) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteCheckIn(checkIn)}
                                    data-testid={`button-delete-checkin-${checkIn.id}`}
                                    title="Delete check-in"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              {(checkIn.previousValue !== null && checkIn.previousValue !== undefined) || 
                               (checkIn.newValue !== null && checkIn.newValue !== undefined) ? (
                                <Badge variant="secondary" className="text-xs">
                                  {formatValue(checkIn.previousValue ?? undefined, entity.unit)} → {formatValue(checkIn.newValue ?? undefined, entity.unit)}
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="text-xs">
                                {Math.round(checkIn.previousProgress || 0)}% → {Math.round(checkIn.newProgress || 0)}%
                              </Badge>
                              {checkIn.newStatus && (
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${getStatusColor(checkIn.newStatus)}`} />
                                  <span className="text-xs">{getStatusLabel(checkIn.newStatus)}</span>
                                </div>
                              )}
                            </div>
                            {checkIn.note && (
                              <p className="text-sm text-muted-foreground mt-2">{checkIn.note}</p>
                            )}
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setExpandedCheckInComments(prev => {
                                    const next = new Set(prev);
                                    if (next.has(checkIn.id)) next.delete(checkIn.id);
                                    else next.add(checkIn.id);
                                    return next;
                                  });
                                }}
                                data-testid={`button-toggle-comments-${checkIn.id}`}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {expandedCheckInComments.has(checkIn.id) ? "Hide comments" : "Comments"}
                              </Button>
                              {expandedCheckInComments.has(checkIn.id) && (
                                <div className="mt-2 pl-2 border-l-2 border-muted">
                                  <DiscussionPanel entityType="check_in" entityId={checkIn.id} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="discussion" className="mt-4">
                <Card>
                  <CardContent className="pt-4">
                    <DiscussionPanel
                      entityType={entityType}
                      entityId={entity.id}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {entityType === "key_result" && (
                <TabsContent value="autoupdate" className="mt-4">
                  <WebhookTokensPanel keyResultId={entity.id} />
                </TabsContent>
              )}

              {entityType === "objective" && (
                <TabsContent value="bigrocks" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Linked Big Rocks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {resolvedLinkedBigRocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No Big Rocks linked to this objective
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {resolvedLinkedBigRocks.map((rock) => (
                            <div 
                              key={rock.id}
                              className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(rock.status || "")}`} />
                                <span className="text-sm">{rock.title}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {rock.completionPercentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>

      {/* Edit Check-in Dialog */}
      <Dialog open={!!editingCheckIn} onOpenChange={(open) => !open && setEditingCheckIn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Check-in</DialogTitle>
            <DialogDescription>
              Correct the values for this check-in from {editingCheckIn && format(new Date(editingCheckIn.asOfDate || editingCheckIn.createdAt || new Date()), "MMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {entityType === "key_result" ? (
              <div>
                <Label htmlFor="editNewValue">Actual Value {entity.unit && `(${entity.unit})`}</Label>
                <Input
                  id="editNewValue"
                  type="number"
                  value={editFormData.newValue}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, newValue: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-edit-checkin-value"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {formatValue(entity.targetValue, entity.unit)} (progress is calculated automatically)
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="editNewProgress">Progress (%)</Label>
                <Input
                  id="editNewProgress"
                  type="number"
                  min={0}
                  value={editFormData.newProgress}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, newProgress: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-edit-checkin-progress"
                />
              </div>
            )}
            <div>
              <Label htmlFor="editNote">Note</Label>
              <Textarea
                id="editNote"
                value={editFormData.note}
                onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Optional note about this check-in..."
                data-testid="input-edit-checkin-note"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setEditingCheckIn(null)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveCheckInEdit}
              disabled={updateCheckInMutation.isPending}
              data-testid="button-save-checkin-edit"
            >
              {updateCheckInMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {entity && (
        <EmbedDialog
          open={embedOpen}
          onClose={() => setEmbedOpen(false)}
          entityType={entityType as "objective" | "key_result"}
          entityId={entity.id}
          entityTitle={entity.title}
        />
      )}
    </Sheet>
  );
}
