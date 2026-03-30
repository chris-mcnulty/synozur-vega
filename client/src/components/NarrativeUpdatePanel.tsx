import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, X, Pencil, Check, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface CheckInPayload {
  tenantId: string;
  entityType: string;
  entityId: string;
  userId: string | undefined;
  userEmail: string | undefined;
  note: string;
  source: string;
  asOfDate: string;
  newValue?: number;
  newProgress?: number;
  newStatus?: string;
  statusManuallySet?: string;
}

interface NarrativeSuggestion {
  entityType: "objective" | "key_result" | "big_rock";
  entityId: string;
  entityTitle: string;
  suggestedValue: number | null;
  suggestedProgress: number | null;
  suggestedStatus: string | null;
  note: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

interface SuggestionState extends NarrativeSuggestion {
  accepted: boolean;
  editMode: boolean;
  editedNote: string;
  editedValue: string;
  editedProgress: string;
  editedStatus: string;
  discarded: boolean;
}

interface NarrativeUpdatePanelProps {
  open: boolean;
  onClose: () => void;
  quarter: number;
  year: number;
  tenantId: string;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  objective: "Objective",
  key_result: "Key Result",
  big_rock: "Big Rock",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  objective: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  key_result: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  big_rock: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "on_track", label: "On Track" },
  { value: "behind", label: "Behind" },
  { value: "at_risk", label: "At Risk" },
  { value: "completed", label: "Completed" },
];

