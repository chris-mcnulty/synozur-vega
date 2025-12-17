import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
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
import { WeightManager } from "@/components/WeightManager";
import { ValueTagSelector } from "@/components/ValueTagSelector";
import { HierarchicalOKRTable } from "@/components/okr/HierarchicalOKRTable";
import { OKRFilters } from "@/components/okr/OKRFilters";
import { OKRDetailPane } from "@/components/okr/OKRDetailPane";
import { ProgressSummaryBar } from "@/components/okr/ProgressSummaryBar";
import { MilestoneEditor, type PhasedTargets } from "@/components/okr/MilestoneEditor";
import { MilestoneTimeline } from "@/components/okr/MilestoneTimeline";
import { TrendingUp, Target, Activity, AlertCircle, CheckCircle, Loader2, Pencil, Trash2, History, Edit, Sparkles, CalendarCheck, Plus, FileSpreadsheet, RefreshCw, Link2, Unlink } from "lucide-react";
import { ExcelFilePicker } from "@/components/ExcelFilePicker";
import { PlannerProgressMapping } from "@/components/planner/PlannerProgressMapping";
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
  // Excel source binding
  excelSourceType?: string | null;
  excelFileId?: string | null;
  excelFileName?: string | null;
  excelFilePath?: string | null;
  excelSheetName?: string | null;
  excelCellReference?: string | null;
  excelLastSyncAt?: string | null;
  excelLastSyncValue?: number | null;
  excelSyncError?: string | null;
  excelAutoSync?: boolean;
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
  ownerEmail?: string;
  accountableId?: string;
  accountableEmail?: string;
  lastCheckInAt?: Date | string;
  lastCheckInNote?: string;
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

