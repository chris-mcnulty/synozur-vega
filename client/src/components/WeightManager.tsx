import { Lock, Unlock, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  calculateTotalWeight,
  getWeightValidationMessage,
  autoBalanceWeights,
  normalizeWeights,
  type WeightedItem,
} from "@/lib/weight-utils";

interface WeightManagerProps<T extends WeightedItem> {
  items: T[];
  onChange: (items: T[]) => void;
  itemNameKey: keyof T;
  disabled?: boolean;
}

export function WeightManager<T extends WeightedItem>({
  items,
  onChange,
  itemNameKey,
  disabled = false,
}: WeightManagerProps<T>) {
  const total = calculateTotalWeight(items);
  const validation = getWeightValidationMessage(items);

  const handleWeightChange = (id: string, newWeight: number) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, weight: newWeight } : item
    );
    onChange(updated);
  };

  const handleLockToggle = (id: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const currentlyLocked = item.isWeightLocked === true;
        return { ...item, isWeightLocked: !currentlyLocked };
      }
      return item;
    });
    onChange(updated);
  };

  const handleAutoBalance = () => {
    const balanced = autoBalanceWeights(items);
    onChange(balanced);
  };

  const handleNormalize = () => {
    const normalized = normalizeWeights(items);
    onChange(normalized);
  };

  const getProgressColor = () => {
    if (validation.isValid) return "bg-green-500";
    if (total > 100) return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Weight Distribution</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoBalance}
            disabled={disabled || items.length === 0}
            data-testid="button-auto-balance"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Auto-Balance
          </Button>
          {!validation.isValid && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNormalize}
              disabled={disabled}
              data-testid="button-normalize"
            >
              Normalize to 100%
            </Button>
          )}
        </div>
      </div>

      {/* Weight Total Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Weight</span>
          <span className={validation.isValid ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
            {total.toFixed(1)}%
          </span>
        </div>
        <div className="relative">
          <Progress value={Math.min(total, 100)} className="h-2" />
          {total > 100 && (
            <div
              className="absolute top-0 left-0 h-2 bg-red-500/30"
              style={{ width: `${Math.min((total - 100) / total * 100, 100)}%` }}
            />
          )}
        </div>
      </div>

      {/* Validation Message */}
      {!validation.isValid && (
        <Alert variant={total > 100 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validation.message}</AlertDescription>
        </Alert>
      )}

      {validation.isValid && items.length > 0 && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {validation.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Weight Items Table */}
      {items.length > 0 ? (
        <div className="border rounded-md">
          <div className="divide-y">
            {items.map((item, index) => {
              const isLocked = item.isWeightLocked === true;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 hover-elevate"
                  data-testid={`weight-item-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {String(item[itemNameKey])}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={item.weight}
                      onChange={(e) => handleWeightChange(item.id, parseFloat(e.target.value) || 0)}
                      disabled={disabled || isLocked}
                      className="w-20 h-8 text-right"
                      min={0}
                      max={100}
                      step={0.1}
                      data-testid={`input-weight-${index}`}
                    />
                    <span className="text-sm text-muted-foreground w-4">%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleLockToggle(item.id)}
                      disabled={disabled}
                      className="h-8 w-8"
                      title={isLocked ? "Unlock weight" : "Lock weight"}
                      data-testid={`button-lock-${index}`}
                    >
                      {isLocked ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items to manage weights for</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Tip: Lock specific weights to preserve them during auto-balance. Unlocked weights will be adjusted proportionally.
      </p>
    </div>
  );
}
