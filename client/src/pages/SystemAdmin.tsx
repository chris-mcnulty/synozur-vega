import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, BookOpen, Save, RotateCcw, Activity, BarChart3, Globe, Monitor, Smartphone, Tablet, Bot, Download, Users, Building2, Check, X, Megaphone, ExternalLink, Info, CreditCard, Ban, Plus, Pencil, Eye, Home, UserPlus, RefreshCw, Calendar, Film, Layers, Trash2, GripVertical, ImagePlus, Upload, Key, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { SystemBanner, ServicePlan, BlockedDomain, CapabilitySection, CapabilityTab } from "@shared/schema";
import { PlatformAIUsageWidget, ModelComparisonWidget } from "@/components/AIUsageWidget";
import { ScheduledJobsManager } from "@/components/ScheduledJobsManager";
import { AdminSupportTab } from "@/components/admin/AdminSupportTab";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ImageUpload } from "@/components/ImageUpload";
import { format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VocabularyTerm = {
  singular: string;
  plural: string;
};

type VocabularyTerms = {
  goal: VocabularyTerm;
  strategy: VocabularyTerm;
  objective: VocabularyTerm;
  keyResult: VocabularyTerm;
  bigRock: VocabularyTerm;
  meeting: VocabularyTerm;
  focusRhythm: VocabularyTerm;
};

const DEFAULT_VOCABULARY: VocabularyTerms = {
  goal: { singular: "Goal", plural: "Goals" },
  strategy: { singular: "Strategy", plural: "Strategies" },
  objective: { singular: "Objective", plural: "Objectives" },
  keyResult: { singular: "Key Result", plural: "Key Results" },
  bigRock: { singular: "Big Rock", plural: "Big Rocks" },
  meeting: { singular: "Meeting", plural: "Meetings" },
  focusRhythm: { singular: "Focus Rhythm", plural: "Focus Rhythms" },
};

const TERM_DESCRIPTIONS: Record<keyof VocabularyTerms, string> = {
  goal: "Annual or long-term organizational targets",
  strategy: "High-level approaches to achieve goals",
  objective: "Specific, measurable outcomes within a time period",
  keyResult: "Quantifiable metrics that measure objective progress",
  bigRock: "Major initiatives or projects that drive results",
  meeting: "Scheduled sessions for team collaboration",
  focusRhythm: "Regular cadence of strategy review sessions",
};

type TrafficStats = {
  totalVisits: number;
  totalSessions: number;
  visitsByPage: { page: string; count: number }[];
  visitsByDay: { date: string; count: number }[];
  visitsByCountry: { country: string; count: number }[];
  visitsByDevice: { device: string; count: number }[];
  visitsByBrowser: { browser: string; count: number }[];
  visitsByReferrer: { referrer: string; count: number }[];
};

type TenantActivityReport = {
  tenants: {
    id: string;
    name: string;
    planName: string | null;
    planStatus: string | null;
    planExpiresAt: string | null;
    selfServiceSignup: boolean | null;
    totalUsers: number;
    activeUsersLast30Days: number;
    elements: {
      hasMission: boolean;
      hasVision: boolean;
      valuesCount: number;
      goalsCount: number;
      strategiesCount: number;
      objectivesCount: number;
      keyResultsCount: number;
      meetingsCount: number;
    };
    lastActivityDate: string | null;
  }[];
  summary: {
    totalTenants: number;
    totalUsers: number;
    activeUsersLast30Days: number;
    inactiveTrialTenants: number;
  };
};

const getDeviceIcon = (device: string) => {
  switch (device.toLowerCase()) {
    case 'mobile': return <Smartphone className="h-4 w-4" />;
    case 'tablet': return <Tablet className="h-4 w-4" />;
    case 'bot': return <Bot className="h-4 w-4" />;
    default: return <Monitor className="h-4 w-4" />;
  }
};

const VOCABULARY_OPTIONS: Record<keyof VocabularyTerms, VocabularyTerm[]> = {
  goal: [
    { singular: "Goal", plural: "Goals" },
    { singular: "Annual Goal", plural: "Annual Goals" },
    { singular: "Strategic Goal", plural: "Strategic Goals" },
    { singular: "Target", plural: "Targets" },
    { singular: "Priority", plural: "Priorities" },
    { singular: "Theme", plural: "Themes" },
  ],
  strategy: [
    { singular: "Strategy", plural: "Strategies" },
    { singular: "Strategic Initiative", plural: "Strategic Initiatives" },
    { singular: "Strategic Pillar", plural: "Strategic Pillars" },
    { singular: "Focus Area", plural: "Focus Areas" },
    { singular: "Strategic Priority", plural: "Strategic Priorities" },
  ],
  objective: [
    { singular: "Objective", plural: "Objectives" },
    { singular: "OKR", plural: "OKRs" },
    { singular: "Quarterly Objective", plural: "Quarterly Objectives" },
    { singular: "Team Objective", plural: "Team Objectives" },
    { singular: "Goal", plural: "Goals" },
    { singular: "Outcome", plural: "Outcomes" },
  ],
  keyResult: [
    { singular: "Key Result", plural: "Key Results" },
    { singular: "KR", plural: "KRs" },
    { singular: "Measure", plural: "Measures" },
    { singular: "Metric", plural: "Metrics" },
    { singular: "Success Metric", plural: "Success Metrics" },
    { singular: "KPI", plural: "KPIs" },
  ],
  bigRock: [
    { singular: "Big Rock", plural: "Big Rocks" },
    { singular: "Initiative", plural: "Initiatives" },
    { singular: "Project", plural: "Projects" },
    { singular: "Priority", plural: "Priorities" },
    { singular: "Action Item", plural: "Action Items" },
    { singular: "Milestone", plural: "Milestones" },
    { singular: "Deliverable", plural: "Deliverables" },
  ],
  meeting: [
    { singular: "Meeting", plural: "Meetings" },
    { singular: "Session", plural: "Sessions" },
    { singular: "Sync", plural: "Syncs" },
    { singular: "Check-in", plural: "Check-ins" },
    { singular: "Standup", plural: "Standups" },
    { singular: "Review", plural: "Reviews" },
  ],
  focusRhythm: [
    { singular: "Focus Rhythm", plural: "Focus Rhythms" },
    { singular: "Cadence", plural: "Cadences" },
    { singular: "Rhythm", plural: "Rhythms" },
    { singular: "Planning Cycle", plural: "Planning Cycles" },
    { singular: "Review Cycle", plural: "Review Cycles" },
  ],
};

type AIConfig = {
  id?: string;
  activeProvider: string;
  activeModel: string;
  enableStreaming: boolean;
  enableFunctionCalling: boolean;
  maxTokensPerRequest: number | null;
  monthlyTokenBudget: number | null;
  providerConfig: Record<string, unknown> | null;
};

type ModelInfo = {
  name: string;
  providers: string[];  // List of providers that support this model
  contextWindow: number;
  costPer1kPrompt: number;  // dollars per 1K tokens
  costPer1kCompletion: number;  // dollars per 1K tokens
};

type AIOptions = {
  providers: { id: string; name: string }[];
  models: string[];
  modelInfo: Record<string, ModelInfo>;
  providerStatus: Record<string, boolean>;
};

function AIConfigPanel() {
  const { toast } = useToast();
  
  const { data: config, isLoading: configLoading } = useQuery<AIConfig>({
    queryKey: ["/api/admin/ai-config"],
  });

  const { data: options, isLoading: optionsLoading } = useQuery<AIOptions>({
    queryKey: ["/api/admin/ai-config/options"],
  });

  const [formData, setFormData] = useState<AIConfig>({
    activeProvider: 'replit_ai',
    activeModel: 'gpt-4o',
    enableStreaming: true,
    enableFunctionCalling: true,
    maxTokensPerRequest: 4000,
    monthlyTokenBudget: null,
    providerConfig: null,
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        activeProvider: config.activeProvider || 'replit_ai',
        activeModel: config.activeModel || 'gpt-4o',
        enableStreaming: config.enableStreaming ?? true,
        enableFunctionCalling: config.enableFunctionCalling ?? true,
        maxTokensPerRequest: config.maxTokensPerRequest || 4000,
        monthlyTokenBudget: config.monthlyTokenBudget || null,
        providerConfig: config.providerConfig || null,
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AIConfig>) => {
      const res = await apiRequest("PATCH", "/api/admin/ai-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-config"] });
      setHasChanges(false);
      toast({
        title: "AI Configuration Updated",
        description: "The AI provider settings have been saved. Changes take effect immediately.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    if (config) {
      setFormData({
        activeProvider: config.activeProvider || 'replit_ai',
        activeModel: config.activeModel || 'gpt-4o',
        enableStreaming: config.enableStreaming ?? true,
        enableFunctionCalling: config.enableFunctionCalling ?? true,
        maxTokensPerRequest: config.maxTokensPerRequest || 4000,
        monthlyTokenBudget: config.monthlyTokenBudget || null,
        providerConfig: config.providerConfig || null,
      });
      setHasChanges(false);
    }
  };

  const updateField = <K extends keyof AIConfig>(field: K, value: AIConfig[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const selectedModelInfo = options?.modelInfo?.[formData.activeModel];
  const modelsForProvider = options?.models?.filter(model => {
    const info = options.modelInfo?.[model];
    return info?.providers?.includes(formData.activeProvider);
  }) || [];

  if (configLoading || optionsLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Provider Configuration
              </CardTitle>
              <CardDescription className="text-sm">
                Configure which AI provider and model the platform uses for all AI features.
                Changes take effect immediately across all tenants.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges}
                data-testid="button-reset-ai-config"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button 
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                data-testid="button-save-ai-config"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <Select
                value={formData.activeProvider}
                onValueChange={(value) => {
                  updateField('activeProvider', value);
                  const firstModelForProvider = options?.models?.find(model => {
                    const info = options.modelInfo?.[model];
                    return info?.providers?.includes(value);
                  });
                  if (firstModelForProvider) {
                    updateField('activeModel', firstModelForProvider);
                  }
                }}
              >
                <SelectTrigger data-testid="select-ai-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {options?.providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the AI service provider for all AI features
              </p>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={formData.activeModel}
                onValueChange={(value) => updateField('activeModel', value)}
              >
                <SelectTrigger data-testid="select-ai-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {modelsForProvider.length > 0 ? (
                    modelsForProvider.map((model) => (
                      <SelectItem key={model} value={model}>
                        {options?.modelInfo?.[model]?.name || model}
                      </SelectItem>
                    ))
                  ) : (
                    options?.models?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {options?.modelInfo?.[model]?.name || model}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the specific AI model to use
              </p>
            </div>
          </div>

          {selectedModelInfo && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3">Model Details</h4>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Context Window:</span>
                    <span className="ml-2 font-medium">{(selectedModelInfo.contextWindow / 1000).toLocaleString()}K tokens</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Input Cost:</span>
                    <span className="ml-2 font-medium">${selectedModelInfo.costPer1kPrompt.toFixed(5)}/1K tokens</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Output Cost:</span>
                    <span className="ml-2 font-medium">${selectedModelInfo.costPer1kCompletion.toFixed(5)}/1K tokens</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium mb-4">Advanced Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Streaming</Label>
                  <p className="text-xs text-muted-foreground">
                    Stream AI responses for better user experience
                  </p>
                </div>
                <Switch
                  checked={formData.enableStreaming}
                  onCheckedChange={(checked) => updateField('enableStreaming', checked)}
                  data-testid="switch-enable-streaming"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Function Calling</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow AI to use structured tool calls
                  </p>
                </div>
                <Switch
                  checked={formData.enableFunctionCalling}
                  onCheckedChange={(checked) => updateField('enableFunctionCalling', checked)}
                  data-testid="switch-enable-function-calling"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Tokens per Request</Label>
                  <Input
                    type="number"
                    value={formData.maxTokensPerRequest || ''}
                    onChange={(e) => updateField('maxTokensPerRequest', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="4000"
                    data-testid="input-max-tokens"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum tokens allowed per AI request
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Token Budget</Label>
                  <Input
                    type="number"
                    value={formData.monthlyTokenBudget || ''}
                    onChange={(e) => updateField('monthlyTokenBudget', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="No limit"
                    data-testid="input-monthly-budget"
                  />
                  <p className="text-xs text-muted-foreground">
                    Platform-wide monthly token limit (optional)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Provider API Status
          </CardTitle>
          <CardDescription>
            Shows which AI providers have their API credentials configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {options?.providers?.map((provider) => {
              const isConfigured = options.providerStatus?.[provider.id] ?? false;
              const isSelected = formData.activeProvider === provider.id;
              return (
                <div 
                  key={provider.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  data-testid={`provider-status-${provider.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {isSelected && (
                      <Badge variant="outline" className="text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isConfigured ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            To configure a provider, add the required API key(s) to your environment secrets. 
            Replit AI is always available through the built-in integration.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About AI Configuration</CardTitle>
          <CardDescription>
            Understanding AI provider settings and their impact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The AI Configuration panel allows platform administrators to control which AI service 
            powers all AI features in Vega, including:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>OKR drafting and suggestions</li>
            <li>Check-in assistance and analysis</li>
            <li>Document extraction in Launchpad</li>
            <li>Big Rock recommendations</li>
          </ul>
          <p>
            <strong>Provider Options:</strong> Replit AI (default), Azure OpenAI, OpenAI, and Anthropic are supported.
            Each provider requires its own API credentials configured in the environment.
          </p>
          <div className="bg-muted/50 rounded-lg p-3 mt-2">
            <p className="font-medium text-foreground mb-2">Required Secrets by Provider:</p>
            <ul className="space-y-1 text-xs">
              <li><strong>Replit AI:</strong> No additional configuration needed</li>
              <li><strong>OpenAI:</strong> OPENAI_API_KEY</li>
              <li><strong>Azure OpenAI:</strong> AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY</li>
              <li><strong>Anthropic:</strong> ANTHROPIC_API_KEY</li>
            </ul>
          </div>
          <p>
            <strong>Cost Considerations:</strong> Different models have different pricing. 
            GPT-5 offers the best quality but highest cost. GPT-4o provides a good balance of quality and cost.
            Claude models are competitive alternatives with strong reasoning capabilities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vocabulary, setVocabulary] = useState<VocabularyTerms>(DEFAULT_VOCABULARY);
  const [hasChanges, setHasChanges] = useState(false);
  const [trafficDateRange, setTrafficDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Service Plans state
  const [servicePlanDialogOpen, setServicePlanDialogOpen] = useState(false);
  const [editingServicePlan, setEditingServicePlan] = useState<ServicePlan | null>(null);
  const [servicePlanFormData, setServicePlanFormData] = useState({
    name: "",
    displayName: "",
    durationDays: "",
    maxReadWriteUsers: "",
    maxReadOnlyUsers: "",
    isDefault: false,
  });

  // Blocked Domains state
  const [blockedDomainDialogOpen, setBlockedDomainDialogOpen] = useState(false);
  const [blockedDomainFormData, setBlockedDomainFormData] = useState({
    domain: "",
    reason: "",
  });

  // Tenant Plan state
  const [tenantPlanDialogOpen, setTenantPlanDialogOpen] = useState(false);
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<any>(null);
  const [tenantPlanFormData, setTenantPlanFormData] = useState({
    servicePlanId: "",
    planExpiresAt: "",
  });

  const userRole = user?.role;
  const hasAccess = userRole === 'vega_admin' || userRole === 'global_admin';

  const { data: systemVocabulary, isLoading } = useQuery<VocabularyTerms>({
    queryKey: ["/api/vocabulary/system"],
    enabled: hasAccess,
  });

  const { data: trafficStats, isLoading: trafficLoading } = useQuery<TrafficStats>({
    queryKey: ["/api/admin/traffic", trafficDateRange.startDate, trafficDateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: trafficDateRange.startDate,
        endDate: trafficDateRange.endDate,
      });
      const response = await fetch(`/api/admin/traffic?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch traffic stats');
      return response.json();
    },
    enabled: hasAccess,
  });

  const { data: tenantActivity, isLoading: tenantActivityLoading } = useQuery<TenantActivityReport>({
    queryKey: ["/api/admin/tenant-activity"],
    enabled: hasAccess,
  });

  // Service Plans query
  const { data: servicePlans = [] } = useQuery<ServicePlan[]>({
    queryKey: ["/api/admin/service-plans"],
    enabled: hasAccess,
  });

  // Blocked Domains query
  const { data: blockedDomains = [] } = useQuery<BlockedDomain[]>({
    queryKey: ["/api/admin/blocked-domains"],
    enabled: hasAccess,
  });

  // Admin tenants query (for plan assignment)
  const { data: adminTenants = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: hasAccess,
  });

  useEffect(() => {
    if (systemVocabulary) {
      setVocabulary(systemVocabulary);
    }
  }, [systemVocabulary]);

  const updateMutation = useMutation({
    mutationFn: (data: VocabularyTerms) =>
      apiRequest("PUT", "/api/vocabulary/system", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/system"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      toast({ title: "Vocabulary updated successfully" });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update vocabulary", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  // Service Plan mutations
  const createServicePlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/service-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-plans"] });
      setServicePlanDialogOpen(false);
      setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
      toast({ title: "Service plan created" });
    },
    onError: () => {
      toast({ title: "Failed to create service plan", variant: "destructive" });
    },
  });

  const updateServicePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/service-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-plans"] });
      setServicePlanDialogOpen(false);
      setEditingServicePlan(null);
      setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
      toast({ title: "Service plan updated" });
    },
    onError: () => {
      toast({ title: "Failed to update service plan", variant: "destructive" });
    },
  });

  // Blocked Domain mutations
  const blockDomainMutation = useMutation({
    mutationFn: (data: { domain: string; reason?: string }) => apiRequest("POST", "/api/admin/blocked-domains", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-domains"] });
      setBlockedDomainDialogOpen(false);
      setBlockedDomainFormData({ domain: "", reason: "" });
      toast({ title: "Domain blocked" });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes("already blocked") ? "Domain is already blocked" : "Failed to block domain";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const unblockDomainMutation = useMutation({
    mutationFn: (domain: string) => apiRequest("DELETE", `/api/admin/blocked-domains/${encodeURIComponent(domain)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-domains"] });
      toast({ title: "Domain unblocked" });
    },
    onError: () => {
      toast({ title: "Failed to unblock domain", variant: "destructive" });
    },
  });

  // Tenant Plan mutation
  const updateTenantPlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/tenants/${id}/plan`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantPlanDialogOpen(false);
      setSelectedTenantForPlan(null);
      toast({ title: "Tenant plan updated" });
    },
    onError: () => {
      toast({ title: "Failed to update tenant plan", variant: "destructive" });
    },
  });

  const handleTermChange = (
    termKey: keyof VocabularyTerms, 
    singular: string
  ) => {
    const options = VOCABULARY_OPTIONS[termKey];
    const selectedOption = options.find(opt => opt.singular === singular);
    if (selectedOption) {
      setVocabulary(prev => ({
        ...prev,
        [termKey]: selectedOption,
      }));
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(vocabulary);
  };

  const handleReset = () => {
    setVocabulary(systemVocabulary || DEFAULT_VOCABULARY);
    setHasChanges(false);
  };

  const exportTrafficToCsv = () => {
    if (!trafficStats) return;
    
    // Fixed row/column structure for OKR Excel data binding
    // Header row with clear column labels - these stay fixed for Excel cell references
    // A1=Label, B1=Total_Sessions, C1=Total_Visits, D1=Homepage_Visits, E1=Login_Visits
    let csv = "Label,Total_Sessions,Total_Visits,Homepage_Visits,Login_Visits,Countries,Referrers\n";
    
    // Row 2: Values row - FIXED positions for Excel cell references
    // B2=Total Sessions, C2=Total Visits, D2=Homepage, E2=Login
    const homepageVisits = trafficStats.visitsByPage.find(p => p.page === '/')?.count || 0;
    const loginVisits = trafficStats.visitsByPage.find(p => p.page === '/login')?.count || 0;
    csv += `TOTALS,${trafficStats.totalSessions},${trafficStats.totalVisits},${homepageVisits},${loginVisits},${trafficStats.visitsByCountry.length},${trafficStats.visitsByReferrer.length}\n`;
    
    // Row 3: Date range info
    csv += `Date_Range,${trafficDateRange.startDate},${trafficDateRange.endDate},,,,\n`;
    csv += "\n";
    
    // Visits by Page section - starts at fixed row 5
    csv += "Page,Visits,,,,,\n";
    trafficStats.visitsByPage.forEach(item => {
      csv += `"${item.page}",${item.count},,,,,\n`;
    });
    
    // Visits by Referrer section
    csv += "\nReferrer,Visits,,,,,\n";
    trafficStats.visitsByReferrer.forEach(item => {
      csv += `"${item.referrer}",${item.count},,,,,\n`;
    });
    
    // Visits by Day section
    csv += "\nDate,Visits,,,,,\n";
    trafficStats.visitsByDay.forEach(item => {
      csv += `${item.date},${item.count},,,,,\n`;
    });
    
    // Visits by Device section
    csv += "\nDevice,Visits,,,,,\n";
    trafficStats.visitsByDevice.forEach(item => {
      csv += `${item.device},${item.count},,,,,\n`;
    });
    
    // Visits by Browser section
    csv += "\nBrowser,Visits,,,,,\n";
    trafficStats.visitsByBrowser.forEach(item => {
      csv += `${item.browser},${item.count},,,,,\n`;
    });
    
    // Visits by Country section
    csv += "\nCountry,Visits,,,,,\n";
    trafficStats.visitsByCountry.forEach(item => {
      csv += `"${item.country}",${item.count},,,,,\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vega-traffic-report-${trafficDateRange.startDate}-to-${trafficDateRange.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Report exported successfully" });
  };

  const exportTenantActivityToCsv = () => {
    if (!tenantActivity) return;
    
    let csv = "Tenant Activity Report\n";
    csv += `Generated: ${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })}\n\n`;
    
    csv += "Summary\n";
    csv += `Total Tenants,${tenantActivity.summary.totalTenants}\n`;
    csv += `Total Users,${tenantActivity.summary.totalUsers}\n`;
    csv += `Active Users (Last 30 Days),${tenantActivity.summary.activeUsersLast30Days}\n`;
    csv += `Inactive Trial Tenants,${tenantActivity.summary.inactiveTrialTenants}\n\n`;
    
    csv += "Tenant Details\n";
    csv += "Tenant Name,Plan,Status,Expires,Self-Service,Total Users,Active Users,Mission,Vision,Values,Goals,Strategies,Objectives,Key Results,Meetings,Last Activity\n";
    tenantActivity.tenants.forEach(t => {
      csv += `"${t.name}","${t.planName || 'N/A'}","${t.planStatus || 'N/A'}","${t.planExpiresAt || 'N/A'}",${t.selfServiceSignup ? 'Yes' : 'No'},${t.totalUsers},${t.activeUsersLast30Days},${t.elements.hasMission ? 'Yes' : 'No'},${t.elements.hasVision ? 'Yes' : 'No'},${t.elements.valuesCount},${t.elements.goalsCount},${t.elements.strategiesCount},${t.elements.objectivesCount},${t.elements.keyResultsCount},${t.elements.meetingsCount},"${t.lastActivityDate || 'Never'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vega-tenant-activity-report-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Tenant activity report exported successfully" });
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This page is only accessible to Vega administrators and global administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const termKeys: (keyof VocabularyTerms)[] = [
    'goal', 'strategy', 'objective', 'keyResult', 'bigRock', 'meeting', 'focusRhythm'
  ];

  return (
    <div className="min-h-full py-6 space-y-6 px-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 md:h-6 md:w-6" />
          System Administration
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Manage system-wide settings for all organizations
        </p>
      </div>

      <Tabs defaultValue={(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const validTabs = ['vocabulary', 'ai-usage', 'ai-config', 'plans', 'security', 'tenants', 'traffic', 'announcements', 'jobs', 'support', 'seo'];
        return tab && validTabs.includes(tab) ? tab : 'vocabulary';
      })()} className="space-y-4">
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:w-auto flex flex-wrap gap-1">
            <TabsTrigger value="vocabulary" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-vocabulary">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Vocab</span>
            </TabsTrigger>
            <TabsTrigger value="ai-usage" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-ai-usage">
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">AI Usage</span>
            </TabsTrigger>
            <TabsTrigger value="ai-config" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-ai-config">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">AI Config</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-plans">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Plans</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-security">
              <Ban className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Security</span>
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-tenants">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Tenants</span>
            </TabsTrigger>
            <TabsTrigger value="traffic" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-traffic">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Traffic</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-announcements">
              <Megaphone className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Announce</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-jobs">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-support">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Support</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="flex items-center gap-1 px-2 sm:px-3 sm:gap-2" data-testid="tab-seo">
              <Globe className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">SEO</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="vocabulary" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Master Vocabulary Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Define the default terminology used across all organizations. 
                    Individual organizations can override these settings.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleReset}
                    disabled={!hasChanges}
                    data-testid="button-reset-vocabulary"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || updateMutation.isPending}
                    data-testid="button-save-vocabulary"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {termKeys.map((termKey) => (
                  <div key={termKey} className="grid gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium capitalize">{termKey.replace(/([A-Z])/g, ' $1').trim()}</h3>
                        <p className="text-sm text-muted-foreground">{TERM_DESCRIPTIONS[termKey]}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Term</Label>
                      <Select
                        value={vocabulary[termKey].singular}
                        onValueChange={(value) => handleTermChange(termKey, value)}
                      >
                        <SelectTrigger data-testid={`select-${termKey}`}>
                          <SelectValue placeholder="Select a term" />
                        </SelectTrigger>
                        <SelectContent>
                          {VOCABULARY_OPTIONS[termKey].map((option) => (
                            <SelectItem 
                              key={option.singular} 
                              value={option.singular}
                              data-testid={`option-${termKey}-${option.singular.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {option.singular} / {option.plural}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Current: <span className="font-medium">{vocabulary[termKey].singular}</span> (singular) / <span className="font-medium">{vocabulary[termKey].plural}</span> (plural)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-usage" className="space-y-4">
          <PlatformAIUsageWidget />
          <ModelComparisonWidget />
          <Card>
            <CardHeader>
              <CardTitle>About AI Usage Tracking</CardTitle>
              <CardDescription>
                Understanding how AI resources are consumed across the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The AI Usage dashboard provides real-time visibility into how AI services are being used 
                across all organizations on the Vega platform. This helps you:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Monitor total token consumption and estimated costs</li>
                <li>Track usage by AI provider (Replit AI, Azure OpenAI, Anthropic)</li>
                <li>Compare model performance and usage patterns (GPT-4, GPT-5, Claude)</li>
                <li>Identify high-usage tenants for capacity planning</li>
                <li>Measure the impact of model changes on costs and performance</li>
              </ul>
              <p>
                <strong>Cost Estimation:</strong> Costs are estimated based on typical pricing for each model. 
                Actual costs may vary based on your specific provider agreements.
              </p>
              <p>
                <strong>Token Counting:</strong> For streaming responses, token counts are estimated 
                (approximately 4 characters per token). Non-streaming calls provide exact counts.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-config" className="space-y-4">
          <AIConfigPanel />
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card data-testid="service-plans-section">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Service Plans
                </CardTitle>
                <CardDescription>
                  Define subscription plans with user limits and duration for tenant licensing
                </CardDescription>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  setEditingServicePlan(null);
                  setServicePlanFormData({ name: "", displayName: "", durationDays: "", maxReadWriteUsers: "", maxReadOnlyUsers: "", isDefault: false });
                  setServicePlanDialogOpen(true);
                }}
                data-testid="button-add-service-plan"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Plan
              </Button>
            </CardHeader>
            <CardContent>
              {servicePlans.length === 0 ? (
                <p className="text-muted-foreground text-sm">No service plans defined yet. Create your first plan to enable tenant licensing.</p>
              ) : (
                <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Display Name</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="hidden md:table-cell">R/W Users</TableHead>
                        <TableHead className="hidden md:table-cell">Read-Only</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicePlans.map((plan) => (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell className="hidden sm:table-cell">{plan.displayName}</TableCell>
                          <TableCell>{plan.durationDays ? `${plan.durationDays}d` : "∞"}</TableCell>
                          <TableCell className="hidden md:table-cell">{plan.maxReadWriteUsers ?? "∞"}</TableCell>
                          <TableCell className="hidden md:table-cell">{plan.maxReadOnlyUsers ?? "∞"}</TableCell>
                          <TableCell>
                            {plan.isDefault && <Badge variant="default">Default</Badge>}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingServicePlan(plan);
                                setServicePlanFormData({
                                  name: plan.name,
                                  displayName: plan.displayName,
                                  durationDays: plan.durationDays?.toString() || "",
                                  maxReadWriteUsers: plan.maxReadWriteUsers?.toString() || "",
                                  maxReadOnlyUsers: plan.maxReadOnlyUsers?.toString() || "",
                                  isDefault: plan.isDefault || false,
                                });
                                setServicePlanDialogOpen(true);
                              }}
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {servicePlans.map((plan) => (
                    <div key={plan.id} className="rounded-md border p-3 space-y-2" data-testid={`card-plan-${plan.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{plan.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{plan.displayName}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {plan.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingServicePlan(plan);
                              setServicePlanFormData({
                                name: plan.name,
                                displayName: plan.displayName,
                                durationDays: plan.durationDays?.toString() || "",
                                maxReadWriteUsers: plan.maxReadWriteUsers?.toString() || "",
                                maxReadOnlyUsers: plan.maxReadOnlyUsers?.toString() || "",
                                isDefault: plan.isDefault || false,
                              });
                              setServicePlanDialogOpen(true);
                            }}
                            data-testid={`button-edit-plan-mobile-${plan.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Duration</div>
                          <div>{plan.durationDays ? `${plan.durationDays}d` : "∞"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">R/W Users</div>
                          <div>{plan.maxReadWriteUsers ?? "∞"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Read-Only</div>
                          <div>{plan.maxReadOnlyUsers ?? "∞"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card data-testid="blocked-domains-section">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ban className="h-5 w-5" />
                  Blocked Domains
                </CardTitle>
                <CardDescription>
                  Prevent specific email domains from creating self-service accounts
                </CardDescription>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  setBlockedDomainFormData({ domain: "", reason: "" });
                  setBlockedDomainDialogOpen(true);
                }}
                data-testid="button-add-blocked-domain"
              >
                <Plus className="h-4 w-4 mr-1" />
                Block Domain
              </Button>
            </CardHeader>
            <CardContent>
              {blockedDomains.length === 0 ? (
                <p className="text-muted-foreground text-sm">No blocked domains. All email domains can create self-service accounts.</p>
              ) : (
                <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead className="hidden sm:table-cell">Reason</TableHead>
                        <TableHead className="hidden md:table-cell">Blocked At</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedDomains.map((domain) => (
                        <TableRow key={domain.domain} data-testid={`row-blocked-${domain.domain}`}>
                          <TableCell className="font-mono text-sm">{domain.domain}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{domain.reason || "-"}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {domain.blockedAt ? new Date(domain.blockedAt).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Unblock domain "${domain.domain}"?`)) {
                                  unblockDomainMutation.mutate(domain.domain);
                                }
                              }}
                              data-testid={`button-unblock-${domain.domain}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {blockedDomains.map((domain) => (
                    <div key={domain.domain} className="rounded-md border p-3 space-y-2" data-testid={`card-blocked-${domain.domain}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm truncate">{domain.domain}</div>
                          {domain.reason && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{domain.reason}</div>
                          )}
                          {domain.blockedAt && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Blocked {new Date(domain.blockedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Unblock domain "${domain.domain}"?`)) {
                              unblockDomainMutation.mutate(domain.domain);
                            }
                          }}
                          data-testid={`button-unblock-mobile-${domain.domain}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <Card data-testid="tenant-plans-section">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Tenant Service Plans
              </CardTitle>
              <CardDescription>
                View and manage service plans assigned to each organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adminTenants.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tenants found.</p>
              ) : (
                <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="hidden sm:table-cell">Started</TableHead>
                        <TableHead className="hidden md:table-cell">Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminTenants.map((tenant) => {
                        const isExpired = tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date();
                        const daysLeft = tenant.planExpiresAt 
                          ? Math.ceil((new Date(tenant.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        return (
                          <TableRow key={tenant.id} data-testid={`row-tenant-plan-${tenant.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: tenant.color || '#6366F1' }}
                                />
                                <span className="font-medium truncate max-w-[120px] sm:max-w-none">{tenant.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={tenant.servicePlan ? "default" : "secondary"} className="text-xs">
                                {tenant.servicePlan?.displayName || "No Plan"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                              {tenant.planStartedAt ? new Date(tenant.planStartedAt).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                              {tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="destructive" className="text-xs">Expired</Badge>
                              ) : daysLeft !== null && daysLeft <= 30 ? (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                                  {daysLeft}d left
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTenantForPlan(tenant);
                                  setTenantPlanFormData({
                                    servicePlanId: tenant.servicePlanId || "none",
                                    planExpiresAt: tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toISOString().split('T')[0] : "",
                                  });
                                  setTenantPlanDialogOpen(true);
                                }}
                                data-testid={`button-edit-tenant-plan-${tenant.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {adminTenants.map((tenant) => {
                    const isExpired = tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date();
                    const daysLeft = tenant.planExpiresAt
                      ? Math.ceil((new Date(tenant.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    return (
                      <div key={tenant.id} className="rounded-md border p-3 space-y-2" data-testid={`card-tenant-plan-${tenant.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: tenant.color || '#6366F1' }}
                            />
                            <span className="font-medium truncate">{tenant.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTenantForPlan(tenant);
                              setTenantPlanFormData({
                                servicePlanId: tenant.servicePlanId || "none",
                                planExpiresAt: tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toISOString().split('T')[0] : "",
                              });
                              setTenantPlanDialogOpen(true);
                            }}
                            data-testid={`button-edit-tenant-plan-mobile-${tenant.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={tenant.servicePlan ? "default" : "secondary"} className="text-xs">
                            {tenant.servicePlan?.displayName || "No Plan"}
                          </Badge>
                          {isExpired ? (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          ) : daysLeft !== null && daysLeft <= 30 ? (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                              {daysLeft}d left
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600">Active</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <div>Started</div>
                            <div className="text-foreground">{tenant.planStartedAt ? new Date(tenant.planStartedAt).toLocaleDateString() : "-"}</div>
                          </div>
                          <div>
                            <div>Expires</div>
                            <div className="text-foreground">{tenant.planExpiresAt ? new Date(tenant.planExpiresAt).toLocaleDateString() : "Never"}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tenant Activity Report */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Tenant Activity Report</CardTitle>
                  <CardDescription>
                    Monitor tenant usage, user activity, and Company OS element adoption
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportTenantActivityToCsv}
                  disabled={!tenantActivity || tenantActivityLoading}
                  data-testid="button-export-tenant-activity"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tenantActivityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : tenantActivity ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <Card>
                      <CardContent className="pt-4 md:pt-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xl md:text-2xl font-bold">{tenantActivity.summary.totalTenants}</div>
                            <p className="text-xs text-muted-foreground truncate">Tenants</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 md:pt-6">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xl md:text-2xl font-bold">{tenantActivity.summary.totalUsers}</div>
                            <p className="text-xs text-muted-foreground truncate">Users</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 md:pt-6">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 md:h-5 md:w-5 text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xl md:text-2xl font-bold">{tenantActivity.summary.activeUsersLast30Days}</div>
                            <p className="text-xs text-muted-foreground truncate">Active (30d)</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 md:pt-6">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 md:h-5 md:w-5 text-orange-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xl md:text-2xl font-bold">{tenantActivity.summary.inactiveTrialTenants}</div>
                            <p className="text-xs text-muted-foreground truncate">Inactive Trials</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="md:hidden space-y-2">
                    {tenantActivity.tenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="rounded-md border p-3 space-y-2"
                        data-testid={`card-tenant-activity-${tenant.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{tenant.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {tenant.planName || 'No Plan'}
                              {tenant.selfServiceSignup ? ' · Self-service' : ''}
                            </div>
                          </div>
                          <Badge
                            variant={tenant.planStatus === 'active' ? 'default' : 'secondary'}
                            className="shrink-0 text-xs"
                          >
                            {tenant.planStatus || 'N/A'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Users</div>
                            <div className="font-medium">{tenant.totalUsers}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Active 30d</div>
                            <div className={tenant.activeUsersLast30Days > 0 ? 'text-green-600 font-medium' : ''}>
                              {tenant.activeUsersLast30Days}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">OKRs</div>
                            <div className="font-medium">{tenant.elements.objectivesCount}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <Badge variant="outline" className="text-xs">
                            {tenant.elements.hasMission ? 'M' : '–M'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {tenant.elements.hasVision ? 'V' : '–V'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">Val {tenant.elements.valuesCount}</Badge>
                          <Badge variant="outline" className="text-xs">G {tenant.elements.goalsCount}</Badge>
                          <Badge variant="outline" className="text-xs">S {tenant.elements.strategiesCount}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last active: {tenant.lastActivityDate || 'Never'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-tenant-activity">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Tenant</th>
                          <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Plan</th>
                          <th className="text-center py-3 px-2 font-medium">Users</th>
                          <th className="text-center py-3 px-2 font-medium hidden md:table-cell">Active</th>
                          <th className="text-center py-3 px-2 font-medium hidden lg:table-cell">M</th>
                          <th className="text-center py-3 px-2 font-medium hidden lg:table-cell">V</th>
                          <th className="text-center py-3 px-2 font-medium hidden xl:table-cell">Val</th>
                          <th className="text-center py-3 px-2 font-medium hidden xl:table-cell">G</th>
                          <th className="text-center py-3 px-2 font-medium hidden xl:table-cell">S</th>
                          <th className="text-center py-3 px-2 font-medium">OKRs</th>
                          <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantActivity.tenants.map((tenant) => (
                          <tr key={tenant.id} className="border-b hover:bg-muted/50" data-testid={`row-tenant-${tenant.id}`}>
                            <td className="py-3 px-2">
                              <div className="max-w-[120px] sm:max-w-none">
                                <div className="font-medium truncate">{tenant.name}</div>
                                {tenant.selfServiceSignup && (
                                  <span className="text-xs text-muted-foreground">Self-service</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 hidden sm:table-cell">
                              <div>
                                <div className="text-xs">{tenant.planName || 'No Plan'}</div>
                                <span className={`text-xs ${tenant.planStatus === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
                                  {tenant.planStatus || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center">{tenant.totalUsers}</td>
                            <td className="py-3 px-2 text-center hidden md:table-cell">
                              <span className={tenant.activeUsersLast30Days > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                {tenant.activeUsersLast30Days}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center hidden lg:table-cell">
                              {tenant.elements.hasMission ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="py-3 px-2 text-center hidden lg:table-cell">
                              {tenant.elements.hasVision ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="py-3 px-2 text-center hidden xl:table-cell">{tenant.elements.valuesCount}</td>
                            <td className="py-3 px-2 text-center hidden xl:table-cell">{tenant.elements.goalsCount}</td>
                            <td className="py-3 px-2 text-center hidden xl:table-cell">{tenant.elements.strategiesCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.objectivesCount}</td>
                            <td className="py-3 px-2 text-sm text-muted-foreground hidden md:table-cell">
                              {tenant.lastActivityDate || 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No tenant activity data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-6">
          {/* Header with Title and Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Traffic Analytics</h2>
              <p className="text-muted-foreground">Monitor visitor activity on key pages</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/traffic'] })}
                data-testid="button-refresh-traffic"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={exportTrafficToCsv}
                disabled={!trafficStats || trafficLoading}
                data-testid="button-export-traffic"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filters Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input
                    type="date"
                    value={trafficDateRange.startDate}
                    onChange={(e) => setTrafficDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-40"
                    data-testid="input-traffic-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input
                    type="date"
                    value={trafficDateRange.endDate}
                    onChange={(e) => setTrafficDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-40"
                    data-testid="input-traffic-end-date"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTrafficDateRange({
                    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                  })}
                  data-testid="button-reset-filters"
                >
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {trafficLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : trafficStats ? (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{trafficStats.totalSessions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total Sessions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Eye className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{trafficStats.totalVisits.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Home className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {trafficStats.visitsByPage.find(p => p.page === '/')?.count || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Homepage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <UserPlus className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {trafficStats.visitsByPage.find(p => p.page === '/login')?.count || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Login/Signup</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Globe className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{trafficStats.visitsByCountry.length}</div>
                        <p className="text-xs text-muted-foreground">Countries</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row - Visits Over Time + Device Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visits Over Time Line Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Visits Over Time
                    </CardTitle>
                    <CardDescription>Daily visit count for the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficStats.visitsByDay.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-12">No data for selected period</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trafficStats.visitsByDay.map(d => ({
                            ...d,
                            displayDate: format(new Date(d.date), 'MMM d')
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="displayDate" 
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="count" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                              activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Device Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Device Distribution
                    </CardTitle>
                    <CardDescription>Breakdown by device type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficStats.visitsByDevice.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-12">No device data available</p>
                    ) : (
                      <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={trafficStats.visitsByDevice.map(d => ({
                                ...d,
                                percentage: Math.round((d.count / trafficStats.totalVisits) * 100)
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="count"
                              nameKey="device"
                              label={({ device, percentage }) => `${device} ${percentage}%`}
                              labelLine={false}
                            >
                              {trafficStats.visitsByDevice.map((_, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={['hsl(var(--primary))', 'hsl(280, 100%, 70%)', 'hsl(200, 100%, 60%)', 'hsl(150, 100%, 50%)'][index % 4]} 
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => [value, 'Visits']}
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Bottom Row - Countries + Browsers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Countries */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Top Countries
                    </CardTitle>
                    <CardDescription>Visitor distribution by country</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficStats.visitsByCountry.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-12">No country data available</p>
                    ) : (
                      <div className="space-y-3">
                        {trafficStats.visitsByCountry.slice(0, 8).map((item, index) => (
                          <div key={item.country} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-sm w-5">{index + 1}.</span>
                              <span className="font-medium">{item.country}</span>
                            </div>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Referrers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Top Referrers
                    </CardTitle>
                    <CardDescription>Where visitors are coming from</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficStats.visitsByReferrer.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-12">No referrer data available</p>
                    ) : (
                      <div className="space-y-3">
                        {trafficStats.visitsByReferrer.slice(0, 8).map((item, index) => (
                          <div key={item.referrer} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-sm w-5">{index + 1}.</span>
                              <span className="font-medium truncate max-w-[200px]">{item.referrer}</span>
                            </div>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Browsers - Horizontal Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Top Browsers
                    </CardTitle>
                    <CardDescription>Visitor distribution by browser</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trafficStats.visitsByBrowser.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-12">No browser data available</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={trafficStats.visitsByBrowser.slice(0, 6)} 
                            layout="vertical"
                            margin={{ left: 0, right: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis 
                              type="category" 
                              dataKey="browser" 
                              tick={{ fontSize: 11 }} 
                              tickLine={false} 
                              axisLine={false}
                              width={80}
                            />
                            <Tooltip 
                              formatter={(value: number) => [value, 'Visits']}
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar 
                              dataKey="count" 
                              fill="hsl(var(--primary))" 
                              radius={[0, 4, 4, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-20">
                <p className="text-muted-foreground text-center">No traffic data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <AnnouncementManager />
          <LandingHeroSettings />
          <CapabilityShowcaseSettings />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <ScheduledJobsManager />
        </TabsContent>
        <TabsContent value="support" className="space-y-4">
          <AdminSupportTab />
        </TabsContent>
        <TabsContent value="seo" className="space-y-4">
          <SeoSettingsPanel />
        </TabsContent>
      </Tabs>

      {/* Service Plan Dialog */}
      <Dialog open={servicePlanDialogOpen} onOpenChange={setServicePlanDialogOpen}>
        <DialogContent data-testid="dialog-service-plan" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingServicePlan ? "Edit Service Plan" : "Create Service Plan"}
            </DialogTitle>
            <DialogDescription>
              Define a service plan with limits and duration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Internal Name</Label>
                <Input
                  id="plan-name"
                  placeholder="trial"
                  value={servicePlanFormData.name}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, name: e.target.value })}
                  data-testid="input-plan-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-display-name">Display Name</Label>
                <Input
                  id="plan-display-name"
                  placeholder="Trial Plan"
                  value={servicePlanFormData.displayName}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, displayName: e.target.value })}
                  data-testid="input-plan-display-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-duration">Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  placeholder="60 (blank = ∞)"
                  value={servicePlanFormData.durationDays}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, durationDays: e.target.value })}
                  data-testid="input-plan-duration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-rw-users">Max R/W Users</Label>
                <Input
                  id="plan-rw-users"
                  type="number"
                  placeholder="blank = ∞"
                  value={servicePlanFormData.maxReadWriteUsers}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, maxReadWriteUsers: e.target.value })}
                  data-testid="input-plan-rw-users"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-ro-users">Max Read-Only</Label>
                <Input
                  id="plan-ro-users"
                  type="number"
                  placeholder="blank = ∞"
                  value={servicePlanFormData.maxReadOnlyUsers}
                  onChange={(e) => setServicePlanFormData({ ...servicePlanFormData, maxReadOnlyUsers: e.target.value })}
                  data-testid="input-plan-ro-users"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="plan-is-default"
                checked={servicePlanFormData.isDefault}
                onCheckedChange={(checked) => setServicePlanFormData({ ...servicePlanFormData, isDefault: checked === true })}
                data-testid="checkbox-plan-default"
              />
              <Label htmlFor="plan-is-default" className="text-sm font-normal cursor-pointer">
                Set as default plan for new self-service signups
              </Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setServicePlanDialogOpen(false)} data-testid="button-cancel-plan" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const data = {
                  name: servicePlanFormData.name,
                  displayName: servicePlanFormData.displayName,
                  durationDays: servicePlanFormData.durationDays ? parseInt(servicePlanFormData.durationDays) : null,
                  maxReadWriteUsers: servicePlanFormData.maxReadWriteUsers ? parseInt(servicePlanFormData.maxReadWriteUsers) : null,
                  maxReadOnlyUsers: servicePlanFormData.maxReadOnlyUsers ? parseInt(servicePlanFormData.maxReadOnlyUsers) : null,
                  isDefault: servicePlanFormData.isDefault,
                };
                if (editingServicePlan) {
                  updateServicePlanMutation.mutate({ id: editingServicePlan.id, data });
                } else {
                  createServicePlanMutation.mutate(data);
                }
              }}
              disabled={!servicePlanFormData.name || !servicePlanFormData.displayName || createServicePlanMutation.isPending || updateServicePlanMutation.isPending}
              data-testid="button-save-plan"
              className="w-full sm:w-auto"
            >
              {editingServicePlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Domain Dialog */}
      <Dialog open={blockedDomainDialogOpen} onOpenChange={setBlockedDomainDialogOpen}>
        <DialogContent data-testid="dialog-block-domain">
          <DialogHeader>
            <DialogTitle>Block Domain</DialogTitle>
            <DialogDescription>
              Prevent users with this email domain from creating self-service accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-domain">Domain</Label>
              <Input
                id="block-domain"
                placeholder="example.com"
                value={blockedDomainFormData.domain}
                onChange={(e) => setBlockedDomainFormData({ ...blockedDomainFormData, domain: e.target.value })}
                data-testid="input-block-domain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason (optional)</Label>
              <Input
                id="block-reason"
                placeholder="Reason for blocking this domain..."
                value={blockedDomainFormData.reason}
                onChange={(e) => setBlockedDomainFormData({ ...blockedDomainFormData, reason: e.target.value })}
                data-testid="input-block-reason"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setBlockedDomainDialogOpen(false)} data-testid="button-cancel-block" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => blockDomainMutation.mutate({ domain: blockedDomainFormData.domain, reason: blockedDomainFormData.reason || undefined })}
              disabled={!blockedDomainFormData.domain || blockDomainMutation.isPending}
              data-testid="button-confirm-block"
              className="w-full sm:w-auto"
            >
              Block Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant Plan Dialog */}
      <Dialog open={tenantPlanDialogOpen} onOpenChange={setTenantPlanDialogOpen}>
        <DialogContent data-testid="dialog-tenant-plan">
          <DialogHeader>
            <DialogTitle>
              Update Plan - {selectedTenantForPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Change the service plan and expiration date for this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Plan</Label>
              <Select
                value={tenantPlanFormData.servicePlanId}
                onValueChange={(value) => setTenantPlanFormData({ ...tenantPlanFormData, servicePlanId: value })}
              >
                <SelectTrigger data-testid="select-tenant-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Plan</SelectItem>
                  {servicePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.displayName} {plan.isDefault && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-expires-at">Expiration Date (blank = never expires)</Label>
              <Input
                id="plan-expires-at"
                type="date"
                value={tenantPlanFormData.planExpiresAt}
                onChange={(e) => setTenantPlanFormData({ ...tenantPlanFormData, planExpiresAt: e.target.value })}
                data-testid="input-plan-expires-at"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setTenantPlanDialogOpen(false)} data-testid="button-cancel-tenant-plan" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTenantForPlan) {
                  updateTenantPlanMutation.mutate({
                    id: selectedTenantForPlan.id,
                    data: {
                      servicePlanId: (!tenantPlanFormData.servicePlanId || tenantPlanFormData.servicePlanId === "none") ? null : tenantPlanFormData.servicePlanId,
                      planExpiresAt: tenantPlanFormData.planExpiresAt || null,
                    },
                  });
                }
              }}
              disabled={updateTenantPlanMutation.isPending}
              data-testid="button-save-tenant-plan"
              className="w-full sm:w-auto"
            >
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementManager() {
  const { toast } = useToast();
  const [editingBanner, setEditingBanner] = useState<SystemBanner | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: banners, isLoading: bannersLoading } = useQuery<SystemBanner[]>({
    queryKey: ["/api/admin/banners"],
  });

  if (bannersLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                System Announcements
              </CardTitle>
              <CardDescription>
                Display announcement banners across the platform for all logged-in users. Banners appear at the top of every page and can be dismissed per session.
              </CardDescription>
            </div>
            <Button
              onClick={() => { setIsCreating(true); setEditingBanner(null); }}
              data-testid="button-create-banner"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Banner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!banners || banners.length === 0) && !isCreating ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No announcements yet. Create one to alert users across all tenants.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {banners?.map((banner) => (
                <BannerListItem
                  key={banner.id}
                  banner={banner}
                  onEdit={() => { setEditingBanner(banner); setIsCreating(false); }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(isCreating || editingBanner) && (
        <BannerEditor
          banner={editingBanner}
          onClose={() => { setEditingBanner(null); setIsCreating(false); }}
        />
      )}
    </div>
  );
}

function BannerListItem({ banner, onEdit }: { banner: SystemBanner; onEdit: () => void }) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const statusLabel = banner.status === 'on' ? 'Active' : banner.status === 'scheduled' ? 'Scheduled' : 'Off';
  const statusColor = banner.status === 'on'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : banner.status === 'scheduled'
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-muted text-muted-foreground';

  const now = new Date();
  const isWithinSchedule = banner.status === 'scheduled' &&
    (!banner.scheduledStart || now >= new Date(banner.scheduledStart)) &&
    (!banner.scheduledEnd || now <= new Date(banner.scheduledEnd));

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/admin/banners/${banner.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
      toast({ title: "Banner deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete banner.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async () => {
    const newStatus = banner.status === 'on' ? 'off' : 'on';
    try {
      await apiRequest("PATCH", `/api/admin/banners/${banner.id}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
      toast({ title: newStatus === 'on' ? "Banner activated" : "Banner deactivated" });
    } catch {
      toast({ title: "Error", description: "Failed to update banner.", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-md" data-testid={`banner-item-${banner.id}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {isWithinSchedule && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Currently Showing
            </span>
          )}
          {banner.scheduledStart && (
            <span className="text-xs text-muted-foreground">
              From: {new Date(banner.scheduledStart).toLocaleDateString()}
            </span>
          )}
          {banner.scheduledEnd && (
            <span className="text-xs text-muted-foreground">
              Until: {new Date(banner.scheduledEnd).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="text-sm truncate">{banner.content}</p>
        <div
          className="h-2 w-16 rounded"
          style={{ backgroundColor: banner.backgroundColor || '#0EA5E9' }}
          title={`Color: ${banner.backgroundColor || '#0EA5E9'}`}
        />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {banner.status !== 'scheduled' && (
          <Button size="icon" variant="ghost" onClick={handleToggle} data-testid={`button-toggle-banner-${banner.id}`}>
            {banner.status === 'on' ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-40" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-banner-${banner.id}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleDelete} disabled={isDeleting} data-testid={`button-delete-banner-${banner.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

const BANNER_COLORS = [
  { label: "Blue (Info)", bg: "#0EA5E9", text: "#FFFFFF" },
  { label: "Purple (Vega)", bg: "#810FFB", text: "#FFFFFF" },
  { label: "Amber (Warning)", bg: "#F59E0B", text: "#000000" },
  { label: "Red (Critical)", bg: "#EF4444", text: "#FFFFFF" },
  { label: "Green (Success)", bg: "#22C55E", text: "#FFFFFF" },
  { label: "Slate (Neutral)", bg: "#475569", text: "#FFFFFF" },
];

function BannerEditor({ banner, onClose }: { banner: SystemBanner | null; onClose: () => void }) {
  const { toast } = useToast();
  const [content, setContent] = useState(banner?.content || "");
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl || "");
  const [linkText, setLinkText] = useState(banner?.linkText || "");
  const [status, setStatus] = useState<string>(banner?.status || "on");
  const [backgroundColor, setBackgroundColor] = useState(banner?.backgroundColor || "#0EA5E9");
  const [textColor, setTextColor] = useState(banner?.textColor || "#FFFFFF");
  const [scheduledStart, setScheduledStart] = useState(
    banner?.scheduledStart ? new Date(banner.scheduledStart).toISOString().slice(0, 16) : ""
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    banner?.scheduledEnd ? new Date(banner.scheduledEnd).toISOString().slice(0, 16) : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        content,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        status,
        backgroundColor,
        textColor,
        scheduledStart: status === 'scheduled' && scheduledStart ? new Date(scheduledStart).toISOString() : null,
        scheduledEnd: status === 'scheduled' && scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
      };

      if (banner) {
        await apiRequest("PATCH", `/api/admin/banners/${banner.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/banners", payload);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
      toast({ title: banner ? "Banner updated" : "Banner created" });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to save banner.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-5 w-5" />
          {banner ? "Edit Banner" : "Create Banner"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="banner-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-banner-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on">Active (show immediately)</SelectItem>
              <SelectItem value="scheduled">Scheduled (show within date range)</SelectItem>
              <SelectItem value="off">Off (hidden)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {status === 'scheduled' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled-start">Start Date & Time</Label>
              <Input
                id="scheduled-start"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                data-testid="input-scheduled-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-end">End Date & Time</Label>
              <Input
                id="scheduled-end"
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                data-testid="input-scheduled-end"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="banner-content-edit">Announcement Text</Label>
          <Textarea
            id="banner-content-edit"
            placeholder="Important: Your organization needs to grant admin consent for Microsoft Planner integration..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-banner-content"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="banner-link-url">Link URL (optional)</Label>
            <Input
              id="banner-link-url"
              placeholder="https://docs.example.com/setup"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              data-testid="input-banner-link-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-link-text">Link Text (optional)</Label>
            <Input
              id="banner-link-text"
              placeholder="Learn more"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              data-testid="input-banner-link-text"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Banner Color</Label>
          <div className="flex flex-wrap gap-2">
            {BANNER_COLORS.map((color) => (
              <button
                key={color.bg}
                onClick={() => { setBackgroundColor(color.bg); setTextColor(color.text); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  backgroundColor === color.bg ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                style={{ backgroundColor: color.bg, color: color.text }}
                data-testid={`button-color-${color.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
              >
                {color.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <div
            className="relative flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md"
            style={{ backgroundColor, color: textColor }}
          >
            <span>{content || "Your announcement text will appear here..."}</span>
            {linkUrl && linkText && (
              <span className="inline-flex items-center gap-1 underline underline-offset-2 font-medium">
                {linkText}
                <ExternalLink className="h-3 w-3" />
              </span>
            )}
            <X className="h-4 w-4 opacity-60 ml-4 flex-shrink-0" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            data-testid="button-save-banner"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : (banner ? "Update Banner" : "Create Banner")}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-banner">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LandingHeroSettings() {
  const { toast } = useToast();
  const [heroMediaType, setHeroMediaType] = useState<'image' | 'video'>('image');
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = useQuery<{ heroMediaType: string }>({
    queryKey: ["/api/landing-settings"],
  });

  useEffect(() => {
    if (settings?.heroMediaType) {
      setHeroMediaType(settings.heroMediaType as 'image' | 'video');
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PATCH", "/api/admin/landing-settings", { heroMediaType });
      queryClient.invalidateQueries({ queryKey: ["/api/landing-settings"] });
      toast({
        title: "Landing page settings saved",
        description: "The hero media type has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save landing page settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Landing Page Hero
        </CardTitle>
        <CardDescription>
          Choose whether to display a static screenshot or a looping demo video in the hero section
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="hero-video" className="text-base font-medium">Show Demo Video</Label>
            <p className="text-sm text-muted-foreground">
              {heroMediaType === 'video' 
                ? 'Displaying looping demo video with "From business plan to AI-powered check-in in less than 90 seconds"' 
                : 'Displaying static screenshot with "Hierarchical OKRs, Big Rocks, and Progress Tracking"'}
            </p>
          </div>
          <Switch
            id="hero-video"
            checked={heroMediaType === 'video'}
            onCheckedChange={(checked) => setHeroMediaType(checked ? 'video' : 'image')}
            data-testid="switch-hero-video"
          />
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full sm:w-auto"
          data-testid="button-save-hero-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Hero Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CapabilityShowcaseSettings() {
  const { toast } = useToast();
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [headline, setHeadline] = useState("Explore Vega Capabilities");
  const [subHeadline, setSubHeadline] = useState("Discover how Vega transforms strategy into weekly action");
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [editingTab, setEditingTab] = useState<CapabilityTab | null>(null);
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [tabFormData, setTabFormData] = useState({
    tabLabel: "",
    heading: "",
    bodyCopy: "",
    primaryImageUrl: "",
    secondaryImageUrl: "",
    ctaText: "",
    ctaUrl: "",
  });
  const [isSavingTab, setIsSavingTab] = useState(false);

  const { data: section, isLoading: sectionLoading } = useQuery<CapabilitySection>({
    queryKey: ["/api/capability-section"],
  });

  const { data: tabs = [], isLoading: tabsLoading } = useQuery<CapabilityTab[]>({
    queryKey: ["/api/capability-tabs"],
  });

  useEffect(() => {
    if (section) {
      setSectionEnabled(section.enabled);
      setHeadline(section.headline);
      setSubHeadline(section.subHeadline || "");
    }
  }, [section]);

  const handleSaveSection = async () => {
    setIsSavingSection(true);
    try {
      await apiRequest("PATCH", "/api/admin/capability-section", {
        enabled: sectionEnabled,
        headline,
        subHeadline,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/capability-section"] });
      toast({
        title: "Capability section saved",
        description: "Settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save capability section settings.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSection(false);
    }
  };

  const openTabDialog = (tab?: CapabilityTab) => {
    if (tab) {
      setEditingTab(tab);
      setTabFormData({
        tabLabel: tab.tabLabel,
        heading: tab.heading,
        bodyCopy: tab.bodyCopy,
        primaryImageUrl: tab.primaryImageUrl || "",
        secondaryImageUrl: tab.secondaryImageUrl || "",
        ctaText: tab.ctaText || "",
        ctaUrl: tab.ctaUrl || "",
      });
    } else {
      setEditingTab(null);
      setTabFormData({
        tabLabel: "",
        heading: "",
        bodyCopy: "",
        primaryImageUrl: "",
        secondaryImageUrl: "",
        ctaText: "",
        ctaUrl: "",
      });
    }
    setTabDialogOpen(true);
  };

  const handleSaveTab = async () => {
    if (!tabFormData.tabLabel || !tabFormData.heading || !tabFormData.bodyCopy) {
      toast({
        title: "Validation Error",
        description: "Tab label, heading, and body copy are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTab(true);
    try {
      if (editingTab) {
        await apiRequest("PATCH", `/api/admin/capability-tabs/${editingTab.id}`, tabFormData);
      } else {
        await apiRequest("POST", "/api/admin/capability-tabs", tabFormData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/capability-tabs"] });
      setTabDialogOpen(false);
      toast({
        title: editingTab ? "Tab updated" : "Tab created",
        description: `"${tabFormData.tabLabel}" has been ${editingTab ? "updated" : "created"}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingTab ? "update" : "create"} tab.`,
        variant: "destructive",
      });
    } finally {
      setIsSavingTab(false);
    }
  };

  const handleDeleteTab = async (tab: CapabilityTab) => {
    if (!confirm(`Delete "${tab.tabLabel}"? This action cannot be undone.`)) return;
    
    try {
      await apiRequest("DELETE", `/api/admin/capability-tabs/${tab.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/capability-tabs"] });
      toast({
        title: "Tab deleted",
        description: `"${tab.tabLabel}" has been removed.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tab.",
        variant: "destructive",
      });
    }
  };

  const moveTab = async (tabId: string, direction: 'up' | 'down') => {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === tabs.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const newOrder = tabs.map((t, i) => {
      if (i === index) return { id: t.id, sortOrder: tabs[swapIndex].sortOrder };
      if (i === swapIndex) return { id: t.id, sortOrder: tabs[index].sortOrder };
      return { id: t.id, sortOrder: t.sortOrder };
    });

    try {
      await apiRequest("POST", "/api/admin/capability-tabs/reorder", { tabOrders: newOrder });
      queryClient.invalidateQueries({ queryKey: ["/api/capability-tabs"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder tabs.",
        variant: "destructive",
      });
    }
  };

  if (sectionLoading || tabsLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Capability Showcase
          </CardTitle>
          <CardDescription>
            Configure the tabbed capability showcase section on the landing page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="capability-enabled" className="text-base font-medium">Enable Showcase Section</Label>
              <p className="text-sm text-muted-foreground">
                Show the capability showcase below the hero section
              </p>
            </div>
            <Switch
              id="capability-enabled"
              checked={sectionEnabled}
              onCheckedChange={setSectionEnabled}
              data-testid="switch-capability-enabled"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="capability-headline">Section Headline</Label>
              <Input
                id="capability-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Explore Vega Capabilities"
                data-testid="input-capability-headline"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capability-subheadline">Sub-headline</Label>
              <Input
                id="capability-subheadline"
                value={subHeadline}
                onChange={(e) => setSubHeadline(e.target.value)}
                placeholder="Discover how Vega transforms strategy into weekly action"
                data-testid="input-capability-subheadline"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveSection}
            disabled={isSavingSection}
            className="w-full sm:w-auto"
            data-testid="button-save-capability-section"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSavingSection ? "Saving..." : "Save Section Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Capability Tabs
              </CardTitle>
              <CardDescription>
                Manage the individual capability tabs displayed in the showcase
              </CardDescription>
            </div>
            <Button onClick={() => openTabDialog()} size="sm" data-testid="button-add-capability-tab">
              <Plus className="h-4 w-4 mr-2" />
              Add Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tabs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No capability tabs configured yet.</p>
              <p className="text-sm">Click "Add Tab" to create your first capability showcase tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tabs.map((tab, index) => (
                <div
                  key={tab.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                  data-testid={`capability-tab-${tab.id}`}
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveTab(tab.id, 'up')}
                      disabled={index === 0}
                      data-testid={`button-move-up-${tab.id}`}
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveTab(tab.id, 'down')}
                      disabled={index === tabs.length - 1}
                      data-testid={`button-move-down-${tab.id}`}
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{tab.tabLabel}</div>
                    <div className="text-sm text-muted-foreground truncate">{tab.heading}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {tab.primaryImageUrl && (
                      <Badge variant="secondary" className="text-xs">
                        <ImagePlus className="h-3 w-3 mr-1" />
                        Image
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openTabDialog(tab)}
                      data-testid={`button-edit-tab-${tab.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTab(tab)}
                      data-testid={`button-delete-tab-${tab.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-capability-tab">
          <DialogHeader>
            <DialogTitle>{editingTab ? "Edit Capability Tab" : "Create Capability Tab"}</DialogTitle>
            <DialogDescription>
              Configure the content for this capability showcase tab
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tab-label">Tab Label *</Label>
                <Input
                  id="tab-label"
                  value={tabFormData.tabLabel}
                  onChange={(e) => setTabFormData({ ...tabFormData, tabLabel: e.target.value })}
                  placeholder="e.g., Strategy"
                  data-testid="input-tab-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tab-heading">Heading *</Label>
                <Input
                  id="tab-heading"
                  value={tabFormData.heading}
                  onChange={(e) => setTabFormData({ ...tabFormData, heading: e.target.value })}
                  placeholder="e.g., Transform Strategy into Action"
                  data-testid="input-tab-heading"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tab-body">Body Copy * (Markdown supported)</Label>
              <Textarea
                id="tab-body"
                value={tabFormData.bodyCopy}
                onChange={(e) => setTabFormData({ ...tabFormData, bodyCopy: e.target.value })}
                placeholder="Describe this capability..."
                rows={4}
                data-testid="input-tab-body"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Image</Label>
                <ImageUpload
                  value={tabFormData.primaryImageUrl}
                  onChange={(url) => setTabFormData({ ...tabFormData, primaryImageUrl: url })}
                  placeholder="Upload or paste URL"
                  testId="tab-primary-image"
                />
                <p className="text-xs text-muted-foreground">Main showcase image for this tab</p>
              </div>
              <div className="space-y-2">
                <Label>Secondary Image</Label>
                <ImageUpload
                  value={tabFormData.secondaryImageUrl}
                  onChange={(url) => setTabFormData({ ...tabFormData, secondaryImageUrl: url })}
                  placeholder="Upload or paste URL"
                  testId="tab-secondary-image"
                />
                <p className="text-xs text-muted-foreground">Optional secondary/detail image</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tab-cta-text">CTA Button Text</Label>
                <Input
                  id="tab-cta-text"
                  value={tabFormData.ctaText}
                  onChange={(e) => setTabFormData({ ...tabFormData, ctaText: e.target.value })}
                  placeholder="e.g., Learn More"
                  data-testid="input-tab-cta-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tab-cta-url">CTA Button URL</Label>
                <Input
                  id="tab-cta-url"
                  value={tabFormData.ctaUrl}
                  onChange={(e) => setTabFormData({ ...tabFormData, ctaUrl: e.target.value })}
                  placeholder="/signup or https://..."
                  data-testid="input-tab-cta-url"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTabDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTab}
              disabled={isSavingTab || !tabFormData.tabLabel || !tabFormData.heading || !tabFormData.bodyCopy}
              data-testid="button-save-tab"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSavingTab ? "Saving..." : editingTab ? "Update Tab" : "Create Tab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type SeoConfigData = {
  title: string;
  description: string;
  ogDescription: string;
  keywords: string;
  canonicalUrl: string;
};

function SeoSettingsPanel() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<SeoConfigData>({
    queryKey: ["/api/seo/config"],
  });

  const [formData, setFormData] = useState<SeoConfigData>({
    title: "",
    description: "",
    ogDescription: "",
    keywords: "",
    canonicalUrl: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        title: config.title || "",
        description: config.description || "",
        ogDescription: config.ogDescription || "",
        keywords: config.keywords || "",
        canonicalUrl: config.canonicalUrl || "",
      });
      setHasChanges(false);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: SeoConfigData) => {
      const res = await apiRequest("PATCH", "/api/seo/config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/config"] });
      setHasChanges(false);
      toast({ title: "SEO settings saved", description: "Changes are live on the landing page." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to save SEO settings", variant: "destructive" });
    },
  });

  const updateField = (field: keyof SeoConfigData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    if (config) {
      setFormData({
        title: config.title || "",
        description: config.description || "",
        ogDescription: config.ogDescription || "",
        keywords: config.keywords || "",
        canonicalUrl: config.canonicalUrl || "",
      });
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading SEO settings...</div>;
  }

  const titlePreview = formData.title || "Vega - The Synozur Alliance Company OS";
  const descPreview = formData.description || "";
  const urlPreview = formData.canonicalUrl || "https://vega.synozur.com";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            SEO Settings
          </CardTitle>
          <CardDescription>
            Manage the landing page's search engine metadata. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seo-title">Page Title</Label>
            <Input
              id="seo-title"
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Vega - The Synozur Alliance Company OS"
              maxLength={70}
              data-testid="input-seo-title"
            />
            <p className="text-xs text-muted-foreground">{formData.title.length}/70 characters — recommended 50–60</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-description">Meta Description</Label>
            <Textarea
              id="seo-description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe the landing page for search engines..."
              rows={3}
              maxLength={160}
              data-testid="input-seo-description"
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/160 characters — recommended 120–155</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-og-description">OG / Social Description</Label>
            <Textarea
              id="seo-og-description"
              value={formData.ogDescription}
              onChange={(e) => updateField("ogDescription", e.target.value)}
              placeholder="Shorter description for social media previews..."
              rows={2}
              maxLength={200}
              data-testid="input-seo-og-description"
            />
            <p className="text-xs text-muted-foreground">Shown in Open Graph and Twitter Card previews</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-keywords">Keywords</Label>
            <Input
              id="seo-keywords"
              value={formData.keywords}
              onChange={(e) => updateField("keywords", e.target.value)}
              placeholder="company operating system, OKR software, strategy execution..."
              data-testid="input-seo-keywords"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of target keywords</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo-canonical">Canonical URL</Label>
            <Input
              id="seo-canonical"
              value={formData.canonicalUrl}
              onChange={(e) => updateField("canonicalUrl", e.target.value)}
              placeholder="https://vega.synozur.com"
              data-testid="input-seo-canonical"
            />
            <p className="text-xs text-muted-foreground">The authoritative URL — also used in sitemap.xml and robots.txt</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              data-testid="button-seo-save"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save SEO Settings"}
            </Button>
            {hasChanges && (
              <Button variant="outline" onClick={handleReset} data-testid="button-seo-reset">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Google Search Result Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Result Preview</CardTitle>
          <CardDescription>How this page may appear in Google search results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-4 space-y-1 font-sans">
            <p className="text-xs text-muted-foreground truncate">{urlPreview}</p>
            <p
              className="text-base font-medium text-blue-600 dark:text-blue-400 leading-snug line-clamp-1"
              data-testid="preview-seo-title"
            >
              {titlePreview}
            </p>
            <p
              className="text-sm text-muted-foreground line-clamp-2 leading-snug"
              data-testid="preview-seo-description"
            >
              {descPreview}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Actual appearance may vary. Google may rewrite titles and descriptions.
          </p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical SEO Files</CardTitle>
          <CardDescription>Automatically generated from the canonical URL above</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">robots.txt</p>
              <p className="text-xs text-muted-foreground">Allows all crawlers, blocks /api/ and /dashboard</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/robots.txt", "_blank")}
              data-testid="button-view-robots"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">sitemap.xml</p>
              <p className="text-xs text-muted-foreground">Lists all public pages with priority and changefreq</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/sitemap.xml", "_blank")}
              data-testid="button-view-sitemap"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
