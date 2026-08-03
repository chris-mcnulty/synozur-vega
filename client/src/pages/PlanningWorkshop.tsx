import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sparkles, Vote, FileText, Plus, Send, Users, Clock, ThumbsUp, Loader2, Trash2, UserPlus, Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type {
  PlanningWorkshop, WorkshopParticipant, WorkshopCandidate, WorkshopVote, WorkshopSettings,
  WorkshopDraftEntry,
} from "@shared/schema";

type ParticipantWithUser = WorkshopParticipant & { name?: string; email?: string };
type WorkshopState = {
  workshop: PlanningWorkshop;
  participants: ParticipantWithUser[];
  candidates: WorkshopCandidate[];
  votes: WorkshopVote[];
};

type Phase = "brainstorm" | "vote" | "draft";

function quarterLabel(q: number): string {
  return q === 0 ? "Annual" : `Q${q}`;
}

function initials(name?: string, email?: string): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// ---- Long-poll hook --------------------------------------------------------
// Uses GET /api/planning-workshops/:id/state?since=<rev> which blocks server-
// side until the workshop's rev increases (or 25s timeout). Falls back to
// re-issuing the request immediately on 200 so UI stays in sync.
function useWorkshopLongPoll(workshopId: string | undefined): {
  data: WorkshopState | undefined;
  isLoading: boolean;
} {
  const queryKey = useMemo(() => ["/api/planning-workshops", workshopId], [workshopId]);
  const initial = useQuery<WorkshopState>({
    queryKey,
    enabled: !!workshopId,
  });
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!workshopId) return;
    stoppedRef.current = false;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled && !stoppedRef.current) {
        const cached = queryClient.getQueryData<WorkshopState>(queryKey);
        const since = cached?.workshop.rev ?? 0;
        try {
          const res = await fetch(
            `/api/planning-workshops/${workshopId}/state?since=${since}`,
            { credentials: "include" },
          );
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          const json = (await res.json()) as WorkshopState;
          if (cancelled) return;
          queryClient.setQueryData(queryKey, json);
        } catch {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    };
    if (initial.data) {
      void poll();
    }
    return () => {
      cancelled = true;
      stoppedRef.current = true;
    };
  }, [workshopId, queryKey, initial.data]);

  return { data: initial.data, isLoading: initial.isLoading };
}

// ---- Workshop timer --------------------------------------------------------
function WorkshopTimer({ workshop, settings }: { workshop: PlanningWorkshop; settings?: WorkshopSettings }) {
  const start = workshop.createdAt ? new Date(workshop.createdAt).getTime() : Date.now();
  const totalMs = (settings?.durationMinutes ?? 45) * 60_000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (workshop.status === "submitted" || workshop.status === "archived") {
    return <Badge variant="outline" data-testid="badge-timer"><Clock className="h-3 w-3 mr-1" /> Closed</Badge>;
  }
  const remaining = Math.max(0, start + totalMs - now);
  const mm = Math.floor(remaining / 60_000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, "0");
  const overdue = remaining === 0;
  return (
    <Badge variant={overdue ? "destructive" : "outline"} data-testid="badge-timer">
      <Clock className="h-3 w-3 mr-1" /> {overdue ? "Overrun" : `${mm}:${ss}`}
    </Badge>
  );
}

// ---- Invite dialog ---------------------------------------------------------
type DirectoryUser = { id: string; email: string; name: string; role: string };

