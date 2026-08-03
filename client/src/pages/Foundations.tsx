import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Edit, X, Plus, Save, Trash2, Loader2, AlertCircle, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { ValueDetailView } from "@/components/ValueDetailView";
import { ValuesAlignmentWidget } from "@/components/ValuesAlignmentWidget";
import { getCurrentQuarter } from "@/lib/fiscal-utils";
import type { Foundation, CompanyValue, AnnualGoal, Ambition } from "@shared/schema";
import { Target, Calendar, CheckCircle2, XCircle } from "lucide-react";

// Suggested options for quick selection
const missionSuggestions = [
  "Empower organizations with AI-driven insights",
  "Transform strategy into actionable results",
  "Foster innovation and sustainable growth",
  "Enable data-driven decision-making",
];

const visionSuggestions = [
  "A world where every organization operates with clarity",
  "Data-driven decision-making at every level",
  "Sustainable growth through innovation",
  "Seamless alignment between strategy and execution",
];

const valueSuggestions = [
  "Innovation",
  "Integrity",
  "Collaboration",
  "Excellence",
  "Customer Success",
  "Transparency",
  "Accountability",
  "Continuous Learning",
  "Respect",
  "Agility",
];


export default function Foundations() {
  const { toast } = useToast();
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  
  const [customMission, setCustomMission] = useState("");
  const [customVision, setCustomVision] = useState("");
  
  // Collapsible state for Mission/Vision editing
  const [missionEditOpen, setMissionEditOpen] = useState(false);
  const [visionEditOpen, setVisionEditOpen] = useState(false);
  
  // Value dialog state
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);
  const [valueTitle, setValueTitle] = useState("");
  const [valueDescription, setValueDescription] = useState("");
  
  // Value detail view state
  const [valueDetailOpen, setValueDetailOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<CompanyValue | null>(null);
  
  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  const [values, setValues] = useState<CompanyValue[]>([]);
  const [ambitions, setAmbitions] = useState<Ambition[]>([]);
  const [goals, setGoals] = useState<AnnualGoal[]>([]); // Kept for save mutation - edited in Outcomes
  const currentYear = new Date().getFullYear();
  
  // Ambition dialog state
  const [ambitionDialogOpen, setAmbitionDialogOpen] = useState(false);
  const [editingAmbitionId, setEditingAmbitionId] = useState<string | null>(null);
  const [ambitionTitle, setAmbitionTitle] = useState("");
  const [ambitionDescription, setAmbitionDescription] = useState("");
  const [ambitionTargetYear, setAmbitionTargetYear] = useState(currentYear + 3);
  const [ambitionLinkedValues, setAmbitionLinkedValues] = useState<string[]>([]);
  
  // Close ambition dialog state
  const [closeAmbitionDialogOpen, setCloseAmbitionDialogOpen] = useState(false);
  const [closingAmbitionId, setClosingAmbitionId] = useState<string | null>(null);
  const [closeAmbitionNote, setCloseAmbitionNote] = useState("");
  
  // New organizational identity fields
  const [tagline, setTagline] = useState<string>("");
  const [companySummary, setCompanySummary] = useState<string>("");
  const [messagingStatement, setMessagingStatement] = useState<string>("");
  const [cultureStatement, setCultureStatement] = useState<string>("");
  const [brandVoice, setBrandVoice] = useState<string>("");

  // Fetch foundation data - only when tenant is available
  const { data: foundation, isLoading } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant?.id}`],
    retry: false,
    enabled: !!currentTenant,
  });

  // Initialize state from database or reset when tenant changes
  useEffect(() => {
    if (foundation) {
      setMission(foundation.mission || "");
      setVision(foundation.vision || "");
      
      // Migrate legacy string values to new CompanyValue format
      const rawValues = foundation.values || [];
      const migratedValues: CompanyValue[] = rawValues.map((value: any) => {
        if (typeof value === "string") {
          // Legacy format: convert string to object
          return { title: value, description: "" };
        }
        // Already in new format
        return value;
      });
      setValues(migratedValues);
      
      // Initialize ambitions
      setAmbitions(foundation.ambitions || []);
      
      // Migrate legacy string goals to new AnnualGoal format
      // Backfill missing years: string goals get currentYear - 1 (assumed to be last year's goals)
      // Goals with year=0, null, or undefined also get backfilled
      const rawGoals = foundation.annualGoals || [];
      const migratedGoals: AnnualGoal[] = rawGoals.map((goal: any) => {
        if (typeof goal === "string") {
          // Legacy format: convert string to object - assume previous year
          return { title: goal, year: currentYear - 1 };
        }
        // Backfill missing or invalid year
        if (!goal.year || goal.year === 0) {
          return { ...goal, year: currentYear - 1 };
        }
        return goal;
      });
      setGoals(migratedGoals);
      
      // Initialize new organizational identity fields
      setTagline(foundation.tagline || "");
      setCompanySummary(foundation.companySummary || "");
      setMessagingStatement(foundation.messagingStatement || "");
      setCultureStatement(foundation.cultureStatement || "");
      setBrandVoice(foundation.brandVoice || "");
    } else {
      // Reset to empty state when no foundation exists for this tenant
      setMission("");
      setVision("");
      setValues([]);
      setAmbitions([]);
      setGoals([]);
      setTagline("");
      setCompanySummary("");
      setMessagingStatement("");
      setCultureStatement("");
      setBrandVoice("");
    }
    // Clear custom input fields when tenant changes
    setCustomMission("");
    setCustomVision("");
  }, [foundation, currentTenant?.id]);

  // Save mutation - accepts optional overrides so callers can pass updated data directly
  const saveMutation = useMutation({
    mutationFn: async (overrides?: { ambitions?: Ambition[]; values?: CompanyValue[]; annualGoals?: AnnualGoal[] }) => {
      return apiRequest("POST", "/api/foundations", {
        tenantId: currentTenant!.id,
        mission,
        vision,
        values: overrides?.values ?? values,
        ambitions: overrides?.ambitions ?? ambitions,
        annualGoals: overrides?.annualGoals ?? goals,
        tagline,
        companySummary,
        messagingStatement,
        cultureStatement,
        brandVoice,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/foundations/${currentTenant?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/values/analytics/distribution'] });
      toast({
        title: "Changes Saved",
        description: "Your foundation elements have been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Wait for tenant to load before rendering main content
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

  const handleAddCustomMission = () => {
    if (customMission.trim()) {
      setMission(customMission.trim());
      setCustomMission("");
    }
  };

  const handleAddCustomVision = () => {
    if (customVision.trim()) {
      setVision(customVision.trim());
      setCustomVision("");
    }
  };

  const handleOpenValueDialog = (index: number | null = null) => {
    if (index !== null) {
      // Editing existing value
      setEditingValueIndex(index);
      setValueTitle(values[index].title);
      setValueDescription(values[index].description);
    } else {
      // Adding new value
      setEditingValueIndex(null);
      setValueTitle("");
      setValueDescription("");
    }
    setValueDialogOpen(true);
  };

  const handleSaveValue = () => {
    if (!valueTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Value title is required",
      });
      return;
    }

    const newValue: CompanyValue = {
      title: valueTitle.trim(),
      description: valueDescription.trim(),
    };

    let updatedValues: CompanyValue[];
    if (editingValueIndex !== null) {
      updatedValues = [...values];
      updatedValues[editingValueIndex] = newValue;
    } else {
      updatedValues = [...values, newValue];
    }

    setValues(updatedValues);
    saveMutation.mutate({ values: updatedValues });

    setValueDialogOpen(false);
    setValueTitle("");
    setValueDescription("");
  };

  const handleAddSuggestion = (type: "mission" | "vision" | "value", suggestion: string) => {
    if (type === "mission") {
      setMission(suggestion);
    } else if (type === "vision") {
      setVision(suggestion);
    } else if (type === "value") {
      const newValue: CompanyValue = {
        title: suggestion,
        description: "",
      };
      if (!values.some(v => v.title === suggestion)) {
        setValues([...values, newValue]);
      }
    }
  };

  const handleRemoveValue = (index: number) => {
    const updatedValues = values.filter((_, i) => i !== index);
    setValues(updatedValues);
    saveMutation.mutate({ values: updatedValues });
  };

  // Generate available target years for ambitions (3-10 years out)
  const ambitionYears = Array.from({ length: 8 }, (_, i) => currentYear + 3 + i);

  // Ambition handlers
  const handleOpenAmbitionDialog = (ambitionId: string | null = null) => {
    if (ambitionId) {
      const ambition = ambitions.find(a => a.id === ambitionId);
      if (ambition) {
        setEditingAmbitionId(ambitionId);
        setAmbitionTitle(ambition.title);
        setAmbitionDescription(ambition.description || "");
        setAmbitionTargetYear(ambition.targetYear);
        setAmbitionLinkedValues(ambition.linkedValueTitles || []);
      }
    } else {
      setEditingAmbitionId(null);
      setAmbitionTitle("");
      setAmbitionDescription("");
      setAmbitionTargetYear(currentYear + 3);
      setAmbitionLinkedValues([]);
    }
    setAmbitionDialogOpen(true);
  };

  const handleSaveAmbition = () => {
    if (!ambitionTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ambition title is required",
      });
      return;
    }

    let updatedAmbitions: Ambition[];

    if (editingAmbitionId) {
      updatedAmbitions = ambitions.map(a => 
        a.id === editingAmbitionId 
          ? { 
              ...a, 
              title: ambitionTitle.trim(), 
              description: ambitionDescription.trim() || undefined,
              targetYear: ambitionTargetYear,
              linkedValueTitles: ambitionLinkedValues.length > 0 ? ambitionLinkedValues : undefined,
            } 
          : a
      );
    } else {
      const newAmbition: Ambition = {
        id: crypto.randomUUID(),
        title: ambitionTitle.trim(),
        description: ambitionDescription.trim() || undefined,
        targetYear: ambitionTargetYear,
        linkedValueTitles: ambitionLinkedValues.length > 0 ? ambitionLinkedValues : undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      
      const activeCount = ambitions.filter(a => a.status === 'active').length;
      if (activeCount >= 5) {
        toast({
          title: "Note",
          description: "You have more than 5 active ambitions. Consider focusing on fewer strategic targets.",
        });
      }
      
      updatedAmbitions = [...ambitions, newAmbition];
    }

    setAmbitions(updatedAmbitions);
    saveMutation.mutate({ ambitions: updatedAmbitions });

    setAmbitionDialogOpen(false);
    setAmbitionTitle("");
    setAmbitionDescription("");
    setAmbitionLinkedValues([]);
  };

  const handleOpenCloseAmbitionDialog = (ambitionId: string) => {
    setClosingAmbitionId(ambitionId);
    setCloseAmbitionNote("");
    setCloseAmbitionDialogOpen(true);
  };

  const handleCloseAmbition = () => {
    if (!closingAmbitionId) return;
    
    const updatedAmbitions = ambitions.map(a => 
      a.id === closingAmbitionId 
        ? { 
            ...a, 
            status: 'closed' as const,
            closedAt: new Date().toISOString(),
            closedNote: closeAmbitionNote.trim() || undefined,
          } 
        : a
    );
    setAmbitions(updatedAmbitions);
    saveMutation.mutate({ ambitions: updatedAmbitions });
    setCloseAmbitionDialogOpen(false);
    setClosingAmbitionId(null);
    setCloseAmbitionNote("");
  };

  const handleReopenAmbition = (ambitionId: string) => {
    const updatedAmbitions = ambitions.map(a => 
      a.id === ambitionId 
        ? { 
            ...a, 
            status: 'active' as const,
            closedAt: undefined,
            closedNote: undefined,
          } 
        : a
    );
    setAmbitions(updatedAmbitions);
    saveMutation.mutate({ ambitions: updatedAmbitions });
  };

  const handleToggleAmbitionValue = (valueTitle: string) => {
    if (ambitionLinkedValues.includes(valueTitle)) {
      setAmbitionLinkedValues(ambitionLinkedValues.filter(v => v !== valueTitle));
    } else {
      setAmbitionLinkedValues([...ambitionLinkedValues, valueTitle]);
    }
  };

  // Filter ambitions by status
  const activeAmbitions = ambitions.filter(a => a.status === 'active');
  const closedAmbitions = ambitions.filter(a => a.status === 'closed');

  const handleClearAll = () => {
    setMission("");
    setVision("");
    setValues([]);
    setAmbitions([]);
    setGoals([]);
    setTagline("");
    setCompanySummary("");
    setMessagingStatement("");
    setCultureStatement("");
    setBrandVoice("");
    toast({
      title: "Cleared",
      description: "All foundation elements have been cleared",
    });
  };

  const handleSave = () => {
    saveMutation.mutate(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Helmet><title>Foundations | Vega</title></Helmet>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Foundations</h1>
          <p className="text-muted-foreground">
            Define your organization's core purpose, values, and annual goals
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            data-testid="button-clear-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="foundations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="foundations" data-testid="tab-foundations">
            Core Foundations
          </TabsTrigger>
          <TabsTrigger value="identity" data-testid="tab-identity">
            Organizational Identity
          </TabsTrigger>
          <TabsTrigger value="positioning" data-testid="tab-positioning">
            Strategic Positioning
          </TabsTrigger>
        </TabsList>

        {/* Organizational Identity Tab */}
        <TabsContent value="identity" className="space-y-6">
          <Card data-testid="card-identity">
            <CardHeader>
              <CardTitle>Organizational Identity</CardTitle>
              <CardDescription>Define your brand's core identity and positioning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Your company's memorable tagline..."
                  data-testid="input-tagline"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company-summary">Company Summary</Label>
                <Textarea
                  id="company-summary"
                  value={companySummary}
                  onChange={(e) => setCompanySummary(e.target.value)}
                  placeholder="A brief overview of your company, its purpose, and what makes it unique..."
                  rows={6}
                  data-testid="textarea-company-summary"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategic Positioning Tab */}
        <TabsContent value="positioning" className="space-y-6">
          <Card data-testid="card-positioning">
            <CardHeader>
              <CardTitle>Strategic Positioning</CardTitle>
              <CardDescription>Define how you communicate and position your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="messaging-statement">Messaging Statement</Label>
                <Textarea
                  id="messaging-statement"
                  value={messagingStatement}
                  onChange={(e) => setMessagingStatement(e.target.value)}
                  placeholder="Your key messaging points and value proposition..."
                  rows={5}
                  data-testid="textarea-messaging-statement"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="culture-statement">Culture Statement</Label>
                <Textarea
                  id="culture-statement"
                  value={cultureStatement}
                  onChange={(e) => setCultureStatement(e.target.value)}
                  placeholder="Describe your organizational culture and work environment..."
                  rows={5}
                  data-testid="textarea-culture-statement"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="brand-voice">Brand Voice</Label>
                <Textarea
                  id="brand-voice"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="How your brand communicates: tone, style, personality..."
                  rows={5}
                  data-testid="textarea-brand-voice"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Core Foundations Tab */}
        <TabsContent value="foundations" className="space-y-6">
          {/* Mission Section */}
          <Card data-testid="card-mission">
            <CardHeader>
              <CardTitle>Mission Statement</CardTitle>
              <CardDescription>What is your organization's fundamental purpose?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Mission - Prominent Display */}
              {mission ? (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                  <p className="text-lg font-medium leading-relaxed" data-testid="text-current-mission">{mission}</p>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <p className="text-muted-foreground">No mission statement defined yet</p>
                </div>
              )}

              {/* Edit Section - Secondary/Collapsible */}
              <Collapsible 
                open={missionEditOpen} 
                onOpenChange={(open) => { 
                  if (open) setCustomMission(mission);
                  setMissionEditOpen(open);
                }}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" data-testid="button-edit-mission-toggle">
                    <Pencil className="h-4 w-4 mr-2" />
                    {mission ? "Edit Mission" : "Add Mission"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <Input
                      id="custom-mission"
                      value={customMission}
                      onChange={(e) => setCustomMission(e.target.value)}
                      placeholder="Enter your mission statement..."
                      onKeyPress={(e) => e.key === "Enter" && handleAddCustomMission()}
                      data-testid="input-custom-mission"
                    />
                    <Button
                      onClick={() => {
                        handleAddCustomMission();
                        setMissionEditOpen(false);
                      }}
                      disabled={!customMission.trim()}
                      data-testid="button-add-mission"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setMissionEditOpen(false)}
                      data-testid="button-cancel-mission"
                    >
                      Cancel
                    </Button>
                  </div>

                  {mission && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setMission("");
                        setMissionEditOpen(false);
                      }}
                      data-testid="button-clear-mission"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Mission
                    </Button>
                  )}

                  <div className="border-t pt-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                    <div className="flex flex-wrap gap-2">
                      {missionSuggestions.map((suggestion, index) => (
                        <Badge
                          key={index}
                          variant={mission === suggestion ? "default" : "outline"}
                          className="cursor-pointer py-2 px-4 hover-elevate"
                          onClick={() => {
                            handleAddSuggestion("mission", suggestion);
                            setMissionEditOpen(false);
                          }}
                          data-testid={`suggestion-mission-${index}`}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Vision Section */}
          <Card data-testid="card-vision">
            <CardHeader>
              <CardTitle>Vision Statement</CardTitle>
              <CardDescription>What future do you aspire to create?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Vision - Prominent Display */}
              {vision ? (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                  <p className="text-lg font-medium leading-relaxed" data-testid="text-current-vision">{vision}</p>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <p className="text-muted-foreground">No vision statement defined yet</p>
                </div>
              )}

              {/* Edit Section - Secondary/Collapsible */}
              <Collapsible 
                open={visionEditOpen} 
                onOpenChange={(open) => { 
                  if (open) setCustomVision(vision);
                  setVisionEditOpen(open);
                }}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" data-testid="button-edit-vision-toggle">
                    <Pencil className="h-4 w-4 mr-2" />
                    {vision ? "Edit Vision" : "Add Vision"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <Input
                      id="custom-vision"
                      value={customVision}
                      onChange={(e) => setCustomVision(e.target.value)}
                      placeholder="Enter your vision statement..."
                      onKeyPress={(e) => e.key === "Enter" && handleAddCustomVision()}
                      data-testid="input-custom-vision"
                    />
                    <Button
                      onClick={() => {
                        handleAddCustomVision();
                        setVisionEditOpen(false);
                      }}
                      disabled={!customVision.trim()}
                      data-testid="button-add-vision"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setVisionEditOpen(false)}
                      data-testid="button-cancel-vision"
                    >
                      Cancel
                    </Button>
                  </div>

                  {vision && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setVision("");
                        setVisionEditOpen(false);
                      }}
                      data-testid="button-clear-vision"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Vision
                    </Button>
                  )}

                  <div className="border-t pt-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                    <div className="flex flex-wrap gap-2">
                      {visionSuggestions.map((suggestion, index) => (
                        <Badge
                          key={index}
                          variant={vision === suggestion ? "default" : "outline"}
                          className="cursor-pointer py-2 px-4 hover-elevate"
                          onClick={() => {
                            handleAddSuggestion("vision", suggestion);
                            setVisionEditOpen(false);
                          }}
                          data-testid={`suggestion-vision-${index}`}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Values Section */}
          <Card data-testid="card-values">
            <CardHeader>
              <CardTitle>Core Values</CardTitle>
              <CardDescription>What principles guide your organization?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => handleOpenValueDialog()} 
                variant="outline"
                className="w-full"
                data-testid="button-add-value"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Value
              </Button>

              {values.length > 0 && (
                <div className="space-y-3">
                  {values.map((value, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-4 p-3 bg-secondary/20 rounded-lg"
                      data-testid={`value-item-${index}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{value.title}</div>
                        {value.description && (
                          <p className="text-sm text-muted-foreground">{value.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedValue(value);
                            setValueDetailOpen(true);
                          }}
                          data-testid={`button-view-value-${index}`}
                          aria-label="View tagged items"
                          title="View tagged items"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenValueDialog(index)}
                          aria-label="Edit value"
                          data-testid={`button-edit-value-${index}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveValue(index)}
                          aria-label="Remove value"
                          data-testid={`button-remove-value-${index}`}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {valueSuggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant={values.some(v => v.title === suggestion) ? "default" : "outline"}
                      className="cursor-pointer py-2 px-4 hover-elevate"
                      onClick={() => handleAddSuggestion("value", suggestion)}
                      data-testid={`suggestion-value-${index}`}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Values Alignment Widget */}
          <ValuesAlignmentWidget />

          {/* Ambitions Section - Long-term Strategic Targets */}
          <Card data-testid="card-ambitions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Ambitions
              </CardTitle>
              <CardDescription>
                3-5 year strategic targets that define your long-term aspirations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => handleOpenAmbitionDialog()} 
                variant="outline"
                className="w-full"
                data-testid="button-add-ambition"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Ambition
              </Button>

              {ambitions.length > 0 ? (
                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="grid w-full grid-cols-2" data-testid="tabs-ambitions-filter">
                    <TabsTrigger value="active" data-testid="tab-ambitions-active">
                      Active ({activeAmbitions.length})
                    </TabsTrigger>
                    <TabsTrigger value="closed" data-testid="tab-ambitions-closed">
                      Closed ({closedAmbitions.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="space-y-3 mt-4">
                    {activeAmbitions.length > 0 ? (
                      activeAmbitions.map((ambition) => (
                        <div
                          key={ambition.id}
                          className="bg-primary/5 border border-primary/20 rounded-lg p-4"
                          data-testid={`ambition-item-${ambition.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{ambition.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {ambition.targetYear}
                                </Badge>
                              </div>
                              {ambition.description && (
                                <p className="text-sm text-muted-foreground">{ambition.description}</p>
                              )}
                              {ambition.linkedValueTitles && ambition.linkedValueTitles.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {ambition.linkedValueTitles.map((valueTitle, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {valueTitle}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenAmbitionDialog(ambition.id)}
                                aria-label="Edit ambition"
                                data-testid={`button-edit-ambition-${ambition.id}`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenCloseAmbitionDialog(ambition.id)}
                                data-testid={`button-close-ambition-${ambition.id}`}
                                aria-label="Close ambition"
                                title="Close ambition"
                              >
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No active ambitions</p>
                        <p className="text-xs mt-1">Add a new ambition or reopen a closed one</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="closed" className="space-y-3 mt-4">
                    {closedAmbitions.length > 0 ? (
                      closedAmbitions.map((ambition) => (
                        <div
                          key={ambition.id}
                          className="bg-muted/50 border rounded-lg p-4 opacity-70"
                          data-testid={`ambition-closed-${ambition.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium line-through">{ambition.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {ambition.targetYear}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">Closed</Badge>
                              </div>
                              {ambition.closedNote && (
                                <p className="text-sm text-muted-foreground italic">"{ambition.closedNote}"</p>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleReopenAmbition(ambition.id)}
                              data-testid={`button-reopen-ambition-${ambition.id}`}
                              aria-label="Reopen ambition"
                              title="Reopen ambition"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No closed ambitions</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ambitions defined yet</p>
                  <p className="text-xs mt-1">Add 3-5 year strategic targets to guide your organization</p>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Save Button - Sticky at bottom for mission/vision/text changes */}
      <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur-sm border-t py-3 mt-6 -mx-4 px-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Value Add/Edit Dialog */}
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent data-testid="dialog-value">
          <DialogHeader>
            <DialogTitle>{editingValueIndex !== null ? "Edit Value" : "Add New Value"}</DialogTitle>
            <DialogDescription>
              Define a core value with its title and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="value-title">Value Title *</Label>
              <Input
                id="value-title"
                value={valueTitle}
                onChange={(e) => setValueTitle(e.target.value)}
                placeholder="e.g., Innovation, Integrity, Excellence"
                data-testid="input-value-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value-description">Description</Label>
              <Textarea
                id="value-description"
                value={valueDescription}
                onChange={(e) => setValueDescription(e.target.value)}
                placeholder="Describe what this value means to your organization..."
                rows={4}
                data-testid="input-value-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValueDialogOpen(false)}
              data-testid="button-cancel-value"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveValue}
              data-testid="button-save-value"
            >
              {editingValueIndex !== null ? "Update" : "Add"} Value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Value Detail View */}
      {selectedValue && (
        <ValueDetailView
          open={valueDetailOpen}
          onOpenChange={setValueDetailOpen}
          valueTitle={selectedValue.title}
          valueDescription={selectedValue.description}
          tenantId={currentTenant.id}
        />
      )}

      {/* Ambition Add/Edit Dialog */}
      <Dialog open={ambitionDialogOpen} onOpenChange={setAmbitionDialogOpen}>
        <DialogContent data-testid="dialog-ambition">
          <DialogHeader>
            <DialogTitle>{editingAmbitionId ? "Edit Ambition" : "Add New Ambition"}</DialogTitle>
            <DialogDescription>
              Define a long-term strategic target for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ambition-title">Title</Label>
              <Input
                id="ambition-title"
                value={ambitionTitle}
                onChange={(e) => setAmbitionTitle(e.target.value)}
                placeholder="e.g., Become market leader in our sector"
                data-testid="input-ambition-title"
              />
            </div>
            <div>
              <Label htmlFor="ambition-description">Description (optional)</Label>
              <Textarea
                id="ambition-description"
                value={ambitionDescription}
                onChange={(e) => setAmbitionDescription(e.target.value)}
                placeholder="Describe what achieving this ambition means..."
                rows={3}
                data-testid="input-ambition-description"
              />
            </div>
            <div>
              <Label htmlFor="ambition-target-year">Target Year</Label>
              <Select
                value={ambitionTargetYear.toString()}
                onValueChange={(value) => setAmbitionTargetYear(parseInt(value))}
              >
                <SelectTrigger aria-label="Target Year" data-testid="select-ambition-target-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ambitionYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {values.length > 0 && (
              <div>
                <Label>Linked Values (optional)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {values.map((value, index) => (
                    <Badge
                      key={index}
                      variant={ambitionLinkedValues.includes(value.title) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleToggleAmbitionValue(value.title)}
                      data-testid={`badge-ambition-value-${index}`}
                    >
                      {value.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAmbitionDialogOpen(false)}
              data-testid="button-cancel-ambition"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAmbition}
              data-testid="button-save-ambition"
            >
              {editingAmbitionId ? "Update" : "Add"} Ambition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Ambition Dialog */}
      <Dialog open={closeAmbitionDialogOpen} onOpenChange={setCloseAmbitionDialogOpen}>
        <DialogContent data-testid="dialog-close-ambition">
          <DialogHeader>
            <DialogTitle>Close Ambition</DialogTitle>
            <DialogDescription>
              Mark this ambition as closed. You can optionally add a closing note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="close-ambition-note">Closing Note (optional)</Label>
              <Textarea
                id="close-ambition-note"
                value={closeAmbitionNote}
                onChange={(e) => setCloseAmbitionNote(e.target.value)}
                placeholder="e.g., Achieved ahead of schedule, Superseded by new strategy..."
                rows={3}
                data-testid="input-close-ambition-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseAmbitionDialogOpen(false)}
              data-testid="button-cancel-close-ambition"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseAmbition}
              data-testid="button-confirm-close-ambition"
            >
              Close Ambition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
