import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Target,
  Rocket,
  ArrowRight,
  AlertCircle,
  Loader2,
  Activity,
  Bell,
  Mountain,
  PlayCircle,
} from "lucide-react";
import { SerialCheckInDialog, type CheckInQueueItem } from "@/components/okr/SerialCheckInDialog";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTimePeriod } from "@/contexts/TimePeriodContext";
import { differenceInDays, format, isAfter, isBefore, addDays, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import type { Objective, KeyResult, BigRock, BigRockTask } from "@shared/schema";

interface Meeting {
  id: string;
  title: string;
  date: string | null;
  meetingType: string;
  attendees?: string[];
}

type PaceStatus = "ahead" | "on_track" | "behind" | "at_risk" | "no_data" | "completed";

function getPaceColor(status: PaceStatus) {
  switch (status) {
    case "ahead": return "text-green-600 dark:text-green-400";
    case "on_track": return "text-green-600 dark:text-green-400";
    case "behind": return "text-amber-600 dark:text-amber-400";
    case "at_risk": return "text-red-600 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

function getPaceBadgeVariant(status: PaceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ahead": return "default";
    case "on_track": return "secondary";
    case "behind": return "outline";
    case "at_risk": return "destructive";
    default: return "outline";
  }
}

function getPaceLabel(status: PaceStatus): string {
  switch (status) {
    case "ahead": return "Ahead";
    case "on_track": return "On Track";
    case "behind": return "Behind";
    case "at_risk": return "At Risk";
    case "no_data": return "No Data";
    case "completed": return "Completed";
  }
}

function calculatePaceStatus(progress: number, quarter: number, year: number): PaceStatus {
  const now = new Date();
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);
  const endDate = new Date(year, quarterStartMonth + 3, 0);
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const rawElapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, Math.min(rawElapsedDays, totalDays));
  const isPeriodEnded = rawElapsedDays > totalDays;
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;
  const gap = progress - percentageThrough;

  if (isPeriodEnded) return progress >= 100 ? "completed" : progress >= 70 ? "on_track" : "behind";
  if (progress === 0 && elapsedDays < 14) return "no_data";
  if (gap >= 10) return "ahead";
  if (gap <= -20) return "at_risk";
  if (gap <= -10) return "behind";
  return "on_track";
}

function daysSinceCheckIn(lastCheckInAt: string | null | undefined): number | null {
  if (!lastCheckInAt) return null;
  return differenceInDays(new Date(), new Date(lastCheckInAt));
}

