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

export type TrendDirection = 'accelerating' | 'steady' | 'decelerating' | 'insufficient_data';

export interface CompletionForecast {
  completionProbability: number;
  projectedEndValue: number;
  confidenceLow: number;
  confidenceMid: number;
  confidenceHigh: number;
  trend: TrendDirection;
  riskFlag: boolean;
  riskReasons: string[];
  velocity: number | null;
  recentVelocity: number | null;
  daysRemaining: number;
  percentageThrough: number;
}

export function calculateCompletionForecast(params: {
  progress: number;
  targetValue?: number;
  quarter?: number | null;
  year?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  checkIns?: CheckInData[];
}): CompletionForecast {
  const { progress, targetValue = 100, checkIns = [] } = params;
  const now = getPacificNow();

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (params.startDate) {
    startDate = typeof params.startDate === 'string' ? parseISO(params.startDate) : params.startDate;
    if (!isValid(startDate)) startDate = null;
  }
  if (params.endDate) {
    endDate = typeof params.endDate === 'string' ? parseISO(params.endDate) : params.endDate;
    if (!isValid(endDate)) endDate = null;
  }
  if ((!startDate || !endDate) && params.quarter) {
    const qd = getQuarterDates(params.year ?? null, params.quarter);
    startDate = startDate || qd.start;
    endDate = endDate || qd.end;
  }

  // For annual/unquartered objectives (quarter is null, 0, or absent), use full-year date range
  if ((!startDate || !endDate) && params.year) {
    const yr = params.year;
    startDate = startDate || new Date(yr, 0, 1);   // Jan 1
    endDate = endDate || new Date(yr, 11, 31, 23, 59, 59); // Dec 31
  }

  if (!startDate || !endDate) {
    return {
      completionProbability: progress >= targetValue ? 100 : 50,
      projectedEndValue: progress,
      confidenceLow: progress,
      confidenceMid: progress,
      confidenceHigh: progress,
      trend: 'insufficient_data',
      riskFlag: false,
      riskReasons: [],
      velocity: null,
      recentVelocity: null,
      daysRemaining: 0,
      percentageThrough: 0,
    };
  }

  const totalDays = Math.max(1, differenceInDays(endDate, startDate));
  const rawElapsed = differenceInDays(now, startDate);
  const elapsedDays = Math.max(0, Math.min(rawElapsed, totalDays));
  const isPeriodEnded = rawElapsed > totalDays;
  const daysRemaining = isPeriodEnded ? 0 : Math.max(0, differenceInDays(endDate, now));
  const percentageThrough = isPeriodEnded ? 100 : (elapsedDays / totalDays) * 100;

  const sorted = [...checkIns].sort((a, b) =>
    new Date(a.asOfDate).getTime() - new Date(b.asOfDate).getTime()
  );

  let overallVelocity: number | null = null;
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const daysBetween = differenceInDays(new Date(last.asOfDate), new Date(first.asOfDate));
    if (daysBetween > 0) {
      overallVelocity = (last.newProgress - first.previousProgress) / daysBetween;
    }
  } else if (elapsedDays > 0 && progress > 0) {
    overallVelocity = progress / elapsedDays;
  }

  let recentVelocity: number | null = null;
  if (sorted.length >= 3) {
    const midpoint = Math.floor(sorted.length / 2);
    const recentHalf = sorted.slice(midpoint);
    if (recentHalf.length >= 2) {
      const rFirst = recentHalf[0];
      const rLast = recentHalf[recentHalf.length - 1];
      const rDays = differenceInDays(new Date(rLast.asOfDate), new Date(rFirst.asOfDate));
      if (rDays > 0) {
        recentVelocity = (rLast.newProgress - rFirst.previousProgress) / rDays;
      }
    }
  }

  let trend: TrendDirection = 'insufficient_data';
  if (overallVelocity !== null && recentVelocity !== null && overallVelocity > 0) {
    const ratio = recentVelocity / overallVelocity;
    if (ratio > 1.25) trend = 'accelerating';
    else if (ratio < 0.75) trend = 'decelerating';
    else trend = 'steady';
  } else if (overallVelocity !== null) {
    trend = 'steady';
  }

  const effectiveVelocity = recentVelocity !== null && recentVelocity > 0
    ? recentVelocity
    : overallVelocity;

  let projectedEndValue: number;
  if (isPeriodEnded) {
    projectedEndValue = progress;
  } else if (effectiveVelocity !== null && effectiveVelocity > 0) {
    projectedEndValue = progress + effectiveVelocity * daysRemaining;
  } else if (percentageThrough > 0) {
    projectedEndValue = (progress / percentageThrough) * 100;
  } else {
    projectedEndValue = progress;
  }
  projectedEndValue = Math.min(projectedEndValue, 200);

  let completionProbability: number;
  if (isPeriodEnded) {
    completionProbability = progress >= targetValue ? 100 : Math.round((progress / targetValue) * 100);
  } else {
    completionProbability = Math.min(100, Math.round((projectedEndValue / targetValue) * 100));
  }

  const varianceFactor = sorted.length >= 3 ? 0.15 : sorted.length >= 2 ? 0.25 : 0.4;
  const confidenceMid = Math.round(projectedEndValue * 10) / 10;
  const confidenceLow = Math.max(0, Math.round((projectedEndValue * (1 - varianceFactor)) * 10) / 10);
  const confidenceHigh = Math.min(200, Math.round((projectedEndValue * (1 + varianceFactor)) * 10) / 10);

  const riskReasons: string[] = [];
  if (completionProbability < 50) riskReasons.push('Low completion probability');
  if (trend === 'decelerating') riskReasons.push('Decelerating velocity');
  if (elapsedDays >= 30 && progress === 0) riskReasons.push('No progress after 30+ days');
  if (sorted.length > 0) {
    const lastCheckIn = sorted[sorted.length - 1];
    const daysSince = differenceInDays(now, new Date(lastCheckIn.asOfDate));
    if (daysSince >= 14) riskReasons.push(`No check-in for ${daysSince} days`);
  } else if (elapsedDays > 14) {
    riskReasons.push('No check-ins recorded');
  }

  const riskFlag = completionProbability < 50 || riskReasons.length >= 2;

  return {
    completionProbability,
    projectedEndValue: Math.round(confidenceMid * 10) / 10,
    confidenceLow,
    confidenceMid,
    confidenceHigh,
    trend,
    riskFlag,
    riskReasons,
    velocity: overallVelocity !== null ? Math.round(overallVelocity * 100) / 100 : null,
    recentVelocity: recentVelocity !== null ? Math.round(recentVelocity * 100) / 100 : null,
    daysRemaining,
    percentageThrough: Math.round(percentageThrough * 10) / 10,
  };
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
