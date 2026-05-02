import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import {
  listDrafts,
  clearDraft,
  clearAllDrafts,
  type CheckInDraftSummary,
} from "@/lib/checkin-draft";
import { formatDistanceToNow } from "date-fns";
import { FileText, Trash2 } from "lucide-react";

const ENTITY_LABELS: Record<string, string> = {
  objective: "Objective",
  key_result: "Key Result",
  big_rock: "Big Rock",
};

export function DraftsManager() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<CheckInDraftSummary[]>([]);

  const refresh = useCallback(() => {
    if (!user?.id) {
      setDrafts([]);
      return;
    }
    setDrafts(listDrafts(user.id, currentTenant?.id));
  }, [user?.id, currentTenant?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDiscardOne = (draft: CheckInDraftSummary) => {
    clearDraft(draft.userId, draft.entityType, draft.entityId);
    refresh();
    toast({
      title: "Draft discarded",
      description: draft.entityTitle
        ? `Removed draft for "${draft.entityTitle}".`
        : "Removed saved draft.",
    });
  };

  const handleClearAll = () => {
    if (!user?.id) return;
    const count = clearAllDrafts(user.id, currentTenant?.id);
    refresh();
    toast({
      title: "Drafts cleared",
      description:
        count === 0
          ? "No drafts to clear."
          : `Removed ${count} saved draft${count === 1 ? "" : "s"}.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Saved Check-in Drafts</CardTitle>
            <CardDescription>
              Drafts are kept for 24 hours on this device while you work on a
              check-in. Discard any you no longer need.
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={drafts.length === 0}
                data-testid="button-clear-all-drafts"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all saved drafts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {drafts.length} saved check-in draft
                  {drafts.length === 1 ? "" : "s"} for this organization on this
                  device. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-clear-all-drafts">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  data-testid="button-confirm-clear-all-drafts"
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center py-8 gap-2"
            data-testid="empty-drafts"
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No saved drafts for this organization.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="list-drafts">
            {drafts.map((draft) => {
              const label =
                ENTITY_LABELS[draft.entityType] ?? draft.entityType;
              const title = draft.entityTitle || `Untitled (${draft.entityId.slice(0, 8)})`;
              return (
                <li
                  key={draft.storageKey}
                  className="flex items-center justify-between gap-3 flex-wrap rounded-md border p-3"
                  data-testid={`row-draft-${draft.entityId}`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" data-testid={`badge-draft-type-${draft.entityId}`}>
                        {label}
                      </Badge>
                      <span
                        className="text-sm font-medium truncate"
                        data-testid={`text-draft-title-${draft.entityId}`}
                      >
                        {title}
                      </span>
                    </div>
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid={`text-draft-saved-${draft.entityId}`}
                    >
                      Saved{" "}
                      {formatDistanceToNow(new Date(draft.savedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDiscardOne(draft)}
                    data-testid={`button-discard-draft-${draft.entityId}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Discard
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
