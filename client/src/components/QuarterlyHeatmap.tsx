import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface HeatmapSnapshot {
  id: string;
  title: string;
  quarter: number | null;
  year: number | null;
  overallProgress: number | null;
  objectivesCompleted: number | null;
  objectivesTotal: number | null;
  keyResultsCompleted: number | null;
  keyResultsTotal: number | null;
  reviewType: string;
  snapshotDate: string;
}

interface QuarterlyHeatmapProps {
  snapshots: HeatmapSnapshot[];
  isLoading?: boolean;
}

function getProgressColor(progress: number | null): string {
  if (progress === null) return "bg-muted/40 text-muted-foreground";
  if (progress >= 90) return "bg-green-500 text-white";
  if (progress >= 75) return "bg-green-400 text-white";
  if (progress >= 60) return "bg-amber-400 text-white";
  if (progress >= 40) return "bg-amber-500 text-white";
  if (progress >= 20) return "bg-red-400 text-white";
  return "bg-red-600 text-white";
}

function getProgressLabel(progress: number | null): string {
  if (progress === null) return "—";
  return `${Math.round(progress)}%`;
}

function getTrendIcon(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff > 5) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (diff < -5) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function generatePeriodColumns(snapshots: HeatmapSnapshot[]): string[] {
  const periodsSet = new Set<string>();
  for (const s of snapshots) {
    if (s.quarter && s.year) {
      periodsSet.add(`Q${s.quarter} ${s.year}`);
    } else if (s.year) {
      periodsSet.add(`FY ${s.year}`);
    }
  }
  return Array.from(periodsSet).sort((a, b) => {
    // Parse and sort chronologically
    const parseKey = (k: string) => {
      if (k.startsWith("Q")) {
        const [q, y] = k.split(" ");
        return parseInt(y) * 10 + parseInt(q.replace("Q", ""));
      }
      return parseInt(k.replace("FY ", "")) * 10;
    };
    return parseKey(a) - parseKey(b);
  });
}

interface RowData {
  label: string;
  cells: Record<string, number | null>;
}

