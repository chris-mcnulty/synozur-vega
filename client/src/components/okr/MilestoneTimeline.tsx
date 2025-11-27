import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  AlertTriangle,
  Clock
} from "lucide-react";
import { format, parseISO, isValid, isBefore, isAfter, differenceInDays } from "date-fns";

export interface Milestone {
  targetValue: number;
  targetDate: string;
}

export interface PhasedTargets {
  interval: 'monthly' | 'quarterly' | 'custom';
  targets: Milestone[];
}

interface MilestoneTimelineProps {
  phasedTargets?: PhasedTargets | null;
  currentValue?: number;
  targetValue?: number;
  initialValue?: number;
  unit?: string;
  metricType?: 'increase' | 'decrease' | 'maintain' | 'complete';
  startDate?: Date | string;
  endDate?: Date | string;
  className?: string;
  compact?: boolean;
}

type PaceStatus = 'ahead' | 'on_pace' | 'behind' | 'completed' | 'not_started';

function calculatePaceStatus(
  milestones: Milestone[],
  currentValue: number,
  metricType: string
): { status: PaceStatus; expectedValue: number; nextMilestone?: Milestone; percentComplete: number } {
  if (milestones.length === 0) {
    return { status: 'not_started', expectedValue: 0, percentComplete: 0 };
  }

  const now = new Date();
  const sortedMilestones = [...milestones].sort(
    (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  // Find the most recent past milestone and next upcoming milestone
  let lastPastMilestone: Milestone | undefined;
  let nextMilestone: Milestone | undefined;

  for (const m of sortedMilestones) {
    const mDate = parseISO(m.targetDate);
    if (isValid(mDate)) {
      if (isBefore(mDate, now) || mDate.toDateString() === now.toDateString()) {
        lastPastMilestone = m;
      } else if (!nextMilestone) {
        nextMilestone = m;
      }
    }
  }

  // If all milestones are in the future, we're at the start
  if (!lastPastMilestone) {
    const firstMilestone = sortedMilestones[0];
    return {
      status: 'not_started',
      expectedValue: 0,
      nextMilestone: firstMilestone,
      percentComplete: 0,
    };
  }

  // If all milestones are in the past, check if we hit the last target
  if (!nextMilestone) {
    const lastTarget = sortedMilestones[sortedMilestones.length - 1].targetValue;
    const isComplete = metricType === 'increase' 
      ? currentValue >= lastTarget
      : metricType === 'decrease'
        ? currentValue <= lastTarget
        : Math.abs(currentValue - lastTarget) < 0.01;
    
    return {
      status: isComplete ? 'completed' : 'behind',
      expectedValue: lastTarget,
      percentComplete: 100,
    };
  }

  // Calculate expected value based on interpolation between milestones
  const lastDate = parseISO(lastPastMilestone.targetDate);
  const nextDate = parseISO(nextMilestone.targetDate);
  const totalDays = differenceInDays(nextDate, lastDate);
  const elapsedDays = differenceInDays(now, lastDate);
  
  const progressBetweenMilestones = totalDays > 0 ? elapsedDays / totalDays : 0;
  const expectedValue = lastPastMilestone.targetValue + 
    (nextMilestone.targetValue - lastPastMilestone.targetValue) * progressBetweenMilestones;

  // Calculate overall percent complete through milestones
  const passedCount = sortedMilestones.filter(m => {
    const d = parseISO(m.targetDate);
    return isValid(d) && isBefore(d, now);
  }).length;
  const percentComplete = ((passedCount + progressBetweenMilestones) / sortedMilestones.length) * 100;

  // Determine pace
  let status: PaceStatus;
  if (metricType === 'increase') {
    if (currentValue >= expectedValue * 1.05) status = 'ahead';
    else if (currentValue >= expectedValue * 0.95) status = 'on_pace';
    else status = 'behind';
  } else if (metricType === 'decrease') {
    if (currentValue <= expectedValue * 0.95) status = 'ahead';
    else if (currentValue <= expectedValue * 1.05) status = 'on_pace';
    else status = 'behind';
  } else {
    // maintain
    if (Math.abs(currentValue - expectedValue) < expectedValue * 0.05) status = 'on_pace';
    else status = 'behind';
  }

  return {
    status,
    expectedValue: Math.round(expectedValue * 100) / 100,
    nextMilestone,
    percentComplete: Math.round(percentComplete),
  };
}

function getPaceIcon(status: PaceStatus) {
  switch (status) {
    case 'ahead':
      return <TrendingUp className="h-4 w-4" />;
    case 'on_pace':
      return <Minus className="h-4 w-4" />;
    case 'behind':
      return <TrendingDown className="h-4 w-4" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'not_started':
      return <Clock className="h-4 w-4" />;
  }
}

function getPaceBadgeVariant(status: PaceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'ahead':
    case 'completed':
      return 'default';
    case 'on_pace':
      return 'secondary';
    case 'behind':
      return 'destructive';
    case 'not_started':
      return 'outline';
  }
}

function getPaceLabel(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
      return 'Ahead of Pace';
    case 'on_pace':
      return 'On Pace';
    case 'behind':
      return 'Behind Pace';
    case 'completed':
      return 'Completed';
    case 'not_started':
      return 'Not Started';
  }
}