function InviteParticipantDialog({
  workshopId, existingUserIds, onInvited,
}: {
  workshopId: string;
  existingUserIds: Set<string>;
  onInvited: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"facilitator" | "participant">("participant");
  const { toast } = useToast();

  const { data: users = [], isFetching } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/users/search", q],
    queryFn: async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=20`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: async (vars: { userId: string; role: "facilitator" | "participant" }) => {
      const res = await apiRequest("POST", `/api/planning-workshops/${workshopId}/participants`, vars);
      return res.json();
    },
    onSuccess: () => {
      onInvited();
      toast({ title: "Invited", description: "Participant added." });
    },
    onError: (e: any) => toast({ title: "Invite failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-invite-participant">
          <UserPlus className="h-4 w-4 mr-2" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite participants</DialogTitle>
          <DialogDescription>Search your tenant's users by name or email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger aria-label="Role" data-testid="select-invite-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant</SelectItem>
                <SelectItem value="facilitator">Facilitator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name or email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
                data-testid="input-invite-search"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {isFetching ? (
              <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : users.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No matches.</div>
            ) : (
              users.map((u) => {
                const already = existingUserIds.has(u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 p-2"
                    data-testid={`row-invite-user-${u.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={already || invite.isPending}
                      onClick={() => invite.mutate({ userId: u.id, role })}
                      data-testid={`button-invite-user-${u.id}`}
                    >
                      {already ? "Added" : "Invite"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main page
// ============================================================================
export default function PlanningWorkshop() {
  const params = useParams<{ id?: string }>();
  if (!params.id) {
    return <WorkshopIndex />;
  }
  return <WorkshopDetail workshopId={params.id} />;
}

function WorkshopDetail({ workshopId }: { workshopId: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading } = useWorkshopLongPoll(workshopId);

  const workshop = data?.workshop;
  const settings = (workshop?.settings as WorkshopSettings | undefined) ?? undefined;
  const phase: Phase = (settings?.phase as Phase) ?? "brainstorm";

  const isFacilitator = !!data?.participants.find(
    (p) => p.userId === user?.id && p.role === "facilitator",
  );

  const myVotes = useMemo(
    () => new Set((data?.votes ?? []).filter((v) => v.userId === user?.id).map((v) => v.candidateId)),
    [data?.votes, user?.id],
  );
  const myVoteCount = myVotes.size;
  const votesAllowed = settings?.votesPerParticipant ?? 5;

  const [newCandidateTitle, setNewCandidateTitle] = useState("");
  const [newCandidateDesc, setNewCandidateDesc] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/planning-workshops", workshopId] });

  const createCandidate = useMutation({
    mutationFn: async (vars: { title: string; description?: string }) => {
      const res = await apiRequest("POST", `/api/planning-workshops/${workshopId}/candidates`, vars);
      return res.json();
    },
    onSuccess: () => {
      setNewCandidateTitle("");
      setNewCandidateDesc("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed to add", description: e?.message, variant: "destructive" }),
  });

  const toggleVote = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/planning-workshops/${workshopId}/candidates/${candidateId}/vote`,
        {},
      );
      return res.json();
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Vote failed", description: e?.message, variant: "destructive" }),
  });

  const updateWorkshop = useMutation({
    mutationFn: async (patch: { status?: string; settings?: Partial<WorkshopSettings>; title?: string }) => {
      const res = await apiRequest("PATCH", `/api/planning-workshops/${workshopId}`, patch);
      return res.json();
    },
    onSuccess: invalidate,
  });

  const submitWorkshop = useMutation({
    mutationFn: async (vars: { requireApproval: boolean }) => {
      const res = await apiRequest("POST", `/api/planning-workshops/${workshopId}/submit`, vars);
      return res.json();
    },
    onSuccess: (result: { createdObjectiveIds: string[] }) => {
      toast({
        title: "Workshop submitted",
        description: `Created ${result.createdObjectiveIds.length} objective(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      invalidate();
      setLocation("/planning");
    },
    onError: (e: any) => toast({ title: "Submit failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading || !data || !workshop) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedCandidates = [...data.candidates].sort(
    (a, b) =>
      b.voteCount - a.voteCount ||
      (a.createdAt && b.createdAt ? +new Date(a.createdAt) - +new Date(b.createdAt) : 0),
  );
  const topN = settings?.topNForDraft ?? 5;
  const topCandidates = sortedCandidates.slice(0, topN);
  const drafts = (settings?.drafts ?? {}) as Record<string, WorkshopDraftEntry>;

  const setPhase = (next: Phase) => updateWorkshop.mutate({ settings: { phase: next } });

  const setDraft = (candidateId: string, draft: WorkshopDraftEntry) => {
    updateWorkshop.mutate({
      settings: { drafts: { ...drafts, [candidateId]: draft } },
    });
  };

  const participantIds = new Set(data.participants.map((p) => p.userId));

  const phaseClass = (col: Phase) =>
    `flex flex-col gap-3 p-3 rounded-md border ${
      phase === col ? "border-primary bg-primary/5" : "border-border"
    }`;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <Helmet><title>Planning Workshop | Vega</title></Helmet>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold" data-testid="text-workshop-title">{workshop.title}</h1>
            <Badge variant="secondary" data-testid="badge-workshop-status">{workshop.status}</Badge>
            <Badge variant="outline">
              {quarterLabel(settings?.quarter ?? 0)} {settings?.year ?? ""}
            </Badge>
            <WorkshopTimer workshop={workshop} settings={settings} />
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Vote className="h-3 w-3" /> {votesAllowed} votes/person
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/planning")} data-testid="button-exit-workshop">
            Back to Outcomes
          </Button>
        </div>
      </div>

      {/* Participants strip */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Participants ({data.participants.length})</span>
            <div className="flex items-center gap-1 flex-wrap">
              {data.participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md"
                  data-testid={`chip-participant-${p.userId}`}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">{initials(p.name, p.email)}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate">{p.name || p.email || p.userId}</span>
                  {p.role === "facilitator" && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">facilitator</Badge>
                  )}
                </span>
              ))}
            </div>
          </div>
          {isFacilitator && workshop.status !== "submitted" && (
            <InviteParticipantDialog
              workshopId={workshopId}
              existingUserIds={participantIds}
              onInvited={invalidate}
            />
          )}
        </CardContent>
      </Card>

      {/* 3-column shared canvas */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Brainstorm column */}
        <section className={phaseClass("brainstorm")} aria-label="Brainstorm" data-testid="col-brainstorm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Brainstorm
            </h2>
            {isFacilitator && phase !== "brainstorm" && (
              <Button size="sm" variant="ghost" onClick={() => setPhase("brainstorm")} data-testid="button-phase-brainstorm">
                Focus
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Input
              placeholder="What outcome should we drive next period?"
              value={newCandidateTitle}
              onChange={(e) => setNewCandidateTitle(e.target.value)}
              data-testid="input-candidate-title"
            />
            <Textarea
              placeholder="Optional context"
              value={newCandidateDesc}
              onChange={(e) => setNewCandidateDesc(e.target.value)}
              className="min-h-16 resize-none"
              data-testid="input-candidate-description"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!newCandidateTitle.trim() || createCandidate.isPending}
              onClick={() => createCandidate.mutate({
                title: newCandidateTitle.trim(),
                description: newCandidateDesc.trim() || undefined,
              })}
              data-testid="button-add-candidate"
            >
              <Plus className="h-4 w-4 mr-2" /> Add candidate
            </Button>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {data.candidates.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center p-3">No candidates yet.</div>
            ) : (
              data.candidates.map((c) => (
                <Card key={c.id} data-testid={`card-candidate-${c.id}`}>
                  <CardContent className="p-3 space-y-1">
                    <div className="text-sm font-medium" data-testid={`text-candidate-title-${c.id}`}>{c.title}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      <ThumbsUp className="h-3 w-3 mr-1" />{c.voteCount}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          {isFacilitator && phase === "brainstorm" && (
            <Button size="sm" onClick={() => setPhase("vote")} data-testid="button-start-vote">
              Move to voting →
            </Button>
          )}
        </section>

        {/* Vote column */}
        <section className={phaseClass("vote")} aria-label="Vote" data-testid="col-vote">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Vote className="h-4 w-4" /> Vote
            </h2>
            <Badge variant="secondary" data-testid="badge-my-votes">{myVoteCount}/{votesAllowed}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            You've used {myVoteCount} of {votesAllowed} votes. Click again to retract.
          </p>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {sortedCandidates.length === 0 && (
              <div className="text-xs text-muted-foreground text-center p-3">Add candidates first.</div>
            )}
            {sortedCandidates.map((c) => {
              const voted = myVotes.has(c.id);
              const disabled = !voted && myVoteCount >= votesAllowed;
              return (
                <Card key={c.id} data-testid={`card-vote-${c.id}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="text-sm font-medium">{c.title}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        <ThumbsUp className="h-3 w-3 mr-1" />{c.voteCount}
                      </Badge>
                      <Button
                        size="sm"
                        variant={voted ? "default" : "outline"}
                        disabled={disabled || toggleVote.isPending}
                        onClick={() => toggleVote.mutate(c.id)}
                        data-testid={`button-vote-${c.id}`}
                      >
                        {voted ? "Voted" : "Vote"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {isFacilitator && phase === "vote" && (
            <Button size="sm" onClick={() => setPhase("draft")} data-testid="button-start-draft">
              Move to drafting →
            </Button>
          )}
        </section>

        {/* Draft column */}
        <section className={phaseClass("draft")} aria-label="Draft" data-testid="col-draft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Draft (top {topN})
            </h2>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {topCandidates.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center p-3">
                Vote first, then top candidates appear here.
              </div>
            ) : (
              topCandidates.map((c) => (
                <DraftCard
                  key={c.id}
                  candidate={c}
                  draft={drafts[c.id]}
                  onChange={(d) => setDraft(c.id, d)}
                  onRemove={() => {
                    const next = { ...drafts };
                    delete next[c.id];
                    updateWorkshop.mutate({ settings: { drafts: next } });
                  }}
                  userId={user?.id}
                  disabled={!isFacilitator}
                />
              ))
            )}
          </div>

          {isFacilitator && Object.keys(drafts).length > 0 && workshop.status !== "submitted" && (
            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitWorkshop.mutate({ requireApproval: true })}
                disabled={submitWorkshop.isPending}
                data-testid="button-submit-for-approval"
              >
                Submit for approval
              </Button>
              <Button
                size="sm"
                onClick={() => submitWorkshop.mutate({ requireApproval: false })}
                disabled={submitWorkshop.isPending}
                data-testid="button-submit-workshop"
              >
                <Send className="h-4 w-4 mr-2" /> Publish OKRs
              </Button>
            </div>
          )}
          {workshop.status === "submitted" && (
            <div className="text-xs text-muted-foreground text-center p-2">
              This workshop has been submitted.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DraftCard({
  candidate, draft, onChange, onRemove, userId, disabled,
}: {
  candidate: WorkshopCandidate;
  draft?: WorkshopDraftEntry;
  onChange: (d: WorkshopDraftEntry) => void;
  onRemove: () => void;
  userId?: string;
  disabled?: boolean;
}) {
  const included = !!draft;
  const d: WorkshopDraftEntry = draft ?? {
    ownerId: userId,
    level: "organization",
    keyResults: [],
  };

  const update = (patch: Partial<WorkshopDraftEntry>) => onChange({ ...d, ...patch });

  return (
    <Card data-testid={`card-draft-${candidate.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-sm">{candidate.title}</CardTitle>
          {candidate.description && (
            <CardDescription className="text-xs line-clamp-2">{candidate.description}</CardDescription>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="outline" className="text-[10px]"><ThumbsUp className="h-3 w-3 mr-1" />{candidate.voteCount}</Badge>
          {included ? (
            <Button size="icon" variant="ghost" aria-label="Exclude candidate" disabled={disabled} onClick={onRemove} data-testid={`button-exclude-${candidate.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" disabled={disabled} onClick={() => onChange(d)} data-testid={`button-include-${candidate.id}`}>
              Include
            </Button>
          )}
        </div>
      </CardHeader>
      {included && (
        <CardContent className="space-y-2 pt-0">
          <Select
            value={d.level ?? "organization"}
            onValueChange={(v) => update({ level: v as WorkshopDraftEntry["level"] })}
            disabled={disabled}
          >
            <SelectTrigger aria-label="Level" data-testid={`select-level-${candidate.id}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="team">Team</SelectItem>
            </SelectContent>
          </Select>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Key Results</Label>
              <Button
                size="sm"
                variant="outline"
                aria-label="Add key result"
                disabled={disabled}
                onClick={() => update({
                  keyResults: [
                    ...(d.keyResults ?? []),
                    { title: "", metricType: "increase", initialValue: 0, targetValue: 100, unit: "" },
                  ],
                })}
                data-testid={`button-add-kr-${candidate.id}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(d.keyResults ?? []).map((kr, i) => (
              <div key={i} className="space-y-1 p-2 border rounded-md">
                <Input
                  placeholder="KR title"
                  value={kr.title}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...(d.keyResults ?? [])];
                    next[i] = { ...next[i], title: e.target.value };
                    update({ keyResults: next });
                  }}
                  data-testid={`input-kr-title-${candidate.id}-${i}`}
                />
                <div className="grid grid-cols-3 gap-1">
                  <Select
                    value={kr.metricType ?? "increase"}
                    disabled={disabled}
                    onValueChange={(v) => {
                      const next = [...(d.keyResults ?? [])];
                      next[i] = { ...next[i], metricType: v as typeof kr.metricType };
                      update({ keyResults: next });
                    }}
                  >
                    <SelectTrigger aria-label="Metric type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">↑</SelectItem>
                      <SelectItem value="decrease">↓</SelectItem>
                      <SelectItem value="maintain">=</SelectItem>
                      <SelectItem value="complete">✓</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="From"
                    disabled={disabled}
                    value={kr.initialValue ?? 0}
                    onChange={(e) => {
                      const next = [...(d.keyResults ?? [])];
                      next[i] = { ...next[i], initialValue: Number(e.target.value) };
                      update({ keyResults: next });
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="To"
                    disabled={disabled}
                    value={kr.targetValue ?? 0}
                    onChange={(e) => {
                      const next = [...(d.keyResults ?? [])];
                      next[i] = { ...next[i], targetValue: Number(e.target.value) };
                      update({ keyResults: next });
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...(d.keyResults ?? [])];
                    next.splice(i, 1);
                    update({ keyResults: next });
                  }}
                  data-testid={`button-remove-kr-${candidate.id}-${i}`}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove KR
                </Button>
              </div>
            ))}
            {(d.keyResults ?? []).length === 0 && (
              <p className="text-[10px] text-muted-foreground">Add at least one key result.</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Workshop Index (no :id)
// ============================================================================
function WorkshopIndex() {
  const [, setLocation] = useLocation();
  const { data: list, isLoading } = useQuery<PlanningWorkshop[]>({
    queryKey: ["/api/planning-workshops"],
  });

  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planning Workshops</h1>
          <p className="text-sm text-muted-foreground">
            Run a synchronous brainstorm → vote → draft session to kick off a new period.
          </p>
        </div>
        <CreateWorkshopDialog
          open={open}
          onOpenChange={setOpen}
          onCreated={(id) => setLocation(`/planning-workshop/${id}`)}
          trigger={<Button data-testid="button-new-workshop"><Plus className="h-4 w-4 mr-2" />New workshop</Button>}
        />
      </div>
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (list?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No workshops yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list!.map((w) => {
            const s = w.settings as WorkshopSettings;
            return (
              <Card
                key={w.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation(`/planning-workshop/${w.id}`)}
                data-testid={`card-workshop-${w.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">{w.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {quarterLabel(s.quarter)} {s.year} · {s.phase ?? "brainstorm"}
                    </div>
                  </div>
                  <Badge variant="secondary">{w.status}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CreateWorkshopDialog({
  open, onOpenChange, onCreated, trigger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  trigger: React.ReactNode;
}) {
  const { toast } = useToast();
  const now = new Date();
  const [title, setTitle] = useState(`Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Planning`);
  const [quarter, setQuarter] = useState<number>(Math.ceil((now.getMonth() + 1) / 3));
  const [year, setYear] = useState<number>(now.getFullYear());
  const [duration, setDuration] = useState<number>(45);
  const [votes, setVotes] = useState<number>(5);
  const [topN, setTopN] = useState<number>(5);

  const createWorkshop = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/planning-workshops", {
        title,
        quarter,
        year,
        durationMinutes: duration,
        votesPerParticipant: votes,
        topNForDraft: topN,
      });
      return res.json() as Promise<PlanningWorkshop>;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning-workshops"] });
      onOpenChange(false);
      onCreated?.(ws.id);
    },
    onError: (e: any) =>
      toast({ title: "Failed to create workshop", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan a period</DialogTitle>
          <DialogDescription>Kick off a new quarter or annual planning session.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-workshop-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Period</Label>
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
                <SelectTrigger aria-label="Period" data-testid="select-workshop-quarter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Annual</SelectItem>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Votes/person</Label>
              <Input type="number" value={votes} onChange={(e) => setVotes(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Top N to draft</Label>
              <Input type="number" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!title.trim() || createWorkshop.isPending}
            onClick={() => createWorkshop.mutate()}
            data-testid="button-create-workshop"
          >
            {createWorkshop.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create workshop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
