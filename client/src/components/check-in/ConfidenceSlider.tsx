import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ConfidenceSliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
  testIdPrefix?: string;
}

const STEPS = 10;

function bucketLabel(v: number): string {
  if (v <= 0.2) return "Very Low";
  if (v <= 0.4) return "Low";
  if (v <= 0.6) return "Medium";
  if (v <= 0.8) return "High";
  return "Very High";
}

function bucketVariant(v: number): "default" | "secondary" | "outline" | "destructive" {
  if (v <= 0.2) return "destructive";
  if (v <= 0.4) return "destructive";
  if (v <= 0.6) return "secondary";
  if (v <= 0.8) return "default";
  return "default";
}

export function ConfidenceSlider({ value, onChange, testIdPrefix = "confidence" }: ConfidenceSliderProps) {
  const intValue = value == null ? 5 : Math.round(value * STEPS);
  const isSet = value != null;
  const display = value == null ? null : Math.round(value * 10) / 10;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${testIdPrefix}-slider`}>
          Confidence
          {isSet && display != null ? (
            <span className="ml-2 text-sm text-muted-foreground" data-testid={`text-${testIdPrefix}-value`}>
              {display.toFixed(1)}
            </span>
          ) : (
            <span className="ml-2 text-sm text-muted-foreground">(not set)</span>
          )}
        </Label>
        <div className="flex items-center gap-2">
          {isSet && display != null && (
            <Badge variant={bucketVariant(display)} data-testid={`badge-${testIdPrefix}-bucket`}>
              {bucketLabel(display)}
            </Badge>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(isSet ? null : 0.5)}
            data-testid={`button-${testIdPrefix}-toggle`}
          >
            {isSet ? "Clear" : "Set"}
          </Button>
        </div>
      </div>
      {isSet && (
        <Slider
          id={`${testIdPrefix}-slider`}
          value={[intValue]}
          onValueChange={(v) => onChange(Math.max(0, Math.min(STEPS, v[0])) / STEPS)}
          min={0}
          max={STEPS}
          step={1}
          data-testid={`slider-${testIdPrefix}`}
        />
      )}
      <p className="text-xs text-muted-foreground">
        How confident is the owner this will hit by the period end? 0.0 = no chance, 1.0 = certain.
      </p>
    </div>
  );
}
