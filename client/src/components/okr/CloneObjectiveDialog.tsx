import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { Objective, User } from "@shared/schema";

interface CloneObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective | null;
  tenantId: string;
  currentQuarter: number;
  currentYear: number;
  users?: User[];
}

type CloneScope = 'objective_only' | 'immediate_children' | 'all_children';

export function CloneObjectiveDialog({
  open,
  onOpenChange,
  objective,
  tenantId,
  currentQuarter,
  currentYear,
  users = [],
}: CloneObjectiveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [targetQuarter, setTargetQuarter] = useState<number | null>(currentQuarter);
  const [targetYear, setTargetYear] = useState(currentYear);
  const [keepOriginalOwner, setKeepOriginalOwner] = useState(true);
  const [newOwnerId, setNewOwnerId] = useState<string>("");
  const [cloneScope, setCloneScope] = useState<CloneScope>('immediate_children');

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!objective) throw new Error("No objective selected");
      return await apiRequest("POST", `/api/okr/objectives/${objective.id}/clone`, {
        targetQuarter: targetQuarter,
        targetYear,
        keepOriginalOwner,
        newOwnerId: keepOriginalOwner ? undefined : newOwnerId,
        cloneScope,
      });
    },
    onSuccess: () => {
      const periodLabel = targetQuarter ? `Q${targetQuarter} ${targetYear}` : `Full Year ${targetYear}`;
      toast({
        title: "Objective cloned",
        description: `Successfully cloned to ${periodLabel}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Clone failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClone = () => {
    cloneMutation.mutate();
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters = [1, 2, 3, 4];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Objective
          </DialogTitle>
          <DialogDescription>
            Create a copy of this objective with reset progress. Useful for quarterly rollover or cross-team collaboration.
          </DialogDescription>
        </DialogHeader>

        {objective && (
          <div className="space-y-6 py-4">
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{objective.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Original: {objective.quarter ? `Q${objective.quarter} ${objective.year}` : `Full Year ${objective.year}`}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target-quarter">Target Period</Label>
                  <Select
                    value={targetQuarter === null ? "annual" : targetQuarter.toString()}
                    onValueChange={(v) => setTargetQuarter(v === "annual" ? null : parseInt(v))}
                  >
                    <SelectTrigger id="target-quarter" data-testid="select-target-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Full Year (Annual)</SelectItem>
                      {quarters.map((q) => (
                        <SelectItem key={q} value={q.toString()}>
                          Q{q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-year">Target Year</Label>
                  <Select
                    value={targetYear.toString()}
                    onValueChange={(v) => setTargetYear(parseInt(v))}
                  >
                    <SelectTrigger id="target-year" data-testid="select-target-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>What to Clone</Label>
                <RadioGroup
                  value={cloneScope}
                  onValueChange={(v) => setCloneScope(v as CloneScope)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="objective_only" id="scope-objective" data-testid="radio-scope-objective" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="scope-objective" className="font-normal">
                        Objective only
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Clone just this objective without Key Results
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="immediate_children" id="scope-immediate" data-testid="radio-scope-immediate" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="scope-immediate" className="font-normal">
                        Objective + Key Results
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Clone this objective and its Key Results
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="all_children" id="scope-all" data-testid="radio-scope-all" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="scope-all" className="font-normal">
                        Full hierarchy
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Clone objective, Key Results, and all nested child objectives
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="keep-owner">Keep original owner</Label>
                    <p className="text-xs text-muted-foreground">
                      Maintain the same ownership on cloned items
                    </p>
                  </div>
                  <Switch
                    id="keep-owner"
                    checked={keepOriginalOwner}
                    onCheckedChange={setKeepOriginalOwner}
                    data-testid="switch-keep-owner"
                  />
                </div>

                {!keepOriginalOwner && (
                  <div className="space-y-2">
                    <Label htmlFor="new-owner">Assign new owner</Label>
                    <Select
                      value={newOwnerId}
                      onValueChange={setNewOwnerId}
                    >
                      <SelectTrigger id="new-owner" data-testid="select-new-owner">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-clone"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={cloneMutation.isPending}
            data-testid="button-confirm-clone"
          >
            {cloneMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Clone Objective
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
