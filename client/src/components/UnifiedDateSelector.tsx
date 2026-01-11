/**
 * UnifiedDateSelector - Reusable date period selector component
 * 
 * Supports week, month, quarter, and year selection with consistent styling
 * and optional multi-range mode for comparisons.
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDays, CalendarRange, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PeriodType,
  type DatePeriod,
  generateWeeks,
  generateMonths,
  generateAllQuarters,
  generateYears,
  getCurrentPeriod,
} from "@/lib/datePeriods";

export interface UnifiedDateSelectorProps {
  value: DatePeriod | null;
  onChange: (period: DatePeriod | null) => void;
  allowedTypes?: PeriodType[];
  defaultType?: PeriodType;
  className?: string;
  showTypeSelector?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

export interface MultiDateSelectorProps {
  values: DatePeriod[];
  onChange: (periods: DatePeriod[]) => void;
  maxSelections?: number;
  allowedTypes?: PeriodType[];
  defaultType?: PeriodType;
  className?: string;
}

const TYPE_LABELS: Record<PeriodType, string> = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  year: "Annual",
};

const TYPE_ICONS: Record<PeriodType, typeof Calendar> = {
  week: CalendarDays,
  month: Calendar,
  quarter: CalendarRange,
  year: Calendar,
};

function getPeriodOptions(type: PeriodType): DatePeriod[] {
  switch (type) {
    case "week": return generateWeeks(12);
    case "month": return generateMonths(12);
    case "quarter": return generateAllQuarters(2);
    case "year": return generateYears(5);
  }
}

/**
 * Single date period selector
 */
export function UnifiedDateSelector({
  value,
  onChange,
  allowedTypes = ["week", "month", "quarter", "year"],
  defaultType = "quarter",
  className,
  showTypeSelector = true,
  compact = false,
  disabled = false,
}: UnifiedDateSelectorProps) {
  const [selectedType, setSelectedType] = useState<PeriodType>(
    value?.type || defaultType
  );
  
  const periods = useMemo(() => getPeriodOptions(selectedType), [selectedType]);
  
  const handleTypeChange = (newType: PeriodType) => {
    setSelectedType(newType);
    const newPeriod = getCurrentPeriod(newType);
    onChange(newPeriod);
  };
  
  const handlePeriodChange = (periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    if (period) {
      onChange(period);
    }
  };
  
  const Icon = TYPE_ICONS[selectedType];
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showTypeSelector && allowedTypes.length > 1 && (
        <Select
          value={selectedType}
          onValueChange={(v) => handleTypeChange(v as PeriodType)}
          disabled={disabled}
        >
          <SelectTrigger className={cn("w-[120px]", compact && "h-8")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedTypes.map((type) => (
              <SelectItem key={type} value={type} data-testid={`select-period-type-${type}`}>
                {TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      <Select
        value={value?.id || ""}
        onValueChange={handlePeriodChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn("min-w-[160px]", compact && "h-8")} data-testid="select-period-value">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder={`Select ${TYPE_LABELS[selectedType].toLowerCase()}`} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {periods.map((period) => (
            <SelectItem key={period.id} value={period.id} data-testid={`select-period-${period.id}`}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Multi-range date selector for comparison mode
 */
export function MultiDateSelector({
  values,
  onChange,
  maxSelections = 3,
  allowedTypes = ["week", "month", "quarter", "year"],
  defaultType = "quarter",
  className,
}: MultiDateSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addingType, setAddingType] = useState<PeriodType>(defaultType);
  
  const periods = useMemo(() => getPeriodOptions(addingType), [addingType]);
  
  const handleAddPeriod = (periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    if (period && !values.some(v => v.id === period.id)) {
      onChange([...values, period]);
    }
    setIsAdding(false);
  };
  
  const handleRemovePeriod = (periodId: string) => {
    onChange(values.filter(v => v.id !== periodId));
  };
  
  const canAddMore = values.length < maxSelections;
  
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {values.map((period) => (
        <Badge 
          key={period.id} 
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          <span>{period.shortLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => handleRemovePeriod(period.id)}
            data-testid={`remove-period-${period.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      
      {canAddMore && (
        <Popover open={isAdding} onOpenChange={setIsAdding}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className="h-7 px-2"
              data-testid="add-comparison-period"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Period
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Add comparison period</span>
              </div>
              
              <Select
                value={addingType}
                onValueChange={(v) => setAddingType(v as PeriodType)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select onValueChange={handleAddPeriod}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={`Select ${addingType}`} />
                </SelectTrigger>
                <SelectContent>
                  {periods
                    .filter(p => !values.some(v => v.id === p.id))
                    .map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default UnifiedDateSelector;
