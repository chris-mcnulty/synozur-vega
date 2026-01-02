import { useState, useRef, useEffect, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Sparkles, Trash2, Pencil, Target, Link2, Loader2, Check, AlertCircle, X, AlertTriangle } from "lucide-react";
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
import { useVocabulary } from "@/contexts/VocabularyContext";
import { ValueTagSelector } from "@/components/ValueTagSelector";
import type { Strategy, Foundation, CompanyValue } from "@shared/schema";

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
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { t } = useVocabulary();
  const search = useSearch();
  const [, navigate] = useLocation();
  
  // Parse URL focus parameter for deep linking from Sankey recommendations
  const urlFocus = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("focus");
  }, [search]);
  
  // Track active focus filter for UI display
  const [activeFocusFilter, setActiveFocusFilter] = useState<string | null>(null);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStreamContent, setAiStreamContent] = useState("");
  const [aiDraftReady, setAiDraftReady] = useState(false);
  const [parsedDraft, setParsedDraft] = useState<{
    title: string;
    description: string;
    priority: string;
    suggestedTimeline: string;
    linkedGoals: string[];
    rationale: string;
  } | null>(null);
  const aiContentRef = useRef<HTMLDivElement>(null);
  
  // Value tag states
  const [strategyValueTags, setStrategyValueTags] = useState<string[]>([]);
  const [previousStrategyValueTags, setPreviousStrategyValueTags] = useState<string[]>([]);
  
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
    queryKey: [`/api/strategies/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch foundation to get actual annual goals
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
    retry: false,
  });
  
  // Handle URL focus parameter - set active filter when URL changes
  useEffect(() => {
    if (urlFocus) {
      setActiveFocusFilter(urlFocus);
      // Clear the URL parameter after applying it
      navigate("/strategy", { replace: true });
    }
  }, [urlFocus, navigate]);
  
  // Get annual goals from foundation
  const annualGoals = foundation?.annualGoals || [];
  
  // Compute which goals have no strategies linked to them
  const unlinkedGoals = useMemo(() => {
    if (!annualGoals || annualGoals.length === 0) return [];
    
    // Get all goal indices that are linked to at least one strategy
    const linkedGoalIndices = new Set<number>();
    strategies.forEach(s => {
      (s.linkedGoals || []).forEach((goalIdx: string) => {
        linkedGoalIndices.add(parseInt(goalIdx));
      });
    });
    
    // Find goals that are NOT linked
    return annualGoals
      .map((goal: any, idx: number) => ({
        index: idx,
        title: typeof goal === 'string' ? goal : goal.title,
        year: typeof goal === 'string' ? null : goal.year,
      }))
      .filter(g => !linkedGoalIndices.has(g.index));
  }, [annualGoals, strategies]);
  
  // Filter strategies based on focus filter
  const filteredStrategies = useMemo(() => {
    if (activeFocusFilter === 'unlinked-goals') {
      // When showing unlinked goals, show all strategies so user can link them
      return strategies;
    }
    return strategies;
  }, [strategies, activeFocusFilter]);

  // Helper function to sync value tags
  const syncValueTags = async (
    entityId: string,
    entityType: 'objectives' | 'bigrocks' | 'strategies',
    currentTags: string[],
    previousTags: string[] = []
  ) => {
    try {
      const toAdd = currentTags.filter(tag => !previousTags.includes(tag));
      const toRemove = previousTags.filter(tag => !currentTags.includes(tag));

      for (const valueTitle of toAdd) {
        const res = await fetch(`/api/${entityType}/${entityId}/values`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ valueTitle }),
        });
        if (!res.ok) {
          console.error('Failed to add value tag:', await res.text());
        }
      }

      for (const valueTitle of toRemove) {
        const res = await fetch(`/api/${entityType}/${entityId}/values`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ valueTitle }),
        });
        if (!res.ok) {
          console.error('Failed to remove value tag:', await res.text());
        }
      }
      
      // Invalidate value tags query for this specific entity
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${entityType}`, entityId, 'values'] 
      });
      // Also invalidate the values analytics
      queryClient.invalidateQueries({ 
        queryKey: ['/api/values/analytics/distribution'] 
      });
    } catch (error) {
      console.error('Failed to sync value tags:', error);
      throw error;
    }
  };

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
    setStrategyValueTags([]);
    setPreviousStrategyValueTags([]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: StrategyFormData) => {
      return apiRequest("POST", "/api/strategies", {
        tenantId: currentTenant?.id,
        ...data,
        updatedBy: "Current User",
      });
    },
    onSuccess: async (response: any) => {
      try {
        // Sync value tags after creating strategy
        await syncValueTags(response.id, 'strategies', strategyValueTags, []);
      } catch (error) {
        console.error('Failed to sync value tags:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant?.id}`] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Strategy Created",
        description: "Your strategy has been created successfully.",
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
    onSuccess: async (response: any, variables: { id: string; data: Partial<StrategyFormData> }) => {
      try {
        // Sync value tags after updating strategy
        await syncValueTags(variables.id, 'strategies', strategyValueTags, previousStrategyValueTags);
      } catch (error) {
        console.error('Failed to sync value tags:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant?.id}`] });
      setEditDialogOpen(false);
      setSelectedStrategy(null);
      resetForm();
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
      queryClient.invalidateQueries({ queryKey: [`/api/strategies/${currentTenant?.id}`] });
      setDeleteDialogOpen(false);
      setSelectedStrategy(null);
      toast({
        title: "Strategy Deleted",
        description: "The strategy has been removed.",
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

  // Wait for tenant to load - AFTER all hooks
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show message if user has no tenant access
  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Organization Access</h2>
          <p className="text-muted-foreground">
            Your account is not yet associated with an organization. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Use actual annual goals from Foundations, with fallback
  // Extract goal titles for display (handle both old string format and new AnnualGoal format)
  const availableGoals: string[] = (foundation?.annualGoals || []).map((goal: any) => 
    typeof goal === 'string' ? goal : goal.title
  );

  const openEditDialog = async (strategy: Strategy) => {
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
    
    // Fetch existing value tags
    try {
      const res = await fetch(`/api/strategies/${strategy.id}/values`);
      if (res.ok) {
        const valueTitles = await res.json();
        setStrategyValueTags(valueTitles);
        setPreviousStrategyValueTags(valueTitles);
      } else {
        setStrategyValueTags([]);
        setPreviousStrategyValueTags([]);
      }
    } catch (error) {
      console.error("Failed to fetch strategy value tags:", error);
      setStrategyValueTags([]);
      setPreviousStrategyValueTags([]);
    }
    
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

  const handleAiDraft = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 10) {
      toast({
        title: "Description too short",
        description: "Please provide a more detailed description of the strategy you want to create.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setAiStreamContent("");
    setAiDraftReady(false);
    setParsedDraft(null);

    try {
      const response = await fetch("/api/ai/strategy-draft/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantId: currentTenant.id,
          prompt: aiPrompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate strategy draft");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let buffer = "";
      let fullContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setAiStreamContent(fullContent);
                if (aiContentRef.current) {
                  aiContentRef.current.scrollTop = aiContentRef.current.scrollHeight;
                }
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Try to parse the JSON response
      try {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setParsedDraft({
            title: parsed.title || "",
            description: parsed.description || "",
            priority: parsed.priority || "medium",
            suggestedTimeline: parsed.suggestedTimeline || "",
            linkedGoals: parsed.linkedGoals || [],
            rationale: parsed.rationale || "",
          });
          setAiDraftReady(true);
        } else {
          throw new Error("Could not parse AI response");
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        toast({
          title: "Parsing Error",
          description: "The AI response couldn't be parsed. You can copy the text manually.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error generating strategy draft:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate strategy draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseDraft = () => {
    if (!parsedDraft) return;

    setFormData({
      title: parsedDraft.title,
      description: parsedDraft.description,
      priority: parsedDraft.priority,
      status: "not-started",
      owner: "",
      timeline: parsedDraft.suggestedTimeline,
      linkedGoals: parsedDraft.linkedGoals.filter(g => availableGoals.includes(g)),
    });

    // Close AI dialog and open create dialog
    setAiDialogOpen(false);
    setAiPrompt("");
    setAiStreamContent("");
    setAiDraftReady(false);
    setParsedDraft(null);
    setCreateDialogOpen(true);

    toast({
      title: "Draft Applied",
      description: "The AI-generated strategy has been loaded into the form. Review and save when ready.",
    });
  };

  const handleCloseAiDialog = () => {
    setAiDialogOpen(false);
    setAiPrompt("");
    setAiStreamContent("");
    setAiDraftReady(false);
    setParsedDraft(null);
    setIsGenerating(false);
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
    critical: filteredStrategies.filter(s => s.priority === "critical"),
    high: filteredStrategies.filter(s => s.priority === "high"),
    medium: filteredStrategies.filter(s => s.priority === "medium"),
    low: filteredStrategies.filter(s => s.priority === "low"),
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
            <h1 className="text-3xl font-semibold">Strategies</h1>
            <p className="text-muted-foreground mt-1">
              Define and manage your organization's strategies
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={aiDialogOpen} onOpenChange={handleCloseAiDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-ai-draft">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Draft
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI Strategy Drafting
                  </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 min-h-0 overflow-hidden">
                  {!aiStreamContent && !isGenerating ? (
                    <div className="p-6 space-y-4">
                      <div>
                        <Label>Describe your strategic goal</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Be specific about what you want to achieve. The AI will use your organization's mission, vision, values, and existing strategies for context.
                        </p>
                        <Textarea
                          placeholder="E.g., Expand into European markets with focus on SaaS products, targeting mid-size enterprises..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={5}
                          className="resize-none"
                          data-testid="textarea-ai-prompt"
                        />
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-full" ref={aiContentRef as any}>
                      <div className="p-6 space-y-4">
                        {parsedDraft ? (
                          <div className="space-y-4">
                            <Card>
                              <CardContent className="pt-4 space-y-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Strategy Title</Label>
                                  <p className="font-medium">{parsedDraft.title}</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Description</Label>
                                  <p className="text-sm whitespace-pre-wrap">{parsedDraft.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Priority</Label>
                                    <Badge variant={getPriorityVariant(parsedDraft.priority) as any} className="mt-1">
                                      {parsedDraft.priority}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Suggested Timeline</Label>
                                    <p className="text-sm">{parsedDraft.suggestedTimeline}</p>
                                  </div>
                                </div>
                                {parsedDraft.linkedGoals.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Linked Goals</Label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {parsedDraft.linkedGoals.map((goal, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {goal}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {parsedDraft.rationale && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Rationale</Label>
                                    <p className="text-sm text-muted-foreground italic">{parsedDraft.rationale}</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-x-auto">
                                {aiStreamContent}
                              </pre>
                            </div>
                            {isGenerating && (
                              <div className="flex items-center gap-2 text-primary animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Generating strategy draft...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 px-6 py-4 border-t flex-shrink-0 bg-background">
                  <div>
                    {aiStreamContent && !isGenerating && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiStreamContent("");
                          setAiDraftReady(false);
                          setParsedDraft(null);
                        }}
                        data-testid="button-new-draft"
                      >
                        New Draft
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCloseAiDialog}
                    >
                      Cancel
                    </Button>
                    {!aiStreamContent && !isGenerating ? (
                      <Button 
                        onClick={handleAiDraft} 
                        disabled={!aiPrompt.trim() || aiPrompt.length < 10}
                        data-testid="button-generate-draft"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Draft
                      </Button>
                    ) : aiDraftReady && parsedDraft ? (
                      <Button 
                        onClick={handleUseDraft}
                        data-testid="button-use-draft"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Use This Draft
                      </Button>
                    ) : null}
                  </div>
                </div>
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
                  <DialogTitle>Create Strategy</DialogTitle>
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
                      placeholder="Describe the strategy in detail..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      data-testid="textarea-strategy-description"
                    />
                  </div>

                  <div>
                    <Label>Company Values</Label>
                    <ValueTagSelector
                      availableValues={foundation?.values || []}
                      selectedValues={strategyValueTags}
                      onValuesChange={setStrategyValueTags}
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
                          data-testid={`badge-goal-${goal?.toLowerCase().replace(/\s+/g, '-')}`}
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

        {/* Unlinked Goals Banner - shown when navigated from Sankey or when there are unlinked goals */}
        {activeFocusFilter === 'unlinked-goals' && unlinkedGoals.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <strong className="text-amber-800 dark:text-amber-200">
                    {unlinkedGoals.length} Annual {unlinkedGoals.length === 1 ? t('goal', 'singular') : t('goal', 'plural')} {unlinkedGoals.length === 1 ? 'has' : 'have'} no aligned strategies:
                  </strong>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFocusFilter(null)}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear filter
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {unlinkedGoals.map((goal) => (
                  <Badge 
                    key={goal.index} 
                    variant="outline" 
                    className="border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    {goal.title}
                    {goal.year && <span className="ml-1 text-amber-600">({goal.year})</span>}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Edit a strategy below and link it to one of these goals, or create a new strategy.
              </p>
            </AlertDescription>
          </Alert>
        )}

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
                    Get started by creating your first strategy
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
              <DialogTitle>Edit Strategy</DialogTitle>
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

              <div>
                <Label>Company Values</Label>
                <ValueTagSelector
                  availableValues={foundation?.values || []}
                  selectedValues={strategyValueTags}
                  onValuesChange={setStrategyValueTags}
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
                      data-testid={`badge-edit-goal-${goal?.toLowerCase().replace(/\s+/g, '-')}`}
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
  // Fetch value tags for this strategy
  const { data: strategyValues = [] } = useQuery<string[]>({
    queryKey: ['/api/strategies', strategy.id, 'values'],
    queryFn: async () => {
      const res = await fetch(`/api/strategies/${strategy.id}/values`);
      if (!res.ok) return [];
      return res.json();
    },
  });

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
            
            {/* Company Values */}
            {strategyValues.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {strategyValues.map((valueTitle: string) => (
                    <Badge key={valueTitle} variant="outline" className="text-xs">
                      {valueTitle}
                    </Badge>
                  ))}
                </div>
              </div>
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
                  <span>{strategy.owner}</span>
                </div>
              )}
              {strategy.timeline && (
                <div>
                  <span className="text-muted-foreground">Timeline:</span>{" "}
                  <span>{strategy.timeline}</span>
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
