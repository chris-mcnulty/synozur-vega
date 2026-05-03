import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Circle,
  Clock,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Sparkles,
  Loader2,
  History,
  Save,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfidenceSlider } from "@/components/check-in/ConfidenceSlider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import type { BigRockTask } from "@shared/schema";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  type CheckInDraft,
} from "@/lib/checkin-draft";

type PaceStatus = "ahead" | "on_track" | "behind" | "at_risk" | "no_data" | "completed";

export interface CheckInQueueItem {
  id: string;
  title: string;
  type: "objective" | "key_result" | "big_rock";
  daysSince: number | null;
  progress: number;
  status: string;
  paceStatus: PaceStatus;
  entityData: any;
}

interface SerialCheckInDialogProps {
  open: boolean;
  queue: CheckInQueueItem[];
  currentIndex: number;
  bigRockTasksMap: Record<string, BigRockTask[]>;
  onAdvance: () => void;
  onPrev: () => void;
  onClose: () => void;
  tenantId: string;
  userId?: string;
  userEmail?: string;
  quarter: number;
  year: number;
}

function getPaceBadgeVariant(
  status: PaceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ahead":
      return "default";
    case "on_track":
      return "secondary";
    case "behind":
      return "outline";
    case "at_risk":
      return "destructive";
    default:
      return "outline";
  }
}

function getPaceLabel(status: PaceStatus): string {
  switch (status) {
    case "ahead":
      return "Ahead";
    case "on_track":
      return "On Track";
    case "behind":
      return "Behind";
    case "at_risk":
      return "At Risk";
    case "no_data":
      return "No Data";
    case "completed":
      return "Completed";
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "objective":
      return "Objective";
    case "key_result":
      return "Key Result";
    case "big_rock":
      return "Initiative";
    default:
      return type;
  }
}

function calcProgressFromValue(kr: any, newVal: number): number {
  const initialValue = kr.initialValue ?? 0;
  const targetValue = kr.targetValue ?? 0;
  let progress = 0;

  if (kr.metricType === "increase") {
    const denom = targetValue - initialValue;
    if (denom === 0) progress = newVal >= targetValue ? 100 : 0;
    else if (denom > 0) progress = ((newVal - initialValue) / denom) * 100;
  } else if (kr.metricType === "decrease") {
    const denom = initialValue - targetValue;
    if (denom === 0) progress = newVal <= targetValue ? 100 : 0;
    else if (denom > 0) progress = ((initialValue - newVal) / denom) * 100;
  } else if (kr.metricType === "maintain") {
    if (targetValue === 0) {
      progress = Math.abs(newVal) <= 0.05 ? 100 : 0;
    } else {
      const deviation = Math.abs(newVal - targetValue) / Math.abs(targetValue);
      progress = deviation <= 0.05 ? 100 : Math.max(0, 100 - deviation * 100);
    }
  } else {
    progress = targetValue > 0 ? (newVal / targetValue) * 100 : 0;
  }

  return Math.max(0, Math.round(progress));
}

