import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OKRFiltersProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  year: number;
}

const periods = [
  { value: "all", label: "All Periods" },
  { value: "0", label: "Annual" },
  { value: "1", label: "Q1" },
  { value: "2", label: "Q2" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
];

const statuses = [
  { value: "all", label: "All Statuses" },
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "behind", label: "Behind" },
];

function FilterBadge({
  label,
  isSelected,
  onClick,
  variant = "outline",
  testId,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  variant?: "outline" | "default";
  testId?: string;
}) {
  return (
    <Badge
      variant={isSelected ? "default" : variant}
      className={cn(
        "cursor-pointer toggle-elevate",
        isSelected && "toggle-elevated"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </Badge>
  );
}

export function OKRFilters({
  selectedPeriod,
  onPeriodChange,
  selectedStatus,
  onStatusChange,
  year,
}: OKRFiltersProps) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-card border rounded-md">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Time Period</label>
        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <FilterBadge
              key={period.value}
              label={period.label}
              isSelected={selectedPeriod === period.value}
              onClick={() => onPeriodChange(period.value)}
              testId={`filter-period-${period.value}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Status</label>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <FilterBadge
              key={status.value}
              label={status.label}
              isSelected={selectedStatus === status.value}
              onClick={() => onStatusChange(status.value)}
              testId={`filter-status-${status.value}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
