import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { CheckCircle, Circle, Clock, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BigRockTask } from "@shared/schema";

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
  const [formAsOfDate, setFormAsOfDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [valueInputDraft, setValueInputDraft] = useState("");
  const [pendingTaskUpdates, setPendingTaskUpdates] = useState<
    Record<string, string>
  >({});

  // Reset form whenever the current item changes
  useEffect(() => {
    if (!item) return;
    const entity = item.entityData;
    setFormProgress(entity?.progress ?? item.progress ?? 0);
    setFormStatus(entity?.status ?? item.status ?? "on_track");
    setFormNote("");
    setFormAsOfDate(new Date().toISOString().split("T")[0]);
    setPendingTaskUpdates({});

    if (item.type === "key_result") {
      const currentVal = entity?.currentValue ?? 0;
      setValueInputDraft(currentVal.toString());
    } else {
      setValueInputDraft("");
    }
  }, [currentIndex, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleValueChange = (inputVal: string) => {
    setValueInputDraft(inputVal);
    if (!item || item.type !== "key_result" || !item.entityData) return;
    const newVal = parseFloat(inputVal);
    if (inputVal === "" || isNaN(newVal)) return;
    setFormProgress(calcProgressFromValue(item.entityData, newVal));
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
          queryKey: ["/api/okr/hierarchy"],
          exact: false,
        });
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
        taskUpdateEntries.map(async ([taskId, newStatus]) => {
          const res = await apiRequest(
            `/api/okr/big-rocks/${item.id}/tasks/${taskId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: newStatus }),
            },
          );
          if (!res.ok) {
            throw new Error(
              `Failed to update task ${taskId} for Big Rock ${item.id}: ${res.status} ${res.statusText}`,
            );
          }
        }),
      );
      queryClient.invalidateQueries({
        queryKey: [`/api/okr/big-rocks/${item.id}/tasks`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/okr/big-rocks"] });
    }

    let finalProgress = formProgress;
    let finalValue = 0;

    if (item.type === "key_result" && item.entityData) {
      finalValue = parseFloat(valueInputDraft);
      if (isNaN(finalValue)) return;
      finalProgress = calcProgressFromValue(item.entityData, finalValue);
    }

    if (typeof finalProgress !== "number" || isNaN(finalProgress)) {
      finalProgress = 0;
    }

    createCheckInMutation.mutate({
      entityType: item.type,
      entityId: item.id,
      newValue: finalValue,
      newProgress: finalProgress,
      newStatus: formStatus,
      note: formNote,
      achievements: [],
      challenges: [],
      nextSteps: [],
      asOfDate: formAsOfDate,
      previousProgress: item.entityData?.progress ?? item.progress ?? 0,
      previousValue: item.entityData?.currentValue ?? 0,
    });
  };

  const handleSkip = () => {
    setPendingTaskUpdates({});
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
            <Select value={formStatus} onValueChange={setFormStatus}>
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

          {/* Note */}
          <div>
            <Label htmlFor="serial-ci-note">Note</Label>
            <Textarea
              id="serial-ci-note"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="What progress was made? Any blockers?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
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
