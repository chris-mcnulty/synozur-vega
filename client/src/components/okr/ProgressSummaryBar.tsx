import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressSummaryBarProps {
  objectives: {
    id: string;
    progress: number;
    status: string;
    keyResults?: { progress: number; status: string }[];
    childObjectives?: { progress: number; status: string }[];
  }[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

interface ProgressStats {
  total: number;
  atRisk: number;
  behind: number;
  onTrack: number;
  completed: number;
  notStarted: number;
  averageProgress: number;
}

function calculateStats(objectives: ProgressSummaryBarProps['objectives']): ProgressStats {
  if (!objectives || objectives.length === 0) {
    return { total: 0, atRisk: 0, behind: 0, onTrack: 0, completed: 0, notStarted: 0, averageProgress: 0 };
  }

  let atRisk = 0;
  let behind = 0;
  let onTrack = 0;
  let completed = 0;
  let notStarted = 0;
  let totalProgress = 0;

  objectives.forEach(obj => {
    const status = obj.status?.toLowerCase();
    if (status === "at_risk" || status === "at risk") atRisk++;
    else if (status === "behind") behind++;
    else if (status === "on_track" || status === "on track") onTrack++;
    else if (status === "completed") completed++;
    else notStarted++;

    totalProgress += Math.min(obj.progress || 0, 100);
  });

  return {
    total: objectives.length,
    atRisk,
    behind,
    onTrack,
    completed,
    notStarted,
    averageProgress: objectives.length > 0 ? Math.round(totalProgress / objectives.length) : 0,
  };
}

export function ProgressSummaryBar({ objectives, isExpanded = true, onToggle }: ProgressSummaryBarProps) {
  const stats = useMemo(() => calculateStats(objectives), [objectives]);
  
  if (stats.total === 0) return null;

  const atRiskWidth = (stats.atRisk / stats.total) * 100;
  const behindWidth = (stats.behind / stats.total) * 100;
  const onTrackWidth = (stats.onTrack / stats.total) * 100;
  const completedWidth = (stats.completed / stats.total) * 100;
  const notStartedWidth = (stats.notStarted / stats.total) * 100;

  return (
    <div className="flex items-center gap-4 p-3 bg-card rounded-lg border" data-testid="progress-summary-bar">
      {onToggle && (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-summary-toggle"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Summary</span>
        </button>
      )}
      
      {!onToggle && (
        <span className="text-sm font-medium text-muted-foreground">Summary</span>
      )}

      <div className="flex-1 h-4 bg-muted/50 rounded-full overflow-hidden flex">
        {completedWidth > 0 && (
          <div 
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${completedWidth}%` }}
            title={`Completed: ${stats.completed}`}
          />
        )}
        {onTrackWidth > 0 && (
          <div 
            className="h-full bg-green-500 transition-all"
            style={{ width: `${onTrackWidth}%` }}
            title={`On Track: ${stats.onTrack}`}
          />
        )}
        {behindWidth > 0 && (
          <div 
            className="h-full bg-yellow-500 transition-all"
            style={{ width: `${behindWidth}%` }}
            title={`Behind: ${stats.behind}`}
          />
        )}
        {atRiskWidth > 0 && (
          <div 
            className="h-full bg-red-500 transition-all"
            style={{ width: `${atRiskWidth}%` }}
            title={`At Risk: ${stats.atRisk}`}
          />
        )}
        {notStartedWidth > 0 && (
          <div 
            className="h-full bg-gray-400 transition-all"
            style={{ width: `${notStartedWidth}%` }}
            title={`Not Started: ${stats.notStarted}`}
          />
        )}
      </div>

      <div className="flex items-center gap-3 text-xs" data-testid="summary-stats">
        <span className="font-bold text-lg" data-testid="text-summary-progress">
          {stats.averageProgress}%
        </span>
        <div className="flex items-center gap-3 text-muted-foreground">
          {stats.completed > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{stats.completed}</span>
            </div>
          )}
          {stats.onTrack > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>{stats.onTrack}</span>
            </div>
          )}
          {stats.behind > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>{stats.behind}</span>
            </div>
          )}
          {stats.atRisk > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>{stats.atRisk}</span>
            </div>
          )}
          {stats.notStarted > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>{stats.notStarted}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
