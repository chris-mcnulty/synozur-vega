/**
 * Get the current fiscal quarter based on today's date
 * Assumes fiscal year starts in January (month 1)
 */
export function getCurrentQuarter(): { quarter: number; year: number } {
  const today = new Date();
  const month = today.getMonth() + 1; // getMonth() returns 0-11
  const year = today.getFullYear();
  
  // Calculate quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
  const quarter = Math.ceil(month / 3);
  
  return { quarter, year };
}

/**
 * Generate quarters for a given year
 */
export function generateQuarters(year: number) {
  return [
    { id: `q1-${year}`, label: `Q1 ${year}`, year, quarter: 1, startDate: "Jan 1", endDate: "Mar 31" },
    { id: `q2-${year}`, label: `Q2 ${year}`, year, quarter: 2, startDate: "Apr 1", endDate: "Jun 30" },
    { id: `q3-${year}`, label: `Q3 ${year}`, year, quarter: 3, startDate: "Jul 1", endDate: "Sep 30" },
    { id: `q4-${year}`, label: `Q4 ${year}`, year, quarter: 4, startDate: "Oct 1", endDate: "Dec 31" },
  ];
}

/**
 * Get how far through a quarter we are (0-100%)
 */
export function getQuarterElapsedPercent(quarter: number, year: number): number {
  // Use Pacific Time
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  // Quarter start/end dates
  const quarterDates: Record<number, { start: Date; end: Date }> = {
    1: { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59) },
    2: { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59) },
    3: { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59) },
    4: { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59) },
  };
  
  const { start, end } = quarterDates[quarter] || quarterDates[1];
  const totalDuration = end.getTime() - start.getTime();
  const elapsed = pacificTime.getTime() - start.getTime();
  
  // Clamp between 0-100
  return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
}

/**
 * Get how far through the year we are (0-100%)
 */
export function getYearElapsedPercent(year: number): number {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  
  const totalDuration = yearEnd.getTime() - yearStart.getTime();
  const elapsed = pacificTime.getTime() - yearStart.getTime();
  
  return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
}

/**
 * Assess progress status relative to time elapsed
 * Returns 'ahead' | 'on_track' | 'behind' | 'at_risk'
 */
export function assessRelativeProgress(
  actualProgress: number,
  expectedProgress: number
): 'ahead' | 'on_track' | 'behind' | 'at_risk' {
  // Give some buffer - within 15% of expected is "on track"
  const ratio = expectedProgress > 0 ? actualProgress / expectedProgress : (actualProgress > 0 ? 2 : 1);
  
  if (ratio >= 1.1) return 'ahead';
  if (ratio >= 0.75) return 'on_track';
  if (ratio >= 0.5) return 'behind';
  return 'at_risk';
}

/**
 * Get a color class based on relative progress (comparing actual to expected)
 */
export function getRelativeProgressColor(
  actualProgress: number,
  expectedProgress: number
): string {
  const status = assessRelativeProgress(actualProgress, expectedProgress);
  switch (status) {
    case 'ahead': return 'bg-green-500';
    case 'on_track': return 'bg-green-500';
    case 'behind': return 'bg-yellow-500';
    case 'at_risk': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}
