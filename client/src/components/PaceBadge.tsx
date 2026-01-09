import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk' | 'no_data' | 'completed';
export type RiskSignal = 'stalled' | 'attention_needed' | 'accelerating' | 'none';

export interface PaceMetrics {
  status: PaceStatus;
  expectedProgress: number;
  actualProgress: number;
  gap: number;
  percentageThrough: number;
  projectedEndProgress: number;
  velocity: number | null;
  riskSignal: RiskSignal;
  daysSinceLastCheckIn: number | null;
  checkInCount: number;
  isPeriodEnded?: boolean;
}

interface PaceBadgeProps {
  metrics: PaceMetrics;
  description?: string;
  showProjection?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

const statusConfig: Record<PaceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof TrendingUp }> = {
  ahead: { 
    label: 'Ahead', 
    variant: 'default', 
    icon: TrendingUp,
  },
  on_track: { 
    label: 'On Track', 
    variant: 'secondary', 
    icon: Minus,
  },
  behind: { 
    label: 'Behind', 
    variant: 'secondary', 
    icon: TrendingDown,
  },
  at_risk: { 
    label: 'At Risk', 
    variant: 'destructive', 
    icon: AlertTriangle,
  },
  no_data: { 
    label: 'No Data', 
    variant: 'outline', 
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    variant: 'default',
    icon: CheckCircle,
  },
};

export function PaceBadge({ metrics, description, showProjection = false, size = 'default', className }: PaceBadgeProps) {
  const config = statusConfig[metrics.status];
  const Icon = config.icon;
  
  const tooltipContent = (
    <div className="space-y-1 text-xs" data-testid="pace-tooltip-content">
      <div className="font-medium" data-testid="pace-tooltip-title">{description || config.label}</div>
      <div className="text-muted-foreground" data-testid="pace-tooltip-period">
        {metrics.percentageThrough.toFixed(0)}% through period
      </div>
      <div className="text-muted-foreground" data-testid="pace-tooltip-progress">
        Expected: {metrics.expectedProgress.toFixed(0)}% | Actual: {metrics.actualProgress.toFixed(0)}%
      </div>
      {metrics.velocity !== null && (
        <div className="text-muted-foreground" data-testid="pace-tooltip-velocity">
          Velocity: {metrics.velocity.toFixed(2)}% per day
        </div>
      )}
      {showProjection && metrics.projectedEndProgress > 0 && (
        <div className="font-medium" data-testid="pace-tooltip-projection">
          Projected: {Math.min(metrics.projectedEndProgress, 200).toFixed(0)}%
        </div>
      )}
      {metrics.riskSignal === 'attention_needed' && (
        <div className="text-destructive" data-testid="pace-tooltip-attention">
          No check-in for {metrics.daysSinceLastCheckIn} days
        </div>
      )}
      {metrics.riskSignal === 'stalled' && (
        <div className="text-destructive" data-testid="pace-tooltip-stalled">Progress stalled</div>
      )}
    </div>
  );
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={config.variant}
          className={cn(
            size === 'sm' && 'text-xs py-0 px-1.5',
            className
          )}
          data-testid={`pace-badge-${metrics.status}`}
        >
          <Icon className="h-3 w-3 mr-1" />
          <span data-testid="pace-badge-label">{config.label}</span>
          {showProjection && metrics.projectedEndProgress > 0 && metrics.status !== 'no_data' && !metrics.isPeriodEnded && (
            <span className="ml-1 opacity-70" data-testid="pace-badge-projection">
              → {Math.min(metrics.projectedEndProgress, 200).toFixed(0)}%
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

interface PaceIndicatorProps {
  metrics: PaceMetrics;
  className?: string;
}

export function PaceIndicator({ metrics, className }: PaceIndicatorProps) {
  const config = statusConfig[metrics.status];
  const Icon = config.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn("flex items-center gap-1 text-muted-foreground", className)}
          data-testid={`pace-indicator-${metrics.status}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="text-xs" data-testid="pace-indicator-tooltip">
          <span className="font-medium" data-testid="pace-indicator-label">{config.label}</span>
          {metrics.velocity !== null && (
            <span className="text-muted-foreground ml-1" data-testid="pace-indicator-velocity">
              • {metrics.velocity > 0 ? '+' : ''}{metrics.velocity.toFixed(1)}%/day
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
