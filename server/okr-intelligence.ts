import { differenceInDays, endOfQuarter, parseISO, isValid } from 'date-fns';

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
  isPeriodEnded: boolean;
}

export interface CheckInData {
  asOfDate: Date;
  newProgress: number;
  previousProgress: number;
}

function getPacificNow(): Date {
  return new Date();
}

function getQuarterDates(year: number | null, quarter: number): { start: Date; end: Date } {
  const effectiveYear = year ?? new Date().getFullYear();
  const quarterStartMonth = (quarter - 1) * 3;
  const start = new Date(effectiveYear, quarterStartMonth, 1);
  const end = endOfQuarter(start);
  return { start, end };
}

export function calculatePaceMetrics(params: {
  progress: number;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  quarter?: number | null;
  year?: number | null;
  checkIns?: CheckInData[];
  targetValue?: number;
}): PaceMetrics {
  const { progress, checkIns = [], targetValue = 100 } = params;
  const now = getPacificNow();
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  
  if (params.startDate) {
    startDate = typeof params.startDate === 'string' 
      ? parseISO(params.startDate) 
      : params.startDate;
    if (!isValid(startDate)) startDate = null;
  }
  
  if (params.endDate) {
    endDate = typeof params.endDate === 'string' 
      ? parseISO(params.endDate) 
      : params.endDate;
    if (!isValid(endDate)) endDate = null;
  }
  
  if ((!startDate || !endDate) && params.quarter) {
    const quarterDates = getQuarterDates(params.year ?? null, params.quarter);
    startDate = startDate || quarterDates.start;
    endDate = endDate || quarterDates.end;
  }
  
  let daysSinceLastCheckIn: number | null = null;
  if (checkIns.length > 0) {
    const sortedCheckIns = [...checkIns].sort((a, b) => 
      new Date(b.asOfDate).getTime() - new Date(a.asOfDate).getTime()
    );
    daysSinceLastCheckIn = differenceInDays(now, new Date(sortedCheckIns[0].asOfDate));
  }
  
  let riskSignal: RiskSignal = 'none';
  if (daysSinceLastCheckIn !== null && daysSinceLastCheckIn >= 14) {
    riskSignal = 'attention_needed';
  }
  
  if (!startDate || !endDate) {
    let status: PaceStatus = 'no_data';
    if (progress > 0 || checkIns.length > 0) {
      status = progress >= targetValue ? 'ahead' : 'on_track';
    }
    
    if (progress === 0 && checkIns.length === 0) {
      riskSignal = 'stalled';
    }
    
    return {
      status,
      expectedProgress: 0,
      actualProgress: progress,
      gap: 0,
      percentageThrough: 0,
      projectedEndProgress: progress,
      velocity: null,
      riskSignal,
      daysSinceLastCheckIn,
      checkInCount: checkIns.length,
      isPeriodEnded: false,
    };
  }
  
  const totalDays = Math.max(1, differenceInDays(endDate, startDate));
  const rawElapsedDays = differenceInDays(now, startDate);
  const elapsedDays = Math.max(0, Math.min(rawElapsedDays, totalDays));
  const isPeriodEnded = rawElapsedDays > totalDays;
  
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;
  const expectedProgress = (percentageThrough / 100) * targetValue;
  const gap = progress - expectedProgress;
  
  let velocity: number | null = null;
  if (checkIns.length >= 2) {
    const sortedCheckIns = [...checkIns].sort((a, b) => 
      new Date(a.asOfDate).getTime() - new Date(b.asOfDate).getTime()
    );
    
    const firstCheckIn = sortedCheckIns[0];
    const lastCheckIn = sortedCheckIns[sortedCheckIns.length - 1];
    
    const daysBetween = differenceInDays(
      new Date(lastCheckIn.asOfDate), 
      new Date(firstCheckIn.asOfDate)
    );
    
    if (daysBetween > 0) {
      const progressChange = lastCheckIn.newProgress - firstCheckIn.previousProgress;
      velocity = progressChange / daysBetween;
    }
  } else if (elapsedDays > 0 && progress > 0) {
    velocity = progress / elapsedDays;
  }
  
  let projectedEndProgress = progress;
  if (!isPeriodEnded) {
    if (velocity !== null && velocity > 0) {
      const remainingDays = Math.max(0, differenceInDays(endDate, now));
      projectedEndProgress = progress + (velocity * remainingDays);
    } else if (percentageThrough > 0) {
      projectedEndProgress = (progress / percentageThrough) * 100;
    }
  } else {
    projectedEndProgress = progress;
  }
  
  if (riskSignal === 'none') {
    if (elapsedDays >= 30 && progress === 0) {
      riskSignal = 'stalled';
    } else if (velocity !== null && velocity > (targetValue / totalDays) * 1.5) {
      riskSignal = 'accelerating';
    }
  }
  
  let status: PaceStatus;
  const gapThreshold = targetValue * 0.1;
  
  if (isPeriodEnded) {
    if (progress >= targetValue) {
      status = 'completed';
    } else if (progress >= targetValue * 0.9) {
      status = 'on_track';
    } else if (progress >= targetValue * 0.7) {
      status = 'behind';
    } else {
      status = 'at_risk';
    }
  } else if (checkIns.length === 0 && progress === 0 && elapsedDays < 14) {
    status = 'no_data';
  } else if (gap >= gapThreshold) {
    status = 'ahead';
  } else if (gap <= -gapThreshold * 2) {
    status = 'at_risk';
  } else if (gap <= -gapThreshold) {
    status = 'behind';
  } else {
    status = 'on_track';
  }
  
  return {
    status,
    expectedProgress: Math.round(expectedProgress * 10) / 10,
    actualProgress: progress,
    gap: Math.round(gap * 10) / 10,
    percentageThrough: Math.round(percentageThrough * 10) / 10,
    projectedEndProgress: Math.min(Math.round(projectedEndProgress * 10) / 10, 200),
    velocity: velocity !== null ? Math.round(velocity * 100) / 100 : null,
    riskSignal,
    daysSinceLastCheckIn,
    checkInCount: checkIns.length,
    isPeriodEnded,
  };
}

