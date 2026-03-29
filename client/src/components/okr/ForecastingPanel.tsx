import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { cn } from "@/lib/utils";
import type { CheckIn } from "@shared/schema";

interface ForecastingPanelProps {
  entity: {
    id: string;
    title: string;
    progress: number;
    quarter?: number;
    year?: number;
    startDate?: Date | string;
    endDate?: Date | string;
    targetValue?: number;
    currentValue?: number;
    initialValue?: number;
    unit?: string;
    metricType?: string;
  };
  checkIns: CheckIn[];
}

type PaceStatus = "ahead" | "on_track" | "behind" | "at_risk" | "no_data" | "completed";

interface PaceResult {
  status: PaceStatus;
  expectedProgress: number;
  actualProgress: number;
  gap: number;
  percentageThrough: number;
  projectedEndProgress: number;
  velocity: number | null;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  requiredVelocityToHitTarget: number | null;
  weeklyCheckInsNeeded: number | null;
}

function getPeriodDates(quarter?: number, year?: number, startDate?: Date | string, endDate?: Date | string) {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate) };
  }
  if (quarter && year) {
    const quarterStartMonth = (quarter - 1) * 3;
    return {
      start: new Date(year, quarterStartMonth, 1),
      end: new Date(year, quarterStartMonth + 3, 0),
    };
  }
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const yr = now.getFullYear();
  const qStartMonth = (q - 1) * 3;
  return {
    start: new Date(yr, qStartMonth, 1),
    end: new Date(yr, qStartMonth + 3, 0),
  };
}