export function NarrativeUpdatePanel({ open, onClose, quarter, year, tenantId }: NarrativeUpdatePanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [narrativeText, setNarrativeText] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/parse-narrative-update", {
        text: narrativeText,
        tenantId,
        quarter,
        year,
      });
      return res.json();
    },
    onSuccess: (data: { suggestions: NarrativeSuggestion[] }) => {
      const states: SuggestionState[] = (data.suggestions || []).map((s) => ({
        ...s,
        accepted: true,
        editMode: false,
        editedNote: s.note,
        editedValue: s.suggestedValue != null ? String(s.suggestedValue) : "",
        editedProgress: s.suggestedProgress != null ? String(s.suggestedProgress) : "",
        editedStatus: s.suggestedStatus || "",
        discarded: false,
      }));
      setSuggestions(states);
      setAnalyzed(true);
      if (states.length === 0) {
        toast({ title: "No matches found", description: "The AI could not find relevant updates in the text." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze the narrative text.", variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (toApply: SuggestionState[]) => {
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        toApply.map((s) => {
          const rawValue = s.editedValue !== "" ? parseFloat(s.editedValue) : s.suggestedValue;
          const rawProgress = s.editedProgress !== "" ? parseFloat(s.editedProgress) : s.suggestedProgress;
          // Sanitize: reject NaN; clamp progress to [0, 200] (allows exceeding 100%)
          const newValue = rawValue != null && !isNaN(rawValue) ? rawValue : null;
          const newProgress = rawProgress != null && !isNaN(rawProgress) ? Math.max(0, rawProgress) : null;
          const newStatus = s.editedStatus || s.suggestedStatus;
          const note = s.editedNote || s.note;

          const payload: CheckInPayload = {
            tenantId,
            entityType: s.entityType,
            entityId: s.entityId,
            userId: user?.id,
            userEmail: user?.email,
            note,
            source: "narrative_parser",
            asOfDate: now,
          };
          if (newValue != null) payload.newValue = newValue;
          if (newProgress != null) payload.newProgress = newProgress;
          if (newStatus) {
            payload.newStatus = newStatus;
            payload.statusManuallySet = "true";
          }
          return apiRequest("POST", "/api/okr/check-ins", payload);
        })
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, tenantId, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, tenantId, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/check-ins`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`], exact: false });

      const msg = failed > 0
        ? `${succeeded} check-in(s) recorded; ${failed} failed.`
        : `${succeeded} check-in(s) recorded successfully.`;
      toast({ title: "Check-ins applied", description: msg });
      handleClose();
    },
    onError: (err: Error) => {
      toast({ title: "Apply failed", description: err.message || "Could not apply check-ins.", variant: "destructive" });
    },
  });

  function handleClose() {
    onClose();
    setNarrativeText("");
    setSuggestions([]);
    setAnalyzed(false);
  }

  function toggleAccepted(idx: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, accepted: !s.accepted } : s))
    );
  }

  function toggleEditMode(idx: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, editMode: !s.editMode } : s))
    );
  }

  function discardSuggestion(idx: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, discarded: true, accepted: false } : s))
    );
  }

  function updateField(idx: number, field: keyof SuggestionState, value: string | boolean) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function handleApply() {
    const toApply = suggestions.filter((s) => s.accepted && !s.discarded);
    if (toApply.length === 0) {
      toast({ title: "Nothing to apply", description: "Select at least one suggestion to apply." });
      return;
    }
    applyMutation.mutate(toApply);
  }

  const activeSuggestions = suggestions.filter((s) => !s.discarded);
  const selectedCount = activeSuggestions.filter((s) => s.accepted).length;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Paste Update
          </SheetTitle>
          <SheetDescription>
            Paste a narrative report, recap, or meeting notes. The AI will match it against your current OKRs and Big Rocks and suggest check-in updates.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="narrative-input">Narrative text</Label>
              <Textarea
                id="narrative-input"
                data-testid="textarea-narrative-input"
                placeholder="Paste your executive report, team recap, or meeting notes here..."
                className="min-h-[140px] resize-none"
                value={narrativeText}
                onChange={(e) => setNarrativeText(e.target.value)}
                disabled={analyzeMutation.isPending}
              />
            </div>

            <Button
              data-testid="button-analyze-narrative"
              onClick={() => { setAnalyzed(false); setSuggestions([]); analyzeMutation.mutate(); }}
              disabled={!narrativeText.trim() || analyzeMutation.isPending}
              className="w-full"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>

            {analyzed && activeSuggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {activeSuggestions.length} suggestion{activeSuggestions.length !== 1 ? "s" : ""} found
                  </p>
                  <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
                </div>

                {suggestions.map((suggestion, idx) => {
                  if (suggestion.discarded) return null;
                  return (
                    <Card key={suggestion.entityId + idx} data-testid={`card-suggestion-${idx}`} className="relative">
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <Checkbox
                              id={`check-suggestion-${idx}`}
                              data-testid={`checkbox-suggestion-${idx}`}
                              checked={suggestion.accepted}
                              onCheckedChange={() => toggleAccepted(idx)}
                            />
                            <span className="font-medium text-sm leading-snug truncate" data-testid={`text-entity-title-${idx}`}>
                              {suggestion.entityTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-edit-suggestion-${idx}`}
                              onClick={() => toggleEditMode(idx)}
                              title={suggestion.editMode ? "Done editing" : "Edit"}
                            >
                              {suggestion.editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-discard-suggestion-${idx}`}
                              onClick={() => discardSuggestion(idx)}
                              title="Discard"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={ENTITY_TYPE_COLORS[suggestion.entityType]} data-testid={`badge-entity-type-${idx}`}>
                            {suggestion.entityType === "key_result" ? <TrendingUp className="h-3 w-3 mr-1" /> : <Target className="h-3 w-3 mr-1" />}
                            {ENTITY_TYPE_LABELS[suggestion.entityType]}
                          </Badge>
                          <Badge className={CONFIDENCE_COLORS[suggestion.confidence]} data-testid={`badge-confidence-${idx}`}>
                            {suggestion.confidence} confidence
                          </Badge>
                        </div>

                        {suggestion.editMode ? (
                          <div className="space-y-2">
                            {(suggestion.entityType === "key_result") && (
                              <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">New Value</Label>
                                  <Input
                                    type="number"
                                    data-testid={`input-value-${idx}`}
                                    placeholder="Value"
                                    value={suggestion.editedValue}
                                    onChange={(e) => updateField(idx, "editedValue", e.target.value)}
                                  />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Progress %</Label>
                                  <Input
                                    type="number"
                                    data-testid={`input-progress-${idx}`}
                                    placeholder="0–100"
                                    min={0}
                                    max={100}
                                    value={suggestion.editedProgress}
                                    onChange={(e) => updateField(idx, "editedProgress", e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                            {(suggestion.entityType !== "key_result") && (
                              <div className="space-y-1">
                                <Label className="text-xs">Progress %</Label>
                                <Input
                                  type="number"
                                  data-testid={`input-progress-${idx}`}
                                  placeholder="0–100"
                                  min={0}
                                  max={100}
                                  value={suggestion.editedProgress}
                                  onChange={(e) => updateField(idx, "editedProgress", e.target.value)}
                                />
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <select
                                data-testid={`select-status-${idx}`}
                                value={suggestion.editedStatus}
                                onChange={(e) => updateField(idx, "editedStatus", e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                <option value="">No status change</option>
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Check-in note</Label>
                              <Textarea
                                data-testid={`textarea-note-${idx}`}
                                className="resize-none min-h-[72px]"
                                value={suggestion.editedNote}
                                onChange={(e) => updateField(idx, "editedNote", e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {(suggestion.suggestedValue != null || suggestion.editedValue !== "") && (
                                <span data-testid={`text-value-${idx}`}>
                                  Value: <span className="font-medium text-foreground">{suggestion.editedValue || suggestion.suggestedValue}</span>
                                </span>
                              )}
                              {(suggestion.suggestedProgress != null || suggestion.editedProgress !== "") && (
                                <span data-testid={`text-progress-${idx}`}>
                                  Progress: <span className="font-medium text-foreground">{suggestion.editedProgress || suggestion.suggestedProgress}%</span>
                                </span>
                              )}
                              {(suggestion.suggestedStatus || suggestion.editedStatus) && (
                                <span data-testid={`text-status-${idx}`}>
                                  Status: <span className="font-medium text-foreground">{suggestion.editedStatus || suggestion.suggestedStatus}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-note-${idx}`}>
                              {suggestion.editedNote || suggestion.note}
                            </p>
                            <p className="text-xs text-muted-foreground/70 italic" data-testid={`text-reasoning-${idx}`}>
                              {suggestion.reasoning}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {analyzed && activeSuggestions.length === 0 && !analyzeMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-suggestions">
                No matching OKRs or Big Rocks were found in the text.
              </p>
            )}
          </div>
        </ScrollArea>

        {analyzed && activeSuggestions.length > 0 && (
          <div className="px-6 py-4 border-t shrink-0 flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel-panel"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedCount === 0 || applyMutation.isPending}
              data-testid="button-apply-selected"
              className="flex-1"
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply Selected (${selectedCount})`
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
