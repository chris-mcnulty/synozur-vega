import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileEdit, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ObjectiveStateBadgeProps {
  objectiveId: string;
  state?: string | null;
  lastRejectionNote?: string | null;
  showSubmitButton?: boolean;
}

export function ObjectiveStateBadge({
  objectiveId,
  state,
  lastRejectionNote,
  showSubmitButton = false,
}: ObjectiveStateBadgeProps) {
  const { toast } = useToast();
  const effective = state || "active";

  const submitMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/okr/objectives/${objectiveId}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/review-queue"] });
      toast({ title: "Submitted for approval" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit", description: err?.message || "", variant: "destructive" });
    },
  });

  if (effective === "active") return null;

  return (
    <div className="inline-flex items-center gap-2 flex-wrap" data-testid={`state-badge-${objectiveId}`}>
      {effective === "pending_approval" && (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending approval
        </Badge>
      )}
      {effective === "draft" && (
        <>
          <Badge variant="outline" className="gap-1">
            <FileEdit className="h-3 w-3" />
            Draft
          </Badge>
          {lastRejectionNote && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={lastRejectionNote}>
              <AlertTriangle className="h-3 w-3" />
              Returned with feedback
            </span>
          )}
          {showSubmitButton && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              data-testid={`button-submit-approval-${objectiveId}`}
            >
              <Send className="h-3 w-3 mr-1" />
              Submit for approval
            </Button>
          )}
        </>
      )}
      {effective !== "pending_approval" && effective !== "draft" && (
        <Badge variant="outline">{effective}</Badge>
      )}
    </div>
  );
}
