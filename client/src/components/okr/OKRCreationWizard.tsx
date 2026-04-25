import { useState, useCallback, useEffect, useRef } from "react";
import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPicker } from "@/components/UserPicker";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { apiRequest, invalidateOKRQueries } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Target, TrendingUp, Activity, Check, ChevronRight, ChevronLeft,
  Plus, Trash2, Loader2, CheckCircle2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type WizardStep = "objective" | "key-results" | "big-rocks" | "review";

interface ObjectiveData {
  title: string;
  description: string;
  level: string;
  ownerEmail: string;
  teamId: string;
  quarter: number;
  year: number;
}

interface KeyResultData {
  title: string;
  description: string;
  metricType: string;
  targetValue: number;
  initialValue: number;
  unit: string;
  weight: number;
}

interface BigRockData {
  title: string;
  description: string;
  ownerEmail: string;
  priority: string;
}

interface OKRCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarter: number;
  year: number;
  onComplete?: () => void;
}

const STEPS: { key: WizardStep; label: string; icon: ElementType }[] = [
  { key: "objective", label: "Objective", icon: Target },
  { key: "key-results", label: "Key Results", icon: TrendingUp },
  { key: "big-rocks", label: "Big Rocks", icon: Activity },
  { key: "review", label: "Review", icon: Check },
];

const DEFAULT_KR: KeyResultData = {
  title: "",
  description: "",
  metricType: "increase",
  targetValue: 100,
  initialValue: 0,
  unit: "%",
  weight: 25,
};

const DEFAULT_BIG_ROCK: BigRockData = {
  title: "",
  description: "",
  ownerEmail: "",
  priority: "medium",
};

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }: { currentStep: WizardStep; steps: typeof STEPS }) {
  const currentIdx = steps.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === currentIdx;
        const isComplete = idx < currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                  isComplete && "bg-primary border-primary text-primary-foreground",
                  isActive && "border-primary text-primary bg-primary/10",
                  !isActive && !isComplete && "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] mt-1 font-medium",
                  isActive && "text-primary",
                  isComplete && "text-primary",
                  !isActive && !isComplete && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-14px]",
                  idx < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Wizard ────────────────────────────────────────────────────────────