function buildRows(snapshots: HeatmapSnapshot[]): RowData[] {
  // Group snapshots by reviewType and period
  const reviewTypeMap: Record<string, Record<string, number | null>> = {};

  for (const s of snapshots) {
    const periodKey = s.quarter && s.year
      ? `Q${s.quarter} ${s.year}`
      : s.year
      ? `FY ${s.year}`
      : null;
    if (!periodKey) continue;

    const rowKey = s.reviewType
      ? s.reviewType.charAt(0).toUpperCase() + s.reviewType.slice(1)
      : "Snapshot";

    if (!reviewTypeMap[rowKey]) {
      reviewTypeMap[rowKey] = {};
    }
    // If multiple snapshots for same period+reviewType, take latest (highest progress or most recent)
    const existing = reviewTypeMap[rowKey][periodKey];
    if (existing === undefined || existing === null || (s.overallProgress !== null && s.overallProgress > existing)) {
      reviewTypeMap[rowKey][periodKey] = s.overallProgress;
    }
  }

  return Object.entries(reviewTypeMap).map(([label, cells]) => ({ label, cells }));
}

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-muted-foreground">Progress:</span>
      {[
        { label: "≥90%", color: "bg-green-500" },
        { label: "75–89%", color: "bg-green-400" },
        { label: "60–74%", color: "bg-amber-400" },
        { label: "40–59%", color: "bg-amber-500" },
        { label: "20–39%", color: "bg-red-400" },
        { label: "<20%", color: "bg-red-600" },
        { label: "No data", color: "bg-muted border border-border" },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <div className={cn("h-3 w-3 rounded-sm flex-shrink-0", item.color)} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function QuarterlyHeatmap({ snapshots, isLoading }: QuarterlyHeatmapProps) {
  const periods = useMemo(() => generatePeriodColumns(snapshots), [snapshots]);
  const rows = useMemo(() => buildRows(snapshots), [snapshots]);

  // Show rolling 6 periods max
  const visiblePeriods = periods.slice(-6);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No snapshots yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create quarterly snapshots to see performance trends over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Overall summary row using all snapshots per period
  const summaryByPeriod: Record<string, { total: number; count: number }> = {};
  for (const s of snapshots) {
    const periodKey = s.quarter && s.year
      ? `Q${s.quarter} ${s.year}`
      : s.year
      ? `FY ${s.year}`
      : null;
    if (!periodKey || s.overallProgress === null) continue;
    if (!summaryByPeriod[periodKey]) summaryByPeriod[periodKey] = { total: 0, count: 0 };
    summaryByPeriod[periodKey].total += s.overallProgress;
    summaryByPeriod[periodKey].count += 1;
  }

  const summaryRow: RowData = {
    label: "Overall Avg",
    cells: Object.fromEntries(
      Object.entries(summaryByPeriod).map(([p, { total, count }]) => [p, Math.round(total / count)])
    ),
  };

  const allRows = rows.length > 0 ? [summaryRow, ...rows] : [summaryRow];

  return (
    <div className="space-y-4">
      <Legend />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36 border-b">
                Review Type
              </th>
              {visiblePeriods.map((period, idx) => (
                <th
                  key={period}
                  className="text-center px-3 py-3 font-medium border-b min-w-[80px]"
                >
                  <span className="text-xs">{period}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, rowIdx) => (
              <tr key={row.label} className={cn(rowIdx === 0 && rows.length > 0 ? "border-b-2 border-border font-medium" : "")}>
                <td className="px-4 py-2.5 text-sm text-muted-foreground border-b border-muted/50 whitespace-nowrap">
                  {row.label}
                </td>
                {visiblePeriods.map((period, colIdx) => {
                  const val = row.cells[period] ?? null;
                  const prevPeriod = colIdx > 0 ? visiblePeriods[colIdx - 1] : null;
                  const prevVal = prevPeriod ? (row.cells[prevPeriod] ?? null) : null;

                  return (
                    <td key={period} className="px-2 py-2 border-b border-muted/50 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "mx-auto rounded-md py-1.5 px-2 flex items-center justify-center gap-1 cursor-default transition-transform hover:scale-105 min-w-[56px]",
                              getProgressColor(val)
                            )}
                          >
                            <span className="text-xs font-semibold tabular-nums">
                              {getProgressLabel(val)}
                            </span>
                            {getTrendIcon(val, prevVal)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs space-y-1">
                            <p className="font-medium">{row.label} — {period}</p>
                            <p>Overall progress: {getProgressLabel(val)}</p>
                            {prevVal !== null && val !== null && (
                              <p className={cn(val - prevVal >= 0 ? "text-green-400" : "text-red-400")}>
                                {val - prevVal >= 0 ? "+" : ""}{Math.round(val - prevVal)}% vs prior period
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Period trend summary */}
      {visiblePeriods.length >= 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visiblePeriods.slice(-4).map((period, idx, arr) => {
            const progress = summaryRow.cells[period] ?? null;
            const prevProgress = idx > 0 ? summaryRow.cells[arr[idx - 1]] ?? null : null;
            const delta = progress !== null && prevProgress !== null ? progress - prevProgress : null;
            return (
              <Card key={period} className="overflow-hidden">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{period}</p>
                  <p className={cn(
                    "text-xl font-bold mt-0.5",
                    progress !== null && progress >= 75 ? "text-green-600 dark:text-green-400" :
                    progress !== null && progress >= 50 ? "text-amber-600 dark:text-amber-400" :
                    progress !== null ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                  )}>
                    {progress !== null ? `${Math.round(progress)}%` : "—"}
                  </p>
                  {delta !== null && (
                    <p className={cn("text-xs mt-0.5", delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                      {delta >= 0 ? "+" : ""}{Math.round(delta)}% vs prior
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