export function MilestoneTimeline({
  phasedTargets,
  currentValue = 0,
  targetValue = 100,
  initialValue = 0,
  unit,
  metricType = 'increase',
  startDate,
  endDate,
  className = '',
  compact = false,
}: MilestoneTimelineProps) {
  const milestones = phasedTargets?.targets || [];

  const paceInfo = useMemo(() => 
    calculatePaceStatus(milestones, currentValue, metricType),
    [milestones, currentValue, metricType]
  );

  const formatValue = (value: number) => {
    if (unit === '%' || unit === 'percent') return `${value}%`;
    if (unit === '$' || unit === 'USD') return `$${value.toLocaleString()}`;
    if (unit) return `${value.toLocaleString()} ${unit}`;
    return value.toLocaleString();
  };

  const sortedMilestones = useMemo(() => 
    [...milestones].sort((a, b) => 
      new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
    ),
    [milestones]
  );

  if (milestones.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant={getPaceBadgeVariant(paceInfo.status)} className="gap-1">
          {getPaceIcon(paceInfo.status)}
          {getPaceLabel(paceInfo.status)}
        </Badge>
        {paceInfo.nextMilestone && (
          <span className="text-xs text-muted-foreground">
            Next: {formatValue(paceInfo.nextMilestone.targetValue)} by {format(parseISO(paceInfo.nextMilestone.targetDate), "MMM d")}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Milestones
          </CardTitle>
          <Badge variant={getPaceBadgeVariant(paceInfo.status)} className="gap-1">
            {getPaceIcon(paceInfo.status)}
            {getPaceLabel(paceInfo.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress through milestones */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Milestone Progress</span>
            <span>{paceInfo.percentComplete}%</span>
          </div>
          <Progress value={paceInfo.percentComplete} className="h-2" />
        </div>

        {/* Current vs Expected */}
        {paceInfo.status !== 'not_started' && paceInfo.status !== 'completed' && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Current</span>
              <p className="font-medium">{formatValue(currentValue)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Expected</span>
              <p className="font-medium">{formatValue(paceInfo.expectedValue)}</p>
            </div>
          </div>
        )}

        {/* Visual timeline */}
        <div className="relative pt-2">
          <div className="absolute left-4 top-6 bottom-2 w-0.5 bg-border" />
          
          {sortedMilestones.map((milestone, index) => {
            const mDate = parseISO(milestone.targetDate);
            const isPast = isValid(mDate) && isBefore(mDate, new Date());
            const isAchieved = metricType === 'increase'
              ? currentValue >= milestone.targetValue
              : metricType === 'decrease'
                ? currentValue <= milestone.targetValue
                : Math.abs(currentValue - milestone.targetValue) < 0.01;
            
            return (
              <div key={index} className="relative flex items-start gap-4 pb-4" data-testid={`milestone-item-${index}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isAchieved 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : isPast
                          ? 'bg-destructive/10 border-destructive text-destructive'
                          : 'bg-background border-muted-foreground/30 text-muted-foreground'
                    }`}>
                      {isAchieved ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isPast ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Target className="h-4 w-4" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAchieved ? 'Achieved' : isPast ? 'Missed' : 'Upcoming'}
                  </TooltipContent>
                </Tooltip>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${
                      isAchieved ? 'text-primary' : isPast ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {formatValue(milestone.targetValue)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(mDate, "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next milestone info */}
        {paceInfo.nextMilestone && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Next Milestone
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{formatValue(paceInfo.nextMilestone.targetValue)}</span>
              <span className="text-muted-foreground">
                {format(parseISO(paceInfo.nextMilestone.targetDate), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MilestoneTimeline;
