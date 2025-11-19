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