export default function MyFocus() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { quarter, year } = useTimePeriod();
  const tenantId = currentTenant?.id;
  const today = new Date();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/okr/objectives", tenantId, quarter, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/okr/objectives?tenantId=${tenantId}&quarter=${quarter}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  const { data: keyResults = [], isLoading: krLoading } = useQuery<KeyResult[]>({
    queryKey: ["/api/okr/key-results", tenantId, quarter, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/okr/key-results?tenantId=${tenantId}&quarter=${quarter}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  const { data: bigRocks = [], isLoading: bigRocksLoading } = useQuery<BigRock[]>({
    queryKey: ["/api/okr/big-rocks", tenantId, quarter, year],
    queryFn: async () => {
      const res = await fetch(
        `/api/okr/big-rocks?tenantId=${tenantId}&quarter=${quarter}&year=${year}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings/${tenantId}`],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${tenantId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch tasks for each big rock to get full task metadata (dueDate, status, assigneeId)
  const bigRockTaskResults = useQueries({
    queries: bigRocks.map((br) => ({
      queryKey: [`/api/okr/big-rocks/${br.id}/tasks`],
      queryFn: async (): Promise<(BigRockTask & { bigRockTitle: string; bigRockId: string })[]> => {
        const res = await fetch(`/api/okr/big-rocks/${br.id}/tasks`, { credentials: "include" });
        if (!res.ok) return [];
        const tasks: BigRockTask[] = await res.json();
        return tasks.map((t) => ({ ...t, bigRockTitle: br.title, bigRockId: br.id }));
      },
      enabled: !!tenantId && bigRocks.length > 0,
      staleTime: 60 * 1000,
    })),
  });

  const isLoading = objectivesLoading || krLoading || bigRocksLoading || meetingsLoading;

  const myObjectives = useMemo(() => {
    if (!user) return [];
    return objectives.filter(
      (o) =>
        o.ownerId === user.id ||
        o.ownerEmail === user.email ||
        (o.coOwnerIds as string[] | null)?.includes(user.id) ||
        o.checkInOwnerId === user.id
    );
  }, [objectives, user]);

  const myKeyResults = useMemo(() => {
    if (!user) return [];
    return keyResults.filter(
      (kr) => kr.ownerId === user.id || (kr as any).ownerEmail === user.email
    );
  }, [keyResults, user]);

  const myBigRocks = useMemo(() => {
    if (!user) return [];
    return bigRocks.filter(
      (br) =>
        (br as any).ownerId === user.id ||
        (br as any).ownerEmail === user.email ||
        (br as any).accountableId === user.id
    );
  }, [bigRocks, user]);

  // Overdue check-ins: items where last check-in is > 7 days ago or never (objectives, key results, and big rocks)
  const overdueCheckIns = useMemo(() => {
    const items: CheckInQueueItem[] = [];

    for (const obj of myObjectives) {
      if (obj.status === "completed" || obj.status === "cancelled") continue;
      const days = daysSinceCheckIn((obj as any).lastCheckInAt);
      if (days === null || days >= 7) {
        items.push({
          id: obj.id,
          title: obj.title,
          type: "objective",
          daysSince: days,
          progress: obj.progress ?? 0,
          status: obj.status ?? "not_started",
          paceStatus: calculatePaceStatus(obj.progress ?? 0, quarter, year),
          entityData: obj,
        });
      }
    }

    for (const kr of myKeyResults) {
      if (kr.status === "completed" || kr.status === "cancelled") continue;
      const days = daysSinceCheckIn((kr as any).lastCheckInAt);
      if (days === null || days >= 7) {
        items.push({
          id: kr.id,
          title: kr.title,
          type: "key_result",
          daysSince: days,
          progress: kr.progress ?? 0,
          status: kr.status ?? "not_started",
          paceStatus: calculatePaceStatus(kr.progress ?? 0, quarter, year),
          entityData: kr,
        });
      }
    }

    for (const br of myBigRocks) {
      if (br.status === "completed" || br.status === "cancelled") continue;
      const days = daysSinceCheckIn(br.lastCheckInAt);
      if (days === null || days >= 7) {
        const bigRockProgress = br.completionPercentage ?? br.progress ?? 0;
        items.push({
          id: br.id,
          title: br.title,
          type: "big_rock",
          daysSince: days,
          progress: bigRockProgress,
          status: br.status ?? "not_started",
          paceStatus: calculatePaceStatus(
            bigRockProgress,
            quarter,
            year,
          ),
          entityData: br,
        });
      }
    }

    return items.sort((a, b) => {
      // Urgency tiers: at_risk → behind → stalled (≥21 days, any pace) → no_data → on_track/ahead
      const isStalled = (item: CheckInQueueItem) =>
        item.daysSince === null || item.daysSince >= 21;

      const urgencyTier = (item: CheckInQueueItem): number => {
        if (item.paceStatus === "at_risk") return 0;
        if (item.paceStatus === "behind") return 1;
        if (isStalled(item)) return 2;
        if (item.paceStatus === "no_data") return 3;
        return 4; // on_track / ahead
      };

      const tA = urgencyTier(a);
      const tB = urgencyTier(b);
      if (tA !== tB) return tA - tB;

      // Within tier: stalest first (null = never → treated as most stale)
      const aD = a.daysSince ?? 9999;
      const bD = b.daysSince ?? 9999;
      return bD - aD;
    });
  }, [myObjectives, myKeyResults, myBigRocks, quarter, year]);

  // At-risk items I own
  const atRiskItems = useMemo(() => {
    return [
      ...myObjectives.filter((o) => calculatePaceStatus(o.progress ?? 0, quarter, year) === "at_risk"),
      ...myKeyResults.filter((kr) => calculatePaceStatus(kr.progress ?? 0, quarter, year) === "at_risk"),
    ];
  }, [myObjectives, myKeyResults, quarter, year]);

  // Tasks due this week from big rock task endpoints (which include dueDate, status, assigneeId)
  const tasksDueThisWeek = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const allTasks = bigRockTaskResults.flatMap((r) => r.data ?? []);
    return allTasks.filter((task) => {
      if (task.status === "completed") return false;
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return !isBefore(due, weekStart) && !isAfter(due, weekEnd);
    });
  }, [bigRockTaskResults, today, weekEnd]);

  // Upcoming meetings in the next 48 hours
  const upcomingMeetings = useMemo(() => {
    const cutoff = addDays(today, 2);
    return meetings
      .filter((m) => {
        if (!m.date) return false;
        const d = new Date(m.date);
        return isAfter(d, today) && isBefore(d, cutoff);
      })
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
      .slice(0, 5);
  }, [meetings, today]);

  // Serial check-in queue state
  const [checkInQueue, setCheckInQueue] = useState<CheckInQueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Build a map of bigRockId → tasks for the serial dialog
  const bigRockTasksMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    bigRockTaskResults.forEach((result, i) => {
      const br = bigRocks[i];
      if (br && result.data) {
        map[br.id] = result.data;
      }
    });
    return map;
  }, [bigRockTaskResults, bigRocks]);

  const startCheckInQueue = () => {
    // Freeze the sorted overdue list into a queue at session start
    setCheckInQueue([...overdueCheckIns]);
    setCurrentQueueIndex(0);
    setIsQueueOpen(true);
  };

  const handleQueueAdvance = () => {
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex >= checkInQueue.length) {
      setIsQueueOpen(false);
    } else {
      setCurrentQueueIndex(nextIndex);
    }
  };

  const handleQueuePrev = () => {
    setCurrentQueueIndex((i) => Math.max(0, i - 1));
  };

  const handleQueueClose = () => {
    setIsQueueOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAnything =
    overdueCheckIns.length > 0 ||
    atRiskItems.length > 0 ||
    tasksDueThisWeek.length > 0 ||
    upcomingMeetings.length > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          My Focus
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(today, "EEEE, MMMM d")} — what needs your attention today
        </p>
      </div>

      {!hasAnything && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">You're all caught up!</p>
            <p className="text-muted-foreground mt-1">No overdue check-ins, upcoming meetings, or at-risk items.</p>
          </CardContent>
        </Card>
      )}

      {/* Overdue Check-Ins */}
      {overdueCheckIns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Overdue Check-ins
                <Badge variant="outline" className="ml-1">{overdueCheckIns.length}</Badge>
              </CardTitle>
              <Button
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={startCheckInQueue}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Start Check-Ins ({overdueCheckIns.length})
              </Button>
            </div>
            <CardDescription>Items you own that haven't been checked in on recently</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueCheckIns.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-2">
                <div className="flex-shrink-0">
                  {item.type === "objective" ? (
                    <Target className="h-4 w-4 text-muted-foreground" />
                  ) : item.type === "big_rock" ? (
                    <Mountain className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={item.progress} className="h-1.5 w-24" />
                    <span className="text-xs text-muted-foreground">{Math.round(item.progress)}%</span>
                    <Badge variant={getPaceBadgeVariant(item.paceStatus)} className="text-[10px] h-4 px-1">
                      {getPaceLabel(item.paceStatus)}
                    </Badge>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {item.daysSince === null ? (
                    <span className="text-xs text-muted-foreground">Never checked in</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{item.daysSince}d ago</span>
                  )}
                </div>
                <Link href="/planning">
                  <Button variant="ghost" size="sm" className="h-7 px-2 flex-shrink-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* At Risk Items */}
      {atRiskItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              At-Risk Items I Own
              <Badge variant="destructive" className="ml-1">{atRiskItems.length}</Badge>
            </CardTitle>
            <CardDescription>These are significantly behind expected pace for the quarter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {atRiskItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2">
                <Target className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={item.progress ?? 0} className="h-1.5 w-24 [&>div]:bg-red-500" />
                    <span className="text-xs text-muted-foreground">{Math.round(item.progress ?? 0)}%</span>
                  </div>
                </div>
                <Link href="/planning">
                  <Button variant="ghost" size="sm" className="h-7 px-2 flex-shrink-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tasks Due This Week */}
      {tasksDueThisWeek.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Big Rock Tasks Due This Week
              <Badge variant="outline" className="ml-1">{tasksDueThisWeek.length}</Badge>
            </CardTitle>
            <CardDescription>
              Tasks from initiatives due by {format(weekEnd, "MMMM d")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksDueThisWeek.map((task, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.bigRockTitle} · Due {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "TBD"}
                  </p>
                </div>
                <Link href={`/planning?bigRockId=${task.bigRockId}`}>
                  <Button variant="ghost" size="sm" className="h-7 px-2 flex-shrink-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Upcoming Meetings
            </CardTitle>
            <CardDescription>Meetings in the next 48 hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center gap-3 py-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.date ? format(new Date(meeting.date), "EEEE, MMM d 'at' h:mm a") : "Date TBD"}
                  </p>
                </div>
                <Link href={`/focus-rhythm/${meeting.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 px-2 flex-shrink-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Link href="/planning">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            All Objectives
          </Button>
        </Link>
        <Link href="/focus-rhythm">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            All Meetings
          </Button>
        </Link>
        <Link href="/executive">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Executive View
          </Button>
        </Link>
      </div>

      {/* Serial Check-In Dialog */}
      {isQueueOpen && checkInQueue.length > 0 && (
        <SerialCheckInDialog
          open={isQueueOpen}
          queue={checkInQueue}
          currentIndex={currentQueueIndex}
          bigRockTasksMap={bigRockTasksMap}
          onAdvance={handleQueueAdvance}
          onPrev={handleQueuePrev}
          onClose={handleQueueClose}
          tenantId={tenantId ?? ""}
          userId={user?.id}
          userEmail={user?.email}
          quarter={quarter}
          year={year}
        />
      )}
    </div>
  );
}
