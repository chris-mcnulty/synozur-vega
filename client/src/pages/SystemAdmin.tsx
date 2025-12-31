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
import { Shield, BookOpen, Save, RotateCcw, Activity, BarChart3, Globe, Monitor, Smartphone, Tablet, Bot, Download, Users, Building2, Check, X, Megaphone, ExternalLink, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { SystemBanner } from "@shared/schema";
import { PlatformAIUsageWidget } from "@/components/AIUsageWidget";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";

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
  focusRhythm: "Regular cadence of strategic planning sessions",
};

type TrafficStats = {
  totalVisits: number;
  visitsByPage: { page: string; count: number }[];
  visitsByDay: { date: string; count: number }[];
  visitsByCountry: { country: string; count: number }[];
  visitsByDevice: { device: string; count: number }[];
  visitsByBrowser: { browser: string; count: number }[];
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

export default function SystemAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vocabulary, setVocabulary] = useState<VocabularyTerms>(DEFAULT_VOCABULARY);
  const [hasChanges, setHasChanges] = useState(false);
  const [trafficDateRange, setTrafficDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
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
    
    let csv = "Traffic Analytics Report\n";
    csv += `Date Range: ${trafficDateRange.startDate} to ${trafficDateRange.endDate}\n\n`;
    
    csv += "Summary\n";
    csv += `Total Page Views,${trafficStats.totalVisits}\n`;
    csv += `Unique Pages,${trafficStats.visitsByPage.length}\n`;
    csv += `Countries,${trafficStats.visitsByCountry.length}\n\n`;
    
    csv += "Visits by Page\n";
    csv += "Page,Count\n";
    trafficStats.visitsByPage.forEach(item => {
      csv += `"${item.page}",${item.count}\n`;
    });
    
    csv += "\nVisits by Day\n";
    csv += "Date,Count\n";
    trafficStats.visitsByDay.forEach(item => {
      csv += `${item.date},${item.count}\n`;
    });
    
    csv += "\nVisits by Device\n";
    csv += "Device,Count\n";
    trafficStats.visitsByDevice.forEach(item => {
      csv += `${item.device},${item.count}\n`;
    });
    
    csv += "\nVisits by Browser\n";
    csv += "Browser,Count\n";
    trafficStats.visitsByBrowser.forEach(item => {
      csv += `${item.browser},${item.count}\n`;
    });
    
    csv += "\nVisits by Country\n";
    csv += "Country,Count\n";
    trafficStats.visitsByCountry.forEach(item => {
      csv += `"${item.country}",${item.count}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-report-${trafficDateRange.startDate}-to-${trafficDateRange.endDate}.csv`;
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
    a.download = `tenant-activity-report-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })}.csv`;
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
    <div className="container mx-auto py-6 space-y-6 max-w-4xl px-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 md:h-6 md:w-6" />
          System Administration
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Manage system-wide settings for all organizations
        </p>
      </div>

      <Tabs defaultValue="vocabulary" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="vocabulary" className="flex items-center gap-2" data-testid="tab-vocabulary">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Vocabulary</span>
              <span className="sm:hidden">Vocab</span>
            </TabsTrigger>
            <TabsTrigger value="ai-usage" className="flex items-center gap-2" data-testid="tab-ai-usage">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">AI Usage</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="traffic" className="flex items-center gap-2" data-testid="tab-traffic">
              <BarChart3 className="h-4 w-4" />
              Traffic
            </TabsTrigger>
            <TabsTrigger value="tenant-activity" className="flex items-center gap-2" data-testid="tab-tenant-activity">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Tenant Activity</span>
              <span className="sm:hidden">Tenants</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-2" data-testid="tab-announcements">
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">Announcements</span>
              <span className="sm:hidden">Announce</span>
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

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Website Traffic Analytics</CardTitle>
                  <CardDescription>
                    Monitor website visits, page popularity, and visitor demographics
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Label className="text-sm">Date Range:</Label>
                  <Input
                    type="date"
                    value={trafficDateRange.startDate}
                    onChange={(e) => setTrafficDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-36"
                    data-testid="input-traffic-start-date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={trafficDateRange.endDate}
                    onChange={(e) => setTrafficDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-36"
                    data-testid="input-traffic-end-date"
                  />
                  <Button
                    variant="outline"
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
            </CardHeader>
            <CardContent>
              {trafficLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : trafficStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{trafficStats.totalVisits.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total Page Views</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{trafficStats.visitsByPage.length}</div>
                        <p className="text-xs text-muted-foreground">Unique Pages Visited</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{trafficStats.visitsByCountry.length}</div>
                        <p className="text-xs text-muted-foreground">Countries</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{trafficStats.visitsByDay.length}</div>
                        <p className="text-xs text-muted-foreground">Days with Activity</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Top Pages</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {trafficStats.visitsByPage.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No page visits recorded yet</p>
                        ) : (
                          <div className="space-y-3">
                            {trafficStats.visitsByPage.slice(0, 10).map((item) => {
                              const maxCount = trafficStats.visitsByPage[0]?.count || 1;
                              const percentage = (item.count / maxCount) * 100;
                              return (
                                <div key={item.page} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="truncate max-w-[200px]" title={item.page}>{item.page}</span>
                                    <span className="font-medium">{item.count.toLocaleString()}</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Device Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {trafficStats.visitsByDevice.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No device data available</p>
                        ) : (
                          <div className="space-y-3">
                            {trafficStats.visitsByDevice.map((item) => {
                              const maxCount = trafficStats.visitsByDevice[0]?.count || 1;
                              const percentage = (item.count / maxCount) * 100;
                              return (
                                <div key={item.device} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                      {getDeviceIcon(item.device)}
                                      {item.device}
                                    </span>
                                    <span className="font-medium">{item.count.toLocaleString()}</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Browser Usage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {trafficStats.visitsByBrowser.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No browser data available</p>
                        ) : (
                          <div className="space-y-3">
                            {trafficStats.visitsByBrowser.map((item) => {
                              const maxCount = trafficStats.visitsByBrowser[0]?.count || 1;
                              const percentage = (item.count / maxCount) * 100;
                              return (
                                <div key={item.browser} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{item.browser}</span>
                                    <span className="font-medium">{item.count.toLocaleString()}</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Top Countries
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {trafficStats.visitsByCountry.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No country data available</p>
                        ) : (
                          <div className="space-y-3">
                            {trafficStats.visitsByCountry.slice(0, 10).map((item) => {
                              const maxCount = trafficStats.visitsByCountry[0]?.count || 1;
                              const percentage = (item.count / maxCount) * 100;
                              return (
                                <div key={item.country} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{item.country}</span>
                                    <span className="font-medium">{item.count.toLocaleString()}</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No traffic data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenant-activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Tenant Activity Report</CardTitle>
                  <CardDescription>
                    Monitor tenant usage, user activity, and Company OS element adoption across all organizations
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
                  Export CSV
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">{tenantActivity.summary.totalTenants}</div>
                            <p className="text-xs text-muted-foreground">Total Tenants</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-2xl font-bold">{tenantActivity.summary.totalUsers}</div>
                            <p className="text-xs text-muted-foreground">Total Users</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-green-500" />
                          <div>
                            <div className="text-2xl font-bold">{tenantActivity.summary.activeUsersLast30Days}</div>
                            <p className="text-xs text-muted-foreground">Active (30 Days)</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <X className="h-5 w-5 text-orange-500" />
                          <div>
                            <div className="text-2xl font-bold">{tenantActivity.summary.inactiveTrialTenants}</div>
                            <p className="text-xs text-muted-foreground">Inactive Trials</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-tenant-activity">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Tenant</th>
                          <th className="text-left py-3 px-2 font-medium">Plan</th>
                          <th className="text-center py-3 px-2 font-medium">Users</th>
                          <th className="text-center py-3 px-2 font-medium">Active</th>
                          <th className="text-center py-3 px-2 font-medium">Mission</th>
                          <th className="text-center py-3 px-2 font-medium">Vision</th>
                          <th className="text-center py-3 px-2 font-medium">Values</th>
                          <th className="text-center py-3 px-2 font-medium">Goals</th>
                          <th className="text-center py-3 px-2 font-medium">Strategies</th>
                          <th className="text-center py-3 px-2 font-medium">OKRs</th>
                          <th className="text-center py-3 px-2 font-medium">KRs</th>
                          <th className="text-center py-3 px-2 font-medium">Meetings</th>
                          <th className="text-left py-3 px-2 font-medium">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantActivity.tenants.map((tenant) => (
                          <tr key={tenant.id} className="border-b hover:bg-muted/50" data-testid={`row-tenant-${tenant.id}`}>
                            <td className="py-3 px-2">
                              <div>
                                <div className="font-medium">{tenant.name}</div>
                                {tenant.selfServiceSignup && (
                                  <span className="text-xs text-muted-foreground">Self-service</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div>
                                <div className="text-xs">{tenant.planName || 'No Plan'}</div>
                                <span className={`text-xs ${tenant.planStatus === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
                                  {tenant.planStatus || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center">{tenant.totalUsers}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={tenant.activeUsersLast30Days > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                {tenant.activeUsersLast30Days}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {tenant.elements.hasMission ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {tenant.elements.hasVision ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                            </td>
                            <td className="py-3 px-2 text-center">{tenant.elements.valuesCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.goalsCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.strategiesCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.objectivesCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.keyResultsCount}</td>
                            <td className="py-3 px-2 text-center">{tenant.elements.meetingsCount}</td>
                            <td className="py-3 px-2 text-sm text-muted-foreground">
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

        <TabsContent value="announcements" className="space-y-4">
          <AnnouncementManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnnouncementManager() {
  const { toast } = useToast();
  const [enableBanner, setEnableBanner] = useState(false);
  const [bannerContent, setBannerContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: banners, isLoading: bannersLoading } = useQuery<SystemBanner[]>({
    queryKey: ["/api/admin/banners"],
  });

  const activeBanner = banners?.[0];

  useEffect(() => {
    if (activeBanner) {
      setEnableBanner(activeBanner.status === 'on');
      setBannerContent(activeBanner.content || "");
      setLinkUrl(activeBanner.linkUrl || "");
      setLinkText(activeBanner.linkText || "");
    }
  }, [activeBanner]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        content: bannerContent,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        status: enableBanner ? 'on' : 'off',
      };

      if (activeBanner) {
        await apiRequest("PATCH", `/api/admin/banners/${activeBanner.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/banners", payload);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
      
      toast({
        title: "Announcement saved",
        description: "The announcement has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save announcement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (bannersLoading) {
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
          <Megaphone className="h-5 w-5" />
          System Announcement
        </CardTitle>
        <CardDescription>
          Display an announcement banner across the landing page and dashboard for all users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enable-banner" className="text-base font-medium">Enable Announcement</Label>
            <p className="text-sm text-muted-foreground">Show the announcement on the main page</p>
          </div>
          <Switch
            id="enable-banner"
            checked={enableBanner}
            onCheckedChange={setEnableBanner}
            data-testid="switch-enable-banner"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="banner-content">Announcement Text</Label>
          <Textarea
            id="banner-content"
            placeholder="Happy Holidays! Have a wonderful holiday season, and see you in 2026."
            value={bannerContent}
            onChange={(e) => setBannerContent(e.target.value)}
            className="min-h-[100px]"
            data-testid="input-banner-content"
          />
          <p className="text-sm text-muted-foreground">
            This message will be displayed prominently on the main page
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="link-url">Link URL (optional)</Label>
            <Input
              id="link-url"
              placeholder="https://example.com/announcement"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              data-testid="input-link-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-text">Link Text (optional)</Label>
            <Input
              id="link-text"
              placeholder="Learn more"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              data-testid="input-link-text"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-start gap-2 text-primary">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-semibold">Announcement:</span>{" "}
                {bannerContent || "Your announcement text will appear here..."}
                {linkUrl && linkText && (
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="ml-1 underline inline-flex items-center gap-1">
                    {linkText}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            The system announcement appears at the top of the landing page and dashboard for all users. 
            Use it for important updates, maintenance notices, or special events.
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isSaving || !bannerContent.trim()}
          className="w-full sm:w-auto"
          data-testid="button-save-announcement"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Announcement"}
        </Button>
      </CardContent>
    </Card>
  );
}
