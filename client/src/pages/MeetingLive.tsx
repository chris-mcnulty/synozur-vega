import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar, ChevronLeft, ChevronRight, Pause, Play, StopCircle,
  Plus, Flag, AlertTriangle, ListChecks, X, Clock, Timer, Sparkles,
} from "lucide-react";
import type { Meeting, LiveMeetingState, ActionItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type CaptureKind = "decision" | "risk" | "action";

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function genId() {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function MeetingLive() {
  const [, focusRhythmParams] = useRoute("/focus-rhythm/:meetingId/live");
  const [, meetingsParams] = useRoute("/meetings/:meetingId/live");
  const meetingId = focusRhythmParams?.meetingId ?? meetingsParams?.meetingId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: meeting, isLoading } = useQuery<Meeting>({
    queryKey: ["/api/meeting", meetingId],
    enabled: !!meetingId,
  });

  // Build the list of agenda topics (skip section headers, keep original index)
  const topics = useMemo(() => {
    const all = meeting?.agenda || [];
    return all
      .map((text, idx) => ({
        idx,
        text,
        isSection: text.startsWith("---") && text.endsWith("---"),
        isOkr: text.startsWith("[OKR]"),
        display: text.startsWith("[OKR]")
          ? text.replace("[OKR] ", "")
          : text.startsWith("---")
            ? text.replace(/^---\s*/, "").replace(/\s*---$/, "")
            : text,
      }))
      .filter((a) => !a.isSection);
  }, [meeting?.agenda]);

  // Live state: hydrate from server on first load, then drive locally and persist on transitions.
  const [liveState, setLiveState] = useState<LiveMeetingState | null>(null);
  // Tick to force re-render of timers each second
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick-capture form state
  const [decisionText, setDecisionText] = useState("");
  const [riskText, setRiskText] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionAssignee, setActionAssignee] = useState("");
  const [activeCapture, setActiveCapture] = useState<CaptureKind | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  // End-meeting confirmation
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  // Hydrate from server, or initialize and persist immediately if absent so a
  // refresh during the first topic resumes instead of resetting.
  const initStartedRef = useRef(false);
  useEffect(() => {
    if (!meeting) return;
    const fromServer = (meeting.liveState as LiveMeetingState | null) ?? null;
    if (fromServer) {
      if (!liveState) setLiveState(fromServer);
      return;
    }
    if (topics.length === 0) return;
    if (liveState) return;
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    const now = new Date().toISOString();
    const initial: LiveMeetingState = {
      startedAt: now,
      currentTopicIndex: topics[0].idx,
      topicChangedAt: now,
      perTopicSeconds: {},
      paused: false,
      pausedAt: null,
      endedAt: null,
      summary: null,
    };
    setLiveState(initial);
    persistMutation.mutate(initial);
  }, [meeting, topics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every second for timer displays
  useEffect(() => {
    if (!liveState || liveState.endedAt) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [liveState?.endedAt, liveState?.paused, liveState?.startedAt]);

  // Persist mutation — used on every transition so refresh resumes correctly
  const persistMutation = useMutation({
    mutationFn: async (next: LiveMeetingState) => {
      const res = await apiRequest("PATCH", `/api/meetings/${meetingId}`, { liveState: next });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting", meetingId] });
    },
    onError: () => {
      toast({ title: "Failed to save live progress", variant: "destructive" });
    },
  });

  const persist = useCallback((next: LiveMeetingState) => {
    setLiveState(next);
    persistMutation.mutate(next);
  }, [persistMutation]);

  // Compute current topic running seconds (including any in-progress time)
  const currentTopicLiveSeconds = useMemo(() => {
    if (!liveState) return 0;
    const idxKey = String(liveState.currentTopicIndex);
    const base = liveState.perTopicSeconds[idxKey] || 0;
    if (liveState.paused || liveState.endedAt) return base;
    const since = (Date.now() - new Date(liveState.topicChangedAt).getTime()) / 1000;
    return base + Math.max(0, since);
  }, [liveState, /* tick: */ Math.floor(Date.now() / 1000)]);

  const totalElapsedSeconds = useMemo(() => {
    if (!liveState) return 0;
    const accum = Object.entries(liveState.perTopicSeconds).reduce((sum, [k, v]) => {
      // Don't double-count the current topic; we'll add its live value
      if (k === String(liveState.currentTopicIndex)) return sum;
      return sum + (v || 0);
    }, 0);
    return accum + currentTopicLiveSeconds;
  }, [liveState, currentTopicLiveSeconds]);

  const totalTargetSeconds = (meeting?.duration || 0) * 60;
  const remainingSeconds = totalTargetSeconds > 0 ? totalTargetSeconds - totalElapsedSeconds : 0;

  const currentPos = useMemo(() => {
    if (!liveState) return -1;
    return topics.findIndex((t) => t.idx === liveState.currentTopicIndex);
  }, [topics, liveState?.currentTopicIndex]);

  const currentTopic = currentPos >= 0 ? topics[currentPos] : null;

  // Append a decision / risk / action item, building on the latest cached
  // meeting and optimistically updating the cache so rapid successive captures
  // don't overwrite each other before the refetch completes.
  type CaptureInput =
    | { kind: "decision"; value: string }
    | { kind: "risk"; value: string }
    | { kind: "action"; value: ActionItem };
  const captureMutation = useMutation({
    mutationFn: async (input: CaptureInput) => {
      const cached = queryClient.getQueryData<Meeting>(["/api/meeting", meetingId]);
      const payload: { decisions?: string[]; risks?: string[]; actionItems?: ActionItem[] } = {};
      const nextMeeting: Meeting | undefined = cached ? { ...cached } : undefined;
      if (input.kind === "decision") {
        const next = [...(cached?.decisions ?? []), input.value];
        payload.decisions = next;
        if (nextMeeting) nextMeeting.decisions = next;
      } else if (input.kind === "risk") {
        const next = [...(cached?.risks ?? []), input.value];
        payload.risks = next;
        if (nextMeeting) nextMeeting.risks = next;
      } else {
        const next = [...(cached?.actionItems ?? []), input.value];
        payload.actionItems = next as ActionItem[];
        if (nextMeeting) nextMeeting.actionItems = next;
      }
      if (nextMeeting) {
        queryClient.setQueryData<Meeting>(["/api/meeting", meetingId], nextMeeting);
      }
      const res = await apiRequest("PATCH", `/api/meetings/${meetingId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting", meetingId] });
    },
    onError: () => {
      // Re-fetch to recover from a failed optimistic update
      queryClient.invalidateQueries({ queryKey: ["/api/meeting", meetingId] });
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const navigateTopic = useCallback((direction: "prev" | "next") => {
    if (!liveState || !meeting) return;
    if (currentPos < 0) return;
    const targetPos = direction === "next" ? currentPos + 1 : currentPos - 1;
    if (targetPos < 0 || targetPos >= topics.length) return;

    // Finalize current topic seconds (if not paused, capture in-progress time)
    const idxKey = String(liveState.currentTopicIndex);
    const finalizedCurrent = liveState.paused
      ? (liveState.perTopicSeconds[idxKey] || 0)
      : (liveState.perTopicSeconds[idxKey] || 0) +
        Math.max(0, (Date.now() - new Date(liveState.topicChangedAt).getTime()) / 1000);
    const next: LiveMeetingState = {
      ...liveState,
      perTopicSeconds: {
        ...liveState.perTopicSeconds,
        [idxKey]: finalizedCurrent,
      },
      currentTopicIndex: topics[targetPos].idx,
      topicChangedAt: new Date().toISOString(),
      // If we were paused, navigating "wakes" us up — resume timing on the new topic
      paused: false,
      pausedAt: null,
    };
    persist(next);
  }, [liveState, meeting, currentPos, topics, persist]);

  const togglePause = useCallback(() => {
    if (!liveState) return;
    if (liveState.paused) {
      // Resume: set new topicChangedAt = now, keep accumulated seconds untouched
      persist({
        ...liveState,
        paused: false,
        pausedAt: null,
        topicChangedAt: new Date().toISOString(),
      });
    } else {
      // Pause: fold elapsed into perTopicSeconds, freeze
      const idxKey = String(liveState.currentTopicIndex);
      const base = liveState.perTopicSeconds[idxKey] || 0;
      const since = (Date.now() - new Date(liveState.topicChangedAt).getTime()) / 1000;
      persist({
        ...liveState,
        paused: true,
        pausedAt: new Date().toISOString(),
        perTopicSeconds: {
          ...liveState.perTopicSeconds,
          [idxKey]: base + Math.max(0, since),
        },
      });
    }
  }, [liveState, persist]);

  const openCapture = useCallback((kind: CaptureKind) => {
    setActiveCapture(kind);
    setTimeout(() => captureInputRef.current?.focus(), 30);
  }, []);

  const cancelCapture = useCallback(() => {
    setActiveCapture(null);
    setDecisionText("");
    setRiskText("");
    setActionText("");
    setActionAssignee("");
  }, []);

  const submitDecision = useCallback(() => {
    const text = decisionText.trim();
    if (!text) return;
    captureMutation.mutate({ kind: "decision", value: text });
    setDecisionText("");
    setActiveCapture(null);
    toast({ title: "Decision captured" });
  }, [decisionText, captureMutation, toast]);

  const submitRisk = useCallback(() => {
    const text = riskText.trim();
    if (!text) return;
    captureMutation.mutate({ kind: "risk", value: text });
    setRiskText("");
    setActiveCapture(null);
    toast({ title: "Risk captured" });
  }, [riskText, captureMutation, toast]);

  const submitAction = useCallback(() => {
    const text = actionText.trim();
    if (!text) return;
    const item: ActionItem = {
      id: genId(),
      description: text,
      assignee: actionAssignee.trim() || undefined,
      completed: false,
    };
    captureMutation.mutate({ kind: "action", value: item });
    setActionText("");
    setActionAssignee("");
    setActiveCapture(null);
    toast({ title: "Action item captured" });
  }, [actionText, actionAssignee, captureMutation, toast]);

  const endMeeting = useCallback(() => {
    if (!liveState || !meeting) return;
    const idxKey = String(liveState.currentTopicIndex);
    const finalizedCurrent = liveState.paused
      ? (liveState.perTopicSeconds[idxKey] || 0)
      : (liveState.perTopicSeconds[idxKey] || 0) +
        Math.max(0, (Date.now() - new Date(liveState.topicChangedAt).getTime()) / 1000);
    const finalPerTopic = {
      ...liveState.perTopicSeconds,
      [idxKey]: finalizedCurrent,
    };
    const totalSeconds = Object.values(finalPerTopic).reduce((s, v) => s + (v || 0), 0);
    const topicsCovered = Object.entries(finalPerTopic).filter(([, v]) => (v || 0) > 0).length;

    const endedAt = new Date().toISOString();
    const next: LiveMeetingState = {
      ...liveState,
      perTopicSeconds: finalPerTopic,
      paused: true,
      pausedAt: endedAt,
      endedAt,
      summary: {
        totalElapsedSeconds: Math.round(totalSeconds),
        topicsCovered,
        decisionsCount: (meeting.decisions || []).length,
        risksCount: (meeting.risks || []).length,
        actionItemsCount: ((meeting.actionItems as ActionItem[] | null) || []).length,
        endedAt,
      },
    };
    persist(next);
    setEndDialogOpen(false);
    toast({
      title: "Meeting ended",
      description: `${formatElapsed(totalSeconds)} total · ${next.summary?.decisionsCount ?? 0} decisions · ${next.summary?.actionItemsCount ?? 0} actions`,
    });
    setLocation(`/focus-rhythm/${meetingId}`);
  }, [liveState, meeting, persist, setLocation, meetingId, toast]);

  // Keyboard shortcuts (only when no input is focused / no capture form is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!liveState || liveState.endedAt) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (activeCapture) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        navigateTopic("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateTopic("prev");
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePause();
      } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        openCapture("decision");
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        openCapture("risk");
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        openCapture("action");
      } else if (e.key === "Escape") {
        // close any open capture (handled in capture form too, this is fallback)
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [liveState, activeCapture, navigateTopic, togglePause, openCapture]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading meeting…</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Meeting not found</h1>
        <Button onClick={() => setLocation("/focus-rhythm")} data-testid="button-live-not-found-back">
          Back to Focus Rhythm
        </Button>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <Sparkles className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">No agenda items yet</h1>
        <p className="text-muted-foreground max-w-md">
          Add at least one agenda item to this meeting before starting Live Mode.
        </p>
        <Button onClick={() => setLocation(`/focus-rhythm/${meetingId}`)} data-testid="button-live-no-agenda-back">
          Back to meeting
        </Button>
      </div>
    );
  }

  if (!liveState) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Preparing live mode…</div>
      </div>
    );
  }

  const decisionsCount = (meeting.decisions || []).length;
  const risksCount = (meeting.risks || []).length;
  const actionsCount = ((meeting.actionItems as ActionItem[] | null) || []).length;
  const isEnded = !!liveState.endedAt;
  const isPaused = liveState.paused;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" data-testid="page-meeting-live">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3 px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="text-xs uppercase tracking-wider">Live Mode</Badge>
          <h1 className="text-lg font-semibold truncate" data-testid="text-live-meeting-title">{meeting.title}</h1>
          {meeting.date && (
            <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {new Date(meeting.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/focus-rhythm/${meetingId}`)}
            data-testid="button-live-exit"
          >
            <X className="w-4 h-4 mr-1" />
            Exit
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setEndDialogOpen(true)}
            disabled={isEnded}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-live-end"
          >
            <StopCircle className="w-4 h-4 mr-1" />
            End Meeting
          </Button>
        </div>
      </header>

      {/* Main two-column layout: Spotlight (left) + Capture/Items (right) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr,420px]">
        {/* Spotlight */}
        <div className="flex flex-col min-h-0 border-r">
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2" data-testid="text-live-progress">
              Topic {currentPos + 1} of {topics.length}
            </p>
            <h2
              className="text-3xl md:text-5xl xl:text-6xl font-bold leading-tight max-w-5xl mb-8"
              data-testid="text-live-current-topic"
            >
              {currentTopic?.display}
            </h2>

            <div className="flex items-end gap-10 mb-8">
              <div className="flex flex-col items-center" data-testid="timer-current-topic">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Timer className="w-3 h-3" /> Topic
                </span>
                <span className={`font-mono text-5xl md:text-6xl tabular-nums ${isPaused ? "text-muted-foreground" : ""}`}>
                  {formatElapsed(currentTopicLiveSeconds)}
                </span>
              </div>
              <div className="flex flex-col items-center" data-testid="timer-total-elapsed">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Elapsed
                </span>
                <span className={`font-mono text-3xl md:text-4xl tabular-nums ${isPaused ? "text-muted-foreground" : ""}`}>
                  {formatElapsed(totalElapsedSeconds)}
                </span>
              </div>
              {totalTargetSeconds > 0 && (
                <div className="flex flex-col items-center" data-testid="timer-remaining">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Remaining</span>
                  <span className={`font-mono text-3xl md:text-4xl tabular-nums ${remainingSeconds < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {remainingSeconds < 0 ? `-${formatElapsed(-remainingSeconds)}` : formatElapsed(remainingSeconds)}
                  </span>
                </div>
              )}
            </div>

            {isPaused && !isEnded && (
              <Badge variant="secondary" className="text-sm">Paused</Badge>
            )}
            {isEnded && (
              <Badge variant="outline" className="text-sm">Meeting ended</Badge>
            )}
          </div>

          {/* Facilitator controls */}
          <div className="border-t px-6 py-4 shrink-0 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigateTopic("prev")}
              disabled={currentPos <= 0 || isEnded}
              data-testid="button-live-prev"
              aria-label="Previous topic (Left arrow)"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={togglePause}
              disabled={isEnded}
              data-testid="button-live-pause"
              aria-label={isPaused ? "Resume timer (P)" : "Pause timer (P)"}
            >
              {isPaused ? <Play className="w-5 h-5 mr-1" /> : <Pause className="w-5 h-5 mr-1" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => navigateTopic("next")}
              disabled={currentPos >= topics.length - 1 || isEnded}
              data-testid="button-live-next"
              aria-label="Next topic (Right arrow or Space)"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>

          {/* Footer hints */}
          <div className="border-t px-6 py-2 shrink-0 hidden md:flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">←</kbd> / <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">→</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">Space</kbd> next</span>
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">P</kbd> pause</span>
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">D</kbd> decision</span>
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">R</kbd> risk</span>
            <span><kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">A</kbd> action</span>
          </div>
        </div>

        {/* Right column: Quick capture + lists */}
        <div className="flex flex-col min-h-0 bg-muted/20">
          {/* Capture buttons */}
          <div className="px-4 py-3 border-b shrink-0 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isEnded}
              onClick={() => openCapture("decision")}
              data-testid="button-capture-decision"
            >
              <Flag className="w-4 h-4 mr-1" />
              Decision
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isEnded}
              onClick={() => openCapture("risk")}
              data-testid="button-capture-risk"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Risk
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isEnded}
              onClick={() => openCapture("action")}
              data-testid="button-capture-action"
            >
              <ListChecks className="w-4 h-4 mr-1" />
              Action
            </Button>
          </div>

          {/* Active capture form */}
          {activeCapture && (
            <div className="px-4 py-3 border-b shrink-0 bg-background">
              {activeCapture === "decision" && (
                <form
                  onSubmit={(e) => { e.preventDefault(); submitDecision(); }}
                  className="space-y-2"
                  data-testid="form-capture-decision"
                >
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Decision
                  </label>
                  <Input
                    ref={captureInputRef}
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    placeholder="What was decided?"
                    onKeyDown={(e) => { if (e.key === "Escape") cancelCapture(); }}
                    data-testid="input-capture-decision"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={cancelCapture} data-testid="button-capture-decision-cancel">Cancel</Button>
                    <Button type="submit" size="sm" disabled={!decisionText.trim() || captureMutation.isPending} data-testid="button-capture-decision-save">Save</Button>
                  </div>
                </form>
              )}
              {activeCapture === "risk" && (
                <form
                  onSubmit={(e) => { e.preventDefault(); submitRisk(); }}
                  className="space-y-2"
                  data-testid="form-capture-risk"
                >
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Risk
                  </label>
                  <Input
                    ref={captureInputRef}
                    value={riskText}
                    onChange={(e) => setRiskText(e.target.value)}
                    placeholder="What risk was raised?"
                    onKeyDown={(e) => { if (e.key === "Escape") cancelCapture(); }}
                    data-testid="input-capture-risk"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={cancelCapture} data-testid="button-capture-risk-cancel">Cancel</Button>
                    <Button type="submit" size="sm" disabled={!riskText.trim() || captureMutation.isPending} data-testid="button-capture-risk-save">Save</Button>
                  </div>
                </form>
              )}
              {activeCapture === "action" && (
                <form
                  onSubmit={(e) => { e.preventDefault(); submitAction(); }}
                  className="space-y-2"
                  data-testid="form-capture-action"
                >
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ListChecks className="w-3 h-3" /> Action item
                  </label>
                  <Input
                    ref={captureInputRef}
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    placeholder="What needs to happen?"
                    onKeyDown={(e) => { if (e.key === "Escape") cancelCapture(); }}
                    data-testid="input-capture-action"
                  />
                  <Input
                    value={actionAssignee}
                    onChange={(e) => setActionAssignee(e.target.value)}
                    placeholder="Assignee (optional)"
                    onKeyDown={(e) => { if (e.key === "Escape") cancelCapture(); }}
                    data-testid="input-capture-action-assignee"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={cancelCapture} data-testid="button-capture-action-cancel">Cancel</Button>
                    <Button type="submit" size="sm" disabled={!actionText.trim() || captureMutation.isPending} data-testid="button-capture-action-save">Save</Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Captured items lists */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3 space-y-5">
              <Section
                icon={<Flag className="w-3.5 h-3.5" />}
                label="Decisions"
                count={decisionsCount}
                testId="section-decisions"
                items={(meeting.decisions || []).map((d, i) => (
                  <Card key={i} className="p-3 text-sm" data-testid={`live-decision-${i}`}>{d}</Card>
                ))}
              />
              <Section
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label="Risks"
                count={risksCount}
                testId="section-risks"
                items={(meeting.risks || []).map((r, i) => (
                  <Card key={i} className="p-3 text-sm" data-testid={`live-risk-${i}`}>{r}</Card>
                ))}
              />
              <Section
                icon={<ListChecks className="w-3.5 h-3.5" />}
                label="Action items"
                count={actionsCount}
                testId="section-actions"
                items={((meeting.actionItems as ActionItem[] | null) || []).map((a) => (
                  <Card key={a.id} className="p-3 text-sm" data-testid={`live-action-${a.id}`}>
                    <div>{a.description}</div>
                    {a.assignee && (
                      <div className="text-xs text-muted-foreground mt-1">Assigned to {a.assignee}</div>
                    )}
                  </Card>
                ))}
              />

              {/* Topics overview */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agenda</h3>
                <div className="space-y-1">
                  {topics.map((t, i) => {
                    const seconds = liveState.perTopicSeconds[String(t.idx)] || 0;
                    const isCurrent = t.idx === liveState.currentTopicIndex;
                    return (
                      <div
                        key={t.idx}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isCurrent ? "bg-primary/10 border border-primary/20 font-medium" : ""}`}
                        data-testid={`live-agenda-${i}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                        <span className="flex-1 truncate">{t.display}</span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {formatElapsed(isCurrent ? currentTopicLiveSeconds : seconds)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* End meeting confirm */}
      <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll save a brief summary — {topics.length} topics, {decisionsCount} decisions, {risksCount} risks,
              {" "}{actionsCount} action items, total elapsed {formatElapsed(totalElapsedSeconds)} — and return you to
              the meeting page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-end-cancel">Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={endMeeting} data-testid="button-end-confirm">End meeting</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section(props: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: React.ReactNode[];
  testId: string;
}) {
  return (
    <div data-testid={props.testId}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
        {props.icon}
        {props.label} ({props.count})
      </h3>
      {props.items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None yet</p>
      ) : (
        <div className="space-y-2">{props.items}</div>
      )}
    </div>
  );
}
