export function getCurrentQuarter(fiscalYearStartMonth: number = 1): { quarter: number; year: number } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Calculate months since fiscal year start
  let monthsSinceFiscalStart = currentMonth - fiscalYearStartMonth;
  if (monthsSinceFiscalStart < 0) {
    monthsSinceFiscalStart += 12;
  }

  // Determine quarter (1-4)
  const quarter = Math.floor(monthsSinceFiscalStart / 3) + 1;

  // Determine fiscal year
  const fiscalYear = currentMonth >= fiscalYearStartMonth ? currentYear : currentYear - 1;

  return { quarter, year: fiscalYear };
}

export function getQuarterLabel(quarter: number): string {
  return `Q${quarter}`;
}

export function getAllQuarters(): number[] {
  return [1, 2, 3, 4];
}

export function getQuarterDateRange(quarter: number, year: number, fiscalYearStartMonth: number = 1): { start: Date; end: Date } {
  // Calculate the start month of the quarter
  const quarterStartOffset = (quarter - 1) * 3;
  let startMonth = fiscalYearStartMonth + quarterStartOffset;
  let startYear = year;

  // Handle month overflow
  while (startMonth > 12) {
    startMonth -= 12;
    startYear++;
  }

  // Calculate end month (last month of the quarter)
  let endMonth = startMonth + 2;
  let endYear = startYear;
  
  while (endMonth > 12) {
    endMonth -= 12;
    endYear++;
  }

  // Get last day of end month
  const lastDay = new Date(endYear, endMonth, 0).getDate();

  const start = new Date(startYear, startMonth - 1, 1); // Month is 0-indexed
  const end = new Date(endYear, endMonth - 1, lastDay, 23, 59, 59);

  return { start, end };
}