export function formatPaceDescription(metrics: PaceMetrics): string {
  if (metrics.status === 'no_data') {
    return 'No progress data yet';
  }
  
  const statusLabels: Record<PaceStatus, string> = {
    ahead: 'Ahead of pace',
    on_track: 'On track',
    behind: 'Behind pace',
    at_risk: 'At risk',
    no_data: 'No data',
    completed: 'Period ended',
  };
  
  let description = statusLabels[metrics.status];
  
  if (metrics.isPeriodEnded) {
    description = `${metrics.actualProgress.toFixed(0)}% achieved`;
  } else if (metrics.velocity !== null && metrics.velocity > 0) {
    description += ` • Projected: ${Math.round(metrics.projectedEndProgress)}%`;
  }
  
  if (metrics.riskSignal === 'stalled') {
    description += ' • Stalled';
  } else if (metrics.riskSignal === 'attention_needed') {
    description += ` • No check-in for ${metrics.daysSinceLastCheckIn} days`;
  }
  
  return description;
}

export function getPaceStatusColor(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'on_track':
      return 'text-blue-600 dark:text-blue-400';
    case 'behind':
      return 'text-amber-600 dark:text-amber-400';
    case 'at_risk':
      return 'text-red-600 dark:text-red-400';
    case 'no_data':
    default:
      return 'text-muted-foreground';
  }
}

export function getPaceStatusBadgeVariant(status: PaceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ahead':
    case 'on_track':
    case 'completed':
      return 'default';
    case 'behind':
      return 'secondary';
    case 'at_risk':
      return 'destructive';
    case 'no_data':
    default:
      return 'outline';
  }
}