export function SerialCheckInDialog({
  open,
  queue,
  currentIndex,
  bigRockTasksMap,
  onAdvance,
  onPrev,
  onClose,
  tenantId,
  userId,
  userEmail,
  quarter,
  year,
}: SerialCheckInDialogProps) {
  const { toast } = useToast();
  const item = queue[currentIndex] ?? null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === queue.length - 1;

  const [formProgress, setFormProgress] = useState(0);
  const [formStatus, setFormStatus] = useState("on_track");
  const [formNote, setFormNote] = useState("");
  const [formConfidence, setFormConfidence] = useState<number | null>(null);
  const [formAsOfDate, setFormAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [valueInputDraft, setValueInputDraft] = useState("");
  const [pendingTaskUpdates, setPendingTaskUpdates] = useState<
    Record<string, string>
  >({});

  // AI rewrite state
  const [aiRewriteMode, setAiRewriteMode] = useState<"full" | "clarity" | "concise" | "expand">("full");
  const [aiRewriteSuggestion, setAiRewriteSuggestion] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);

  // Draft auto-save state
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<CheckInDraft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftNow, setDraftNow] = useState<number>(Date.now());

  // Reset form whenever the current item changes
  useEffect(() => {
    if (!item) return;
    const entity = item.entityData;
    setFormProgress(entity?.progress ?? item.progress ?? 0);
    setFormStatus(entity?.status ?? item.status ?? "on_track");
    setFormNote("");
    setFormConfidence(null);
    setFormAsOfDate(new Date().toISOString().split("T")[0]);
    setPendingTaskUpdates({});
    setAiRewriteSuggestion(null);
    setIsRewriting(false);
    setDraftRestorePrompt(null);
    setDraftSavedAt(null);

    if (item.type === "key_result" && entity) {
      const currentVal = entity.currentValue ?? 0;
      setValueInputDraft(currentVal.toString());
      setFormProgress(calcProgressFromValue(entity, currentVal));
    } else {
      setValueInputDraft("");
    }
  }, [currentIndex, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the current item changes (or dialog opens), check for an existing draft.
  useEffect(() => {
    if (!open) {
      setDraftRestorePrompt(null);
      setDraftSavedAt(null);
      return;
    }
    if (!item?.id || !userId) return;
    const existing = loadDraft(userId, item.type, item.id);
    if (existing) {
      setDraftRestorePrompt(existing);
    } else {
      setDraftRestorePrompt(null);
    }
  }, [open, item?.id, item?.type, userId]);

  // Debounced auto-save of the in-progress check-in to local storage.
  useEffect(() => {
    if (!open) return;
    if (draftRestorePrompt) return;
    if (!item?.id || !userId) return;

    const handle = window.setTimeout(() => {
      const payload: Omit<CheckInDraft, "savedAt"> = {
        form: {
          newProgress: formProgress,
          newStatus: formStatus,
          note: formNote,
          asOfDate: formAsOfDate,
          confidence: formConfidence,
        },
        valueInputDraft,
        pendingTaskUpdates,
      };
      if (item.type === "key_result") {
        const v = parseFloat(valueInputDraft);
        if (!isNaN(v)) payload.form.newValue = v;
      }
      const savedAt = saveDraft(userId, item.type, item.id, payload);
      if (savedAt) setDraftSavedAt(savedAt);
    }, 600);

    return () => window.clearTimeout(handle);
  }, [
    open,
    draftRestorePrompt,
    item?.id,
    item?.type,
    userId,
    formProgress,
    formStatus,
    formNote,
    formConfidence,
    formAsOfDate,
    valueInputDraft,
    pendingTaskUpdates,
  ]);

  // Tick the clock so the "Draft saved · Xs ago" indicator updates.
  useEffect(() => {
    if (!open || draftSavedAt === null) return;
    const interval = window.setInterval(() => setDraftNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open, draftSavedAt]);

  const handleRestoreDraft = () => {
    if (!draftRestorePrompt) return;
    const draftForm = draftRestorePrompt.form;
    setFormProgress(draftForm.newProgress);
    setFormStatus(draftForm.newStatus);
    setFormNote(draftForm.note);
    if (draftForm.confidence === null || typeof draftForm.confidence === "number") {
      setFormConfidence(draftForm.confidence);
    }
    if (draftForm.asOfDate) setFormAsOfDate(draftForm.asOfDate);
    if (typeof draftRestorePrompt.valueInputDraft === "string") {
      setValueInputDraft(draftRestorePrompt.valueInputDraft);
    }
    if (draftRestorePrompt.pendingTaskUpdates) {
      setPendingTaskUpdates(draftRestorePrompt.pendingTaskUpdates);
    }
    setDraftSavedAt(draftRestorePrompt.savedAt);
    setDraftRestorePrompt(null);
  };

  const handleDiscardDraft = () => {
    if (item?.id && userId) {
      clearDraft(userId, item.type, item.id);
    }
    setDraftRestorePrompt(null);
    setDraftSavedAt(null);
  };

  const clearCurrentDraft = () => {
    if (item?.id && userId) {
      clearDraft(userId, item.type, item.id);
    }
    setDraftSavedAt(null);
  };

  // Recent check-in history for the current item
  const { data: recentCheckIns = [] } = useQuery<any[]>({
    queryKey: ["/api/okr/check-ins", item?.type, item?.id],
    queryFn: async () => {
      if (!item) return [];
      const res = await fetch(
        `/api/okr/check-ins?entityType=${item.type}&entityId=${item.id}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!item?.id,
    staleTime: 30 * 1000,
  });

  // Show the 3 most recent (sorted desc by date)
  const lastThreeCheckIns = [...recentCheckIns]
    .sort((a, b) => new Date(b.asOfDate ?? b.createdAt).getTime() - new Date(a.asOfDate ?? a.createdAt).getTime())
    .slice(0, 3);

  const handleValueChange = (inputVal: string) => {
    setValueInputDraft(inputVal);
    if (!item || item.type !== "key_result" || !item.entityData) return;
    const newVal = parseFloat(inputVal);
    if (inputVal === "" || isNaN(newVal)) return;
    setFormProgress(calcProgressFromValue(item.entityData, newVal));
  };

  const handleAiRewrite = async () => {
    if (!formNote.trim()) {
      toast({
        title: "Note required",
        description: "Write a note first, then AI can improve it.",
        variant: "destructive",
      });
      return;
    }
    if (!item) return;
    setIsRewriting(true);
    setAiRewriteSuggestion(null);
    try {
      const payload: any = {
        originalNote: formNote,
        newProgress: formProgress,
        mode: aiRewriteMode,
        entityType: item.type,
      };
      if (item.type === "key_result") {
        payload.keyResultId = item.id;
        const v = parseFloat(valueInputDraft);
        if (!isNaN(v)) payload.newValue = v;
      } else if (item.type === "big_rock") {
        payload.bigRockId = item.id;
      } else if (item.type === "objective") {
        payload.objectiveId = item.id;
      }
      const res = await apiRequest("POST", "/api/ai/rewrite-checkin", payload);
      const data = await res.json();
      setAiRewriteSuggestion(data.rewrittenNote);
    } catch (err: any) {
      toast({
        title: "AI Rewrite failed",
        description: err?.message || "Could not rewrite note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRewriting(false);
    }
  };

  const createCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      let asOfDateISO: string;
      if (data.asOfDate) {
        const [y, m, d] = data.asOfDate.split("-").map(Number);
        asOfDateISO = new Date(y, m - 1, d, 12, 0, 0).toISOString();
      } else {
        asOfDateISO = new Date().toISOString();
      }
      return apiRequest("POST", "/api/okr/check-ins", {
        ...data,
        userId,
        userEmail,
        tenantId,
        asOfDate: asOfDateISO,
      });
    },
    onSuccess: () => {
      clearCurrentDraft();
      if (item) {
        if (item.type === "objective") {
          queryClient.invalidateQueries({
            queryKey: ["/api/okr/objectives", tenantId, quarter, year],
          });
          queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
        } else if (item.type === "key_result") {
          queryClient.invalidateQueries({
            queryKey: ["/api/okr/key-results", tenantId, quarter, year],
          });
          queryClient.invalidateQueries({ queryKey: ["/api/okr/key-results"] });
          queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
        } else if (item.type === "big_rock") {
          queryClient.invalidateQueries({
            queryKey: ["/api/okr/big-rocks", tenantId, quarter, year],
          });
          queryClient.invalidateQueries({ queryKey: ["/api/okr/big-rocks"] });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/okr/check-ins"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/okr/check-ins", item.type, item.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/okr/hierarchy"],
          exact: false,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/context"] });
      }
      toast({ title: "Check-in recorded" });
      onAdvance();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record check-in",
        variant: "destructive",
      });
    },
  });

  const handleRecord = async () => {
    if (!item) return;

    // Flush pending task updates before recording
    const tasks = bigRockTasksMap[item.id] ?? [];
    const taskUpdateEntries = Object.entries(pendingTaskUpdates).filter(
      ([taskId, newStatus]) => {
        const original = tasks.find((t) => t.id === taskId);
        return original && original.status !== newStatus;
      },
    );
    if (taskUpdateEntries.length > 0) {
      await Promise.all(
        taskUpdateEntries.map(([taskId, newStatus]) =>
          apiRequest(
            "PATCH",
            `/api/okr/big-rocks/${item.id}/tasks/${taskId}`,
            { status: newStatus },
          ),
        ),
      );
      queryClient.invalidateQueries({
        queryKey: [`/api/okr/big-rocks/${item.id}/tasks`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/big-rocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/context"] });
    }

    let finalProgress = formProgress;

    if (typeof finalProgress !== "number" || isNaN(finalProgress)) {
      finalProgress = 0;
    }

    const checkInPayload: Record<string, unknown> = {
      entityType: item.type,
      entityId: item.id,
      newProgress: finalProgress,
      newStatus: formStatus,
      note: formNote,
      achievements: [],
      challenges: [],
      nextSteps: [],
      asOfDate: formAsOfDate,
      previousProgress: item.entityData?.progress ?? item.progress ?? 0,
      confidence: formConfidence,
    };

    if (item.type === "key_result" && item.entityData) {
      const finalValue = parseFloat(valueInputDraft);
      if (isNaN(finalValue)) return;
      checkInPayload.newProgress = calcProgressFromValue(
        item.entityData,
        finalValue,
      );
      checkInPayload.newValue = finalValue;
      checkInPayload.previousValue = item.entityData?.currentValue ?? 0;
    }

    createCheckInMutation.mutate(checkInPayload);
  };

  const handleSkip = () => {
    setPendingTaskUpdates({});
    setAiRewriteSuggestion(null);
    onAdvance();
  };

  if (!item) return null;

  const bigRockTasks =
    item.type === "big_rock" ? (bigRockTasksMap[item.id] ?? []) : [];
  const isRecording = createCheckInMutation.isPending;
  const isKRValueInvalid =
    item.type === "key_result" &&
    (valueInputDraft === "" || isNaN(parseFloat(valueInputDraft)));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Check-in ({currentIndex + 1} of {queue.length})
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5 mt-1">
              <p className="text-base font-medium text-foreground">
                {item.title}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                <Badge variant="outline" className="text-[10px] h-5">
                  {getTypeLabel(item.type)}
                </Badge>
                {item.daysSince === null ? (
                  <span>Never checked in</span>
                ) : (
                  <span>{item.daysSince}d ago</span>
                )}
                <Badge
                  variant={getPaceBadgeVariant(item.paceStatus)}
                  className="text-[10px] h-5"
                >
                  {getPaceLabel(item.paceStatus)}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Progress
                    value={Math.min(item.progress, 100)}
                    className="h-1.5 w-20"
                  />
                  <span>{Math.round(item.progress)}%</span>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {draftRestorePrompt && (
          <Alert
            data-testid="alert-serial-restore-draft"
            className="border-primary/30 bg-primary/5"
          >
            <Save className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="font-medium">Unsaved draft found</span>
                  <span className="text-muted-foreground">
                    {" · saved "}
                    {formatDistanceToNow(new Date(draftRestorePrompt.savedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDiscardDraft}
                    data-testid="button-serial-discard-draft"
                  >
                    Discard
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRestoreDraft}
                    data-testid="button-serial-restore-draft"
                  >
                    Restore draft
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Recent check-in history */}
        {lastThreeCheckIns.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" />
              Recent History
            </div>
            {lastThreeCheckIns.map((ci, i) => {
              const dateStr = ci.asOfDate || ci.createdAt;
              const displayDate = dateStr ? format(new Date(dateStr), "MMM d") : "—";
              const progressLabel = ci.newProgress !== undefined && ci.previousProgress !== undefined
                ? `${ci.previousProgress}% → ${ci.newProgress}%`
                : ci.newProgress !== undefined ? `${ci.newProgress}%` : null;
              return (
                <div key={ci.id ?? i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-10">{displayDate}</span>
                  {progressLabel && (
                    <span className="text-muted-foreground shrink-0">{progressLabel}</span>
                  )}
                  {ci.note ? (
                    <span className="text-foreground/80 line-clamp-1 flex-1">{ci.note}</span>
                  ) : (
                    <span className="text-muted-foreground italic flex-1">No note</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          {/* As Of Date */}
          <div>
            <Label htmlFor="serial-ci-date">As Of Date</Label>
            <Input
              id="serial-ci-date"
              type="date"
              value={formAsOfDate}
              onChange={(e) => setFormAsOfDate(e.target.value)}
              className="dark:bg-background dark:text-foreground dark:[color-scheme:dark]"
            />
            <p className="text-xs text-muted-foreground mt-0.5">When does this check-in data apply?</p>
          </div>

          {/* Key Result: Value Input */}
          {item.type === "key_result" && item.entityData && (
            <div>
              <Label htmlFor="serial-ci-value">
                Current Value
                {item.entityData.unit ? ` (${item.entityData.unit})` : ""}
              </Label>
              <Input
                id="serial-ci-value"
                type="number"
                value={valueInputDraft}
                onChange={(e) => handleValueChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Target: {item.entityData.targetValue} {item.entityData.unit}
                {item.entityData.initialValue !== 0 &&
                  ` (from ${item.entityData.initialValue})`}
              </p>
              {valueInputDraft !== "" &&
                !isNaN(parseFloat(valueInputDraft)) && (
                  <div className="mt-2 p-2 bg-secondary/20 rounded-md">
                    <p className="text-sm font-medium">
                      Calculated Progress: {formProgress}%
                    </p>
                  </div>
                )}
              {valueInputDraft !== "" &&
                isNaN(parseFloat(valueInputDraft)) && (
                  <p className="text-sm text-destructive mt-1">
                    Please enter a valid number
                  </p>
                )}
            </div>
          )}

          {/* Objective: Progress Slider */}
          {item.type === "objective" && (
            <div>
              <Label>New Progress ({formProgress}%)</Label>
              <Slider
                value={[formProgress]}
                onValueChange={(v) => setFormProgress(v[0])}
                max={100}
                step={5}
              />
            </div>
          )}

          {/* Big Rock: Completion Slider */}
          {item.type === "big_rock" && (
            <div>
              <Label>Completion ({formProgress}%)</Label>
              <Slider
                value={[formProgress]}
                onValueChange={(v) => setFormProgress(v[0])}
                max={100}
                step={5}
              />
            </div>
          )}

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select value={formStatus} onValueChange={(status) => {
              setFormStatus(status);
              // Auto-set progress to 100 when marking as completed
              if (status === "completed" && item.type !== "key_result") {
                setFormProgress(100);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="not_started">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    Not Started
                  </span>
                </SelectItem>
                <SelectItem value="on_track">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    On Track
                  </span>
                </SelectItem>
                <SelectItem value="behind">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Behind
                  </span>
                </SelectItem>
                <SelectItem value="at_risk">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    At Risk
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="postponed">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Postponed
                  </span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                    Cancelled
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ConfidenceSlider
            value={formConfidence}
            onChange={setFormConfidence}
            testIdPrefix="serial-confidence"
          />

          {/* Big Rock Tasks */}
          {item.type === "big_rock" && bigRockTasks.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">
                Tasks
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  (
                  {
                    Object.values({
                      ...Object.fromEntries(
                        bigRockTasks.map((t) => [t.id, t.status]),
                      ),
                      ...pendingTaskUpdates,
                    }).filter((s) => s === "completed").length
                  }
                  /{bigRockTasks.length} complete)
                </span>
              </Label>
              <div className="rounded-md border divide-y">
                {bigRockTasks.map((task) => {
                  const currentStatus =
                    pendingTaskUpdates[task.id] ?? task.status;
                  const cycleStatus = (s: string) =>
                    s === "open"
                      ? "in_progress"
                      : s === "in_progress"
                        ? "completed"
                        : "open";
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setPendingTaskUpdates((prev) => ({
                            ...prev,
                            [task.id]: cycleStatus(currentStatus),
                          }))
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title={`Status: ${currentStatus.replace("_", " ")} — click to advance`}
                      >
                        {currentStatus === "completed" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : currentStatus === "in_progress" ? (
                          <Clock className="w-5 h-5 text-amber-500" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm ${currentStatus === "completed" ? "line-through text-muted-foreground" : ""}`}
                        >
                          {task.title}
                        </span>
                        {(task.assigneeEmail || task.dueDate) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.assigneeEmail && (
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {task.assigneeEmail}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(task.dueDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" },
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {pendingTaskUpdates[task.id] &&
                        pendingTaskUpdates[task.id] !== task.status && (
                          <span className="text-xs text-primary font-medium shrink-0">
                            changed
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note + AI Rewrite */}
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <Label htmlFor="serial-ci-note">Note</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={aiRewriteMode}
                  onValueChange={(v: any) => setAiRewriteMode(v)}
                >
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="full">Full Rewrite</SelectItem>
                    <SelectItem value="clarity">Improve Clarity</SelectItem>
                    <SelectItem value="concise">Make Concise</SelectItem>
                    <SelectItem value="expand">Add Context</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleAiRewrite}
                  disabled={isRewriting || !formNote.trim()}
                  data-testid="button-serial-ai-rewrite"
                >
                  {isRewriting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI Rewrite
                </Button>
              </div>
            </div>
            <Textarea
              id="serial-ci-note"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="What progress was made? Any blockers?"
              rows={3}
            />

            {/* AI suggestion */}
            {aiRewriteSuggestion && (
              <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Suggestion
                </div>
                <p className="text-sm whitespace-pre-wrap bg-background p-2 rounded border">
                  {aiRewriteSuggestion}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiRewriteSuggestion(null)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setFormNote(aiRewriteSuggestion);
                      setAiRewriteSuggestion(null);
                    }}
                  >
                    Use This
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="text-xs text-muted-foreground"
            data-testid="text-serial-draft-saved-indicator"
          >
            {draftSavedAt !== null && (
              <span>
                Draft saved ·{" "}
                {draftNow - draftSavedAt < 5000
                  ? "just now"
                  : formatDistanceToNow(new Date(draftSavedAt), {
                      addSuffix: true,
                    })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrev}
                  disabled={isFirst}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button variant="outline" size="sm" onClick={handleSkip}>
                  Skip
                  <SkipForward className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-serial-cancel-checkin">
              Cancel
            </Button>
            <Button
              onClick={handleRecord}
              disabled={isRecording || isKRValueInvalid}
            >
              {isRecording
                ? "Recording..."
                : isLast
                  ? "Record & Finish"
                  : "Record & Next"}
              {!isRecording && !isLast && (
                <ChevronRight className="h-4 w-4 ml-1" />
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