function computeForecast(progress: number, checkIns: CheckIn[], quarter?: number, year?: number, startDate?: Date | string, endDate?: Date | string): PaceResult {
  const now = new Date();
  const { start, end } = getPeriodDates(quarter, year, startDate, endDate);

  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const rawElapsedDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, Math.min(rawElapsedDays, totalDays));
  const daysRemaining = Math.max(0, totalDays - elapsedDays);
  const isPeriodEnded = rawElapsedDays > totalDays;
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;
  const expectedProgress = percentageThrough;
  const gap = progress - expectedProgress;

  // Velocity: progress per day based on recent check-ins
  let velocity: number | null = null;
  const sortedCheckIns = [...checkIns]
    .filter((ci) => ci.createdAt)
    .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

  if (sortedCheckIns.length >= 2) {
    const earliest = sortedCheckIns[0];
    const latest = sortedCheckIns[sortedCheckIns.length - 1];
    const daySpan = Math.max(
      1,
      Math.floor((new Date(latest.createdAt!).getTime() - new Date(earliest.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
    );
    const progressSpan = (latest.newProgress ?? 0) - (earliest.newProgress ?? 0);
    velocity = progressSpan / daySpan;
  }

  // Projected end progress
  let projectedEndProgress = progress;
  if (!isPeriodEnded) {
    if (velocity !== null && daysRemaining > 0) {
      projectedEndProgress = Math.min(progress + velocity * daysRemaining, 200);
    } else if (percentageThrough > 0) {
      projectedEndProgress = Math.min((progress / percentageThrough) * 100, 200);
    }
  }

  // Required velocity to hit 100% by end
  let requiredVelocityToHitTarget: number | null = null;
  let weeklyCheckInsNeeded: number | null = null;
  if (!isPeriodEnded && daysRemaining > 0) {
    const progressNeeded = Math.max(0, 100 - progress);
    requiredVelocityToHitTarget = progressNeeded / daysRemaining;
    weeklyCheckInsNeeded = requiredVelocityToHitTarget * 7;
  }

  let status: PaceStatus;
  if (isPeriodEnded) {
    if (progress >= 100) status = "completed";
    else if (progress >= 70) status = "on_track";
    else status = "behind";
  } else if (progress === 0 && elapsedDays < 14) {
    status = "no_data";
  } else if (gap >= 10) {
    status = "ahead";
  } else if (gap <= -20) {
    status = "at_risk";
  } else if (gap <= -10) {
    status = "behind";
  } else {
    status = "on_track";
  }

  return {
    status,
    expectedProgress,
    actualProgress: progress,
    gap,
    percentageThrough,
    projectedEndProgress,
    velocity,
    daysRemaining,
    daysElapsed: elapsedDays,
    totalDays,
    requiredVelocityToHitTarget,
    weeklyCheckInsNeeded,
  };
}

function buildProjectionChartData(
  checkIns: CheckIn[],
  projectedEndProgress: number,
  velocity: number | null,
  start: Date,
  end: Date,
  daysElapsed: number,
  daysRemaining: number
) {
  // Historical check-in points
  const historical = checkIns
    .filter((ci) => ci.createdAt && ci.newProgress != null)
    .map((ci) => ({
      day: Math.max(0, Math.floor((new Date(ci.createdAt!).getTime() - start.getTime()) / (1000 * 60 * 60 * 24))),
      actual: ci.newProgress ?? 0,
      projected: undefined as number | undefined,
      expected: undefined as number | undefined,
    }))
    .sort((a, b) => a.day - b.day);

  // Generate expected progress line points at intervals
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const interval = Math.max(1, Math.floor(totalDays / 8));
  const points: { day: number; actual?: number; projected?: number; expected: number }[] = [];

  for (let d = 0; d <= totalDays; d += interval) {
    const expectedPct = (d / totalDays) * 100;
    points.push({ day: d, expected: Math.round(expectedPct) });
  }
  // Ensure end point
  if (points[points.length - 1]?.day !== totalDays) {
    points.push({ day: totalDays, expected: 100 });
  }

  // Add current point as projected start
  const currentProgress = checkIns.length > 0
    ? Math.max(...checkIns.map((ci) => ci.newProgress ?? 0))
    : 0;

  points.push({ day: daysElapsed, projected: currentProgress, expected: Math.round((daysElapsed / totalDays) * 100) });
  points.push({ day: totalDays, projected: Math.round(Math.min(projectedEndProgress, 100)), expected: 100 });

  // Merge historical actual data into points
  const dayMap = new Map(points.map((p) => [p.day, p]));
  for (const h of historical) {
    const existing = dayMap.get(h.day);
    if (existing) {
      existing.actual = h.actual;
    } else {
      dayMap.set(h.day, { day: h.day, actual: h.actual, expected: Math.round((h.day / totalDays) * 100) });
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
}

function StatusIcon({ status }: { status: PaceStatus }) {
  switch (status) {
    case "ahead": return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "on_track": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "behind": return <TrendingDown className="h-4 w-4 text-amber-500" />;
    case "at_risk": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusLabel(status: PaceStatus): string {
  switch (status) {
    case "ahead": return "Ahead of pace";
    case "on_track": return "On track";
    case "behind": return "Behind pace";
    case "at_risk": return "At risk";
    case "no_data": return "Not enough data yet";
    case "completed": return "Completed";
  }
}

function statusBadgeVariant(status: PaceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ahead": return "default";
    case "on_track": return "secondary";
    case "behind": return "outline";
    case "at_risk": return "destructive";
    default: return "outline";
  }
}

export function ForecastingPanel({ entity, checkIns }: ForecastingPanelProps) {
  const forecast = useMemo(
    () =>
      computeForecast(
        entity.progress,
        checkIns,
        entity.quarter,
        entity.year,
        entity.startDate,
        entity.endDate
      ),
    [entity, checkIns]
  );

  const { start, end } = getPeriodDates(entity.quarter, entity.year, entity.startDate, entity.endDate);

  const chartData = useMemo(
    () =>
      buildProjectionChartData(
        checkIns,
        forecast.projectedEndProgress,
        forecast.velocity,
        start,
        end,
        forecast.daysElapsed,
        forecast.daysRemaining
      ),
    [checkIns, forecast, start, end]
  );

  const projectedPct = Math.round(Math.min(forecast.projectedEndProgress, 100));
  const weeklyVelocity = forecast.velocity !== null ? Math.round(forecast.velocity * 7 * 10) / 10 : null;
  const requiredWeekly = forecast.weeklyCheckInsNeeded !== null ? Math.round(forecast.weeklyCheckInsNeeded * 10) / 10 : null;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Projected End</p>
            <div className="flex items-end gap-1.5">
              <span className={cn("text-2xl font-bold", projectedPct >= 90 ? "text-green-600 dark:text-green-400" : projectedPct >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
                {projectedPct}%
              </span>
            </div>
            <Progress value={projectedPct} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Pace Status</p>
            <div className="flex items-center gap-1.5 mt-1">
              <StatusIcon status={forecast.status} />
              <Badge variant={statusBadgeVariant(forecast.status)} className="text-xs">
                {statusLabel(forecast.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {forecast.daysRemaining > 0
                ? `${forecast.daysRemaining} days remaining`
                : "Period ended"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Weekly Velocity</p>
            <p className="text-2xl font-bold">
              {weeklyVelocity !== null ? `+${weeklyVelocity}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {weeklyVelocity !== null ? "avg progress per week" : "Not enough check-ins"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trajectory chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Progress Trajectory</CardTitle>
          <CardDescription className="text-xs">Actual progress vs expected pace and projected outcome</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `D${v}`}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${Math.round(value)}%`, name]}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Expected"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
                  name="Actual"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name="Projected"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-muted-foreground opacity-60" style={{ backgroundImage: "repeating-linear-gradient(to right, currentColor 0, currentColor 4px, transparent 4px, transparent 8px)" }} /><span className="text-xs text-muted-foreground">Expected</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-primary" /><span className="text-xs text-muted-foreground">Actual</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-primary opacity-50" style={{ backgroundImage: "repeating-linear-gradient(to right, currentColor 0, currentColor 5px, transparent 5px, transparent 8px)" }} /><span className="text-xs text-muted-foreground">Projected</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            What Would It Take?
          </CardTitle>
          <CardDescription className="text-xs">Scenarios to reach your target by end of period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Scenario: at current pace */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-sm">At current pace</span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={projectedPct} className="w-24 h-2" />
              <span className={cn("text-sm font-medium w-10 text-right", projectedPct >= 90 ? "text-green-600 dark:text-green-400" : projectedPct >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
                {projectedPct}%
              </span>
            </div>
          </div>

          {/* Scenario: required to hit 100% */}
          {requiredWeekly !== null && forecast.daysRemaining > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm">
                  To reach 100%{" "}
                  <span className="text-xs text-muted-foreground">
                    (+{requiredWeekly}%/wk needed)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={100} className="w-24 h-2" />
                <span className="text-sm font-medium w-10 text-right text-green-600 dark:text-green-400">100%</span>
              </div>
            </div>
          )}

          {/* Already on track */}
          {forecast.status === "completed" || projectedPct >= 100 ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mt-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">You're projected to hit your target — keep it up!</span>
            </div>
          ) : forecast.daysRemaining === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <Info className="h-4 w-4" />
              <span className="text-sm">Period has ended.</span>
            </div>
          ) : requiredWeekly !== null && weeklyVelocity !== null && requiredWeekly > weeklyVelocity ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2.5 mt-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                You need <strong>+{requiredWeekly}% per week</strong> to hit 100% — your current pace is{" "}
                {weeklyVelocity !== null ? `+${weeklyVelocity}%/week` : "unknown"}.{" "}
                {requiredWeekly <= weeklyVelocity * 1.5
                  ? "A modest increase in effort could close the gap."
                  : "This will require a significant acceleration."}
              </p>
            </div>
          ) : null}

          {/* Context */}
          <Separator />
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{Math.round(forecast.percentageThrough)}%</span> through period
            </div>
            <div>
              <span className="font-medium text-foreground">{forecast.daysRemaining}</span> days left
            </div>
            <div>
              <span className="font-medium text-foreground">{Math.round(forecast.expectedProgress)}%</span> expected progress
            </div>
            <div>
              <span className="font-medium text-foreground">{Math.round(forecast.actualProgress)}%</span> actual progress
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
