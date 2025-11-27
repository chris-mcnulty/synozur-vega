import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Calendar, Target, GripVertical } from "lucide-react";
import { format, parseISO, isValid, isBefore, isAfter } from "date-fns";

export interface Milestone {
  targetValue: number;
  targetDate: string;
}

export interface PhasedTargets {
  interval: 'monthly' | 'quarterly' | 'custom';
  targets: Milestone[];
}

interface MilestoneEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phasedTargets?: PhasedTargets | null;
  onSave: (phasedTargets: PhasedTargets | null) => void;
  metricType?: 'increase' | 'decrease' | 'maintain' | 'complete';
  targetValue?: number;
  initialValue?: number;
  unit?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  isLoading?: boolean;
}

function validateMilestones(
  milestones: Milestone[],
  metricType?: string,
  startDate?: Date | string,
  endDate?: Date | string
): string[] {
  const errors: string[] = [];
  
  if (milestones.length === 0) {
    return errors;
  }

  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  // Check date order
  for (let i = 0; i < sortedMilestones.length - 1; i++) {
    const current = sortedMilestones[i];
    const next = sortedMilestones[i + 1];
    if (current.targetDate === next.targetDate) {
      errors.push(`Duplicate date: ${format(parseISO(current.targetDate), "MMM d, yyyy")}`);
    }
  }

  // Check value progression based on metric type
  if (metricType === 'increase') {
    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      if (sortedMilestones[i].targetValue > sortedMilestones[i + 1].targetValue) {
        errors.push("For 'increase' metrics, milestone values should increase over time");
        break;
      }
    }
  } else if (metricType === 'decrease') {
    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      if (sortedMilestones[i].targetValue < sortedMilestones[i + 1].targetValue) {
        errors.push("For 'decrease' metrics, milestone values should decrease over time");
        break;
      }
    }
  }

  // Check dates are within range
  if (startDate) {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    for (const m of sortedMilestones) {
      const mDate = parseISO(m.targetDate);
      if (isValid(start) && isValid(mDate) && isBefore(mDate, start)) {
        errors.push(`Milestone date ${format(mDate, "MMM d, yyyy")} is before start date`);
      }
    }
  }

  if (endDate) {
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    for (const m of sortedMilestones) {
      const mDate = parseISO(m.targetDate);
      if (isValid(end) && isValid(mDate) && isAfter(mDate, end)) {
        errors.push(`Milestone date ${format(mDate, "MMM d, yyyy")} is after end date`);
      }
    }
  }

  return errors;
}

export function MilestoneEditor({
  open,
  onOpenChange,
  phasedTargets,
  onSave,
  metricType = 'increase',
  targetValue = 100,
  initialValue = 0,
  unit,
  startDate,
  endDate,
  isLoading = false,
}: MilestoneEditorProps) {
  const [interval, setInterval] = useState<'monthly' | 'quarterly' | 'custom'>(
    phasedTargets?.interval || 'custom'
  );
  const [milestones, setMilestones] = useState<Milestone[]>(
    phasedTargets?.targets || []
  );
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddMilestone = () => {
    const lastDate = milestones.length > 0 
      ? parseISO(milestones[milestones.length - 1].targetDate)
      : startDate 
        ? (typeof startDate === 'string' ? parseISO(startDate) : startDate)
        : new Date();
    
    const newDate = new Date(lastDate);
    if (interval === 'monthly') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (interval === 'quarterly') {
      newDate.setMonth(newDate.getMonth() + 3);
    } else {
      newDate.setDate(newDate.getDate() + 30);
    }

    // Calculate suggested value based on metric type and progression
    let suggestedValue = targetValue;
    if (milestones.length > 0) {
      const lastValue = milestones[milestones.length - 1].targetValue;
      const step = (targetValue - initialValue) / (milestones.length + 2);
      if (metricType === 'increase') {
        suggestedValue = Math.min(lastValue + step, targetValue);
      } else if (metricType === 'decrease') {
        suggestedValue = Math.max(lastValue - step, targetValue);
      } else {
        suggestedValue = targetValue;
      }
    } else {
      // First milestone - start at 1/3 of the way
      suggestedValue = initialValue + (targetValue - initialValue) / 3;
    }

    setMilestones([
      ...milestones,
      {
        targetDate: format(newDate, "yyyy-MM-dd"),
        targetValue: Math.round(suggestedValue * 100) / 100,
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleUpdateMilestone = (index: number, field: 'targetValue' | 'targetDate', value: string | number) => {
    const updated = [...milestones];
    if (field === 'targetValue') {
      updated[index] = { ...updated[index], targetValue: Number(value) };
    } else {
      updated[index] = { ...updated[index], targetDate: String(value) };
    }
    setMilestones(updated);
  };

  const handleClearAll = () => {
    setMilestones([]);
    setErrors([]);
  };

  const handleSave = () => {
    if (milestones.length === 0) {
      onSave(null);
      onOpenChange(false);
      return;
    }

    const validationErrors = validateMilestones(milestones, metricType, startDate, endDate);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Sort milestones by date before saving
    const sortedMilestones = [...milestones].sort((a, b) => 
      new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
    );

    onSave({
      interval,
      targets: sortedMilestones,
    });
    onOpenChange(false);
  };

  const formatUnitDisplay = (value: number) => {
    if (unit === '%' || unit === 'percent') return `${value}%`;
    if (unit === '$' || unit === 'USD') return `$${value.toLocaleString()}`;
    if (unit) return `${value.toLocaleString()} ${unit}`;
    return value.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Set Milestones
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Interval selector */}
          <div className="flex items-center gap-4">
            <Label htmlFor="interval" className="whitespace-nowrap">Interval:</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as any)}>
              <SelectTrigger id="interval" className="w-40" data-testid="select-milestone-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target context */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Target: <strong className="text-foreground">{formatUnitDisplay(targetValue)}</strong>
            </span>
            <span>
              Start: <strong className="text-foreground">{formatUnitDisplay(initialValue)}</strong>
            </span>
            <span>
              Metric: <strong className="text-foreground capitalize">{metricType}</strong>
            </span>
          </div>

          {/* Milestones list */}
          <div className="space-y-2">
            {milestones.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No milestones set</p>
                  <p className="text-xs">Add milestones to track progress over time</p>
                </CardContent>
              </Card>
            ) : (
              milestones.map((milestone, index) => (
                <Card key={index} className="group">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-move" />
                      
                      <div className="flex items-center gap-2 flex-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={milestone.targetDate}
                          onChange={(e) => handleUpdateMilestone(index, 'targetDate', e.target.value)}
                          className="w-40"
                          data-testid={`input-milestone-date-${index}`}
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-1">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={milestone.targetValue}
                          onChange={(e) => handleUpdateMilestone(index, 'targetValue', e.target.value)}
                          className="w-32"
                          step="any"
                          data-testid={`input-milestone-value-${index}`}
                        />
                        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMilestone(index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-milestone-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Add milestone button */}
          <Button
            variant="outline"
            onClick={handleAddMilestone}
            className="w-full"
            data-testid="button-add-milestone"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Milestone
          </Button>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm font-medium text-destructive mb-1">Please fix the following:</p>
              <ul className="text-sm text-destructive list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {milestones.length > 0 && (
            <Button variant="outline" onClick={handleClearAll} data-testid="button-clear-milestones">
              Clear All
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-milestones">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} data-testid="button-save-milestones">
            {isLoading ? "Saving..." : "Save Milestones"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MilestoneEditor;
