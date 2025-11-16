import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  TrendingUp,
  Target,
  Pencil,
  Trash2,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Okr, Kpi, Rock } from "@shared/schema";
import { useTenant } from "@/contexts/TenantContext";
import { getCurrentQuarter } from "@/lib/quarters";

const availableGoals = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
];

const availableStrategies = [
  "Launch New Product Line",
  "Expand Market Presence",
  "Improve Customer Retention",
];

const availablePeople = [
  "Sarah Chen",
  "Michael Torres",
  "Alex Kim",
  "Jordan Lee",
];

export default function Planning() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [selectedTab, setSelectedTab] = useState("okrs");
  
  // Get current quarter dynamically
  const currentPeriod = getCurrentQuarter();
  const [quarter, setQuarter] = useState(currentPeriod.quarter);
  const [year, setYear] = useState(currentPeriod.year);

  const { data: okrs = [], isLoading: loadingOkrs } = useQuery<Okr[]>({
    queryKey: [`/api/okrs/${currentTenant.id}`, { quarter, year }],
    queryFn: async () => {
      const res = await fetch(`/api/okrs/${currentTenant.id}?quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch OKRs");
      return res.json();
    },
  });

  const { data: kpis = [], isLoading: loadingKpis } = useQuery<Kpi[]>({
    queryKey: [`/api/kpis/${currentTenant.id}`, { quarter, year }],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/${currentTenant.id}?quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
  });

  const { data: rocks = [], isLoading: loadingRocks } = useQuery<Rock[]>({
    queryKey: [`/api/rocks/${currentTenant.id}`, { quarter, year }],
    queryFn: async () => {
      const res = await fetch(`/api/rocks/${currentTenant.id}?quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch rocks");
      return res.json();
    },
  });

  const isLoading = loadingOkrs || loadingKpis || loadingRocks;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="grid gap-4 mt-8">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quarterly Planning</h1>
            <p className="text-muted-foreground mt-1">
              Manage OKRs, KPIs, and quarterly rocks for Q{quarter} {year}
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
            <TabsTrigger value="okrs" data-testid="tab-okrs">
              OKRs ({okrs.length})
            </TabsTrigger>
            <TabsTrigger value="kpis" data-testid="tab-kpis">
              KPIs ({kpis.length})
            </TabsTrigger>
            <TabsTrigger value="rocks" data-testid="tab-rocks">
              Big Rocks ({rocks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="okrs">
            <OkrsSection okrs={okrs} quarter={quarter} year={year} />
          </TabsContent>

          <TabsContent value="kpis">
            <KpisSection kpis={kpis} quarter={quarter} year={year} />
          </TabsContent>

          <TabsContent value="rocks">
            <RocksSection rocks={rocks} quarter={quarter} year={year} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OkrsSection({ okrs, quarter, year }: { okrs: Okr[]; quarter: number; year: number }) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOkr, setSelectedOkr] = useState<Okr | null>(null);
  const [formData, setFormData] = useState({
    objective: "",
    progress: 0,
    department: "",
    assignedTo: "",
    linkedGoals: [] as string[],
    linkedStrategies: [] as string[],
    keyResults: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/okrs", {
        tenantId: currentTenant.id,
        quarter,
        year,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okrs/${currentTenant.id}`, { quarter, year }] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "OKR Created", description: "Successfully created new OKR" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create OKR", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/okrs/${id}`, { ...data, updatedBy: "Current User" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okrs/${currentTenant.id}`, { quarter, year }] });
      setEditDialogOpen(false);
      setSelectedOkr(null);
      toast({ title: "OKR Updated", description: "Successfully updated OKR" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update OKR", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/okrs/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okrs/${currentTenant.id}`, { quarter, year }] });
      setDeleteDialogOpen(false);
      setSelectedOkr(null);
      toast({ title: "OKR Deleted", description: "Successfully deleted OKR" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete OKR", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      objective: "",
      progress: 0,
      department: "",
      assignedTo: "",
      linkedGoals: [],
      linkedStrategies: [],
      keyResults: [],
    });
  };

  const openEditDialog = (okr: Okr) => {
    setSelectedOkr(okr);
    setFormData({
      objective: okr.objective,
      progress: okr.progress || 0,
      department: okr.department || "",
      assignedTo: okr.assignedTo || "",
      linkedGoals: okr.linkedGoals || [],
      linkedStrategies: okr.linkedStrategies || [],
      keyResults: okr.keyResults || [],
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.objective.trim()) {
      toast({ title: "Validation Error", description: "Please enter an objective", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedOkr) return;
    if (!formData.objective.trim()) {
      toast({ title: "Validation Error", description: "Please enter an objective", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedOkr.id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedOkr) return;
    deleteMutation.mutate(selectedOkr.id);
  };

  const [newKeyResult, setNewKeyResult] = useState("");

  const addKeyResult = () => {
    if (newKeyResult.trim()) {
      setFormData({ ...formData, keyResults: [...formData.keyResults, newKeyResult] });
      setNewKeyResult("");
    }
  };

  const removeKeyResult = (index: number) => {
    setFormData({
      ...formData,
      keyResults: formData.keyResults.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Objectives & Key Results</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-okr">
              <Plus className="w-4 h-4 mr-2" />
              Add OKR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create OKR for Q{quarter} {year}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="objective">Objective *</Label>
                <Input
                  id="objective"
                  placeholder="E.g., Launch innovative product suite"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  data-testid="input-objective"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="E.g., Product"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    data-testid="input-department"
                  />
                </div>
                <div>
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <Select
                    value={formData.assignedTo}
                    onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                  >
                    <SelectTrigger data-testid="select-assigned-to">
                      <SelectValue placeholder="Select person" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePeople.map((person) => (
                        <SelectItem key={person} value={person}>
                          {person}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Progress (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  data-testid="input-progress"
                />
              </div>

              <div>
                <Label>Key Results</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter a key result"
                    value={newKeyResult}
                    onChange={(e) => setNewKeyResult(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addKeyResult()}
                    data-testid="input-key-result"
                  />
                  <Button onClick={addKeyResult} data-testid="button-add-key-result">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keyResults.map((kr, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyResult(index)}
                      data-testid={`badge-key-result-${index}`}
                    >
                      {kr} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Linked Goals</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableGoals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newGoals = formData.linkedGoals.includes(goal)
                          ? formData.linkedGoals.filter(g => g !== goal)
                          : [...formData.linkedGoals, goal];
                        setFormData({ ...formData, linkedGoals: newGoals });
                      }}
                      data-testid={`badge-goal-${goal.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Linked Strategies</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableStrategies.map((strategy) => (
                    <Badge
                      key={strategy}
                      variant={formData.linkedStrategies.includes(strategy) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newStrategies = formData.linkedStrategies.includes(strategy)
                          ? formData.linkedStrategies.filter(s => s !== strategy)
                          : [...formData.linkedStrategies, strategy];
                        setFormData({ ...formData, linkedStrategies: newStrategies });
                      }}
                      data-testid={`badge-strategy-${strategy.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {strategy}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-okr">
                {createMutation.isPending ? "Creating..." : "Create OKR"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {okrs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No OKRs for Q{quarter} {year}</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first objective and key results
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-okr">
              <Plus className="w-4 h-4 mr-2" />
              Create OKR
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {okrs.map((okr) => (
            <Card key={okr.id} className="hover-elevate" data-testid={`card-okr-${okr.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{okr.objective}</CardTitle>
                    {(okr.department || okr.assignedTo) && (
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {okr.department && <span>Department: {okr.department}</span>}
                        {okr.assignedTo && <span>Owner: {okr.assignedTo}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(okr)}
                      data-testid={`button-edit-okr-${okr.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedOkr(okr); setDeleteDialogOpen(true); }}
                      data-testid={`button-delete-okr-${okr.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{okr.progress || 0}%</span>
                  </div>
                  <Progress value={okr.progress || 0} />
                </div>

                {okr.keyResults && okr.keyResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Key Results</h4>
                    <ul className="space-y-1">
                      {okr.keyResults.map((kr, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <span>{kr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {((okr.linkedGoals && okr.linkedGoals.length > 0) || (okr.linkedStrategies && okr.linkedStrategies.length > 0)) && (
                  <div className="space-y-2">
                    {okr.linkedGoals && okr.linkedGoals.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Link2 className="w-4 h-4" />
                          <span>Linked Goals</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {okr.linkedGoals.map((goal, index) => (
                            <Badge key={index} variant="secondary">{goal}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {okr.linkedStrategies && okr.linkedStrategies.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Link2 className="w-4 h-4" />
                          <span>Linked Strategies</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {okr.linkedStrategies.map((strategy, index) => (
                            <Badge key={index} variant="secondary">{strategy}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit OKR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Objective *</Label>
              <Input
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                data-testid="input-edit-objective"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  data-testid="input-edit-department"
                />
              </div>
              <div>
                <Label>Assigned To</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                >
                  <SelectTrigger data-testid="select-edit-assigned-to">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeople.map((person) => (
                      <SelectItem key={person} value={person}>
                        {person}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Progress (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-progress"
              />
            </div>

            <div>
              <Label>Key Results</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Enter a key result"
                  value={newKeyResult}
                  onChange={(e) => setNewKeyResult(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyResult()}
                  data-testid="input-edit-key-result"
                />
                <Button onClick={addKeyResult} data-testid="button-edit-add-key-result">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.keyResults.map((kr, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeKeyResult(index)}
                    data-testid={`badge-edit-key-result-${index}`}
                  >
                    {kr} ×
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Linked Goals</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableGoals.map((goal) => (
                  <Badge
                    key={goal}
                    variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newGoals = formData.linkedGoals.includes(goal)
                        ? formData.linkedGoals.filter(g => g !== goal)
                        : [...formData.linkedGoals, goal];
                      setFormData({ ...formData, linkedGoals: newGoals });
                    }}
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Linked Strategies</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableStrategies.map((strategy) => (
                  <Badge
                    key={strategy}
                    variant={formData.linkedStrategies.includes(strategy) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newStrategies = formData.linkedStrategies.includes(strategy)
                        ? formData.linkedStrategies.filter(s => s !== strategy)
                        : [...formData.linkedStrategies, strategy];
                      setFormData({ ...formData, linkedStrategies: newStrategies });
                    }}
                  >
                    {strategy}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedOkr(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-update-okr">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OKR</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this OKR? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedOkr(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-okr"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpisSection({ kpis, quarter, year }: { kpis: Kpi[]; quarter: number; year: number }) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<Kpi | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    value: 0,
    change: 0,
    target: 0,
    linkedGoals: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/kpis", {
        tenantId: currentTenant.id,
        quarter,
        year,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kpis/${currentTenant.id}`, { quarter, year }] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "KPI Created", description: "Successfully created new KPI" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/kpis/${id}`, { ...data, updatedBy: "Current User" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kpis/${currentTenant.id}`, { quarter, year }] });
      setEditDialogOpen(false);
      setSelectedKpi(null);
      toast({ title: "KPI Updated", description: "Successfully updated KPI" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/kpis/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kpis/${currentTenant.id}`, { quarter, year }] });
      setDeleteDialogOpen(false);
      setSelectedKpi(null);
      toast({ title: "KPI Deleted", description: "Successfully deleted KPI" });
    },
  });

  const resetForm = () => {
    setFormData({
      label: "",
      value: 0,
      change: 0,
      target: 0,
      linkedGoals: [],
    });
  };

  const openEditDialog = (kpi: Kpi) => {
    setSelectedKpi(kpi);
    setFormData({
      label: kpi.label,
      value: kpi.value || 0,
      change: kpi.change || 0,
      target: kpi.target || 0,
      linkedGoals: kpi.linkedGoals || [],
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.label.trim()) {
      toast({ title: "Validation Error", description: "Please enter a KPI label", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedKpi) return;
    updateMutation.mutate({ id: selectedKpi.id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedKpi) return;
    deleteMutation.mutate(selectedKpi.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-kpi">
              <Plus className="w-4 h-4 mr-2" />
              Add KPI
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create KPI for Q{quarter} {year}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">KPI Label *</Label>
                <Input
                  id="label"
                  placeholder="E.g., Monthly Recurring Revenue"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  data-testid="input-kpi-label"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="value">Current Value</Label>
                  <Input
                    id="value"
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                    data-testid="input-kpi-value"
                  />
                </div>
                <div>
                  <Label htmlFor="change">Change (%)</Label>
                  <Input
                    id="change"
                    type="number"
                    value={formData.change}
                    onChange={(e) => setFormData({ ...formData, change: parseInt(e.target.value) || 0 })}
                    data-testid="input-kpi-change"
                  />
                </div>
                <div>
                  <Label htmlFor="target">Target</Label>
                  <Input
                    id="target"
                    type="number"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) || 0 })}
                    data-testid="input-kpi-target"
                  />
                </div>
              </div>

              <div>
                <Label>Linked Goals</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableGoals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newGoals = formData.linkedGoals.includes(goal)
                          ? formData.linkedGoals.filter(g => g !== goal)
                          : [...formData.linkedGoals, goal];
                        setFormData({ ...formData, linkedGoals: newGoals });
                      }}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-kpi">
                {createMutation.isPending ? "Creating..." : "Create KPI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {kpis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No KPIs for Q{quarter} {year}</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first key performance indicator
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-kpi">
              <Plus className="w-4 h-4 mr-2" />
              Create KPI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.id} className="hover-elevate" data-testid={`card-kpi-${kpi.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{kpi.label}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(kpi)}
                      data-testid={`button-edit-kpi-${kpi.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedKpi(kpi); setDeleteDialogOpen(true); }}
                      data-testid={`button-delete-kpi-${kpi.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-bold">{kpi.value || 0}</span>
                  {kpi.change !== null && kpi.change !== undefined && (
                    <Badge variant={kpi.change >= 0 ? "default" : "destructive"}>
                      {kpi.change >= 0 ? "+" : ""}{kpi.change}%
                    </Badge>
                  )}
                </div>
                {kpi.target !== null && kpi.target !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    Target: {kpi.target}
                  </div>
                )}
                {kpi.linkedGoals && kpi.linkedGoals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Link2 className="w-4 h-4" />
                      <span>Linked Goals</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {kpi.linkedGoals.map((goal, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit KPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>KPI Label *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                data-testid="input-edit-kpi-label"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Current Value</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-kpi-value"
                />
              </div>
              <div>
                <Label>Change (%)</Label>
                <Input
                  type="number"
                  value={formData.change}
                  onChange={(e) => setFormData({ ...formData, change: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-kpi-change"
                />
              </div>
              <div>
                <Label>Target</Label>
                <Input
                  type="number"
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-kpi-target"
                />
              </div>
            </div>

            <div>
              <Label>Linked Goals</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableGoals.map((goal) => (
                  <Badge
                    key={goal}
                    variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newGoals = formData.linkedGoals.includes(goal)
                        ? formData.linkedGoals.filter(g => g !== goal)
                        : [...formData.linkedGoals, goal];
                      setFormData({ ...formData, linkedGoals: newGoals });
                    }}
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedKpi(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-update-kpi">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete KPI</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this KPI? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedKpi(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-kpi"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RocksSection({ rocks, quarter, year }: { rocks: Rock[]; quarter: number; year: number }) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRock, setSelectedRock] = useState<Rock | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    status: "not-started",
    owner: "",
    linkedGoals: [] as string[],
    linkedStrategies: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/rocks", {
        tenantId: currentTenant.id,
        quarter,
        year,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rocks/${currentTenant.id}`, { quarter, year }] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Rock Created", description: "Successfully created new rock" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/rocks/${id}`, { ...data, updatedBy: "Current User" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rocks/${currentTenant.id}`, { quarter, year }] });
      setEditDialogOpen(false);
      setSelectedRock(null);
      toast({ title: "Rock Updated", description: "Successfully updated rock" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rocks/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rocks/${currentTenant.id}`, { quarter, year }] });
      setDeleteDialogOpen(false);
      setSelectedRock(null);
      toast({ title: "Rock Deleted", description: "Successfully deleted rock" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      status: "not-started",
      owner: "",
      linkedGoals: [],
      linkedStrategies: [],
    });
  };

  const openEditDialog = (rock: Rock) => {
    setSelectedRock(rock);
    setFormData({
      title: rock.title,
      status: rock.status || "not-started",
      owner: rock.owner || "",
      linkedGoals: rock.linkedGoals || [],
      linkedStrategies: rock.linkedStrategies || [],
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast({ title: "Validation Error", description: "Please enter a rock title", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedRock) return;
    updateMutation.mutate({ id: selectedRock.id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedRock) return;
    deleteMutation.mutate(selectedRock.id);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in-progress": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Quarterly Big Rocks</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-rock">
              <Plus className="w-4 h-4 mr-2" />
              Add Rock
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Rock for Q{quarter} {year}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Rock Title *</Label>
                <Input
                  id="title"
                  placeholder="E.g., Complete product migration"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-rock-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger data-testid="select-rock-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not-started">Not Started</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <Select
                    value={formData.owner}
                    onValueChange={(value) => setFormData({ ...formData, owner: value })}
                  >
                    <SelectTrigger data-testid="select-rock-owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePeople.map((person) => (
                        <SelectItem key={person} value={person}>
                          {person}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Linked Goals</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableGoals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newGoals = formData.linkedGoals.includes(goal)
                          ? formData.linkedGoals.filter(g => g !== goal)
                          : [...formData.linkedGoals, goal];
                        setFormData({ ...formData, linkedGoals: newGoals });
                      }}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Linked Strategies</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableStrategies.map((strategy) => (
                    <Badge
                      key={strategy}
                      variant={formData.linkedStrategies.includes(strategy) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newStrategies = formData.linkedStrategies.includes(strategy)
                          ? formData.linkedStrategies.filter(s => s !== strategy)
                          : [...formData.linkedStrategies, strategy];
                        setFormData({ ...formData, linkedStrategies: newStrategies });
                      }}
                    >
                      {strategy}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-save-rock">
                {createMutation.isPending ? "Creating..." : "Create Rock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rocks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Rocks for Q{quarter} {year}</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first quarterly big rock
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-rock">
              <Plus className="w-4 h-4 mr-2" />
              Create Rock
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rocks.map((rock) => (
            <Card key={rock.id} className="hover-elevate" data-testid={`card-rock-${rock.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getStatusBadgeVariant(rock.status || "not-started")}>
                        {rock.status || "not-started"}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{rock.title}</CardTitle>
                    {rock.owner && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Owner: {rock.owner}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(rock)}
                      data-testid={`button-edit-rock-${rock.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setSelectedRock(rock); setDeleteDialogOpen(true); }}
                      data-testid={`button-delete-rock-${rock.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {((rock.linkedGoals && rock.linkedGoals.length > 0) || (rock.linkedStrategies && rock.linkedStrategies.length > 0)) && (
                  <div className="space-y-2">
                    {rock.linkedGoals && rock.linkedGoals.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Link2 className="w-4 h-4" />
                          <span>Linked Goals</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rock.linkedGoals.map((goal, index) => (
                            <Badge key={index} variant="secondary">{goal}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {rock.linkedStrategies && rock.linkedStrategies.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Link2 className="w-4 h-4" />
                          <span>Linked Strategies</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rock.linkedStrategies.map((strategy, index) => (
                            <Badge key={index} variant="secondary">{strategy}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Rock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rock Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-edit-rock-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-edit-rock-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Owner</Label>
                <Select
                  value={formData.owner}
                  onValueChange={(value) => setFormData({ ...formData, owner: value })}
                >
                  <SelectTrigger data-testid="select-edit-rock-owner">
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeople.map((person) => (
                      <SelectItem key={person} value={person}>
                        {person}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Linked Goals</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableGoals.map((goal) => (
                  <Badge
                    key={goal}
                    variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newGoals = formData.linkedGoals.includes(goal)
                        ? formData.linkedGoals.filter(g => g !== goal)
                        : [...formData.linkedGoals, goal];
                      setFormData({ ...formData, linkedGoals: newGoals });
                    }}
                  >
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Linked Strategies</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableStrategies.map((strategy) => (
                  <Badge
                    key={strategy}
                    variant={formData.linkedStrategies.includes(strategy) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newStrategies = formData.linkedStrategies.includes(strategy)
                        ? formData.linkedStrategies.filter(s => s !== strategy)
                        : [...formData.linkedStrategies, strategy];
                      setFormData({ ...formData, linkedStrategies: newStrategies });
                    }}
                  >
                    {strategy}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedRock(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-update-rock">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rock</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this rock? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedRock(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-rock"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
