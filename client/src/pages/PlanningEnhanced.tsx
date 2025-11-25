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
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentQuarter } from "@/lib/quarters";
import { OKRTreeView } from "@/components/okr/OKRTreeView";
import { WeightManager } from "@/components/WeightManager";
import { ValueTagSelector } from "@/components/ValueTagSelector";
import { TrendingUp, Target, Activity, AlertCircle, CheckCircle, Loader2, Pencil, Trash2, History, Edit, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Foundation, CompanyValue } from "@shared/schema";
import { ProgressSummaryDialog } from "@/components/ProgressSummaryDialog";

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
  metricType: string;
  currentValue: number;
  targetValue: number;
  initialValue?: number;
  unit: string;
  progress: number;
  weight: number;
  isWeightLocked?: boolean;
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
  linkedStrategies?: string[];
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
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("enhanced-okrs");
  const [quarter, setQuarter] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [level, setLevel] = useState<string>("all");
  const [teamId, setTeamId] = useState<string>("all");

  // Fetch teams for filtering
  const { data: teamsData = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: [`/api/okr/teams`, currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return [];
      }
      const res = await fetch(`/api/okr/teams?tenantId=${currentTenant.id}`);
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch foundation for fiscal year settings
  const { data: foundation } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
  });

  // Fetch strategies for linking
  const { data: strategies = [] } = useQuery<any[]>({
    queryKey: [`/api/strategies/${currentTenant?.id}`],
    enabled: !!currentTenant?.id,
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
    queryKey: [`/api/okr/objectives`, currentTenant?.id, quarter, year, level, teamId],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return [];
      }
      const levelParam = level !== 'all' ? `&level=${level}` : '';
      const teamParam = teamId !== 'all' ? `&teamId=${teamId}` : '';
      const res = await fetch(`/api/okr/objectives?tenantId=${currentTenant.id}&quarter=${quarter}&year=${year}${levelParam}${teamParam}`);
      if (!res.ok) throw new Error("Failed to fetch objectives");
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  const { data: bigRocks = [], isLoading: loadingBigRocks } = useQuery<BigRock[]>({
    queryKey: [`/api/okr/big-rocks`, currentTenant?.id, quarter, year],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return [];
      }
      const res = await fetch(`/api/okr/big-rocks?tenantId=${currentTenant.id}&quarter=${quarter}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch big rocks");
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Enrich objectives with their key results and big rocks
  const [enrichedObjectives, setEnrichedObjectives] = useState<any[]>([]);
  
  useEffect(() => {
    const enrichData = async () => {
      if (objectives.length === 0) {
        setEnrichedObjectives([]);
        return;
      }
      
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
    
    enrichData();
    // Use a hash that includes progress to detect data changes, not just ID changes
  }, [JSON.stringify(objectives.map(o => ({ id: o.id, progress: o.progress }))), JSON.stringify(bigRocks.map(b => ({ id: b.id, completionPercentage: b.completionPercentage })))]);

  // Dialog states
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [keyResultDialogOpen, setKeyResultDialogOpen] = useState(false);
  const [bigRockDialogOpen, setBigRockDialogOpen] = useState(false);
  const [bigRockDialogMode, setBigRockDialogMode] = useState<"create" | "link">("create");
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInHistoryDialogOpen, setCheckInHistoryDialogOpen] = useState(false);
  const [selectedKRForHistory, setSelectedKRForHistory] = useState<KeyResult | null>(null);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [weightManagementDialogOpen, setWeightManagementDialogOpen] = useState(false);
  const [progressSummaryDialogOpen, setProgressSummaryDialogOpen] = useState(false);
  const [managedWeights, setManagedWeights] = useState<KeyResult[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [selectedBigRock, setSelectedBigRock] = useState<BigRock | null>(null);
  const [selectedBigRockForLink, setSelectedBigRockForLink] = useState<string | null>(null);
  const [checkInEntity, setCheckInEntity] = useState<{ type: string; id: string; current?: any } | null>(null);

  // Value tag states
  const [objectiveValueTags, setObjectiveValueTags] = useState<string[]>([]);
  const [previousObjectiveValueTags, setPreviousObjectiveValueTags] = useState<string[]>([]);

  // Form data states
  const [objectiveForm, setObjectiveForm] = useState({
    title: "",
    description: "",
    level: "organization",
    parentId: "",
    ownerEmail: "",
    progressMode: "rollup",
    quarter: 1,
    year: new Date().getFullYear(),
    linkedStrategies: [] as string[],
    linkedGoals: [] as string[],
  });

  const [keyResultForm, setKeyResultForm] = useState({
    title: "",
    description: "",
    metricType: "increase",
    targetValue: 100,
    currentValue: 0,
    initialValue: 0,
    unit: "%",
    weight: 25,
    objectiveId: "",
  });

  const [bigRockForm, setBigRockForm] = useState({
    title: "",
    description: "",
    objectiveId: "",
    keyResultId: "",
    completionPercentage: 0,
    linkedStrategies: [] as string[],
  });

  const [checkInForm, setCheckInForm] = useState({
    newValue: 0,
    newProgress: 0,
    newStatus: "",
    note: "",
    achievements: [""],
    challenges: [""],
    nextSteps: [""],
    asOfDate: new Date().toISOString().split('T')[0], // Default to today, user-changeable
  });

  // Separate draft state for value input (allows empty string during editing)
  const [valueInputDraft, setValueInputDraft] = useState<string>("");

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
        await fetch(`/api/${entityType}/${entityId}/values`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueTitle }),
        });
      }

      for (const valueTitle of toRemove) {
        await fetch(`/api/${entityType}/${entityId}/values`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueTitle }),
        });
      }
      
      // Invalidate value tags query for this specific entity
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${entityType}`, entityId, 'values'] 
      });
    } catch (error) {
      console.error('Failed to sync value tags:', error);
      throw error;
    }
  };

  // Mutations
  const createObjectiveMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[Planning] Creating objective with data:', data);
      // Convert empty parentId to null, use quarter/year from form data
      const cleanedData = {
        ...data,
        parentId: data.parentId || null,
        tenantId: currentTenant.id,
        quarter: data.quarter,
        year: data.year,
      };
      return apiRequest("POST", "/api/okr/objectives", cleanedData);
    },
    onSuccess: async (response: any) => {
      try {
        // Sync value tags after creating objective
        await syncValueTags(response.id, 'objectives', objectiveValueTags, []);
      } catch (error) {
        console.error('Failed to sync value tags:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setObjectiveDialogOpen(false);
      setObjectiveValueTags([]);
      toast({ title: "Success", description: "Objective created successfully" });
    },
    onError: (error: any) => {
      console.error('[Planning] Error creating objective:', error);
      toast({ title: "Error", description: error.message || "Failed to create objective", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      setKeyResultDialogOpen(false);
      toast({ title: "Success", description: "Key Result created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create key result", variant: "destructive" });
    },
  });

  const updateKeyResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/okr/key-results/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      setKeyResultDialogOpen(false);
      setSelectedKeyResult(null);
      toast({ title: "Success", description: "Key Result updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update Key Result", variant: "destructive" });
    },
  });

  const deleteKeyResultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/okr/key-results/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      toast({ title: "Success", description: "Key Result deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete Key Result", variant: "destructive" });
    },
  });

  const createBigRockMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[Planning] Creating big rock with data:', data);
      // Convert empty objectiveId/keyResultId to null
      const cleanedData = {
        ...data,
        objectiveId: data.objectiveId || null,
        keyResultId: data.keyResultId || null,
        tenantId: currentTenant.id,
        quarter,
        year,
      };
      return apiRequest("POST", "/api/okr/big-rocks", cleanedData);
    },
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      setBigRockDialogOpen(false);
      setSelectedBigRock(null);
      setSelectedBigRockForLink(null);
      setBigRockDialogMode("create");
      toast({ title: "Success", description: "Big Rock created successfully" });
    },
    onError: (error: any) => {
      console.error('[Planning] Error creating big rock:', error);
      toast({ title: "Error", description: error.message || "Failed to create big rock", variant: "destructive" });
    },
  });

  const updateBigRockMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/okr/big-rocks/${id}`, data);
    },
    onSuccess: async (response: any, variables: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      setBigRockDialogOpen(false);
      setSelectedBigRock(null);
      setSelectedBigRockForLink(null);
      setBigRockDialogMode("create");
      toast({ title: "Success", description: "Big Rock updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update Big Rock", variant: "destructive" });
    },
  });

  const deleteBigRockMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/okr/big-rocks/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      toast({ title: "Success", description: "Big Rock deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete Big Rock", variant: "destructive" });
    },
  });

  const promoteKeyResultMutation = useMutation({
    mutationFn: async (keyResultId: string) => {
      // Don't send userId if not available - backend will use session
      const body = user?.id ? { userId: user.id } : {};
      return apiRequest("POST", `/api/okr/key-results/${keyResultId}/promote-to-kpi`, body);
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

  const unpromoteKeyResultMutation = useMutation({
    mutationFn: async (keyResultId: string) => {
      return apiRequest("POST", `/api/okr/key-results/${keyResultId}/unpromote-from-kpi`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/kpis`] });
      toast({ title: "Success", description: "Key Result removed from KPI dashboard" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove from KPI dashboard", variant: "destructive" });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Normalize data like create mutation - convert empty parentId to null, include quarter/year and tenantId
      const cleanedData = {
        ...data,
        parentId: data.parentId || null,
        tenantId: currentTenant.id,
        quarter: data.quarter,
        year: data.year,
      };
      return apiRequest("PATCH", `/api/okr/objectives/${id}`, cleanedData);
    },
    onSuccess: async (response: any, variables: { id: string }) => {
      try {
        // Sync value tags after updating objective
        await syncValueTags(variables.id, 'objectives', objectiveValueTags, previousObjectiveValueTags);
      } catch (error) {
        console.error('Failed to sync value tags:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setObjectiveDialogOpen(false);
      setSelectedObjective(null);
      setObjectiveValueTags([]);
      setPreviousObjectiveValueTags([]);
      toast({ title: "Success", description: "Objective updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update objective", variant: "destructive" });
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/okr/objectives/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      toast({ title: "Success", description: "Objective deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete objective", variant: "destructive" });
    },
  });

  const createCheckInMutation = useMutation({
    mutationFn: async (data: any) => {
      // Include userId and userEmail from current user, plus tenantId
      // Convert asOfDate string to ISO timestamp if present
      const checkInData = {
        ...data,
        userId: user?.id,
        userEmail: user?.email,
        tenantId: currentTenant.id,
        asOfDate: data.asOfDate ? new Date(data.asOfDate).toISOString() : new Date().toISOString(),
      };
      return apiRequest("POST", "/api/okr/check-ins", checkInData);
    },
    onSuccess: () => {
      // Invalidate the specific query keys that need to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/check-ins`] });
      // Also invalidate all key-results queries to ensure they refetch
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setCheckInDialogOpen(false);
      toast({ title: "Success", description: "Check-in recorded successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record check-in", variant: "destructive" });
    },
  });

  const updateCheckInMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Convert asOfDate string to ISO timestamp if present
      const checkInData = {
        ...data,
        asOfDate: data.asOfDate ? new Date(data.asOfDate).toISOString() : undefined,
      };
      return apiRequest("PATCH", `/api/okr/check-ins/${id}`, checkInData);
    },
    onSuccess: () => {
      // Invalidate the specific query keys that need to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/big-rocks`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/check-ins`] });
      // Also invalidate all key-results queries to ensure they refetch
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setCheckInDialogOpen(false);
      setEditingCheckIn(null);
      toast({ title: "Success", description: "Check-in updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update check-in", variant: "destructive" });
    },
  });

  // Fetch check-in history for selected Key Result
  const { data: checkInHistory = [] } = useQuery<CheckIn[]>({
    queryKey: [`/api/okr/check-ins`, selectedKRForHistory?.id],
    queryFn: async () => {
      if (!selectedKRForHistory) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=key_result&entityId=${selectedKRForHistory.id}`);
      if (!res.ok) throw new Error("Failed to fetch check-in history");
      return res.json();
    },
    enabled: !!selectedKRForHistory && checkInHistoryDialogOpen,
  });

  // Helper functions for toggling strategies and goals
  const toggleObjectiveStrategy = (strategyId: string) => {
    setObjectiveForm(prev => ({
      ...prev,
      linkedStrategies: prev.linkedStrategies.includes(strategyId)
        ? prev.linkedStrategies.filter(s => s !== strategyId)
        : [...prev.linkedStrategies, strategyId],
    }));
  };

  const toggleObjectiveGoal = (goal: string) => {
    setObjectiveForm(prev => ({
      ...prev,
      linkedGoals: prev.linkedGoals.includes(goal)
        ? prev.linkedGoals.filter(g => g !== goal)
        : [...prev.linkedGoals, goal],
    }));
  };

  const toggleBigRockStrategy = (strategyId: string) => {
    setBigRockForm(prev => ({
      ...prev,
      linkedStrategies: prev.linkedStrategies.includes(strategyId)
        ? prev.linkedStrategies.filter(s => s !== strategyId)
        : [...prev.linkedStrategies, strategyId],
    }));
  };

  // Handler functions
  const handleCreateObjective = (parentId?: string) => {
    setObjectiveForm({
      title: "",
      description: "",
      level: parentId ? "team" : "organization",
      parentId: parentId || "",
      ownerEmail: "",
      progressMode: "rollup",
      quarter,
      year,
      linkedStrategies: [],
      linkedGoals: [],
    });
    setSelectedObjective(null);
    setObjectiveValueTags([]);
    setPreviousObjectiveValueTags([]);
    setObjectiveDialogOpen(true);
  };

  const handleEditObjective = async (objective: Objective) => {
    setObjectiveForm({
      title: objective.title,
      description: objective.description,
      level: objective.level,
      parentId: objective.parentId || "",
      ownerEmail: objective.ownerEmail || "",
      progressMode: "rollup",
      quarter: objective.quarter,
      year: objective.year,
      linkedStrategies: objective.linkedStrategies || [],
      linkedGoals: objective.linkedGoals || [],
    });
    setSelectedObjective(objective);
    
    // Fetch existing value tags
    try {
      const res = await fetch(`/api/objectives/${objective.id}/values`);
      if (res.ok) {
        const valueTitles = await res.json();
        setObjectiveValueTags(valueTitles);
        setPreviousObjectiveValueTags(valueTitles);
      } else {
        setObjectiveValueTags([]);
        setPreviousObjectiveValueTags([]);
      }
    } catch (error) {
      console.error("Failed to fetch objective value tags:", error);
      setObjectiveValueTags([]);
      setPreviousObjectiveValueTags([]);
    }
    
    setObjectiveDialogOpen(true);
  };

  const handleDeleteObjective = (id: string) => {
    if (confirm("Are you sure you want to delete this objective? This will also delete all associated Key Results and Big Rocks.")) {
      deleteObjectiveMutation.mutate(id);
    }
  };

  const handleCreateKeyResult = (objectiveId: string) => {
    const objective = objectives.find(o => o.id === objectiveId);
    if (objective) {
      setSelectedObjective(objective);
      setKeyResultForm({
        title: "",
        description: "",
        metricType: "increase",
        targetValue: 100,
        currentValue: 0,
        initialValue: 0,
        unit: "%",
        weight: 25,
        objectiveId: objectiveId,
      });
      setSelectedKeyResult(null);
      setKeyResultDialogOpen(true);
    }
  };

  const handleEditKeyResult = (keyResult: KeyResult, objectiveId: string) => {
    setSelectedKeyResult(keyResult);
    const objective = objectives.find(o => o.id === objectiveId);
    if (objective) {
      setSelectedObjective(objective);
    }
    setKeyResultForm({
      title: keyResult.title,
      description: keyResult.description || "",
      metricType: keyResult.metricType || "increase",
      targetValue: keyResult.targetValue,
      currentValue: keyResult.currentValue,
      initialValue: keyResult.initialValue || 0,
      unit: keyResult.unit,
      weight: keyResult.weight,
      objectiveId: objectiveId,
    });
    setKeyResultDialogOpen(true);
  };

  const handleDeleteKeyResult = (id: string, objectiveId: string) => {
    if (window.confirm("Are you sure you want to delete this Key Result? Associated Big Rocks will also be deleted.")) {
      deleteKeyResultMutation.mutate(id);
    }
  };

  const handleCreateBigRock = (objectiveId: string, keyResultId?: string) => {
    setSelectedBigRock(null);
    setSelectedBigRockForLink(null);
    setBigRockDialogMode("create");
    setBigRockForm({
      title: "",
      description: "",
      objectiveId,
      keyResultId: keyResultId || "",
      completionPercentage: 0,
      linkedStrategies: [],
    });
    setBigRockDialogOpen(true);
  };

  const handleEditBigRock = async (bigRock: BigRock) => {
    setSelectedBigRock(bigRock);
    setBigRockForm({
      title: bigRock.title,
      description: bigRock.description || "",
      objectiveId: bigRock.objectiveId || "",
      keyResultId: bigRock.keyResultId || "",
      completionPercentage: bigRock.completionPercentage,
      linkedStrategies: bigRock.linkedStrategies || [],
    });
    setBigRockDialogOpen(true);
  };

  const handleDeleteBigRock = (id: string) => {
    if (window.confirm("Are you sure you want to delete this Big Rock?")) {
      deleteBigRockMutation.mutate(id);
    }
  };

  const handleManageWeights = async (objectiveId: string) => {
    // Fetch the latest Key Results for this objective
    const krRes = await fetch(`/api/okr/objectives/${objectiveId}/key-results`);
    if (!krRes.ok) {
      toast({ title: "Error", description: "Failed to fetch Key Results", variant: "destructive" });
      return;
    }
    const keyResults = await krRes.json();
    
    // Find the objective from the main objectives list
    const objective = objectives.find(o => o.id === objectiveId);
    if (objective) {
      setSelectedObjective(objective);
      setManagedWeights(keyResults); // Initialize local state
      setWeightManagementDialogOpen(true);
    }
  };

  const handleSaveWeights = async () => {
    // Batch update all Key Results
    try {
      await Promise.all(
        managedWeights.map(kr =>
          fetch(`/api/okr/key-results/${kr.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weight: kr.weight,
              isWeightLocked: kr.isWeightLocked,
            }),
          })
        )
      );
      
      // Invalidate cache once after all updates
      await queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
      
      toast({ title: "Success", description: "Key Result weights updated successfully" });
      setWeightManagementDialogOpen(false);
      setManagedWeights([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update weights", variant: "destructive" });
    }
  };

  const handleCheckIn = async (entityType: string, entityId: string) => {
    // Find the entity data for context
    let current = null;
    if (entityType === "objective") {
      current = objectives.find(o => o.id === entityId);
      setCheckInEntity({ type: entityType, id: entityId, current });
      setCheckInForm({
        newValue: 0,
        newProgress: current?.progress || 0,
        newStatus: current?.status || "on_track",
        note: "",
        achievements: [""],
        challenges: [""],
        nextSteps: [""],
        asOfDate: new Date().toISOString().split('T')[0],
      });
    } else if (entityType === "key_result") {
      // Fetch the full Key Result data to get unit and target
      try {
        const res = await fetch(`/api/okr/key-results/${entityId}`);
        if (res.ok) {
          current = await res.json();
          setCheckInEntity({ type: entityType, id: entityId, current });
          const currentVal = current?.currentValue || 0;
          setCheckInForm({
            newValue: currentVal,
            newProgress: current?.progress || 0,
            newStatus: current?.status || "on_track",
            note: "",
            achievements: [""],
            challenges: [""],
            nextSteps: [""],
            asOfDate: new Date().toISOString().split('T')[0],
          });
          setValueInputDraft(currentVal.toString());
        }
      } catch (error) {
        console.error("Failed to fetch Key Result data:", error);
      }
    }
    setEditingCheckIn(null);
    setCheckInDialogOpen(true);
  };

  const handleEditCheckIn = async (checkIn: CheckIn) => {
    // Fetch the full Key Result data for context (needed for unit, target, etc.)
    try {
      const res = await fetch(`/api/okr/key-results/${checkIn.entityId}`);
      if (res.ok) {
        const current = await res.json();
        setCheckInEntity({ type: checkIn.entityType, id: checkIn.entityId, current });
        setCheckInForm({
          newValue: checkIn.newValue || 0,
          newProgress: checkIn.newProgress,
          newStatus: checkIn.newStatus || "on_track",
          note: checkIn.note || "",
          achievements: checkIn.achievements || [""],
          challenges: checkIn.challenges || [""],
          nextSteps: checkIn.nextSteps || [""],
          asOfDate: checkIn.asOfDate 
            ? new Date(checkIn.asOfDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        });
        setValueInputDraft((checkIn.newValue || 0).toString());
        setEditingCheckIn(checkIn);
        setCheckInHistoryDialogOpen(false);
        setCheckInDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch Key Result data for edit:", error);
      toast({ title: "Error", description: "Failed to load check-in data", variant: "destructive" });
    }
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
              Hierarchical OKRs, Big Rocks, and Progress Tracking for {quarter === 0 ? 'Annual' : `Q${quarter}`} {year}
              {level !== 'all' && ` - ${level.charAt(0).toUpperCase() + level.slice(1)} Level`}
              {teamId !== 'all' && teamsData.find(t => t.id === teamId) && ` - ${teamsData.find(t => t.id === teamId)?.name}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={quarter.toString()} onValueChange={(v) => setQuarter(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Annual</SelectItem>
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
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-40" data-testid="select-level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-44" data-testid="select-team">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamsData.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setProgressSummaryDialogOpen(true)}
              data-testid="button-generate-summary"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
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
              strategies={strategies}
              onCreateObjective={handleCreateObjective}
              onEditObjective={handleEditObjective}
              onDeleteObjective={handleDeleteObjective}
              onCreateKeyResult={handleCreateKeyResult}
              onEditKeyResult={handleEditKeyResult}
              onDeleteKeyResult={handleDeleteKeyResult}
              onManageWeights={handleManageWeights}
              onPromoteKeyResult={(id) => promoteKeyResultMutation.mutate(id)}
              onUnpromoteKeyResult={(id) => unpromoteKeyResultMutation.mutate(id)}
              onCreateBigRock={handleCreateBigRock}
              onCheckIn={handleCheckIn}
              onViewHistory={(entityType, entity) => {
                setSelectedKRForHistory(entity);
                setCheckInHistoryDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="big-rocks">
            <BigRocksSection 
              bigRocks={bigRocks} 
              objectives={objectives} 
              onCreateBigRock={handleCreateBigRock}
              onEditBigRock={handleEditBigRock}
              onDeleteBigRock={handleDeleteBigRock}
            />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressDashboard objectives={enrichedObjectives} bigRocks={bigRocks} />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Objective Dialog */}
        <Dialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedObjective ? "Edit" : "Create"} Objective</DialogTitle>
              <DialogDescription>
                {selectedObjective ? "Update the objective details" : `Define a new objective`}
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
              <div>
                <Label>Company Values</Label>
                <ValueTagSelector
                  availableValues={foundation?.values || []}
                  selectedValues={objectiveValueTags}
                  onValuesChange={setObjectiveValueTags}
                />
              </div>

              <div>
                <Label>Linked Strategies</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {strategies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No strategies defined yet</p>
                  ) : (
                    strategies.map((strategy) => (
                      <Badge
                        key={strategy.id}
                        variant={objectiveForm.linkedStrategies.includes(strategy.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleObjectiveStrategy(strategy.id)}
                        data-testid={`badge-strategy-${strategy.id}`}
                      >
                        {strategy.title}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label>Linked Annual Goals</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(!foundation?.annualGoals || foundation.annualGoals.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No annual goals defined yet</p>
                  ) : (
                    foundation.annualGoals.map((goal) => (
                      <Badge
                        key={goal}
                        variant={objectiveForm.linkedGoals.includes(goal) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleObjectiveGoal(goal)}
                        data-testid={`badge-goal-${goal.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {goal}
                      </Badge>
                    ))
                  )}
                </div>
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
                    <SelectContent className="z-[60]">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="obj-quarter">Time Period</Label>
                  <Select
                    value={String(objectiveForm.quarter)}
                    onValueChange={(value) => setObjectiveForm({ ...objectiveForm, quarter: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-objective-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="0">Annual</SelectItem>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="obj-year">Year</Label>
                  <Select
                    value={String(objectiveForm.year)}
                    onValueChange={(value) => setObjectiveForm({ ...objectiveForm, year: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-objective-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setObjectiveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedObjective) {
                    updateObjectiveMutation.mutate({ id: selectedObjective.id, data: objectiveForm });
                  } else {
                    createObjectiveMutation.mutate(objectiveForm);
                  }
                }}
                disabled={createObjectiveMutation.isPending || updateObjectiveMutation.isPending}
                data-testid="button-save-objective"
              >
                {(createObjectiveMutation.isPending || updateObjectiveMutation.isPending) ? "Saving..." : selectedObjective ? "Save Changes" : "Create Objective"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Key Result Dialog */}
        <Dialog open={keyResultDialogOpen} onOpenChange={setKeyResultDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedKeyResult ? "Edit" : "Create"} Key Result</DialogTitle>
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
              <div>
                <Label htmlFor="kr-metric-type">Metric Type</Label>
                <Select
                  value={keyResultForm.metricType}
                  onValueChange={(value) => setKeyResultForm({ ...keyResultForm, metricType: value })}
                >
                  <SelectTrigger data-testid="select-kr-metric-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="increase">Increase (higher is better)</SelectItem>
                    <SelectItem value="decrease">Decrease (lower is better)</SelectItem>
                    <SelectItem value="maintain">Maintain (stay at target)</SelectItem>
                    <SelectItem value="complete">Complete (binary done/not done)</SelectItem>
                  </SelectContent>
                </Select>
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
                  if (selectedKeyResult) {
                    updateKeyResultMutation.mutate({ id: selectedKeyResult.id, data: keyResultForm });
                  } else {
                    createKeyResultMutation.mutate(keyResultForm);
                  }
                }}
                disabled={createKeyResultMutation.isPending || updateKeyResultMutation.isPending}
                data-testid="button-save-kr"
              >
                {(createKeyResultMutation.isPending || updateKeyResultMutation.isPending) ? "Saving..." : selectedKeyResult ? "Save Changes" : "Create Key Result"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Big Rock Dialog */}
        <Dialog open={bigRockDialogOpen} onOpenChange={(open) => {
          if (!open) {
            // Reset state when closing dialog
            setSelectedBigRockForLink(null);
            setBigRockDialogMode("create");
          }
          setBigRockDialogOpen(open);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedBigRock ? "Edit" : bigRockForm.objectiveId || bigRockForm.keyResultId ? "Link or Create" : "Create"} Big Rock (Initiative)</DialogTitle>
              <DialogDescription>
                {selectedBigRock ? "Update your strategic initiative" : `Define or link a strategic initiative for ${quarter === 0 ? 'Annual' : `Q${quarter}`} ${year}`}
              </DialogDescription>
            </DialogHeader>
            
            {!selectedBigRock && (bigRockForm.objectiveId || bigRockForm.keyResultId) && (
              <Tabs value={bigRockDialogMode} onValueChange={(value: any) => setBigRockDialogMode(value)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create" data-testid="tab-create-bigrock">Create New</TabsTrigger>
                  <TabsTrigger value="link" data-testid="tab-link-bigrock">Link Existing</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {bigRockDialogMode === "create" || selectedBigRock ? (
              <div className="space-y-4 mt-4">
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
                  <Label>Linked Strategies</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {strategies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No strategies defined yet</p>
                    ) : (
                      strategies.map((strategy) => (
                        <Badge
                          key={strategy.id}
                          variant={bigRockForm.linkedStrategies.includes(strategy.id) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate"
                          onClick={() => toggleBigRockStrategy(strategy.id)}
                          data-testid={`badge-br-strategy-${strategy.id}`}
                        >
                          {strategy.title}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="br-progress">{selectedBigRock ? "Completion" : "Initial Progress"} ({bigRockForm.completionPercentage}%)</Label>
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
            ) : (
              <div className="space-y-4 mt-4">
                <Label>Select Existing Big Rock to Link</Label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {bigRocks.filter(rock => !rock.objectiveId && !rock.keyResultId).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No unlinked Big Rocks available for Q{quarter} {year}</p>
                      <p className="text-sm mt-2">Switch to "Create New" to create a Big Rock</p>
                    </div>
                  ) : (
                    bigRocks
                      .filter(rock => !rock.objectiveId && !rock.keyResultId)
                      .map((rock) => (
                        <Card
                          key={rock.id}
                          className={cn(
                            "p-4 cursor-pointer hover-elevate",
                            selectedBigRockForLink === rock.id && "border-primary"
                          )}
                          onClick={() => setSelectedBigRockForLink(rock.id)}
                          data-testid={`card-select-bigrock-${rock.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{rock.title}</h4>
                              {rock.description && (
                                <p className="text-sm text-muted-foreground mt-1">{rock.description}</p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {rock.status || "not-started"}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {rock.completionPercentage}% Complete
                                </Badge>
                              </div>
                            </div>
                            {selectedBigRockForLink === rock.id && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </Card>
                      ))
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { 
                setBigRockDialogOpen(false); 
                setSelectedBigRockForLink(null);
                setBigRockDialogMode("create");
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (bigRockDialogMode === "link" && selectedBigRockForLink) {
                    // Link existing Big Rock
                    updateBigRockMutation.mutate({
                      id: selectedBigRockForLink,
                      data: {
                        objectiveId: bigRockForm.objectiveId || undefined,
                        keyResultId: bigRockForm.keyResultId || undefined,
                      }
                    });
                  } else {
                    // Create or update Big Rock
                    console.log('[Big Rock Submit] Form state:', bigRockForm);
                    if (selectedBigRock) {
                      updateBigRockMutation.mutate({
                        id: selectedBigRock.id,
                        data: bigRockForm
                      });
                    } else {
                      createBigRockMutation.mutate(bigRockForm);
                    }
                  }
                }}
                disabled={
                  createBigRockMutation.isPending || 
                  updateBigRockMutation.isPending || 
                  (bigRockDialogMode === "link" && !selectedBigRockForLink)
                }
                data-testid="button-save-bigrock"
              >
                {selectedBigRock 
                  ? (updateBigRockMutation.isPending ? "Updating..." : "Update Big Rock")
                  : bigRockDialogMode === "link"
                    ? (updateBigRockMutation.isPending ? "Linking..." : "Link Big Rock")
                    : (createBigRockMutation.isPending ? "Creating..." : "Create Big Rock")
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Weight Management Dialog */}
        <Dialog open={weightManagementDialogOpen} onOpenChange={(open) => {
          setWeightManagementDialogOpen(open);
          if (!open) setManagedWeights([]); // Clear local state on close
        }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage Key Result Weights</DialogTitle>
              <DialogDescription>
                {selectedObjective && `For: ${selectedObjective.title}`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {managedWeights.length > 0 && (
                <WeightManager
                  items={managedWeights}
                  onChange={setManagedWeights} // Update local state only
                  itemNameKey={"title" as any}
                />
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setWeightManagementDialogOpen(false);
                  setManagedWeights([]);
                }}
                data-testid="button-cancel-weights"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveWeights}
                data-testid="button-save-weights"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Check-In Dialog */}
        <Dialog open={checkInDialogOpen} onOpenChange={(open) => {
          setCheckInDialogOpen(open);
          if (!open) {
            setEditingCheckIn(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCheckIn ? "Edit Check-In" : "Record Check-In"}</DialogTitle>
              <DialogDescription>
                {checkInEntity && `${checkInEntity.type.replace("_", " ")} - ${checkInEntity.current?.title || checkInEntity.id}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ci-asofdate">As Of Date</Label>
                <Input
                  id="ci-asofdate"
                  type="date"
                  value={checkInForm.asOfDate}
                  onChange={(e) => setCheckInForm({ ...checkInForm, asOfDate: e.target.value })}
                  className="dark:bg-background dark:text-foreground dark:[color-scheme:dark]"
                  data-testid="input-checkin-asofdate"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  When does this check-in data apply? (Defaults to today)
                </p>
              </div>
              
              {/* For Key Results: Show Value Input with Unit */}
              {checkInEntity?.type === "key_result" && checkInEntity.current && (
                <div>
                  <Label htmlFor="ci-value">
                    Current Value
                    {checkInEntity.current.unit && ` (${checkInEntity.current.unit})`}
                  </Label>
                  <Input
                    id="ci-value"
                    type="number"
                    value={valueInputDraft}
                    onChange={(e) => {
                      const inputVal = e.target.value;
                      
                      // Always update draft to allow editing
                      setValueInputDraft(inputVal);
                      
                      // Only calculate progress if input is a valid number
                      if (inputVal === "" || inputVal === null) {
                        // Keep previous progress, just clear the input visually
                        return;
                      }
                      
                      const newVal = parseFloat(inputVal);
                      if (isNaN(newVal)) {
                        return; // Don't update progress if invalid
                      }
                      
                      // Auto-calculate progress based on metric type
                      const kr = checkInEntity.current;
                      
                      // Default initialValue to 0 if undefined (for legacy records)
                      const initialValue = kr.initialValue ?? 0;
                      const targetValue = kr.targetValue ?? 0;
                      
                      let progress = 0;
                      
                      if (kr.metricType === "increase") {
                        const denominator = targetValue - initialValue;
                        if (denominator === 0) {
                          progress = newVal >= targetValue ? 100 : 0;
                        } else if (denominator > 0) {
                          progress = ((newVal - initialValue) / denominator) * 100;
                        } else {
                          progress = 0;
                        }
                      } else if (kr.metricType === "decrease") {
                        const denominator = initialValue - targetValue;
                        if (denominator === 0) {
                          progress = newVal <= targetValue ? 100 : 0;
                        } else if (denominator > 0) {
                          progress = ((initialValue - newVal) / denominator) * 100;
                        } else {
                          progress = 0;
                        }
                      } else if (kr.metricType === "maintain") {
                        if (targetValue === 0) {
                          progress = Math.abs(newVal) <= 0.05 ? 100 : 0;
                        } else {
                          const deviation = Math.abs(newVal - targetValue) / Math.abs(targetValue);
                          progress = deviation <= 0.05 ? 100 : Math.max(0, 100 - (deviation * 100));
                        }
                      } else if (kr.metricType === "complete") {
                        if (targetValue === 0 || targetValue < 0) {
                          progress = 0;
                        } else {
                          progress = newVal >= targetValue ? 100 : (newVal / targetValue) * 100;
                        }
                      }
                      
                      // Clamp progress to 0-100 range and ensure no NaN
                      const clampedProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(100, Math.round(progress)));
                      
                      setCheckInForm({ 
                        ...checkInForm, 
                        newValue: newVal,
                        newProgress: clampedProgress
                      });
                    }}
                    data-testid="input-checkin-value"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Target: {checkInEntity.current.targetValue} {checkInEntity.current.unit}
                    {checkInEntity.current.initialValue !== 0 && ` (from ${checkInEntity.current.initialValue})`}
                  </p>
                  {valueInputDraft && !isNaN(parseFloat(valueInputDraft)) ? (
                    <div className="mt-2 p-2 bg-secondary/20 rounded-md">
                      <p className="text-sm font-medium">Calculated Progress: {checkInForm.newProgress}%</p>
                    </div>
                  ) : valueInputDraft !== "" ? (
                    <p className="text-sm text-destructive mt-1">Please enter a valid number</p>
                  ) : null}
                </div>
              )}
              
              {/* For Objectives: Show Progress Slider */}
              {checkInEntity?.type === "objective" && (
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
              )}
              
              <div>
                <Label htmlFor="ci-status">Status</Label>
                <Select
                  value={checkInForm.newStatus}
                  onValueChange={(value) => setCheckInForm({ ...checkInForm, newStatus: value })}
                >
                  <SelectTrigger data-testid="select-checkin-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
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
                    // Validate for Key Results: ensure we have a valid number from the draft input
                    if (checkInEntity.type === "key_result") {
                      const finalValue = parseFloat(valueInputDraft);
                      // Use the parsed value from draft
                      checkInForm.newValue = finalValue;
                    }
                    
                    if (editingCheckIn) {
                      // Update existing check-in
                      updateCheckInMutation.mutate({
                        id: editingCheckIn.id,
                        data: checkInForm,
                      });
                    } else {
                      // Create new check-in
                      createCheckInMutation.mutate({
                        entityType: checkInEntity.type,
                        entityId: checkInEntity.id,
                        ...checkInForm,
                        previousProgress: checkInEntity.current?.progress || 0,
                        previousValue: checkInEntity.current?.currentValue || 0,
                      });
                    }
                  }
                }}
                disabled={
                  (editingCheckIn ? updateCheckInMutation.isPending : createCheckInMutation.isPending) || 
                  (checkInEntity?.type === "key_result" && (valueInputDraft === "" || isNaN(parseFloat(valueInputDraft))))
                }
                data-testid="button-save-checkin"
              >
                {editingCheckIn 
                  ? (updateCheckInMutation.isPending ? "Updating..." : "Update Check-In")
                  : (createCheckInMutation.isPending ? "Recording..." : "Record Check-In")
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Check-In History Dialog */}
        <Dialog open={checkInHistoryDialogOpen} onOpenChange={setCheckInHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Check-In History</DialogTitle>
              <DialogDescription>
                {selectedKRForHistory?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {checkInHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No check-ins recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checkInHistory.map((checkIn) => (
                    <Card key={checkIn.id} className="p-4" data-testid={`checkin-${checkIn.id}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {checkIn.asOfDate 
                                  ? new Date(checkIn.asOfDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : new Date(checkIn.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                }
                              </span>
                              <Badge variant={
                                checkIn.newStatus === 'on_track' ? 'default' :
                                checkIn.newStatus === 'behind' ? 'secondary' :
                                checkIn.newStatus === 'at_risk' ? 'destructive' :
                                checkIn.newStatus === 'completed' ? 'default' :
                                'outline'
                              }>
                                {checkIn.newStatus?.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              by {checkIn.createdBy}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {checkIn.newValue !== undefined && selectedKRForHistory?.unit && (
                                  <span>{checkIn.newValue} {selectedKRForHistory.unit}</span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Progress: {checkIn.previousProgress}% → {checkIn.newProgress}%
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditCheckIn(checkIn)}
                              data-testid={`button-edit-checkin-${checkIn.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {checkIn.note && (
                          <div className="text-sm bg-muted p-3 rounded-md">
                            <div className="font-medium mb-1">Note:</div>
                            <div className="whitespace-pre-wrap">{checkIn.note}</div>
                          </div>
                        )}
                        {checkIn.achievements && checkIn.achievements.length > 0 && checkIn.achievements.some(a => a) && (
                          <div className="text-sm">
                            <div className="font-medium mb-1 text-green-600 dark:text-green-400">Achievements:</div>
                            <ul className="list-disc pl-5 space-y-1">
                              {checkIn.achievements.filter(a => a).map((achievement, idx) => (
                                <li key={idx}>{achievement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {checkIn.challenges && checkIn.challenges.length > 0 && checkIn.challenges.some(c => c) && (
                          <div className="text-sm">
                            <div className="font-medium mb-1 text-yellow-600 dark:text-yellow-400">Challenges:</div>
                            <ul className="list-disc pl-5 space-y-1">
                              {checkIn.challenges.filter(c => c).map((challenge, idx) => (
                                <li key={idx}>{challenge}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {checkIn.nextSteps && checkIn.nextSteps.length > 0 && checkIn.nextSteps.some(n => n) && (
                          <div className="text-sm">
                            <div className="font-medium mb-1 text-blue-600 dark:text-blue-400">Next Steps:</div>
                            <ul className="list-disc pl-5 space-y-1">
                              {checkIn.nextSteps.filter(n => n).map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCheckInHistoryDialogOpen(false)}
                data-testid="button-close-history"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Progress Summary Dialog */}
        <ProgressSummaryDialog
          open={progressSummaryDialogOpen}
          onOpenChange={setProgressSummaryDialogOpen}
          objectives={enrichedObjectives.map(obj => ({
            id: obj.id,
            title: obj.title,
            progress: obj.progress,
            status: obj.status,
            keyResults: obj.keyResults?.map((kr: any) => ({
              id: kr.id,
              title: kr.title,
              currentValue: kr.currentValue || 0,
              targetValue: kr.targetValue || 100,
              unit: kr.unit || '%',
              progress: kr.progress || 0,
            })),
          }))}
          quarter={quarter}
          year={year}
        />
      </div>
    </div>
  );
}

// Big Rocks Section Component
function BigRocksSection({ bigRocks, objectives, onCreateBigRock, onEditBigRock, onDeleteBigRock }: any) {
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
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{rock.title}</CardTitle>
                    {rock.objectiveId && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Linked to: {getObjectiveTitle(rock.objectiveId)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEditBigRock(rock)}
                      data-testid={`button-edit-bigrock-${rock.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteBigRock(rock.id)}
                      data-testid={`button-delete-bigrock-${rock.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rock.description && (
                  <p className="text-sm text-muted-foreground mb-4">{rock.description}</p>
                )}
                
                {/* Linked Strategies */}
                {rock.linkedStrategies && rock.linkedStrategies.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-sm mb-2">Linked Strategies</h4>
                    <div className="flex flex-wrap gap-2">
                      {rock.linkedStrategies.map((strategyId: string) => (
                        <Badge key={strategyId} variant="outline" className="text-xs">
                          {strategyId}
                        </Badge>
                      ))}
                    </div>
                  </div>
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