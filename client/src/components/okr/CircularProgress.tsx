import { cn } from "@/lib/utils";

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
}

function getProgressColor(progress: number): string {
  if (progress >= 70) return "text-green-500";
  if (progress >= 40) return "text-yellow-500";
  return "text-red-500";
}

function getProgressStrokeColor(progress: number): string {
  if (progress >= 70) return "#22c55e";
  if (progress >= 40) return "#eab308";
  return "#ef4444";
}

export function CircularProgress({
  progress,
  size = 32,
  strokeWidth = 3,
  className,
  showPercentage = false,
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
          className={getProgressColor(progress)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke={getProgressStrokeColor(progress)}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      {showPercentage && (
        <span className={cn("absolute text-xs font-medium", getProgressColor(progress))}>
          {Math.round(normalizedProgress)}
        </span>
      )}
    </div>
  );
}