export function OKRCreationWizard({
  open,
  onOpenChange,
  quarter,
  year,
  onComplete,
}: OKRCreationWizardProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // Draft auto-save: scope the localStorage key to tenant so drafts don't leak across tenants.
  const draftKey = tenantId ? `okr-wizard-draft:${tenantId}` : null;

  const [step, setStep] = useState<WizardStep>("objective");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Form state
  const [objective, setObjective] = useState<ObjectiveData>({
    title: "",
    description: "",
    level: "organization",
    ownerEmail: "",
    teamId: "",
    quarter,
    year,
  });
  const [keyResults, setKeyResults] = useState<KeyResultData[]>([{ ...DEFAULT_KR }]);
  const [bigRocks, setBigRocks] = useState<BigRockData[]>([]);

  // Scroll-to-bottom sentinel for the KR list
  const krScrollEndRef = useRef<HTMLDivElement>(null);

  // Restore draft on open
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!open || !draftKey || hasRestoredRef.current) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") {
          if (draft.objective) setObjective((prev) => ({ ...prev, ...draft.objective }));
          if (Array.isArray(draft.keyResults) && draft.keyResults.length > 0) setKeyResults(draft.keyResults);
          if (Array.isArray(draft.bigRocks)) setBigRocks(draft.bigRocks);
          if (draft.step) setStep(draft.step);
          setDraftRestored(true);
        }
      }
    } catch {
      // Ignore malformed drafts
    }
    hasRestoredRef.current = true;
  }, [open, draftKey]);

  // Auto-save draft as the user edits (debounced via effect dependency batching)
  useEffect(() => {
    if (!open || !draftKey) return;
    const hasContent =
      objective.title.trim().length > 0 ||
      objective.description.trim().length > 0 ||
      keyResults.some((kr) => kr.title.trim().length > 0) ||
      bigRocks.some((br) => br.title.trim().length > 0);
    if (!hasContent) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ objective, keyResults, bigRocks, step, savedAt: Date.now() }),
      );
    } catch {
      // Quota exceeded or storage unavailable — ignore
    }
  }, [open, draftKey, objective, keyResults, bigRocks, step]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore
    }
  }, [draftKey]);

  // Fetch teams for dropdown
  const { data: teamsData = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: [`/api/okr/teams`, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await fetch(`/api/okr/teams`, {
        credentials: "include",
        headers: {
          "x-tenant-id": tenantId,
        },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  // ─── Navigation ─────────────────────────────────────────────────────────

  const currentIdx = STEPS.findIndex(s => s.key === step);

  const canProceed = useCallback(() => {
    if (step === "objective") {
      return objective.title.trim().length > 0;
    }
    if (step === "key-results") {
      return keyResults.every(kr => kr.title.trim().length > 0 && kr.targetValue > 0);
    }
    return true;
  }, [step, objective.title, keyResults]);

  const goNext = () => {
    if (!canProceed()) {
      setShowValidation(true);
      if (step === "objective") {
        toast({ title: "Title required", description: "Please enter a title for your objective before continuing.", variant: "destructive" });
      } else if (step === "key-results") {
        const hasEmptyTitle = keyResults.some(kr => !kr.title.trim());
        const hasZeroTarget = keyResults.some(kr => kr.targetValue <= 0);
        if (hasEmptyTitle) {
          toast({ title: "Key result title missing", description: "Please add a title to every key result, or delete the empty ones.", variant: "destructive" });
        } else if (hasZeroTarget) {
          toast({ title: "Target value required", description: "Every key result needs a target value greater than zero.", variant: "destructive" });
        }
      }
      return;
    }
    setShowValidation(false);
    if (currentIdx < STEPS.length - 1) {
      setStep(STEPS[currentIdx + 1].key);
    }
  };

  const goBack = () => {
    setShowValidation(false);
    if (currentIdx > 0) {
      setStep(STEPS[currentIdx - 1].key);
    }
  };

  // ─── Key Result helpers ─────────────────────────────────────────────────

  const addKeyResult = () => {
    setKeyResults(prev => {
      const next = [...prev, { ...DEFAULT_KR }];
      const newIdx = next.length - 1;
      // After React re-renders, scroll the sentinel into view and focus the new title
      setTimeout(() => {
        krScrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        // Focus the new input so the user can start typing immediately
        const input = document.querySelector<HTMLInputElement>(
          `[data-testid="wizard-kr-title-${newIdx}"]`
        );
        input?.focus();
      }, 80);
      return next;
    });
  };

  const removeKeyResult = (index: number) => {
    if (keyResults.length <= 1) return;
    setKeyResults(prev => prev.filter((_, i) => i !== index));
  };

  const updateKeyResult = (index: number, field: keyof KeyResultData, value: any) => {
    setKeyResults(prev => prev.map((kr, i) => i === index ? { ...kr, [field]: value } : kr));
  };

  // ─── Big Rock helpers ───────────────────────────────────────────────────

  const addBigRock = () => {
    setBigRocks(prev => [...prev, { ...DEFAULT_BIG_ROCK }]);
  };

  const removeBigRock = (index: number) => {
    setBigRocks(prev => prev.filter((_, i) => i !== index));
  };

  const updateBigRock = (index: number, field: keyof BigRockData, value: string) => {
    setBigRocks(prev => prev.map((br, i) => i === index ? { ...br, [field]: value } : br));
  };

  // ─── Submit all ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!tenantId) return;
    setIsSubmitting(true);

    try {
      // 1. Create objective
      const objRes = await apiRequest("POST", "/api/okr/objectives", {
        ...objective,
        parentId: null,
      });
      const createdObjective = await objRes.json();

      // 2. Create key results
      const createdKRs = [];
      for (const kr of keyResults) {
        if (!kr.title.trim()) continue;
        const krRes = await apiRequest("POST", "/api/okr/key-results", {
          ...kr,
          objectiveId: createdObjective.id,
        });
        createdKRs.push(await krRes.json());
      }

      // 3. Create big rocks
      for (const br of bigRocks) {
        if (!br.title.trim()) continue;
        await apiRequest("POST", "/api/okr/big-rocks", {
          title: br.title,
          description: br.description,
          ownerEmail: br.ownerEmail || null,
          priority: br.priority,
          objectiveId: createdObjective.id,
          keyResultId: null,
          quarter: objective.quarter,
          year: objective.year,
        });
      }

      // Invalidate all OKR queries (prefix-based so tenant-scoped composite keys match)
      await invalidateOKRQueries();

      toast({
        title: "OKR Created",
        description: `Created "${objective.title}" with ${createdKRs.length} Key Result${createdKRs.length !== 1 ? "s" : ""} and ${bigRocks.filter(b => b.title.trim()).length} Big Rock${bigRocks.filter(b => b.title.trim()).length !== 1 ? "s" : ""}`,
      });

      // Reset, clear draft, and close
      clearDraft();
      resetWizard();
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      console.error("[OKR Wizard] Creation failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create OKR. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep("objective");
    setShowValidation(false);
    setObjective({
      title: "",
      description: "",
      level: "organization",
      ownerEmail: "",
      teamId: "",
      quarter,
      year,
    });
    setKeyResults([{ ...DEFAULT_KR }]);
    setBigRocks([]);
    setDraftRestored(false);
    hasRestoredRef.current = false;
  };

  const discardDraft = () => {
    clearDraft();
    resetWizard();
    toast({ title: "Draft discarded", description: "Your saved wizard draft has been cleared." });
  };

  const handleClose = (isOpen: boolean) => {
    // Closing the wizard keeps the draft in localStorage so the user can resume later.
    // The draft is only cleared on successful submit or explicit discard.
    if (!isOpen) {
      hasRestoredRef.current = false;
    }
    onOpenChange(isOpen);
  };

  // ─── Step: Objective ──────────────────────────────────────────────────

  const renderObjectiveStep = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wizard-obj-title">Title *</Label>
        <Input
          id="wizard-obj-title"
          placeholder="e.g., Increase customer retention by 20%"
          value={objective.title}
          onChange={e => setObjective(prev => ({ ...prev, title: e.target.value }))}
          data-testid="wizard-objective-title"
          className={cn(showValidation && !objective.title.trim() && "border-destructive focus-visible:ring-destructive")}
        />
        {showValidation && !objective.title.trim() && (
          <p className="text-xs text-destructive mt-1">Please enter a title for your objective.</p>
        )}
      </div>

      <div>
        <Label htmlFor="wizard-obj-desc">Description</Label>
        <Textarea
          id="wizard-obj-desc"
          placeholder="What does success look like?"
          rows={3}
          value={objective.description}
          onChange={e => setObjective(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Level</Label>
          <Select value={objective.level} onValueChange={v => setObjective(prev => ({ ...prev, level: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Owner</Label>
          <UserPicker
            value={objective.ownerEmail}
            onChange={email => setObjective(prev => ({ ...prev, ownerEmail: email }))}
            placeholder="Select owner..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quarter</Label>
          <Select value={String(objective.quarter)} onValueChange={v => setObjective(prev => ({ ...prev, quarter: parseInt(v) }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Year</Label>
          <Select value={String(objective.year)} onValueChange={v => setObjective(prev => ({ ...prev, year: parseInt(v) }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {teamsData.length > 0 && (
        <div>
          <Label>Team</Label>
          <Select
            value={objective.teamId || "none"}
            onValueChange={v => setObjective(prev => ({ ...prev, teamId: v === "none" ? "" : v }))}
          >
            <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No team</SelectItem>
              {teamsData.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  // ─── Step: Key Results ────────────────────────────────────────────────

  const renderKeyResultsStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add measurable Key Results for <strong>"{objective.title}"</strong>
      </p>

      <ScrollArea className="max-h-[380px] pr-2">
        <div className="space-y-4">
          {keyResults.map((kr, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Key Result {idx + 1}
                </span>
                {keyResults.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeKeyResult(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div>
                <Input
                  placeholder="e.g., Achieve 95% customer satisfaction score"
                  value={kr.title}
                  onChange={e => updateKeyResult(idx, "title", e.target.value)}
                  data-testid={`wizard-kr-title-${idx}`}
                  className={cn(showValidation && !kr.title.trim() && "border-destructive focus-visible:ring-destructive")}
                />
                {showValidation && !kr.title.trim() && (
                  <p className="text-xs text-destructive mt-1">Title is required — fill it in or delete this key result.</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={kr.metricType} onValueChange={v => updateKeyResult(idx, "metricType", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">Increase</SelectItem>
                      <SelectItem value="decrease">Decrease</SelectItem>
                      <SelectItem value="maintain">Maintain</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Target</Label>
                  <Input
                    type="number"
                    className={cn("h-8 text-xs", showValidation && kr.targetValue <= 0 && "border-destructive focus-visible:ring-destructive")}
                    value={kr.targetValue}
                    onChange={e => updateKeyResult(idx, "targetValue", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label className="text-xs">Unit</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="%"
                    value={kr.unit}
                    onChange={e => updateKeyResult(idx, "unit", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
          <div ref={krScrollEndRef} />
        </div>
      </ScrollArea>

      <Button variant="outline" size="sm" onClick={addKeyResult} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Add Key Result
      </Button>
    </div>
  );

  // ─── Step: Big Rocks ──────────────────────────────────────────────────

  const renderBigRocksStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optionally add Big Rocks (initiatives) that will drive this objective.
      </p>

      {bigRocks.length > 0 && (
        <ScrollArea className="max-h-[340px] pr-2">
          <div className="space-y-3">
            {bigRocks.map((br, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Big Rock {idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeBigRock(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <Input
                  placeholder="e.g., Launch customer feedback portal"
                  value={br.title}
                  onChange={e => updateBigRock(idx, "title", e.target.value)}
                  data-testid={`wizard-br-title-${idx}`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Owner</Label>
                    <UserPicker
                      value={br.ownerEmail}
                      onChange={email => updateBigRock(idx, "ownerEmail", email)}
                      placeholder="Select owner..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select value={br.priority} onValueChange={v => updateBigRock(idx, "priority", v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Button variant="outline" size="sm" onClick={addBigRock} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Add Big Rock
      </Button>

      {bigRocks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Big Rocks are optional. You can add them later too.
        </p>
      )}
    </div>
  );

  // ─── Step: Review ─────────────────────────────────────────────────────

  const renderReviewStep = () => {
    const validKRs = keyResults.filter(kr => kr.title.trim());
    const validBRs = bigRocks.filter(br => br.title.trim());
    const team = teamsData.find(t => t.id === objective.teamId);

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-2">
          Review your OKR before creating it.
        </p>

        <ScrollArea className="max-h-[400px] pr-2">
          <div className="space-y-4">
            {/* Objective summary */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Objective</span>
                <Badge variant="outline" className="text-[10px]">
                  Q{objective.quarter} {objective.year}
                </Badge>
              </div>
              <p className="font-medium">{objective.title}</p>
              {objective.description && (
                <p className="text-sm text-muted-foreground">{objective.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Level: {objective.level}</span>
                {objective.ownerEmail && <span>Owner: {objective.ownerEmail}</span>}
                {team && <span>Team: {team.name}</span>}
              </div>
            </div>

            {/* Key Results summary */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm">
                  {validKRs.length} Key Result{validKRs.length !== 1 ? "s" : ""}
                </span>
              </div>
              {validKRs.map((kr, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm">{kr.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {kr.metricType} to {kr.targetValue}{kr.unit}
                  </span>
                </div>
              ))}
            </div>

            {/* Big Rocks summary */}
            {validBRs.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-sm">
                    {validBRs.length} Big Rock{validBRs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {validBRs.map((br, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="text-sm">{br.title}</span>
                    <Badge variant="outline" className="text-[10px]">{br.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create OKR</DialogTitle>
          <DialogDescription>
            Build a complete OKR hierarchy in one session.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} steps={STEPS} />

        {draftRestored && (
          <div
            className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary"
            data-testid="wizard-draft-restored"
          >
            <span>Resumed from a saved draft.</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={discardDraft}
              disabled={isSubmitting}
              data-testid="wizard-discard-draft"
            >
              Discard draft
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0">
          {step === "objective" && renderObjectiveStep()}
          {step === "key-results" && renderKeyResultsStep()}
          {step === "big-rocks" && renderBigRocksStep()}
          {step === "review" && renderReviewStep()}
        </div>

        <DialogFooter className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {currentIdx > 0 && (
              <Button variant="outline" onClick={goBack} disabled={isSubmitting}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            {step === "review" ? (
              <Button onClick={handleSubmit} disabled={isSubmitting || !tenantId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create OKR
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
