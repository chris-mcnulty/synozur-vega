import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { getCurrentQuarter } from "@/lib/quarters";
import { OKRTreeView } from "@/components/okr/OKRTreeView";
import { TrendingUp, Target, Activity, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import type { Foundation } from "@shared/schema";

interface Objective {
  id: string;
  title: string;
  description: string;
  level: string;
  parentId?: string;
  progress: number;
  status: string;
  ownerEmail?: string;
  coOwnerIds?: string[];
  quarter: number;
  year: number;
  tenantId: string;
}

interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progress: number;
  weight: number;
  status: string;
  isPromotedToKpi?: boolean;
}

interface BigRock {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: string;
  completionPercentage: number;
  objectiveId?: string;
  keyResultId?: string;
  quarter: number;
  year: number;
}

interface CheckIn {
  id: string;
  entityType: string;
  entityId: string;
  previousValue?: number;
  newValue?: number;
  previousProgress: number;
  newProgress: number;
  previousStatus?: string;
  newStatus?: string;
  note?: string;
  achievements?: string[];
  challenges?: string[];
  nextSteps?: string[];
  createdBy: string;
  createdAt: Date;
}

export default function PlanningEnhanced() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [selectedTab, setSelectedTab] = useState("enhanced-okrs");
  const [quarter, setQuarter] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Fetch foundation for fiscal year settings
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant.id}`],
  });

  // Set initial quarter/year based on tenant's fiscal year
  useEffect(() => {
    if (foundation) {
      const fiscalYearStartMonth = foundation.fiscalYearStartMonth || 1;
      const currentPeriod = getCurrentQuarter(fiscalYearStartMonth);
      setQuarter(currentPeriod.quarter);
      setYear(currentPeriod.year);
    }
  }, [foundation?.fiscalYearStartMonth]);

  // Fetch enhanced OKR data
  const { data: objectives = [], isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year],
    queryFn: async () => {
      const res = await fetch(`/api/okr/objectives?tenantId=${currentTenant.id}&quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch objectives");
      return res.json();
    },
  });

  const { data: bigRocks = [], isLoading: loadingBigRocks } = useQuery<BigRock[]>({
    queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year],
    queryFn: async () => {
      const res = await fetch(`/api/okr/big-rocks?tenantId=${currentTenant.id}&quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch big rocks");
      return res.json();
    },
  });

  // Enrich objectives with their key results and big rocks
  const [enrichedObjectives, setEnrichedObjectives] = useState<any[]>([]);
  
  useEffect(() => {
    const enrichData = async () => {
      const enriched = await Promise.all(objectives.map(async (obj) => {
        // Fetch key results for this objective
        const krRes = await fetch(`/api/okr/objectives/${obj.id}/key-results`);
        const keyResults = krRes.ok ? await krRes.json() : [];
        
        // Filter big rocks for this objective
        const objBigRocks = bigRocks.filter(rock => rock.objectiveId === obj.id);
        
        return {
          ...obj,
          keyResults,
          bigRocks: objBigRocks,
        };
      }));
      setEnrichedObjectives(enriched);
    };
    
    if (objectives.length > 0) {
      enrichData();
    }
  }, [objectives, bigRocks]);

  // Dialog states
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [keyResultDialogOpen, setKeyResultDialogOpen] = useState(false);
  const [bigRockDialogOpen, setBigRockDialogOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [selectedBigRock, setSelectedBigRock] = useState<BigRock | null>(null);
  const [checkInEntity, setCheckInEntity] = useState<{ type: string; id: string; current?: any } | null>(null);

  // Form data states
  const [objectiveForm, setObjectiveForm] = useState({
    title: "",
    description: "",
    level: "organization",
    parentId: "",
    ownerEmail: "",
    progressMode: "rollup",
  });

  const [keyResultForm, setKeyResultForm] = useState({
    title: "",
    description: "",
    targetValue: 100,
    currentValue: 0,
    unit: "%",
    weight: 25,
  });

  const [bigRockForm, setBigRockForm] = useState({
    title: "",
    description: "",
    objectiveId: "",
    keyResultId: "",
    completionPercentage: 0,
  });

  const [checkInForm, setCheckInForm] = useState({
    newValue: 0,
    newProgress: 0,
    newStatus: "",
    note: "",
    achievements: [""],
    challenges: [""],
    nextSteps: [""],
  });

  // Mutations
  const createObjectiveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/okr/objectives", {
        ...data,
        tenantId: currentTenant.id,
        quarter,
        year,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setObjectiveDialogOpen(false);
      toast({ title: "Success", description: "Objective created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create objective", variant: "destructive" });
    },
  });

  const createKeyResultMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/okr/key-results", {
        ...data,
        tenantId: currentTenant.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setKeyResultDialogOpen(false);
      toast({ title: "Success", description: "Key Result created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create key result", variant: "destructive" });
    },
  });

  const createBigRockMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/okr/big-rocks", {
        ...data,
        tenantId: currentTenant.id,
        quarter,
        year,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`] });
      setBigRockDialogOpen(false);
      toast({ title: "Success", description: "Big Rock created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create big rock", variant: "destructive" });
    },
  });

  const promoteKeyResultMutation = useMutation({
    mutationFn: async (keyResultId: string) => {
      return apiRequest("POST", `/api/okr/key-results/${keyResultId}/promote-to-kpi`, {
        userId: "current-user", // TODO: Get from auth context
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/kpis`] });
      toast({ title: "Success", description: "Key Result promoted to KPI dashboard" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to promote key result", variant: "destructive" });
    },
  });

  const createCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/okr/check-ins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr`] });
      setCheckInDialogOpen(false);
      toast({ title: "Success", description: "Check-in recorded successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record check-in", variant: "destructive" });
    },
  });

  // Handler functions
  const handleCreateObjective = (parentId?: string) => {
    setObjectiveForm({
      title: "",
      description: "",
      level: parentId ? "team" : "organization",
      parentId: parentId || "",
      ownerEmail: "",
      progressMode: "rollup",
    });
    setSelectedObjective(null);
    setObjectiveDialogOpen(true);
  };

  const handleCreateKeyResult = (objectiveId: string) => {
    const objective = objectives.find(o => o.id === objectiveId);
    if (objective) {
      setSelectedObjective(objective);
      setKeyResultForm({
        title: "",
        description: "",
        targetValue: 100,
        currentValue: 0,
        unit: "%",
        weight: 25,
      });
      setKeyResultDialogOpen(true);
    }
  };

  const handleCreateBigRock = (objectiveId: string, keyResultId?: string) => {
    setBigRockForm({
      title: "",
      description: "",
      objectiveId,
      keyResultId: keyResultId || "",
      completionPercentage: 0,
    });
    setBigRockDialogOpen(true);
  };

  const handleCheckIn = (entityType: string, entityId: string) => {
    // Find the entity data for context
    let current = null;
    if (entityType === "objective") {
      current = objectives.find(o => o.id === entityId);
    }
    
    setCheckInEntity({ type: entityType, id: entityId, current });
    setCheckInForm({
      newValue: 0,
      newProgress: current?.progress || 0,
      newStatus: current?.status || "on_track",
      note: "",
      achievements: [""],
      challenges: [""],
      nextSteps: [""],
    });
    setCheckInDialogOpen(true);
  };

  const isLoading = loadingObjectives || loadingBigRocks;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Planning</h1>
            <p className="text-muted-foreground mt-1">
              Hierarchical OKRs, Big Rocks, and Progress Tracking for Q{quarter} {year}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={quarter.toString()} onValueChange={(v) => setQuarter(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="enhanced-okrs" data-testid="tab-enhanced-okrs">
              Enhanced OKRs
            </TabsTrigger>
            <TabsTrigger value="big-rocks" data-testid="tab-big-rocks">
              Big Rocks ({bigRocks.length})
            </TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">
              Progress Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enhanced-okrs">
            <OKRTreeView
              objectives={enrichedObjectives}
              onCreateObjective={handleCreateObjective}
              onCreateKeyResult={handleCreateKeyResult}
              onPromoteKeyResult={(id) => promoteKeyResultMutation.mutate(id)}
              onCreateBigRock={handleCreateBigRock}
              onCheckIn={handleCheckIn}
            />
          </TabsContent>

          <TabsContent value="big-rocks">
            <BigRocksSection bigRocks={bigRocks} objectives={objectives} onCreateBigRock={handleCreateBigRock} />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressDashboard objectives={enrichedObjectives} bigRocks={bigRocks} />
          </TabsContent>
        </Tabs>

        {/* Create Objective Dialog */}
        <Dialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Objective</DialogTitle>
              <DialogDescription>
                Define a new objective for Q{quarter} {year}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="obj-title">Title *</Label>
                <Input
                  id="obj-title"
                  value={objectiveForm.title}
                  onChange={(e) => setObjectiveForm({ ...objectiveForm, title: e.target.value })}
                  placeholder="e.g., Increase customer satisfaction"
                  data-testid="input-objective-title"
                />
              </div>
              <div>
                <Label htmlFor="obj-desc">Description</Label>
                <Textarea
                  id="obj-desc"
                  value={objectiveForm.description}
                  onChange={(e) => setObjectiveForm({ ...objectiveForm, description: e.target.value })}
                  placeholder="Describe the objective in detail..."
                  rows={3}
                  data-testid="input-objective-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="obj-level">Level</Label>
                  <Select
                    value={objectiveForm.level}
                    onValueChange={(value) => setObjectiveForm({ ...objectiveForm, level: value })}
                  >
                    <SelectTrigger data-testid="select-objective-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="obj-owner">Owner Email</Label>
                  <Input
                    id="obj-owner"
                    type="email"
                    value={objectiveForm.ownerEmail}
                    onChange={(e) => setObjectiveForm({ ...objectiveForm, ownerEmail: e.target.value })}
                    placeholder="owner@example.com"
                    data-testid="input-objective-owner"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setObjectiveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createObjectiveMutation.mutate(objectiveForm)}
                disabled={createObjectiveMutation.isPending}
                data-testid="button-save-objective"
              >
                {createObjectiveMutation.isPending ? "Creating..." : "Create Objective"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Key Result Dialog */}
        <Dialog open={keyResultDialogOpen} onOpenChange={setKeyResultDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Key Result</DialogTitle>
              <DialogDescription>
                {selectedObjective && `For: ${selectedObjective.title}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="kr-title">Title *</Label>
                <Input
                  id="kr-title"
                  value={keyResultForm.title}
                  onChange={(e) => setKeyResultForm({ ...keyResultForm, title: e.target.value })}
                  placeholder="e.g., Achieve 90% customer satisfaction score"
                  data-testid="input-kr-title"
                />
              </div>
              <div>
                <Label htmlFor="kr-desc">Description</Label>
                <Textarea
                  id="kr-desc"
                  value={keyResultForm.description}
                  onChange={(e) => setKeyResultForm({ ...keyResultForm, description: e.target.value })}
                  placeholder="How will this be measured?"
                  rows={2}
                  data-testid="input-kr-description"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="kr-target">Target Value</Label>
                  <Input
                    id="kr-target"
                    type="number"
                    value={keyResultForm.targetValue}
                    onChange={(e) => setKeyResultForm({ ...keyResultForm, targetValue: parseFloat(e.target.value) || 0 })}
                    data-testid="input-kr-target"
                  />
                </div>
                <div>
                  <Label htmlFor="kr-current">Current Value</Label>
                  <Input
                    id="kr-current"
                    type="number"
                    value={keyResultForm.currentValue}
                    onChange={(e) => setKeyResultForm({ ...keyResultForm, currentValue: parseFloat(e.target.value) || 0 })}
                    data-testid="input-kr-current"
                  />
                </div>
                <div>
                  <Label htmlFor="kr-unit">Unit</Label>
                  <Input
                    id="kr-unit"
                    value={keyResultForm.unit}
                    onChange={(e) => setKeyResultForm({ ...keyResultForm, unit: e.target.value })}
                    placeholder="%"
                    data-testid="input-kr-unit"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="kr-weight">Weight ({keyResultForm.weight}%)</Label>
                <Slider
                  id="kr-weight"
                  value={[keyResultForm.weight]}
                  onValueChange={(value) => setKeyResultForm({ ...keyResultForm, weight: value[0] })}
                  max={100}
                  step={5}
                  data-testid="slider-kr-weight"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setKeyResultDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedObjective) {
                    createKeyResultMutation.mutate({
                      ...keyResultForm,
                      objectiveId: selectedObjective.id,
                    });
                  }
                }}
                disabled={createKeyResultMutation.isPending}
                data-testid="button-save-kr"
              >
                {createKeyResultMutation.isPending ? "Creating..." : "Create Key Result"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Big Rock Dialog */}
        <Dialog open={bigRockDialogOpen} onOpenChange={setBigRockDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Big Rock (Initiative)</DialogTitle>
              <DialogDescription>
                Define a strategic initiative for Q{quarter} {year}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="br-title">Title *</Label>
                <Input
                  id="br-title"
                  value={bigRockForm.title}
                  onChange={(e) => setBigRockForm({ ...bigRockForm, title: e.target.value })}
                  placeholder="e.g., Launch customer feedback system"
                  data-testid="input-bigrock-title"
                />
              </div>
              <div>
                <Label htmlFor="br-desc">Description</Label>
                <Textarea
                  id="br-desc"
                  value={bigRockForm.description}
                  onChange={(e) => setBigRockForm({ ...bigRockForm, description: e.target.value })}
                  placeholder="Describe the initiative..."
                  rows={3}
                  data-testid="input-bigrock-description"
                />
              </div>
              <div>
                <Label htmlFor="br-progress">Initial Progress ({bigRockForm.completionPercentage}%)</Label>
                <Slider
                  id="br-progress"
                  value={[bigRockForm.completionPercentage]}
                  onValueChange={(value) => setBigRockForm({ ...bigRockForm, completionPercentage: value[0] })}
                  max={100}
                  step={5}
                  data-testid="slider-bigrock-progress"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBigRockDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createBigRockMutation.mutate(bigRockForm)}
                disabled={createBigRockMutation.isPending}
                data-testid="button-save-bigrock"
              >
                {createBigRockMutation.isPending ? "Creating..." : "Create Big Rock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Check-In Dialog */}
        <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Check-In</DialogTitle>
              <DialogDescription>
                {checkInEntity && `${checkInEntity.type.replace("_", " ")} - ${checkInEntity.current?.title || checkInEntity.id}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ci-progress">New Progress ({checkInForm.newProgress}%)</Label>
                <Slider
                  id="ci-progress"
                  value={[checkInForm.newProgress]}
                  onValueChange={(value) => setCheckInForm({ ...checkInForm, newProgress: value[0] })}
                  max={100}
                  step={5}
                  data-testid="slider-checkin-progress"
                />
              </div>
              <div>
                <Label htmlFor="ci-status">Status</Label>
                <Select
                  value={checkInForm.newStatus}
                  onValueChange={(value) => setCheckInForm({ ...checkInForm, newStatus: value })}
                >
                  <SelectTrigger data-testid="select-checkin-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="behind">Behind</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ci-note">Note</Label>
                <Textarea
                  id="ci-note"
                  value={checkInForm.note}
                  onChange={(e) => setCheckInForm({ ...checkInForm, note: e.target.value })}
                  placeholder="Add any notes about this check-in..."
                  rows={3}
                  data-testid="textarea-checkin-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (checkInEntity) {
                    createCheckInMutation.mutate({
                      entityType: checkInEntity.type,
                      entityId: checkInEntity.id,
                      ...checkInForm,
                      previousProgress: checkInEntity.current?.progress || 0,
                      createdBy: "current-user", // TODO: Get from auth context
                    });
                  }
                }}
                disabled={createCheckInMutation.isPending}
                data-testid="button-save-checkin"
              >
                {createCheckInMutation.isPending ? "Recording..." : "Record Check-In"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Big Rocks Section Component
function BigRocksSection({ bigRocks, objectives, onCreateBigRock }: any) {
  const getObjectiveTitle = (objId: string) => {
    const obj = objectives.find((o: Objective) => o.id === objId);
    return obj?.title || "Unknown Objective";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Strategic Big Rocks</h2>
        <Button onClick={() => onCreateBigRock("")} data-testid="button-add-bigrock">
          Add Big Rock
        </Button>
      </div>

      {bigRocks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Big Rocks Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first strategic initiative
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bigRocks.map((rock: BigRock) => (
            <Card key={rock.id} className="hover-elevate" data-testid={`card-bigrock-${rock.id}`}>
              <CardHeader>
                <CardTitle className="text-lg">{rock.title}</CardTitle>
                {rock.objectiveId && (
                  <p className="text-sm text-muted-foreground">
                    Linked to: {getObjectiveTitle(rock.objectiveId)}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {rock.description && (
                  <p className="text-sm text-muted-foreground mb-4">{rock.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Completion</span>
                    <span className="font-medium">{rock.completionPercentage}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${rock.completionPercentage}%` }}
                    />
                  </div>
                  <Badge
                    variant={rock.status === "completed" ? "default" : "secondary"}
                    data-testid={`badge-status-${rock.id}`}
                  >
                    {rock.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Progress Dashboard Component
function ProgressDashboard({ objectives, bigRocks }: any) {
  const avgProgress = objectives.length > 0
    ? Math.round(objectives.reduce((acc: number, obj: Objective) => acc + obj.progress, 0) / objectives.length)
    : 0;

  const completedObjectives = objectives.filter((obj: Objective) => obj.status === "completed").length;
  const atRiskObjectives = objectives.filter((obj: Objective) => obj.status === "at_risk").length;
  const onTrackObjectives = objectives.filter((obj: Objective) => obj.status === "on_track").length;

  const completedRocks = bigRocks.filter((rock: BigRock) => rock.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProgress}%</div>
            <p className="text-xs text-muted-foreground">Across all objectives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTrackObjectives}</div>
            <p className="text-xs text-muted-foreground">Objectives on track</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{atRiskObjectives}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedObjectives}/{objectives.length}
            </div>
            <p className="text-xs text-muted-foreground">Objectives completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Objective Progress Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {objectives.map((obj: Objective) => (
              <div key={obj.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{obj.title}</span>
                    <Badge variant={obj.level === "organization" ? "default" : "secondary"}>
                      {obj.level}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{obj.progress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${obj.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Progress is automatically calculated from weighted key result contributions.
          Regular check-ins help track actual vs expected progress over time.
        </AlertDescription>
      </Alert>
    </div>
  );
}