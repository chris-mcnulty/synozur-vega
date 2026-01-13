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
import { Switch } from "@/components/ui/switch";
import type { BigRock, User } from "@shared/schema";

interface CloneBigRockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bigRock: BigRock | null;
  tenantId: string;
  currentQuarter: number;
  currentYear: number;
  users?: User[];
}

export function CloneBigRockDialog({
  open,
  onOpenChange,
  bigRock,
  tenantId,
  currentQuarter,
  currentYear,
  users = [],
}: CloneBigRockDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [targetQuarter, setTargetQuarter] = useState<number | null>(currentQuarter);
  const [targetYear, setTargetYear] = useState(currentYear);
  const [keepOriginalOwner, setKeepOriginalOwner] = useState(true);
  const [newOwnerId, setNewOwnerId] = useState<string>("");
  const [keepLinkedOKR, setKeepLinkedOKR] = useState(false);

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!bigRock) throw new Error("No Big Rock selected");
      return await apiRequest("POST", `/api/okr/big-rocks/${bigRock.id}/clone`, {
        targetQuarter: targetQuarter,
        targetYear,
        keepOriginalOwner,
        newOwnerId: keepOriginalOwner ? undefined : newOwnerId,
        keepLinkedOKR,
      });
    },
    onSuccess: () => {
      const periodLabel = targetQuarter ? `Q${targetQuarter} ${targetYear}` : `Full Year ${targetYear}`;
      toast({
        title: "Big Rock cloned",
        description: `Successfully cloned to ${periodLabel}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/big-rocks", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/hierarchy", tenantId] });
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

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
  const quarters = [1, 2, 3, 4];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Big Rock
          </DialogTitle>
          <DialogDescription>
            Create a copy of this Big Rock with reset progress. Useful for quarterly rollover.
          </DialogDescription>
        </DialogHeader>

        {bigRock && (
          <div className="space-y-6 py-4">
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{bigRock.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Original: {bigRock.quarter ? `Q${bigRock.quarter} ${bigRock.year}` : `Full Year ${bigRock.year}`}
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
                    <SelectTrigger id="target-quarter" data-testid="select-bigrock-target-quarter">
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
                    <SelectTrigger id="target-year" data-testid="select-bigrock-target-year">
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
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="keep-owner">Keep original owner</Label>
                    <p className="text-xs text-muted-foreground">
                      Maintain the same ownership on the cloned Big Rock
                    </p>
                  </div>
                  <Switch
                    id="keep-owner"
                    checked={keepOriginalOwner}
                    onCheckedChange={setKeepOriginalOwner}
                    data-testid="switch-bigrock-keep-owner"
                  />
                </div>

                {!keepOriginalOwner && (
                  <div className="space-y-2">
                    <Label htmlFor="new-owner">Assign new owner</Label>
                    <Select
                      value={newOwnerId}
                      onValueChange={setNewOwnerId}
                    >
                      <SelectTrigger id="new-owner" data-testid="select-bigrock-new-owner">
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

              {(bigRock.objectiveId || bigRock.keyResultId) && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="keep-linked">Keep OKR linkage</Label>
                    <p className="text-xs text-muted-foreground">
                      Link cloned Big Rock to the same Objective/Key Result
                    </p>
                  </div>
                  <Switch
                    id="keep-linked"
                    checked={keepLinkedOKR}
                    onCheckedChange={setKeepLinkedOKR}
                    data-testid="switch-bigrock-keep-linked"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-bigrock-clone"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={cloneMutation.isPending}
            data-testid="button-confirm-bigrock-clone"
          >
            {cloneMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Clone Big Rock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
