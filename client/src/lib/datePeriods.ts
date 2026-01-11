/**
 * Shared date period utilities for consistent date calculations across the app
 */

import { subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from "date-fns";

export type PeriodType = "week" | "month" | "quarter" | "year";

export interface DatePeriod {
  id: string;
  label: string;
  shortLabel: string;
  type: PeriodType;
  startDate: Date;
  endDate: Date;
}

/**
 * Generate the last N weeks for selection
 */
export function generateWeeks(count: number = 12): DatePeriod[] {
  const weeks: DatePeriod[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }); // Start on Monday
    const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    
    const label = i === 0 
      ? "This Week" 
      : i === 1 
        ? "Last Week" 
        : `Week of ${format(weekStart, "MMM d")}`;
    
    weeks.push({
      id: `week-${format(weekStart, "yyyy-MM-dd")}`,
      label,
      shortLabel: format(weekStart, "MMM d"),
      type: "week",
      startDate: weekStart,
      endDate: weekEnd,
    });
  }
  
  return weeks;
}

/**
 * Generate the last N months for selection
 */
export function generateMonths(count: number = 12): DatePeriod[] {
  const months: DatePeriod[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    
    const label = i === 0 
      ? "This Month" 
      : format(monthStart, "MMMM yyyy");
    
    months.push({
      id: `month-${format(monthStart, "yyyy-MM")}`,
      label,
      shortLabel: format(monthStart, "MMM yyyy"),
      type: "month",
      startDate: monthStart,
      endDate: monthEnd,
    });
  }
  
  return months;
}

/**
 * Generate quarters for selection (current year and previous years)
 */
export function generateAllQuarters(yearsBack: number = 2): DatePeriod[] {
  const quarters: DatePeriod[] = [];
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  
  for (let year = currentYear + 1; year >= currentYear - yearsBack; year--) {
    for (let q = 4; q >= 1; q--) {
      // Skip future quarters
      if (year > currentYear || (year === currentYear + 1 && q > 1)) {
        if (year > currentYear) continue;
      }
      
      const quarterStartMonth = (q - 1) * 3;
      const quarterStart = new Date(year, quarterStartMonth, 1);
      const quarterEnd = endOfQuarter(quarterStart);
      
      const isCurrent = year === currentYear && q === currentQuarter;
      const label = isCurrent ? `Q${q} ${year} (Current)` : `Q${q} ${year}`;
      
      quarters.push({
        id: `q${q}-${year}`,
        label,
        shortLabel: `Q${q} ${year}`,
        type: "quarter",
        startDate: quarterStart,
        endDate: quarterEnd,
      });
    }
  }
  
  // Sort by most recent first
  return quarters.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

/**
 * Generate years for selection
 */
export function generateYears(count: number = 5): DatePeriod[] {
  const years: DatePeriod[] = [];
  const currentYear = new Date().getFullYear();
  
  for (let i = 0; i <= count; i++) {
    const year = currentYear - i;
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));
    
    const label = i === 0 ? `${year} (Current)` : `${year}`;
    
    years.push({
      id: `year-${year}`,
      label,
      shortLabel: `${year}`,
      type: "year",
      startDate: yearStart,
      endDate: yearEnd,
    });
  }
  
  return years;
}

/**
 * Get current period of a given type
 */
export function getCurrentPeriod(type: PeriodType): DatePeriod {
  const now = new Date();
  
  switch (type) {
    case "week": {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      return {
        id: `week-${format(weekStart, "yyyy-MM-dd")}`,
        label: "This Week",
        shortLabel: format(weekStart, "MMM d"),
        type: "week",
        startDate: weekStart,
        endDate: weekEnd,
      };
    }
    case "month": {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      return {
        id: `month-${format(monthStart, "yyyy-MM")}`,
        label: "This Month",
        shortLabel: format(monthStart, "MMM yyyy"),
        type: "month",
        startDate: monthStart,
        endDate: monthEnd,
      };
    }
    case "quarter": {
      const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
      const year = now.getFullYear();
      const quarterStartMonth = (currentQuarter - 1) * 3;
      const quarterStart = new Date(year, quarterStartMonth, 1);
      const quarterEnd = endOfQuarter(quarterStart);
      return {
        id: `q${currentQuarter}-${year}`,
        label: `Q${currentQuarter} ${year} (Current)`,
        shortLabel: `Q${currentQuarter} ${year}`,
        type: "quarter",
        startDate: quarterStart,
        endDate: quarterEnd,
      };
    }
    case "year": {
      const year = now.getFullYear();
      const yearStart = startOfYear(now);
      const yearEnd = endOfYear(now);
      return {
        id: `year-${year}`,
        label: `${year} (Current)`,
        shortLabel: `${year}`,
        type: "year",
        startDate: yearStart,
        endDate: yearEnd,
      };
    }
  }
}

/**
 * Calculate date range from period
 */
export function getDateRangeFromPeriod(period: DatePeriod): { startDate: string; endDate: string } {
  return {
    startDate: format(period.startDate, "yyyy-MM-dd"),
    endDate: format(period.endDate, "yyyy-MM-dd"),
  };
}

/**
 * Get number of days in a period type (approximate for averaging)
 */
export function getPeriodDays(type: PeriodType): number {
  switch (type) {
    case "week": return 7;
    case "month": return 30;
    case "quarter": return 90;
    case "year": return 365;
  }
}
