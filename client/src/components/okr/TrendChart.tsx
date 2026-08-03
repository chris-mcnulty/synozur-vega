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
  /** True when this point comes from a live check-in injected after the last snapshot. */
  isLive?: boolean;
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

// Custom shape for the "live today" point — a ring with a filled centre so it
// stands out clearly from the historical pace dots.
function LiveDotShape(props: {
  cx?: number;
  cy?: number;
  payload?: { paceStatus?: string | null };
}) {
  const { cx = 0, cy = 0, payload } = props;
  const color = PACE_COLORS[payload?.paceStatus ?? "no_data"] ?? "#9ca3af";
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={3} fill={color} />
    </g>
  );
}

// Renders the daily progress trend (snapshot-backed) for an objective or key
// result. Plots the actual progress line, an "expected" linear-pace reference
// line, and colored markers indicating the pace status captured for each day —
// so users can see when an OKR slipped from "on track" to "behind" historically.
//
// The live today point (flagged isLive=true from the server) is shown as a
// distinct ring marker. The Line uses a null-gap strategy: live points get
// `lineActual=null` so recharts naturally creates a gap there rather than
// drawing a connecting segment to the live check-in value (which could spike).
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
    /** Raw progress value — always the real number (used by Scatter + Tooltip). */
    actual: number;
    /**
     * Progress value for the Line series. Set to `null` for live points so
     * recharts creates a natural gap instead of connecting the historical line
     * to the live check-in value (which avoids jarring spikes).
     */
    lineActual: number | null;
    expected: number;
    paceStatus: string | null;
    isLive?: boolean;
  };

  const chartData: ChartRow[] = series.map((point) => {
    const pointDate = parseTrendDate(point.date);
    return {
      date: format(pointDate, "MMM d"),
      actual: point.progress,
      lineActual: point.isLive ? null : point.progress,
      expected: getExpectedProgress(pointDate),
      paceStatus: point.paceStatus ?? null,
      isLive: point.isLive,
    };
  });

  if (chartData.length === 0) {
    chartData.push({
      date: format(periodStart, "MMM d"),
      actual: 0,
      lineActual: 0,
      expected: 0,
      paceStatus: null,
    });
    chartData.push({
      date: format(today, "MMM d"),
      actual: fallbackProgress,
      lineActual: fallbackProgress,
      expected: getExpectedProgress(today),
      paceStatus: null,
    });
  } else {
    const firstPointDate = parseTrendDate(series[0].date);
    if (differenceInDays(firstPointDate, periodStart) > 7) {
      chartData.unshift({
        date: format(periodStart, "MMM d"),
        actual: 0,
        lineActual: 0,
        expected: 0,
        paceStatus: null,
      });
    }
    // Anchor a single-point series with a "today" point so a line is visible.
    if (chartData.length === 1) {
      chartData.push({
        date: format(today, "MMM d"),
        actual: chartData[0].actual,
        lineActual: chartData[0].actual,
        expected: getExpectedProgress(today),
        paceStatus: null,
      });
    }
  }

  // Group historical (non-live) points by pace status for separate scatter layers.
  const paceLayers: Record<string, Array<{ date: string; pace: number }>> = {};
  for (const row of chartData) {
    if (!row.paceStatus || row.isLive) continue;
    if (!paceLayers[row.paceStatus]) paceLayers[row.paceStatus] = [];
    paceLayers[row.paceStatus].push({ date: row.date, pace: row.actual });
  }

  // Separate scatter layer for the live today point.
  const liveRows = chartData.filter((r) => r.isLive);

  const presentPaceStatuses = Object.keys(paceLayers);

  return (
    <div className="space-y-2" data-testid="chart-trend">
      <div style={{ height }} role="img" aria-label="Line chart: daily progress trend versus expected pace with pace-status markers">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart accessibilityLayer data={chartData}>
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
                    <div className="font-medium">
                      {label}
                      {row.isLive && (
                        <span className="ml-1 text-muted-foreground">(live)</span>
                      )}
                    </div>
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
            {/* Historical progress line: uses `lineActual` which is null for live
                points so recharts creates a natural gap rather than connecting
                the line to the live check-in value (avoids jarring spikes). */}
            <Line
              type="monotone"
              dataKey="lineActual"
              stroke="#9ca3af"
              strokeWidth={1.5}
              dot={false}
              name="Actual"
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Pace-status dots for historical snapshots (one Scatter layer per colour). */}
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
            {/* Live today point — distinct ring marker, not connected to the line. */}
            {liveRows.length > 0 && (
              <Scatter
                data={liveRows.map((r) => ({
                  date: r.date,
                  actual: r.actual,
                  paceStatus: r.paceStatus,
                }))}
                dataKey="actual"
                fill={PACE_COLORS[liveRows[0].paceStatus ?? "no_data"] ?? "#9ca3af"}
                shape={<LiveDotShape />}
                isAnimationActive={false}
                legendType="none"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {(presentPaceStatuses.length > 0 || liveRows.length > 0) && (
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
          {liveRows.length > 0 && (
            <span className="inline-flex items-center gap-1" data-testid="legend-pace-live">
              <span
                className="relative inline-flex h-3 w-3 items-center justify-center"
              >
                <span
                  className="absolute inline-block h-3 w-3 rounded-full opacity-20"
                  style={{ backgroundColor: PACE_COLORS[liveRows[0].paceStatus ?? "no_data"] ?? "#9ca3af" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PACE_COLORS[liveRows[0].paceStatus ?? "no_data"] ?? "#9ca3af" }}
                />
              </span>
              Live
            </span>
          )}
        </div>
      )}
    </div>
  );
}
