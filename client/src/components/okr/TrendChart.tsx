import { format, differenceInDays } from "date-fns";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from "recharts";
import type { TooltipProps } from "recharts";

export type TrendPoint = {
  date: string;
  progress: number;
  confidence?: number | null;
  paceStatus?: string | null;
};

interface TrendChartProps {
  series: TrendPoint[];
  periodStart: Date;
  periodEnd: Date;
  fallbackProgress?: number;
  height?: number;
}

const PACE_COLORS: Record<string, string> = {
  ahead: "#10b981",
  on_track: "#22c55e",
  behind: "#f59e0b",
  at_risk: "#ef4444",
  completed: "#3b82f6",
  no_data: "#9ca3af",
};

const PACE_LABELS: Record<string, string> = {
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
  at_risk: "At risk",
  completed: "Completed",
  no_data: "No data",
};

// Parse a snapshot date in the user's local timezone. Snapshot dates come back
// as bare `YYYY-MM-DD` (Pacific calendar day); using `new Date(...)` would
// interpret that as UTC midnight and shift the label by a day for users in
// negative offsets. Anything else (e.g. an ISO timestamp from a check-in
// fallback) is parsed normally.
export function parseTrendDate(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(input);
}

// Renders the daily progress trend (snapshot-backed) for an objective or key
// result. Plots the actual progress line, an "expected" linear-pace reference
// line, and colored markers indicating the pace status captured for each day —
// so users can see when an OKR slipped from "on track" to "behind" historically.
export function TrendChart({
  series,
  periodStart,
  periodEnd,
  fallbackProgress = 0,
  height = 192,
}: TrendChartProps) {
  const totalPeriodDays = Math.max(1, differenceInDays(periodEnd, periodStart));
  const today = new Date();

  const getExpectedProgress = (date: Date): number => {
    const daysSinceStart = differenceInDays(date, periodStart);
    if (daysSinceStart <= 0) return 0;
    if (daysSinceStart >= totalPeriodDays) return 100;
    return Math.round((daysSinceStart / totalPeriodDays) * 100);
  };

  type ChartRow = {
    date: string;
    actual: number;
    expected: number;
    paceStatus: string | null;
  };

  const chartData: ChartRow[] = series.map((point) => {
    const pointDate = parseTrendDate(point.date);
    return {
      date: format(pointDate, "MMM d"),
      actual: point.progress,
      expected: getExpectedProgress(pointDate),
      paceStatus: point.paceStatus ?? null,
    };
  });

  if (chartData.length === 0) {
    chartData.push({
      date: format(periodStart, "MMM d"),
      actual: 0,
      expected: 0,
      paceStatus: null,
    });
    chartData.push({
      date: format(today, "MMM d"),
      actual: fallbackProgress,
      expected: getExpectedProgress(today),
      paceStatus: null,
    });
  } else {
    const firstPointDate = parseTrendDate(series[0].date);
    if (differenceInDays(firstPointDate, periodStart) > 7) {
      chartData.unshift({
        date: format(periodStart, "MMM d"),
        actual: 0,
        expected: 0,
        paceStatus: null,
      });
    }
    // Anchor a single-point series with a "today" point so a line is visible.
    if (chartData.length === 1) {
      chartData.push({
        date: format(today, "MMM d"),
        actual: chartData[0].actual,
        expected: getExpectedProgress(today),
        paceStatus: null,
      });
    }
  }

  // Group points by pace status for separate scatter layers (one color each)
  const paceLayers: Record<string, Array<{ date: string; pace: number }>> = {};
  for (const row of chartData) {
    if (!row.paceStatus) continue;
    if (!paceLayers[row.paceStatus]) paceLayers[row.paceStatus] = [];
    paceLayers[row.paceStatus].push({ date: row.date, pace: row.actual });
  }

  const presentPaceStatuses = Object.keys(paceLayers);

  return (
    <div className="space-y-2" data-testid="chart-trend">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
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
              labelStyle={{ fontSize: 12 }}
              content={({ active, payload, label }: TooltipProps<number, string>) => {
                if (!active || !payload || payload.length === 0) return null;
                const first = payload[0];
                const row = first.payload as ChartRow | undefined;
                if (!row) return null;
                return (
                  <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                    <div className="font-medium">{label}</div>
                    <div className="text-muted-foreground">
                      Actual: {Math.round(row.actual)}%
                    </div>
                    <div className="text-muted-foreground">
                      Expected: {Math.round(row.expected)}%
                    </div>
                    {row.paceStatus && (
                      <div
                        className="font-medium"
                        style={{ color: PACE_COLORS[row.paceStatus] ?? "inherit" }}
                      >
                        {PACE_LABELS[row.paceStatus] ?? row.paceStatus}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine y={100} stroke="#e5e7eb" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="#d1d5db"
              strokeDasharray="5 5"
              dot={false}
              name="Expected"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="Actual"
              isAnimationActive={false}
            />
            {presentPaceStatuses.map((status) => (
              <Scatter
                key={status}
                data={paceLayers[status].map((p) => ({
                  date: p.date,
                  actual: p.pace,
                }))}
                dataKey="actual"
                fill={PACE_COLORS[status] ?? "#9ca3af"}
                shape="circle"
                isAnimationActive={false}
                legendType="none"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {presentPaceStatuses.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
          data-testid="legend-pace-status"
        >
          <span>Pace:</span>
          {presentPaceStatuses.map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-1"
              data-testid={`legend-pace-${status}`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: PACE_COLORS[status] ?? "#9ca3af" }}
              />
              {PACE_LABELS[status] ?? status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
