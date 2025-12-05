import { useState, useEffect } from "react";
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
import { Eye, Edit, X, Plus, Save, Trash2, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { ValueDetailView } from "@/components/ValueDetailView";
import { AIGoalsSuggestionDialog } from "@/components/AIGoalsSuggestionDialog";
import type { Foundation, CompanyValue } from "@shared/schema";

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

const goalSuggestions = [
  "Increase revenue by 30%",
  "Expand to new markets",
  "Improve customer satisfaction",
  "Launch innovative products",
  "Build high-performing teams",
  "Achieve operational excellence",
  "Strengthen brand presence",
  "Foster sustainable practices",
];

export default function Foundations() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [customMission, setCustomMission] = useState("");
  const [customVision, setCustomVision] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  
  // Value dialog state
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);
  const [valueTitle, setValueTitle] = useState("");
  const [valueDescription, setValueDescription] = useState("");
  
  // Value detail view state
  const [valueDetailOpen, setValueDetailOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<CompanyValue | null>(null);
  
  // AI suggestions dialog state
  const [aiGoalsSuggestionOpen, setAiGoalsSuggestionOpen] = useState(false);
  
  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  const [values, setValues] = useState<CompanyValue[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  
  // New organizational identity fields
  const [tagline, setTagline] = useState<string>("");
  const [companySummary, setCompanySummary] = useState<string>("");
  const [messagingStatement, setMessagingStatement] = useState<string>("");
  const [cultureStatement, setCultureStatement] = useState<string>("");
  const [brandVoice, setBrandVoice] = useState<string>("");

  // Fetch foundation data
  const { data: foundation, isLoading } = useQuery<Foundation>({
    queryKey: [`/api/foundations/${currentTenant.id}`],
    retry: false,
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
      
      setGoals(foundation.annualGoals || []);
      
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
    setCustomGoal("");
  }, [foundation, currentTenant.id]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/foundations", {
        tenantId: currentTenant.id,
        mission,
        vision,
        values,
        annualGoals: goals,
        tagline,
        companySummary,
        messagingStatement,
        cultureStatement,
        brandVoice,
        fiscalYearStartMonth: 1,
        updatedBy: "Current User",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/foundations/${currentTenant.id}`] });
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

    if (editingValueIndex !== null) {
      // Update existing value
      const updatedValues = [...values];
      updatedValues[editingValueIndex] = newValue;
      setValues(updatedValues);
    } else {
      // Add new value
      setValues([...values, newValue]);
    }

    setValueDialogOpen(false);
    setValueTitle("");
    setValueDescription("");
  };

  const handleAddCustomGoal = () => {
    if (customGoal.trim() && !goals.includes(customGoal.trim())) {
      setGoals([...goals, customGoal.trim()]);
      setCustomGoal("");
    }
  };

  const handleAddSuggestion = (type: "mission" | "vision" | "value" | "goal", suggestion: string) => {
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
    } else if (type === "goal") {
      if (!goals.includes(suggestion)) {
        setGoals([...goals, suggestion]);
      }
    }
  };

  const handleRemoveValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const handleRemoveGoal = (goal: string) => {
    setGoals(goals.filter(g => g !== goal));
  };

  const handleClearAll = () => {
    setMission("");
    setVision("");
    setValues([]);
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
    saveMutation.mutate();
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
              <div className="space-y-2">
                <Label htmlFor="custom-mission">Current Mission</Label>
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
                    onClick={handleAddCustomMission}
                    disabled={!customMission.trim()}
                    data-testid="button-add-mission"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Set
                  </Button>
                </div>
              </div>

              {mission && (
                <div className="bg-muted rounded-lg p-4 flex items-start justify-between gap-2">
                  <p className="text-sm flex-1">{mission}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMission("")}
                    data-testid="button-clear-mission"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {missionSuggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant={mission === suggestion ? "default" : "outline"}
                      className="cursor-pointer py-2 px-4 hover-elevate"
                      onClick={() => handleAddSuggestion("mission", suggestion)}
                      data-testid={`suggestion-mission-${index}`}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vision Section */}
          <Card data-testid="card-vision">
            <CardHeader>
              <CardTitle>Vision Statement</CardTitle>
              <CardDescription>What future do you aspire to create?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-vision">Current Vision</Label>
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
                    onClick={handleAddCustomVision}
                    disabled={!customVision.trim()}
                    data-testid="button-add-vision"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Set
                  </Button>
                </div>
              </div>

              {vision && (
                <div className="bg-muted rounded-lg p-4 flex items-start justify-between gap-2">
                  <p className="text-sm flex-1">{vision}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVision("")}
                    data-testid="button-clear-vision"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {visionSuggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant={vision === suggestion ? "default" : "outline"}
                      className="cursor-pointer py-2 px-4 hover-elevate"
                      onClick={() => handleAddSuggestion("vision", suggestion)}
                      data-testid={`suggestion-vision-${index}`}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
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
                          title="View tagged items"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenValueDialog(index)}
                          data-testid={`button-edit-value-${index}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveValue(index)}
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

          {/* Goals Section */}
          <Card data-testid="card-goals">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Annual Goals</CardTitle>
                <CardDescription>What are your key organizational objectives for this year?</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiGoalsSuggestionOpen(true)}
                data-testid="button-ai-goal-suggestions"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Suggestions
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-goal">Add Goal</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-goal"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="Enter an annual goal..."
                    onKeyPress={(e) => e.key === "Enter" && handleAddCustomGoal()}
                    data-testid="input-custom-goal"
                  />
                  <Button
                    onClick={handleAddCustomGoal}
                    disabled={!customGoal.trim()}
                    data-testid="button-add-goal"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {goals.length > 0 && (
                <div className="space-y-2">
                  {goals.map((goal, index) => (
                    <div
                      key={index}
                      className="bg-muted rounded-lg p-3 flex items-start justify-between gap-2"
                      data-testid={`goal-item-${index}`}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        <Badge variant="secondary" className="mt-0.5">{index + 1}</Badge>
                        <p className="text-sm">{goal}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGoal(goal)}
                        data-testid={`button-remove-goal-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Quick Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {goalSuggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant={goals.includes(suggestion) ? "default" : "outline"}
                      className="cursor-pointer py-2 px-4 hover-elevate"
                      onClick={() => handleAddSuggestion("goal", suggestion)}
                      data-testid={`suggestion-goal-${index}`}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button - Works across all tabs */}
      <div className="mt-6 flex justify-end">
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

      {/* AI Goals Suggestion Dialog */}
      <AIGoalsSuggestionDialog
        open={aiGoalsSuggestionOpen}
        onOpenChange={setAiGoalsSuggestionOpen}
        onAddGoal={(goalTitle) => {
          if (!goals.includes(goalTitle)) {
            setGoals(prev => [...prev, goalTitle]);
          }
        }}
      />
    </div>
  );
}
