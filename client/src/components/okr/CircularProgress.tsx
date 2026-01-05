import { cn } from "@/lib/utils";

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  // Optional: time-aware coloring based on period
  quarter?: number | null;
  year?: number | null;
}

// Calculate expected progress based on time elapsed in the period
function getExpectedProgress(quarter?: number | null, year?: number | null): number {
  const now = new Date();
  // Use Pacific Time for consistency
  const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const currentYear = pacificNow.getFullYear();
  const currentMonth = pacificNow.getMonth(); // 0-indexed
  const currentDay = pacificNow.getDate();
  
  if (!year) return 50; // Default if no period specified
  
  if (!quarter) {
    // Annual period: expected progress = months elapsed / 12
    if (currentYear > year) return 100; // Past year
    if (currentYear < year) return 0; // Future year
    // Current year: calculate based on current month/day
    const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    const dayOfYear = Math.floor((pacificNow.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.round((dayOfYear / daysInYear) * 100);
  } else {
    // Quarterly period
    const currentQuarter = Math.ceil((currentMonth + 1) / 3);
    
    if (currentYear > year || (currentYear === year && currentQuarter > quarter)) {
      return 100; // Past quarter
    }
    if (currentYear < year || (currentYear === year && currentQuarter < quarter)) {
      return 0; // Future quarter
    }
    
    // Current quarter: calculate based on days elapsed
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterStart = new Date(year, quarterStartMonth, 1);
    const quarterEnd = new Date(year, quarterStartMonth + 3, 0); // Last day of quarter
    const totalDays = Math.round((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.round((pacificNow.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.round((Math.max(0, Math.min(daysElapsed, totalDays)) / totalDays) * 100);
  }
}

// Time-aware progress color: compare actual progress to expected progress
function getProgressColor(progress: number, quarter?: number | null, year?: number | null): string {
  const expected = getExpectedProgress(quarter, year);
  const delta = progress - expected;
  
  // Ahead or on track (within 10% of expected)
  if (delta >= -10) return "text-green-500";
  // Slightly behind (10-25% behind expected)
  if (delta >= -25) return "text-yellow-500";
  // Significantly behind
  return "text-red-500";
}

function getProgressStrokeColor(progress: number, quarter?: number | null, year?: number | null): string {
  const expected = getExpectedProgress(quarter, year);
  const delta = progress - expected;
  
  if (delta >= -10) return "#22c55e"; // green
  if (delta >= -25) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export function CircularProgress({
  progress,
  size = 32,
  strokeWidth = 3,
  className,
  showPercentage = false,
  quarter,
  year,
}: CircularProgressProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          className="text-muted/30"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={getProgressColor(progress, quarter, year)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke={getProgressStrokeColor(progress, quarter, year)}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      {showPercentage && (
        <span className={cn("absolute text-xs font-medium", getProgressColor(progress, quarter, year))}>
          {Math.round(normalizedProgress)}
        </span>
      )}
    </div>
  );
}