// Helper to get saved planning filters from localStorage
function getSavedPlanningFilters() {
  try {
    const saved = localStorage.getItem("planningFilters");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
}

export default function PlanningEnhanced() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  
  // Load saved filters from localStorage
  const savedFilters = getSavedPlanningFilters();
  
  const [selectedTab, setSelectedTab] = useState(savedFilters?.selectedTab || "hierarchy");
  // Unified filters for all tabs
  const [quarter, setQuarter] = useState<number | null>(savedFilters?.quarter ?? null); // null means "All Periods"
  const [year, setYear] = useState(savedFilters?.year || new Date().getFullYear());
  const [level, setLevel] = useState<string>(savedFilters?.level || "all");
  const [teamId, setTeamId] = useState<string>(savedFilters?.teamId || "all");
  const [statusFilter, setStatusFilter] = useState<string>(savedFilters?.statusFilter || "all");
  const [filtersInitialized, setFiltersInitialized] = useState(!!savedFilters);
  
  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (filtersInitialized) {
      localStorage.setItem("planningFilters", JSON.stringify({
        selectedTab,
        quarter,
        year,
        level,
        teamId,
        statusFilter,
      }));
    }
  }, [selectedTab, quarter, year, level, teamId, statusFilter, filtersInitialized]);
  
  // Detail pane state
  const [detailPaneOpen, setDetailPaneOpen] = useState(false);
  const [detailPaneEntityType, setDetailPaneEntityType] = useState<"objective" | "key_result">("objective");
  const [detailPaneEntity, setDetailPaneEntity] = useState<any>(null);
  const [detailPaneParentObjective, setDetailPaneParentObjective] = useState<any>(null);

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

  // Set initial quarter/year based on tenant's fiscal year (only if no saved filters)
  useEffect(() => {
    if (!filtersInitialized) {
      if (foundation) {
        const fiscalYearStartMonth = foundation.fiscalYearStartMonth || 1;
        const currentPeriod = getCurrentQuarter(fiscalYearStartMonth);
        setQuarter(currentPeriod.quarter);
        setYear(currentPeriod.year);
      }
      // Mark as initialized after first render so filters will be saved
      setFiltersInitialized(true);
    }
  }, [foundation?.fiscalYearStartMonth, filtersInitialized]);

  // Fetch enhanced OKR data (uses unified filters)
  const { data: objectives = [], isLoading: loadingObjectives } = useQuery<Objective[]>({
    queryKey: [`/api/okr/objectives`, currentTenant?.id, quarter, year, level, teamId],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return [];
      }
      const quarterParam = quarter !== null ? `&quarter=${quarter}` : '';
      const levelParam = level !== 'all' ? `&level=${level}` : '';
      const teamParam = teamId !== 'all' ? `&teamId=${teamId}` : '';
      const res = await fetch(`/api/okr/objectives?tenantId=${currentTenant.id}${quarterParam}&year=${year}${levelParam}${teamParam}`);
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
      const quarterParam = quarter !== null ? `&quarter=${quarter}` : '';
      const res = await fetch(`/api/okr/big-rocks?tenantId=${currentTenant.id}${quarterParam}&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch big rocks");
      return res.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch hierarchy data (uses unified filters)
  const { data: hierarchyData = [], isLoading: loadingHierarchy } = useQuery<any[]>({
    queryKey: [`/api/okr/hierarchy`, currentTenant?.id, quarter, year, level, teamId],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return [];
      }
      const periodParam = quarter !== null ? `&quarter=${quarter}` : '';
      const levelParam = level !== 'all' ? `&level=${level}` : '';
      const teamParam = teamId !== 'all' ? `&teamId=${teamId}` : '';
      const res = await fetch(`/api/okr/hierarchy?tenantId=${currentTenant.id}${periodParam}&year=${year}${levelParam}${teamParam}`);
      if (!res.ok) throw new Error("Failed to fetch hierarchy");
      return res.json();
    },
    enabled: !!currentTenant?.id && selectedTab === 'hierarchy',
  });

  // Filter hierarchy data by status (unified filter)
  const filteredHierarchyData = statusFilter === 'all' 
    ? hierarchyData 
    : hierarchyData.filter((obj: any) => obj.status === statusFilter);

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
  const [selectedBigRockForHistory, setSelectedBigRockForHistory] = useState<BigRock | null>(null);
  const [bigRockCheckInHistoryDialogOpen, setBigRockCheckInHistoryDialogOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [closePromptDialogOpen, setClosePromptDialogOpen] = useState(false);
  const [closePromptEntity, setClosePromptEntity] = useState<{ type: string; id: string; title: string; progress: number } | null>(null);
  const [weightManagementDialogOpen, setWeightManagementDialogOpen] = useState(false);
  const [progressSummaryDialogOpen, setProgressSummaryDialogOpen] = useState(false);
  const [saveToMeetingDialogOpen, setSaveToMeetingDialogOpen] = useState(false);
  const [alignmentDialogOpen, setAlignmentDialogOpen] = useState(false);
  const [alignmentTargetObjective, setAlignmentTargetObjective] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<{ content: string; dateRange: string } | null>(null);
  const [managedWeights, setManagedWeights] = useState<KeyResult[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [selectedBigRock, setSelectedBigRock] = useState<BigRock | null>(null);
  const [selectedBigRockForLink, setSelectedBigRockForLink] = useState<string | null>(null);
  const [checkInEntity, setCheckInEntity] = useState<{ type: string; id: string; current?: any } | null>(null);

  // Value tag states
  const [objectiveValueTags, setObjectiveValueTags] = useState<string[]>([]);
  const [previousObjectiveValueTags, setPreviousObjectiveValueTags] = useState<string[]>([]);
  const [previousLinkedBigRocks, setPreviousLinkedBigRocks] = useState<string[]>([]);

  // Fetch meetings for Save to Meeting functionality
  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: [`/api/meetings/${currentTenant?.id}`],
    enabled: !!currentTenant?.id && saveToMeetingDialogOpen,
  });

  // Form data states
  const [objectiveMilestoneEditorOpen, setObjectiveMilestoneEditorOpen] = useState(false);
  const [keyResultMilestoneEditorOpen, setKeyResultMilestoneEditorOpen] = useState(false);
  const [excelPickerOpen, setExcelPickerOpen] = useState(false);
  const [syncingExcel, setSyncingExcel] = useState(false);

  const [objectiveForm, setObjectiveForm] = useState({
    title: "",
    description: "",
    level: "organization",
    parentId: "",
    ownerEmail: "",
    teamId: "" as string,
    progressMode: "rollup",
    quarter: 1,
    year: new Date().getFullYear(),
    linkedStrategies: [] as string[],
    linkedGoals: [] as string[],
    linkedBigRocks: [] as string[],
    alignedToObjectiveIds: [] as string[], // Objectives this one "ladders up" to (supports)
    phasedTargets: null as PhasedTargets | null,
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
    phasedTargets: null as PhasedTargets | null,
  });

  const [bigRockForm, setBigRockForm] = useState({
    title: "",
    description: "",
    objectiveId: "",
    keyResultId: "",
    teamId: "",
    ownerEmail: "",
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

  // Helper function to sync Big Rock links
  const syncBigRockLinks = async (
    objectiveId: string,
    currentBigRocks: string[],
    previousBigRocks: string[] = []
  ) => {
    try {
      const toAdd = currentBigRocks.filter(id => !previousBigRocks.includes(id));
      const toRemove = previousBigRocks.filter(id => !currentBigRocks.includes(id));

      for (const bigRockId of toAdd) {
        await apiRequest("POST", `/api/okr/objectives/${objectiveId}/link-big-rock`, {
          bigRockId,
          tenantId: currentTenant?.id,
        });
      }

      for (const bigRockId of toRemove) {
        await apiRequest("DELETE", `/api/okr/objectives/${objectiveId}/link-big-rock/${bigRockId}`, undefined);
      }
      
      // Invalidate all related queries including hierarchy (use exact: false to match all variants)
      queryClient.invalidateQueries({ 
        queryKey: [`/api/okr/objectives`, objectiveId, 'linked-big-rocks'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/okr/hierarchy`],
        exact: false
      });
    } catch (error) {
      console.error('Failed to sync Big Rock links:', error);
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
        // Sync Big Rock links after creating objective
        await syncBigRockLinks(response.id, objectiveForm.linkedBigRocks, []);
      } catch (error) {
        console.error('Failed to sync value tags or Big Rock links:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`] });
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

  // Meeting mutation for Save to Meeting functionality
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/meetings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      setSaveToMeetingDialogOpen(false);
      setSavedSummary(null);
      setProgressSummaryDialogOpen(false);
      toast({ title: "Success", description: "Progress summary saved to meeting" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save summary to meeting", variant: "destructive" });
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/meetings", {
        ...data,
        tenantId: currentTenant?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${currentTenant?.id}`] });
      setSaveToMeetingDialogOpen(false);
      setSavedSummary(null);
      setProgressSummaryDialogOpen(false);
      toast({ title: "Success", description: "New meeting created with progress summary" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create meeting", variant: "destructive" });
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

  // Excel sync mutation
  const syncExcelMutation = useMutation({
    mutationFn: async (keyResultId: string) => {
      const res = await fetch(`/api/m365/key-results/${keyResultId}/sync-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ updateCurrentValue: true }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to sync');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      if (data.syncError) {
        toast({ title: "Sync completed with warning", description: data.syncError, variant: "destructive" });
      } else {
        toast({ title: "Excel synced", description: `Value updated: ${data.previousValue} → ${data.syncedValue}` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  // Excel unlink mutation
  const unlinkExcelMutation = useMutation({
    mutationFn: async (keyResultId: string) => {
      const res = await fetch(`/api/m365/key-results/${keyResultId}/link-excel`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to unlink');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      toast({ title: "Excel unlinked", description: "Key Result is no longer connected to Excel" });
    },
    onError: (error: any) => {
      toast({ title: "Unlink failed", description: error.message, variant: "destructive" });
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
        // Sync Big Rock links after updating objective
        await syncBigRockLinks(variables.id, objectiveForm.linkedBigRocks, previousLinkedBigRocks);
      } catch (error) {
        console.error('Failed to sync value tags or Big Rock links:', error);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`] });
      setObjectiveDialogOpen(false);
      setSelectedObjective(null);
      setObjectiveValueTags([]);
      setPreviousObjectiveValueTags([]);
      setPreviousLinkedBigRocks([]);
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

  const closeObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/okr/objectives/${id}`, { status: 'closed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`], exact: false });
      toast({ title: "Success", description: "Objective closed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to close objective", variant: "destructive" });
    },
  });

  const reopenObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/okr/objectives/${id}`, { status: 'on_track' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`], exact: false });
      toast({ title: "Success", description: "Objective reopened successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reopen objective", variant: "destructive" });
    },
  });

  const closeKeyResultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/okr/key-results/${id}`, { status: 'closed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`], exact: false });
      toast({ title: "Success", description: "Key Result closed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to close Key Result", variant: "destructive" });
    },
  });

  const reopenKeyResultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/okr/key-results/${id}`, { status: 'on_track' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/hierarchy`], exact: false });
      toast({ title: "Success", description: "Key Result reopened successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reopen Key Result", variant: "destructive" });
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

  // Close/Complete entity mutation (for close prompt)
  const closeEntityMutation = useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: string; entityId: string }) => {
      const endpoint = entityType === "key_result" 
        ? `/api/okr/key-results/${entityId}`
        : `/api/okr/objectives/${entityId}`;
      return apiRequest("PATCH", endpoint, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`, currentTenant.id, quarter, year] });
      queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
      setClosePromptDialogOpen(false);
      setClosePromptEntity(null);
      toast({ title: "Success", description: "Item marked as completed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to close item", variant: "destructive" });
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

  // Fetch check-in history for selected Big Rock
  const { data: bigRockCheckInHistory = [] } = useQuery<CheckIn[]>({
    queryKey: [`/api/okr/check-ins`, 'big_rock', selectedBigRockForHistory?.id],
    queryFn: async () => {
      if (!selectedBigRockForHistory) return [];
      const res = await fetch(`/api/okr/check-ins?entityType=big_rock&entityId=${selectedBigRockForHistory.id}`);
      if (!res.ok) throw new Error("Failed to fetch check-in history");
      return res.json();
    },
    enabled: !!selectedBigRockForHistory && bigRockCheckInHistoryDialogOpen,
  });

  // Helper functions for toggling strategies and goals
  const toggleObjectiveStrategy = (strategyId: string) => {
    setObjectiveForm(prev => {
      const currentStrategies = prev.linkedStrategies || [];
      return {
        ...prev,
        linkedStrategies: currentStrategies.includes(strategyId)
          ? currentStrategies.filter(s => s !== strategyId)
          : [...currentStrategies, strategyId],
      };
    });
  };

  const toggleObjectiveGoal = (goal: string) => {
    setObjectiveForm(prev => {
      const currentGoals = prev.linkedGoals || [];
      return {
        ...prev,
        linkedGoals: currentGoals.includes(goal)
          ? currentGoals.filter(g => g !== goal)
          : [...currentGoals, goal],
      };
    });
  };

  const toggleBigRockStrategy = (strategyId: string) => {
    setBigRockForm(prev => {
      const currentStrategies = prev.linkedStrategies || [];
      return {
        ...prev,
        linkedStrategies: currentStrategies.includes(strategyId)
          ? currentStrategies.filter(s => s !== strategyId)
          : [...currentStrategies, strategyId],
      };
    });
  };

  // Handler functions
  const handleCreateObjective = (parentId?: string) => {
    setObjectiveForm({
      title: "",
      description: "",
      level: parentId ? "team" : "organization",
      parentId: parentId || "",
      ownerEmail: "",
      teamId: "",
      progressMode: "rollup",
      quarter: quarter ?? 1, // Default to Q1 if "All Periods" selected
      year,
      linkedStrategies: [],
      linkedGoals: [],
      linkedBigRocks: [],
      phasedTargets: null,
    });
    setSelectedObjective(null);
    setObjectiveValueTags([]);
    setPreviousObjectiveValueTags([]);
    setObjectiveDialogOpen(true);
  };

  const handleEditObjective = async (objective: Objective & { phasedTargets?: PhasedTargets | null }) => {
    // Set initial form state with defensive defaults
    const initialForm = {
      title: objective.title || "",
      description: objective.description || "",
      level: objective.level || "organization",
      parentId: objective.parentId || "",
      ownerEmail: objective.ownerEmail || "",
      teamId: objective.teamId || "",
      progressMode: "rollup" as const,
      quarter: objective.quarter || 1,
      year: objective.year || new Date().getFullYear(),
      linkedStrategies: Array.isArray(objective.linkedStrategies) ? objective.linkedStrategies : [],
      linkedGoals: Array.isArray(objective.linkedGoals) ? objective.linkedGoals : [],
      linkedBigRocks: [] as string[],
      phasedTargets: objective.phasedTargets || null,
    };
    
    setObjectiveForm(initialForm);
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
    
    // Fetch existing linked Big Rocks
    try {
      const res = await fetch(`/api/okr/objectives/${objective.id}/linked-big-rocks`);
      if (res.ok) {
        const linkedBigRocks = await res.json();
        const bigRockIds = linkedBigRocks.map((br: BigRock) => br.id);
        setPreviousLinkedBigRocks(bigRockIds);
        // Update form with fetched Big Rocks, preserving all other fields
        setObjectiveForm(prev => ({ 
          ...prev, 
          linkedBigRocks: bigRockIds
        }));
      }
    } catch (error) {
      console.error("Failed to fetch linked Big Rocks:", error);
    }
    
    // Open dialog after all state is set
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
        phasedTargets: null,
      });
      setSelectedKeyResult(null);
      setKeyResultDialogOpen(true);
    }
  };

  const handleEditKeyResult = (keyResult: KeyResult & { phasedTargets?: PhasedTargets | null }, objectiveId: string) => {
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
      phasedTargets: keyResult.phasedTargets || null,
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
      teamId: "",
      ownerEmail: "",
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
      teamId: bigRock.teamId || "",
      ownerEmail: bigRock.ownerEmail || "",
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

  const handleBigRockCheckIn = (rock: BigRock) => {
    // Set up for new check-in
    setCheckInEntity({
      type: "big_rock",
      id: rock.id,
      current: rock,
    });
    setEditingCheckIn(null);
    setCheckInForm({
      newValue: 0,
      newProgress: rock.completionPercentage || 0,
      newStatus: rock.status || "not_started",
      note: "",
      achievements: [""],
      challenges: [""],
      nextSteps: [""],
      asOfDate: new Date().toISOString().split('T')[0],
    });
    setCheckInDialogOpen(true);
  };

  const handleBigRockViewHistory = (rock: BigRock) => {
    setSelectedBigRockForHistory(rock);
    setBigRockCheckInHistoryDialogOpen(true);
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
      
      // Check if objective has exceeded target (100%+) and show close prompt
      if (current && current.progress >= 100 && current.status !== "completed") {
        setClosePromptEntity({
          type: entityType,
          id: entityId,
          title: current.title,
          progress: current.progress,
        });
        setClosePromptDialogOpen(true);
        return;
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
        asOfDate: new Date().toISOString().split('T')[0],
      });
    } else if (entityType === "key_result") {
      // Fetch the full Key Result data to get unit and target
      try {
        const res = await fetch(`/api/okr/key-results/${entityId}`);
        if (res.ok) {
          current = await res.json();
          
          // Check if KR has exceeded target (100%+) and show close prompt
          if (current && current.progress >= 100 && current.status !== "completed") {
            setClosePromptEntity({
              type: entityType,
              id: entityId,
              title: current.title,
              progress: current.progress,
            });
            setClosePromptDialogOpen(true);
            return;
          }
          
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
  
  // Handler to proceed with check-in after dismissing close prompt
  const handleProceedWithCheckIn = async () => {
    if (!closePromptEntity) return;
    
    setClosePromptDialogOpen(false);
    const { type, id } = closePromptEntity;
    setClosePromptEntity(null);
    
    // Now actually open the check-in dialog
    let current = null;
    if (type === "objective") {
      current = objectives.find(o => o.id === id);
      setCheckInEntity({ type, id, current });
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
    } else if (type === "key_result") {
      try {
        const res = await fetch(`/api/okr/key-results/${id}`);
        if (res.ok) {
          current = await res.json();
          setCheckInEntity({ type, id, current });
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
            <h1 className="text-3xl font-semibold">Enhanced Planning</h1>
            <p className="text-muted-foreground mt-1">
              Hierarchical OKRs, Big Rocks, and Progress Tracking for {quarter === null ? 'All Periods' : quarter === 0 ? 'Annual' : `Q${quarter}`} {year}
              {level !== 'all' && ` - ${level.charAt(0).toUpperCase() + level.slice(1)} Level`}
              {teamId !== 'all' && teamsData.find(t => t.id === teamId) && ` - ${teamsData.find(t => t.id === teamId)?.name}`}
              {statusFilter !== 'all' && ` - ${statusFilter.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={quarter === null ? 'all' : quarter.toString()} onValueChange={(v) => setQuarter(v === 'all' ? null : parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="0">Annual</SelectItem>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-24" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="behind">Behind</SelectItem>
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-36" data-testid="select-level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-40" data-testid="select-team">
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
            <Button
              onClick={() => handleCreateObjective()}
              data-testid="button-add-objective"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Objective
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">
              OKR Hierarchy
            </TabsTrigger>
            <TabsTrigger value="big-rocks" data-testid="tab-big-rocks">
              Big Rocks ({bigRocks.length})
            </TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">
              Progress Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy">
            <div className="space-y-4">
              {!loadingHierarchy && filteredHierarchyData.length > 0 && (
                <ProgressSummaryBar objectives={filteredHierarchyData} />
              )}
              {loadingHierarchy ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <HierarchicalOKRTable
                  objectives={filteredHierarchyData}
                  onSelectObjective={(obj) => {
                    setDetailPaneEntityType("objective");
                    setDetailPaneEntity(obj);
                    setDetailPaneParentObjective(null);
                    setDetailPaneOpen(true);
                  }}
                  onSelectKeyResult={(kr, parentObj) => {
                    setDetailPaneEntityType("key_result");
                    setDetailPaneEntity(kr);
                    setDetailPaneParentObjective(parentObj);
                    setDetailPaneOpen(true);
                  }}
                  onEditObjective={(obj) => {
                    setSelectedObjective(obj as any);
                    setObjectiveForm({
                      title: obj.title,
                      description: obj.description,
                      level: obj.level || 'organization',
                      parentId: obj.parentId || '',
                      linkedStrategies: Array.isArray((obj as any).linkedStrategies) ? (obj as any).linkedStrategies : [],
                      linkedBigRocks: [],
                      ownerEmail: obj.ownerEmail || '',
                      teamId: (obj as any).teamId || '',
                      progressMode: "rollup",
                      quarter: obj.quarter,
                      year: obj.year,
                      linkedGoals: Array.isArray((obj as any).linkedGoals) ? (obj as any).linkedGoals : [],
                      alignedToObjectiveIds: Array.isArray((obj as any).alignedToObjectiveIds) ? (obj as any).alignedToObjectiveIds : [],
                      phasedTargets: obj.phasedTargets || null,
                    });
                    setObjectiveDialogOpen(true);
                  }}
                  onEditKeyResult={(kr) => {
                    setSelectedKeyResult(kr as any);
                    // Find the parent objective for this KR
                    const parentObj = objectives.find(o => o.id === kr.objectiveId);
                    if (parentObj) {
                      setSelectedObjective(parentObj);
                    }
                    // Populate the form with existing KR data
                    setKeyResultForm({
                      title: kr.title,
                      description: kr.description || "",
                      metricType: kr.metricType || "increase",
                      targetValue: kr.targetValue ?? 100,
                      currentValue: kr.currentValue ?? 0,
                      initialValue: kr.initialValue ?? 0,
                      unit: kr.unit || "%",
                      weight: kr.weight ?? 25,
                      objectiveId: kr.objectiveId,
                      phasedTargets: (kr as any).phasedTargets || null,
                    });
                    setKeyResultDialogOpen(true);
                  }}
                  onAddChildObjective={(parentId) => {
                    setSelectedObjective(null);
                    setObjectiveForm({
                      title: "",
                      description: "",
                      level: "team",
                      parentId: parentId,
                      linkedStrategies: [],
                      linkedBigRocks: [],
                      ownerEmail: user?.email || "",
                      teamId: "",
                      progressMode: "rollup",
                      quarter: quarter ?? 1, // Default to Q1 if "All Periods" selected
                      year: year,
                      linkedGoals: [],
                      alignedToObjectiveIds: [],
                      phasedTargets: null,
                    });
                    setObjectiveDialogOpen(true);
                  }}
                  onAlignObjective={(targetObjectiveId) => {
                    // Open alignment dialog to select existing objectives to link
                    setAlignmentTargetObjective(targetObjectiveId);
                    setAlignmentDialogOpen(true);
                  }}
                  onAddKeyResult={(objectiveId) => {
                    setSelectedKeyResult(null);
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
                      phasedTargets: null,
                    });
                    setKeyResultDialogOpen(true);
                  }}
                  onCheckInObjective={(obj) => {
                    // Check if objective has exceeded target (100%+) and show close prompt
                    if (obj.progress >= 100 && obj.status !== "completed") {
                      setClosePromptEntity({
                        type: "objective",
                        id: obj.id,
                        title: obj.title,
                        progress: obj.progress,
                      });
                      setClosePromptDialogOpen(true);
                      return;
                    }
                    setCheckInEntity({ type: 'objective', id: obj.id, current: obj });
                    setCheckInForm({
                      newValue: 0,
                      newProgress: obj.progress,
                      newStatus: obj.status,
                      note: "",
                      achievements: [""],
                      challenges: [""],
                      nextSteps: [""],
                      asOfDate: new Date().toISOString().split('T')[0],
                    });
                    setCheckInDialogOpen(true);
                  }}
                  onCheckInKeyResult={(kr) => {
                    // Check if KR has exceeded target (100%+) and show close prompt
                    if (kr.progress >= 100 && kr.status !== "completed") {
                      setClosePromptEntity({
                        type: "key_result",
                        id: kr.id,
                        title: kr.title,
                        progress: kr.progress,
                      });
                      setClosePromptDialogOpen(true);
                      return;
                    }
                    setCheckInEntity({ type: 'key_result', id: kr.id, current: kr });
                    setValueInputDraft(String(kr.currentValue || 0));
                    setCheckInForm({
                      newValue: kr.currentValue || 0,
                      newProgress: kr.progress,
                      newStatus: kr.status,
                      note: "",
                      achievements: [""],
                      challenges: [""],
                      nextSteps: [""],
                      asOfDate: new Date().toISOString().split('T')[0],
                    });
                    setCheckInDialogOpen(true);
                  }}
                  onDeleteObjective={(objectiveId) => {
                    if (confirm("Are you sure you want to delete this objective? This will also delete all its key results.")) {
                      deleteObjectiveMutation.mutate(objectiveId);
                    }
                  }}
                  onDeleteKeyResult={(keyResultId) => {
                    if (confirm("Are you sure you want to delete this key result?")) {
                      deleteKeyResultMutation.mutate(keyResultId);
                    }
                  }}
                  onCloseObjective={(objectiveId) => {
                    if (confirm("Close this objective? It will become read-only until reopened.")) {
                      closeObjectiveMutation.mutate(objectiveId);
                    }
                  }}
                  onReopenObjective={(objectiveId) => {
                    reopenObjectiveMutation.mutate(objectiveId);
                  }}
                  onCloseKeyResult={(keyResultId) => {
                    if (confirm("Close this key result? It will become read-only until reopened.")) {
                      closeKeyResultMutation.mutate(keyResultId);
                    }
                  }}
                  onReopenKeyResult={(keyResultId) => {
                    reopenKeyResultMutation.mutate(keyResultId);
                  }}
                  onManageWeights={handleManageWeights}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="big-rocks">
            <BigRocksSection 
              bigRocks={bigRocks} 
              objectives={objectives}
              strategies={strategies}
              onCreateBigRock={handleCreateBigRock}
              onEditBigRock={handleEditBigRock}
              onDeleteBigRock={handleDeleteBigRock}
              onCheckIn={handleBigRockCheckIn}
              onViewHistory={handleBigRockViewHistory}
            />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressDashboard objectives={enrichedObjectives} bigRocks={bigRocks} />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Objective Dialog */}
        <Dialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedObjective ? "Edit" : "Create"} Objective</DialogTitle>
              <DialogDescription>
                {selectedObjective ? "Update the objective details" : `Define a new objective`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
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
                        variant={(objectiveForm.linkedStrategies || []).includes(strategy.id) ? "default" : "outline"}
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
                        variant={(objectiveForm.linkedGoals || []).includes(goal) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleObjectiveGoal(goal)}
                        data-testid={`badge-goal-${goal?.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {goal}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label>Link to Existing Big Rocks</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {bigRocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No big rocks available to link</p>
                  ) : (
                    bigRocks.map((rock: BigRock) => (
                      <Badge
                        key={rock.id}
                        variant={(objectiveForm.linkedBigRocks || []).includes(rock.id) ? "default" : "outline"}
                        className="cursor-pointer toggle-elevate"
                        onClick={() => {
                          const current = objectiveForm.linkedBigRocks || [];
                          if (current.includes(rock.id)) {
                            setObjectiveForm({ ...objectiveForm, linkedBigRocks: current.filter(id => id !== rock.id) });
                          } else {
                            setObjectiveForm({ ...objectiveForm, linkedBigRocks: [...current, rock.id] });
                          }
                        }}
                        data-testid={`badge-bigrock-${rock.id}`}
                      >
                        {rock.title}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label>Link to Parent Objective</Label>
                <p className="text-xs text-muted-foreground mb-2">Select a parent objective for direct hierarchy</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {objectives.filter(obj => obj.id !== selectedObjective?.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No other objectives available</p>
                  ) : (
                    objectives.filter(obj => obj.id !== selectedObjective?.id).map((obj: Objective) => (
                      <Badge
                        key={obj.id}
                        variant={objectiveForm.parentId === obj.id ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setObjectiveForm({ 
                            ...objectiveForm, 
                            parentId: objectiveForm.parentId === obj.id ? "" : obj.id 
                          });
                        }}
                        data-testid={`badge-parent-objective-${obj.id}`}
                      >
                        {obj.title}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Aligns To / Supports (Ladder Up)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Link this objective to existing objectives it supports. Creates a virtual parent-child relationship without changing the hierarchy.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {objectives.filter(obj => 
                    obj.id !== selectedObjective?.id && 
                    obj.id !== objectiveForm.parentId
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No objectives available to align to</p>
                  ) : (
                    objectives.filter(obj => 
                      obj.id !== selectedObjective?.id && 
                      obj.id !== objectiveForm.parentId
                    ).map((obj: Objective) => (
                      <Badge
                        key={obj.id}
                        variant={(objectiveForm.alignedToObjectiveIds || []).includes(obj.id) ? "default" : "outline"}
                        className="cursor-pointer toggle-elevate"
                        onClick={() => {
                          const current = objectiveForm.alignedToObjectiveIds || [];
                          if (current.includes(obj.id)) {
                            setObjectiveForm({ ...objectiveForm, alignedToObjectiveIds: current.filter(id => id !== obj.id) });
                          } else {
                            setObjectiveForm({ ...objectiveForm, alignedToObjectiveIds: [...current, obj.id] });
                          }
                        }}
                        data-testid={`badge-align-objective-${obj.id}`}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        {obj.title}
                        {obj.level && <span className="ml-1 text-xs opacity-70">({obj.level})</span>}
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
                  <Label htmlFor="obj-team">Assign to Team</Label>
                  <Select
                    value={objectiveForm.teamId || "none"}
                    onValueChange={(value) => setObjectiveForm({ ...objectiveForm, teamId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-objective-team">
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="none">No team (Organization-wide)</SelectItem>
                      {teamsData.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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

              {/* Milestones Section */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Milestones</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setObjectiveMilestoneEditorOpen(true)}
                    data-testid="button-set-objective-milestones"
                  >
                    {objectiveForm.phasedTargets?.targets?.length ? `Edit ${objectiveForm.phasedTargets.targets.length} Milestones` : "Set Milestones"}
                  </Button>
                </div>
                {objectiveForm.phasedTargets?.targets && objectiveForm.phasedTargets.targets.length > 0 && (
                  <div className="mt-2">
                    <MilestoneTimeline
                      phasedTargets={objectiveForm.phasedTargets}
                      currentValue={0}
                      targetValue={100}
                      initialValue={0}
                      metricType="increase"
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
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

              {/* Milestones Section */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Milestones</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setKeyResultMilestoneEditorOpen(true)}
                    data-testid="button-set-kr-milestones"
                  >
                    {keyResultForm.phasedTargets?.targets?.length ? `Edit ${keyResultForm.phasedTargets.targets.length} Milestones` : "Set Milestones"}
                  </Button>
                </div>
                {keyResultForm.phasedTargets?.targets && keyResultForm.phasedTargets.targets.length > 0 && (
                  <div className="mt-2">
                    <MilestoneTimeline
                      phasedTargets={keyResultForm.phasedTargets}
                      currentValue={keyResultForm.currentValue}
                      targetValue={keyResultForm.targetValue}
                      initialValue={keyResultForm.initialValue}
                      unit={keyResultForm.unit}
                      metricType={keyResultForm.metricType as 'increase' | 'decrease' | 'maintain' | 'complete'}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* Excel Data Source Section - only show for existing KRs */}
              {selectedKeyResult && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <Label>Excel Data Source</Label>
                    </div>
                    {selectedKeyResult.excelFileId ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <Link2 className="h-3 w-3 mr-1" />
                        Linked
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not linked</Badge>
                    )}
                  </div>
                  
                  {selectedKeyResult.excelFileId ? (
                    <div className="space-y-2">
                      <div className="text-sm">
                        <p className="font-medium truncate">{selectedKeyResult.excelFileName}</p>
                        <p className="text-muted-foreground text-xs truncate">
                          {selectedKeyResult.excelSheetName}!{selectedKeyResult.excelCellReference}
                        </p>
                        {selectedKeyResult.excelLastSyncAt && (
                          <p className="text-muted-foreground text-xs mt-1">
                            Last synced: {format(new Date(selectedKeyResult.excelLastSyncAt), "MMM d, yyyy h:mm a")}
                            {selectedKeyResult.excelLastSyncValue !== null && (
                              <span className="ml-2">Value: {selectedKeyResult.excelLastSyncValue}</span>
                            )}
                          </p>
                        )}
                        {selectedKeyResult.excelSyncError && (
                          <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {selectedKeyResult.excelSyncError}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncExcelMutation.mutate(selectedKeyResult.id)}
                          disabled={syncExcelMutation.isPending}
                          data-testid="button-sync-excel"
                        >
                          {syncExcelMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Sync Now
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Unlink this Key Result from Excel?")) {
                              unlinkExcelMutation.mutate(selectedKeyResult.id);
                            }
                          }}
                          disabled={unlinkExcelMutation.isPending}
                          data-testid="button-unlink-excel"
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Unlink
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Connect to an Excel file in OneDrive to automatically sync the current value.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExcelPickerOpen(true)}
                        data-testid="button-link-excel"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        Link to Excel
                      </Button>
                    </div>
                  )}
                </div>
              )}
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

        {/* Milestone Editor for Objectives */}
        <MilestoneEditor
          open={objectiveMilestoneEditorOpen}
          onOpenChange={setObjectiveMilestoneEditorOpen}
          phasedTargets={objectiveForm.phasedTargets}
          onSave={(phasedTargets) => {
            setObjectiveForm({ ...objectiveForm, phasedTargets });
          }}
          metricType="increase"
          targetValue={100}
          initialValue={0}
        />

        {/* Milestone Editor for Key Results */}
        <MilestoneEditor
          open={keyResultMilestoneEditorOpen}
          onOpenChange={setKeyResultMilestoneEditorOpen}
          phasedTargets={keyResultForm.phasedTargets}
          onSave={(phasedTargets) => {
            setKeyResultForm({ ...keyResultForm, phasedTargets });
          }}
          metricType={keyResultForm.metricType as 'increase' | 'decrease' | 'maintain' | 'complete'}
          targetValue={keyResultForm.targetValue}
          initialValue={keyResultForm.initialValue}
          unit={keyResultForm.unit}
        />

        {/* Excel File Picker for Key Results */}
        {selectedKeyResult && (
          <ExcelFilePicker
            open={excelPickerOpen}
            onOpenChange={setExcelPickerOpen}
            keyResultId={selectedKeyResult.id}
            keyResultTitle={selectedKeyResult.title}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
              setKeyResultDialogOpen(false);
            }}
          />
        )}

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
                {selectedBigRock ? "Update your Big Rock initiative" : `Define or link a Big Rock initiative for ${quarter === 0 ? 'Annual' : `Q${quarter}`} ${year}`}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="br-team">Assign to Team</Label>
                    <Select
                      value={bigRockForm.teamId || "none"}
                      onValueChange={(value) => setBigRockForm({ ...bigRockForm, teamId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger data-testid="select-bigrock-team">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        <SelectItem value="none">No Team</SelectItem>
                        {teamsData.map((team) => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="br-owner">Owner Email</Label>
                    <Input
                      id="br-owner"
                      type="email"
                      value={bigRockForm.ownerEmail}
                      onChange={(e) => setBigRockForm({ ...bigRockForm, ownerEmail: e.target.value })}
                      placeholder="owner@example.com"
                      data-testid="input-bigrock-owner"
                    />
                  </div>
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

                {selectedBigRock && (
                  <div className="pt-2">
                    <PlannerProgressMapping
                      entityType="bigrock"
                      entityId={selectedBigRock.id}
                      entityTitle={selectedBigRock.title}
                      onProgressUpdate={(progress) => {
                        setBigRockForm({ ...bigRockForm, completionPercentage: Math.round(progress) });
                      }}
                    />
                  </div>
                )}
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
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Manage Key Result Weights</DialogTitle>
              <DialogDescription>
                {selectedObjective && `For: ${selectedObjective.title}`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 overflow-y-auto flex-1 min-h-0">
              {managedWeights.length > 0 && (
                <WeightManager
                  items={managedWeights}
                  onChange={setManagedWeights} // Update local state only
                  itemNameKey={"title" as any}
                />
              )}
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
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

        {/* Close/Complete Prompt Dialog */}
        <Dialog open={closePromptDialogOpen} onOpenChange={setClosePromptDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Target Exceeded
              </DialogTitle>
              <DialogDescription>
                This {closePromptEntity?.type === "key_result" ? "Key Result" : "Objective"} has already exceeded its target.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="font-medium text-sm mb-1">{closePromptEntity?.title}</p>
                <p className="text-2xl font-bold text-green-600">
                  {closePromptEntity?.progress}% complete
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                It looks like you're done working on this. Would you like to close it instead of checking in?
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleProceedWithCheckIn}
                data-testid="button-continue-checkin"
              >
                Continue Check-in
              </Button>
              <Button
                onClick={() => {
                  if (closePromptEntity) {
                    closeEntityMutation.mutate({
                      entityType: closePromptEntity.type,
                      entityId: closePromptEntity.id,
                    });
                  }
                }}
                disabled={closeEntityMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-close-entity"
              >
                {closeEntityMutation.isPending ? "Closing..." : "Close It"}
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
                      
                      // Allow progress >100% for exceeding targets, only clamp negative to 0
                      const finalProgress = isNaN(progress) ? 0 : Math.max(0, Math.round(progress));
                      
                      setCheckInForm({ 
                        ...checkInForm, 
                        newValue: newVal,
                        newProgress: finalProgress
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
              
              {/* For Big Rocks: Show Completion Percentage Slider (when not using Planner sync) */}
              {checkInEntity?.type === "big_rock" && (
                <div>
                  <Label htmlFor="ci-bigrock-progress">Completion ({checkInForm.newProgress}%)</Label>
                  {checkInEntity.current?.plannerSyncEnabled ? (
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                      <p>Progress is synced from Microsoft Planner.</p>
                      <p className="mt-1">To update manually, disable Planner sync in the Big Rock settings.</p>
                    </div>
                  ) : (
                    <Slider
                      id="ci-bigrock-progress"
                      value={[checkInForm.newProgress]}
                      onValueChange={(value) => setCheckInForm({ ...checkInForm, newProgress: value[0] })}
                      max={100}
                      step={5}
                      data-testid="slider-bigrock-checkin-progress"
                    />
                  )}
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

        {/* Big Rock Check-In History Dialog */}
        <Dialog open={bigRockCheckInHistoryDialogOpen} onOpenChange={setBigRockCheckInHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Big Rock Check-In History</DialogTitle>
              <DialogDescription>
                {selectedBigRockForHistory?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {bigRockCheckInHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No check-ins recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bigRockCheckInHistory.map((checkIn) => (
                    <Card key={checkIn.id} className="p-4" data-testid={`bigrock-checkin-${checkIn.id}`}>
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
                                {checkIn.newStatus?.replace('_', ' ').toUpperCase() || 'NOT STARTED'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              by {checkIn.createdBy}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                Completion: {checkIn.previousProgress}% → {checkIn.newProgress}%
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setCheckInEntity({
                                  type: "big_rock",
                                  id: selectedBigRockForHistory?.id || "",
                                  current: selectedBigRockForHistory,
                                });
                                handleEditCheckIn(checkIn);
                              }}
                              data-testid={`button-edit-bigrock-checkin-${checkIn.id}`}
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
                onClick={() => setBigRockCheckInHistoryDialogOpen(false)}
                data-testid="button-close-bigrock-history"
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
          quarter={quarter ?? 0}
          year={year}
          onSaveToMeeting={(summary, dateRange) => {
            setSavedSummary({ content: summary, dateRange });
            setSaveToMeetingDialogOpen(true);
          }}
        />

        {/* Save to Meeting Dialog */}
        <Dialog open={saveToMeetingDialogOpen} onOpenChange={setSaveToMeetingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Save Summary to Meeting
              </DialogTitle>
              <DialogDescription>
                Choose an existing meeting to add this progress summary, or create a new meeting.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {savedSummary && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium mb-1">Progress Summary ({savedSummary.dateRange})</div>
                  <div className="text-muted-foreground line-clamp-3">
                    {savedSummary.content.substring(0, 200)}...
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Select an existing meeting:</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  {meetings.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No meetings found. Create a new meeting below.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {meetings.sort((a: any, b: any) => 
                        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
                      ).slice(0, 10).map((meeting: any) => (
                        <Button
                          key={meeting.id}
                          variant="outline"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => {
                            const existingSummary = meeting.summary || '';
                            const newSummary = existingSummary 
                              ? `${existingSummary}\n\n---\n\n**Progress Report (${savedSummary?.dateRange}):**\n${savedSummary?.content}`
                              : `**Progress Report (${savedSummary?.dateRange}):**\n${savedSummary?.content}`;
                            updateMeetingMutation.mutate({
                              id: meeting.id,
                              data: { summary: newSummary }
                            });
                          }}
                          data-testid={`button-select-meeting-${meeting.id}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium">{meeting.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {meeting.date ? format(new Date(meeting.date), 'MMM d, yyyy') : 'No date set'}
                              {meeting.meetingType && ` • ${meeting.meetingType}`}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  createMeetingMutation.mutate({
                    title: `Progress Review - ${savedSummary?.dateRange}`,
                    meetingType: 'monthly',
                    date: new Date().toISOString(),
                    summary: `**Progress Report (${savedSummary?.dateRange}):**\n${savedSummary?.content}`,
                  });
                }}
                disabled={createMeetingMutation.isPending}
                data-testid="button-create-new-meeting"
              >
                {createMeetingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create New Meeting with Summary
              </Button>
            </div>
            
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveToMeetingDialogOpen(false);
                  setSavedSummary(null);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alignment Dialog - Link existing objectives to a target */}
        <Dialog open={alignmentDialogOpen} onOpenChange={setAlignmentDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Link Objectives</DialogTitle>
              <DialogDescription>
                Select objectives to align with "{objectives.find(o => o.id === alignmentTargetObjective)?.title || 'this objective'}". 
                Aligned objectives will appear as supporting items in the hierarchy.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Filter for objectives that can be aligned (not the target itself, not already aligned) */}
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                {objectives
                  .filter(obj => 
                    obj.id !== alignmentTargetObjective && 
                    obj.parentId !== alignmentTargetObjective &&
                    obj.level !== 'organization' // Only team/individual can align to org
                  )
                  .map((obj) => {
                    const isAligned = obj.alignedToObjectiveIds?.includes(alignmentTargetObjective || '');
                    return (
                      <div
                        key={obj.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-md mb-2 hover-elevate cursor-pointer",
                          isAligned ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700" : "border"
                        )}
                        onClick={async () => {
                          // Toggle alignment
                          const currentAligned = obj.alignedToObjectiveIds || [];
                          let newAligned: string[];
                          if (isAligned) {
                            newAligned = currentAligned.filter(id => id !== alignmentTargetObjective);
                          } else {
                            newAligned = [...currentAligned, alignmentTargetObjective!];
                          }
                          
                          // Update the objective
                          try {
                            await apiRequest(`/api/okr/objectives/${obj.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ alignedToObjectiveIds: newAligned }),
                            });
                            queryClient.invalidateQueries({ queryKey: [`/api/okr/objectives`] });
                            queryClient.invalidateQueries({ queryKey: ['/api/okr/hierarchy'] });
                            toast({
                              title: isAligned ? "Alignment removed" : "Objective aligned",
                              description: isAligned 
                                ? `"${obj.title}" is no longer aligned to this objective`
                                : `"${obj.title}" now supports this objective`,
                            });
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to update alignment",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid={`alignment-option-${obj.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {isAligned ? (
                            <Link2 className="h-4 w-4 text-purple-500" />
                          ) : (
                            <Target className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{obj.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {obj.level} • Q{obj.quarter} {obj.year}
                              {obj.ownerEmail && ` • ${obj.ownerEmail.split('@')[0]}`}
                            </div>
                          </div>
                        </div>
                        <Badge variant={isAligned ? "default" : "outline"} className="text-xs">
                          {isAligned ? "Aligned" : "Click to align"}
                        </Badge>
                      </div>
                    );
                  })
                }
                {objectives.filter(obj => 
                  obj.id !== alignmentTargetObjective && 
                  obj.parentId !== alignmentTargetObjective &&
                  obj.level !== 'organization'
                ).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No team or individual objectives available to align.
                    Create team-level objectives first.
                  </div>
                )}
              </ScrollArea>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAlignmentDialogOpen(false);
                  setSelectedObjective(null);
                  setObjectiveForm({
                    title: "",
                    description: "",
                    level: "team",
                    parentId: "",
                    linkedStrategies: [],
                    linkedBigRocks: [],
                    ownerEmail: user?.email || "",
                    teamId: "",
                    progressMode: "rollup",
                    quarter: quarter ?? 1,
                    year: year,
                    linkedGoals: [],
                    alignedToObjectiveIds: alignmentTargetObjective ? [alignmentTargetObjective] : [],
                    phasedTargets: null,
                  });
                  setObjectiveDialogOpen(true);
                }}
                data-testid="button-create-aligned-objective"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Aligned Objective
              </Button>
            </div>
            
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setAlignmentDialogOpen(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* OKR Detail Pane */}
        <OKRDetailPane
          open={detailPaneOpen}
          onOpenChange={setDetailPaneOpen}
          entityType={detailPaneEntityType}
          entity={detailPaneEntity}
          alignedStrategies={strategies.filter((s: any) => 
            detailPaneEntity?.linkedStrategies?.includes(s.id)
          )}
          linkedBigRocks={detailPaneEntity?.linkedBigRocks || []}
          onCheckIn={() => {
            if (detailPaneEntityType === "objective" && detailPaneEntity) {
              setCheckInEntity({ type: 'objective', id: detailPaneEntity.id, current: detailPaneEntity });
              setCheckInForm({
                newValue: 0,
                newProgress: detailPaneEntity.progress,
                newStatus: detailPaneEntity.status,
                note: "",
                achievements: [""],
                challenges: [""],
                nextSteps: [""],
                asOfDate: new Date().toISOString().split('T')[0],
              });
            } else if (detailPaneEntityType === "key_result" && detailPaneEntity) {
              setCheckInEntity({ type: 'key_result', id: detailPaneEntity.id, current: detailPaneEntity });
              setValueInputDraft(String(detailPaneEntity.currentValue || 0));
              setCheckInForm({
                newValue: detailPaneEntity.currentValue || 0,
                newProgress: detailPaneEntity.progress,
                newStatus: detailPaneEntity.status,
                note: "",
                achievements: [""],
                challenges: [""],
                nextSteps: [""],
                asOfDate: new Date().toISOString().split('T')[0],
              });
            }
            setDetailPaneOpen(false);
            setCheckInDialogOpen(true);
          }}
          onEdit={() => {
            if (detailPaneEntityType === "objective" && detailPaneEntity) {
              setSelectedObjective(detailPaneEntity as any);
              setObjectiveForm({
                title: detailPaneEntity.title,
                description: detailPaneEntity.description || "",
                level: detailPaneEntity.level || 'organization',
                parentId: detailPaneEntity.parentId || '',
                linkedStrategies: Array.isArray((detailPaneEntity as any).linkedStrategies) ? (detailPaneEntity as any).linkedStrategies : [],
                linkedBigRocks: [],
                ownerEmail: detailPaneEntity.ownerEmail || '',
                teamId: (detailPaneEntity as any).teamId || '',
                progressMode: "rollup",
                quarter: detailPaneEntity.quarter,
                year: detailPaneEntity.year,
                linkedGoals: Array.isArray((detailPaneEntity as any).linkedGoals) ? (detailPaneEntity as any).linkedGoals : [],
                phasedTargets: detailPaneEntity.phasedTargets || null,
              });
              setDetailPaneOpen(false);
              setObjectiveDialogOpen(true);
            } else if (detailPaneEntityType === "key_result" && detailPaneEntity) {
              setSelectedKeyResult(detailPaneEntity as any);
              // Find the parent objective for this KR
              const parentObj = objectives.find(o => o.id === (detailPaneEntity as any).objectiveId);
              if (parentObj) {
                setSelectedObjective(parentObj);
              }
              // Populate the form with existing KR data
              setKeyResultForm({
                title: detailPaneEntity.title,
                description: detailPaneEntity.description || "",
                metricType: (detailPaneEntity as any).metricType || "increase",
                targetValue: detailPaneEntity.targetValue ?? 100,
                currentValue: detailPaneEntity.currentValue ?? 0,
                initialValue: (detailPaneEntity as any).initialValue ?? 0,
                unit: detailPaneEntity.unit || "%",
                weight: (detailPaneEntity as any).weight ?? 25,
                objectiveId: (detailPaneEntity as any).objectiveId,
                phasedTargets: detailPaneEntity.phasedTargets || null,
              });
              setDetailPaneOpen(false);
              setKeyResultDialogOpen(true);
            }
          }}
        />
      </div>
    </div>
  );
}

// Big Rocks Section Component
function BigRocksSection({ bigRocks, objectives, strategies, onCreateBigRock, onEditBigRock, onDeleteBigRock, onCheckIn, onViewHistory }: any) {
  const getObjectiveTitle = (objId: string) => {
    const obj = objectives.find((o: Objective) => o.id === objId);
    return obj?.title || "Unknown Objective";
  };

  const getStrategyTitle = (strategyId: string) => {
    const strategy = strategies?.find((s: any) => s.id === strategyId);
    return strategy?.title || "Unknown Strategy";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "on_track": return "bg-blue-500";
      case "behind": return "bg-yellow-500";
      case "at_risk": return "bg-red-500";
      case "postponed": return "bg-gray-500";
      case "closed": return "bg-gray-700";
      default: return "bg-gray-400";
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "default";
      case "on_track": return "secondary";
      case "at_risk": return "destructive";
      case "behind": return "outline";
      default: return "secondary";
    }
  };

  // Derive effective status from completion percentage if status is not set or is "not_started"
  const deriveEffectiveStatus = (status?: string | null, completion?: number | null): string => {
    const pct = completion || 0;
    // If status is explicitly set to something meaningful, use it
    if (status && status !== 'not_started') {
      return status;
    }
    // Auto-derive status from completion percentage
    if (pct >= 100) return 'completed';
    if (pct > 0) return 'on_track';
    return 'not_started';
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Big Rocks</h2>
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
              Create your first Big Rock initiative
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bigRocks.map((rock: BigRock) => {
            const effectiveStatus = deriveEffectiveStatus(rock.status, rock.completionPercentage);
            return (
            <Card key={rock.id} className="hover-elevate" data-testid={`card-bigrock-${rock.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg leading-tight">{rock.title}</CardTitle>
                    {rock.objectiveId && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Linked to: {getObjectiveTitle(rock.objectiveId)}
                      </p>
                    )}
                    {rock.accountableEmail && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Accountable: {rock.accountableEmail}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {effectiveStatus !== 'closed' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onCheckIn(rock)}
                        title="Check In"
                        data-testid={`button-checkin-bigrock-${rock.id}`}
                      >
                        <Activity className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onViewHistory(rock)}
                      title="View History"
                      data-testid={`button-history-bigrock-${rock.id}`}
                    >
                      <History className="h-4 w-4" />
                    </Button>
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
                          {getStrategyTitle(strategyId)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Completion</span>
                    <span className="font-medium">{rock.completionPercentage}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all", getStatusColor(effectiveStatus))}
                      style={{ width: `${rock.completionPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={getStatusBadgeVariant(effectiveStatus)}
                      data-testid={`badge-status-${rock.id}`}
                    >
                      {effectiveStatus.replace("_", " ")}
                    </Badge>
                    {rock.lastCheckInAt && (
                      <span className="text-xs text-muted-foreground">
                        Last check-in: {formatDate(rock.lastCheckInAt)}
                      </span>
                    )}
                  </div>
                  {rock.lastCheckInNote && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mt-2">
                      "{rock.lastCheckInNote.length > 100 ? rock.lastCheckInNote.substring(0, 100) + "..." : rock.lastCheckInNote}"
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
          })}
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