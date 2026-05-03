import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Objective, OkrApprovalHistory } from "@shared/schema";

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString();
}

export default function ReviewQueue() {
  const { toast } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [historyForId, setHistoryForId] = useState<string | null>(null);

  const { data: queue = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["/api/okr/review-queue"],
  });

  const { data: history } = useQuery<OkrApprovalHistory[]>({
    queryKey: ["/api/okr/objectives", historyForId, "approval-history"],
    enabled: !!historyForId,
    queryFn: async () => {
      const res = await fetch(`/api/okr/objectives/${historyForId}/approval-history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/okr/objectives/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okr/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      toast({ title: "Approved", description: "OKR is now active." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to approve", description: err?.message || "", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return await apiRequest("POST", `/api/okr/objectives/${id}/reject`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okr/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      setRejectingId(null);
      setRejectionNote("");
      toast({ title: "Sent back", description: "The submitter was notified." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reject", description: err?.message || "", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          OKRs awaiting your approval. Approving makes them active; sending back returns them to the owner as a draft with your note.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="text-queue-empty">
            Nothing awaiting review.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((obj) => (
            <Card key={obj.id} data-testid={`card-pending-${obj.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="text-base" data-testid={`text-title-${obj.id}`}>{obj.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Pending approval
                    </Badge>
                    {obj.quarter ? <span>Q{obj.quarter} {obj.year}</span> : <span>{obj.year}</span>}
                    {obj.ownerEmail && <span>Owner: {obj.ownerEmail}</span>}
                    <span>Submitted: {formatDate((obj as any).submittedForApprovalAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistoryForId(obj.id)}
                    data-testid={`button-history-${obj.id}`}
                  >
                    <History className="h-4 w-4 mr-1" />
                    History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setRejectingId(obj.id); setRejectionNote(""); }}
                    disabled={rejectMutation.isPending}
                    data-testid={`button-reject-${obj.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Send back
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(obj.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-approve-${obj.id}`}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </CardHeader>
              {obj.description && (
                <CardContent className="text-sm text-muted-foreground pt-0">
                  {obj.description}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectingId} onOpenChange={(open) => { if (!open) { setRejectingId(null); setRejectionNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to owner</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add a note explaining what needs to change. The owner will be notified and the OKR returned to draft.
            </p>
            <Textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="What needs to change?"
              data-testid="input-rejection-note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectionNote(""); }}>Cancel</Button>
            <Button
              onClick={() => rejectingId && rejectMutation.mutate({ id: rejectingId, note: rejectionNote })}
              disabled={!rejectionNote.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyForId} onOpenChange={(open) => { if (!open) setHistoryForId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approval history</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {!history ? (
              <Skeleton className="h-16 w-full" />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="border rounded-md p-3 text-sm" data-testid={`history-entry-${h.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {h.fromState ?? "—"} → {h.toState}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</div>
                  </div>
                  {h.note && <p className="text-muted-foreground mt-1">{h.note}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
