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
import { Shield, BookOpen, Save, RotateCcw } from "lucide-react";

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

  const userRole = user?.role;
  const hasAccess = userRole === 'vega_admin' || userRole === 'global_admin';

  const { data: systemVocabulary, isLoading } = useQuery<VocabularyTerms>({
    queryKey: ["/api/vocabulary/system"],
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
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            System Administration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage system-wide settings for all organizations
          </p>
        </div>
      </div>

      <Tabs defaultValue="vocabulary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vocabulary" className="flex items-center gap-2" data-testid="tab-vocabulary">
            <BookOpen className="h-4 w-4" />
            Vocabulary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vocabulary" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Master Vocabulary Settings</CardTitle>
                  <CardDescription>
                    Define the default terminology used across all organizations. 
                    Individual organizations can override these settings.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    disabled={!hasChanges}
                    data-testid="button-reset-vocabulary"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button 
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
      </Tabs>
    </div>
  );
}
