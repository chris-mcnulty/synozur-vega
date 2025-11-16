import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Sparkles, Trash2, Pencil, Target, Link2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import type { Strategy } from "@shared/schema";

const availableGoals = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
  "Strengthen brand presence",
  "Foster sustainable practices",
];

const priorityLevels = [
  { value: "critical", label: "Critical", variant: "destructive" },
  { value: "high", label: "High Priority", variant: "default" },
  { value: "medium", label: "Medium Priority", variant: "secondary" },
  { value: "low", label: "Low Priority", variant: "outline" },
] as const;

const statusOptions = [
  { value: "not-started", label: "Not Started" },
  { value: "in-progress", label: "In Progress" },
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "completed", label: "Completed" },
];

interface StrategyFormData {
  title: string;
  description: string;
  priority: string;
  status: string;
  owner: string;
  timeline: string;
  linkedGoals: string[];
}

export default function Strategy() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  
  const [formData, setFormData] = useState<StrategyFormData>({
    title: "",
    description: "",
    priority: "medium",
    status: "not-started",
    owner: "",
    timeline: "",
    linkedGoals: [],
  });

  const { data: strategies = [], isLoading } = useQuery<Strategy[]>({
    queryKey: [`/api/strategies/${currentTenant.id}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: StrategyFormData) => {
      return apiRequest("POST", "/api/strategies", {
        tenantId: currentTenant.id,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant.id}`] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Strategy Created",
        description: "Your strategic priority has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create strategy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StrategyFormData> }) => {
      return apiRequest("PATCH", `/api/strategies/${id}`, {
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant.id}`] });
      setEditDialogOpen(false);
      setSelectedStrategy(null);
      toast({
        title: "Strategy Updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update strategy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/strategies/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant.id}`] });
      setDeleteDialogOpen(false);
      setSelectedStrategy(null);
      toast({
        title: "Strategy Deleted",
        description: "The strategic priority has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete strategy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      status: "not-started",
      owner: "",
      timeline: "",
      linkedGoals: [],
    });
  };

  const openEditDialog = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setFormData({
      title: strategy.title,
      description: strategy.description || "",
      priority: strategy.priority || "medium",
      status: strategy.status || "not-started",
      owner: strategy.owner || "",
      timeline: strategy.timeline || "",
      linkedGoals: strategy.linkedGoals || [],
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a strategy title.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedStrategy) return;
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a strategy title.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: selectedStrategy.id,
      data: formData,
    });
  };

  const handleDelete = () => {
    if (!selectedStrategy) return;
    deleteMutation.mutate(selectedStrategy.id);
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      linkedGoals: prev.linkedGoals.includes(goal)
        ? prev.linkedGoals.filter(g => g !== goal)
        : [...prev.linkedGoals, goal],
    }));
  };

  const handleAiDraft = () => {
    toast({
      title: "AI Feature",
      description: "AI drafting will be available in a future update.",
    });
    setAiDialogOpen(false);
    setAiPrompt("");
  };

  const getPriorityVariant = (priority: string) => {
    const level = priorityLevels.find(p => p.value === priority);
    return level?.variant || "secondary";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 dark:text-green-400";
      case "on-track": return "text-blue-600 dark:text-blue-400";
      case "in-progress": return "text-yellow-600 dark:text-yellow-400";
      case "at-risk": return "text-orange-600 dark:text-orange-400";
      default: return "text-muted-foreground";
    }
  };

  const groupedStrategies = {
    critical: strategies.filter(s => s.priority === "critical"),
    high: strategies.filter(s => s.priority === "high"),
    medium: strategies.filter(s => s.priority === "medium"),
    low: strategies.filter(s => s.priority === "low"),
  };

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
            <h1 className="text-3xl font-bold">Strategic Priorities</h1>
            <p className="text-muted-foreground mt-1">
              Define and manage your organization's strategic priorities
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-ai-draft">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Draft
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AI Strategy Drafting</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Describe your strategic goal</Label>
                    <Textarea
                      placeholder="E.g., Expand into European markets with focus on SaaS products..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      data-testid="textarea-ai-prompt"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAiDraft} data-testid="button-generate-draft">
                    Generate Draft
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-strategy">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Strategy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Strategic Priority</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Strategy Title *</Label>
                    <Input
                      id="title"
                      placeholder="E.g., Launch New Product Line"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      data-testid="input-strategy-title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the strategic priority in detail..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      data-testid="textarea-strategy-description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority Level</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="owner">Owner</Label>
                      <Input
                        id="owner"
                        placeholder="E.g., Sarah Chen"
                        value={formData.owner}
                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                        data-testid="input-owner"
                      />
                    </div>

                    <div>
                      <Label htmlFor="timeline">Timeline</Label>
                      <Input
                        id="timeline"
                        placeholder="E.g., Q1 2025"
                        value={formData.timeline}
                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                        data-testid="input-timeline"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Linked Annual Goals</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {availableGoals.map((goal) => (
                        <Badge
                          key={goal}
                          variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleGoal(goal)}
                          data-testid={`badge-goal-${goal.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    data-testid="button-save-strategy"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Strategy"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All Strategies ({strategies.length})
            </TabsTrigger>
            <TabsTrigger value="critical" data-testid="tab-critical">
              Critical ({groupedStrategies.critical.length})
            </TabsTrigger>
            <TabsTrigger value="high" data-testid="tab-high">
              High ({groupedStrategies.high.length})
            </TabsTrigger>
            <TabsTrigger value="medium" data-testid="tab-medium">
              Medium ({groupedStrategies.medium.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {strategies.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Strategies Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Get started by creating your first strategic priority
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Strategy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {strategies.map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    getPriorityVariant={getPriorityVariant}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {["critical", "high", "medium"].map((priority) => (
            <TabsContent key={priority} value={priority} className="space-y-4">
              {groupedStrategies[priority as keyof typeof groupedStrategies].length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No {priority} priority strategies</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {groupedStrategies[priority as keyof typeof groupedStrategies].map((strategy) => (
                    <StrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                      getPriorityVariant={getPriorityVariant}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Strategic Priority</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Strategy Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="textarea-edit-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority Level</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger data-testid="select-edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Owner</Label>
                  <Input
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    data-testid="input-edit-owner"
                  />
                </div>

                <div>
                  <Label>Timeline</Label>
                  <Input
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    data-testid="input-edit-timeline"
                  />
                </div>
              </div>

              <div>
                <Label>Linked Annual Goals</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableGoals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={formData.linkedGoals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleGoal(goal)}
                      data-testid={`badge-edit-goal-${goal.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedStrategy(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                data-testid="button-update-strategy"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Strategy</DialogTitle>
            </DialogHeader>
            <p>
              Are you sure you want to delete "{selectedStrategy?.title}"? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedStrategy(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

interface StrategyCardProps {
  strategy: Strategy;
  onEdit: (strategy: Strategy) => void;
  onDelete: (strategy: Strategy) => void;
  getPriorityVariant: (priority: string) => "destructive" | "default" | "secondary" | "outline";
  getStatusColor: (status: string) => string;
}

function StrategyCard({ strategy, onEdit, onDelete, getPriorityVariant, getStatusColor }: StrategyCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-strategy-${strategy.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getPriorityVariant(strategy.priority || "medium")}>
                {strategy.priority || "Medium"}
              </Badge>
              {strategy.status && (
                <span className={`text-sm font-medium ${getStatusColor(strategy.status)}`}>
                  {statusOptions.find(s => s.value === strategy.status)?.label}
                </span>
              )}
            </div>
            <CardTitle className="text-xl">{strategy.title}</CardTitle>
            {strategy.description && (
              <CardDescription className="mt-2">{strategy.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(strategy)}
              data-testid={`button-edit-${strategy.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(strategy)}
              data-testid={`button-delete-${strategy.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(strategy.owner || strategy.timeline) && (
            <div className="flex gap-6 text-sm">
              {strategy.owner && (
                <div>
                  <span className="text-muted-foreground">Owner:</span>{" "}
                  <span className="font-medium">{strategy.owner}</span>
                </div>
              )}
              {strategy.timeline && (
                <div>
                  <span className="text-muted-foreground">Timeline:</span>{" "}
                  <span className="font-medium">{strategy.timeline}</span>
                </div>
              )}
            </div>
          )}
          
          {strategy.linkedGoals && strategy.linkedGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Link2 className="w-4 h-4" />
                <span>Linked Annual Goals</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {strategy.linkedGoals.map((goal, index) => (
                  <Badge key={index} variant="secondary">
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
