import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Target, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  User,
  Calendar,
  Link2,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { CheckIn, Objective, KeyResult, Strategy, BigRock } from "@shared/schema";
import { MilestoneTimeline, type PhasedTargets } from "./MilestoneTimeline";

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
  if (unit) return `${value.toLocaleString()} ${unit}`;
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

  if (!entity) return null;

  const latestCheckIn = checkInHistory[0];

  const chartData = checkInHistory
    .slice()
    .reverse()
    .map((checkIn, index) => ({
      date: format(new Date(checkIn.asOfDate || checkIn.createdAt || new Date()), "MMM d"),
      actual: checkIn.newProgress,
      expected: Math.min(100, ((index + 1) / Math.max(checkInHistory.length, 1)) * 100),
    }));

  if (chartData.length === 0) {
    chartData.push({
      date: "Start",
      actual: 0,
      expected: 0,
    });
    chartData.push({
      date: "Now",
      actual: entity.progress,
      expected: 50,
    });
  }

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
                <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <SheetTitle className="text-left truncate" data-testid="text-detail-title">
                {entity.title}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                size="sm" 
                onClick={onCheckIn}
                data-testid="button-detail-checkin"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
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
                  <span className="text-2xl font-bold ml-auto">{Math.round(entity.progress)}%</span>
                </div>

                <Progress value={entity.progress} className="h-2" />

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

                {chartData.length > 1 && (
                  <div className="h-40 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          tick={{ fontSize: 11 }} 
                          tickLine={false}
                          axisLine={false}
                          width={30}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${Math.round(value)}%`]}
                          labelStyle={{ fontSize: 12 }}
                        />
                        <ReferenceLine y={100} stroke="#e5e7eb" strokeDasharray="3 3" />
                        <Line 
                          type="monotone" 
                          dataKey="expected" 
                          stroke="#d1d5db" 
                          strokeDasharray="5 5"
                          dot={false}
                          name="Expected"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="actual" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", r: 3 }}
                          name="Actual"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview" data-testid="tab-detail-overview">Overview</TabsTrigger>
                <TabsTrigger value="activity" data-testid="tab-detail-activity">Activity</TabsTrigger>
                {entityType === "objective" && (
                  <TabsTrigger value="bigrocks" data-testid="tab-detail-bigrocks">Big Rocks</TabsTrigger>
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

                {(alignedStrategies.length > 0 || alignedObjectives.length > 0) && (
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
                      {alignedObjectives.map((obj) => (
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
                    {entity.description && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Description</p>
                        <p className="text-sm">{entity.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(checkIn.asOfDate || checkIn.createdAt || new Date()), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
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
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {entityType === "objective" && (
                <TabsContent value="bigrocks" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Linked Big Rocks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedBigRocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No Big Rocks linked to this objective
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {linkedBigRocks.map((rock) => (
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
    </Sheet>
  );
}
