import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, Rocket, FileText, Sparkles, Check, ChevronRight, Target, Flag, Lightbulb, CheckCircle2, Loader2, AlertCircle, X, Edit2, SkipForward, Info } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import type { LaunchpadSession, LaunchpadProposal, LaunchpadExistingData } from '@shared/schema';

type Step = 'upload' | 'analyzing' | 'review' | 'complete';

// Section approval state
interface SectionApprovals {
  mission: boolean;
  vision: boolean;
  values: boolean;
  goals: boolean;
  strategies: boolean;
  objectives: boolean;
  bigRocks: boolean;
}

export default function Launchpad() {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetQuarter, setTargetQuarter] = useState<string>("all");
  const [currentSession, setCurrentSession] = useState<LaunchpadSession | null>(null);
  const [editedProposal, setEditedProposal] = useState<LaunchpadProposal | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showBigRockQuarterDialog, setShowBigRockQuarterDialog] = useState(false);
  const [bigRockQuarter, setBigRockQuarter] = useState<string>("1");
  const [sectionApprovals, setSectionApprovals] = useState<SectionApprovals>({
    mission: true,
    vision: true,
    values: true,
    goals: true,
    strategies: true,
    objectives: true,
    bigRocks: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  
  // Get existing data from the session for comparison
  const existingData: LaunchpadExistingData | null = (currentSession as any)?.existingData || null;

  const { data: sessions, isLoading: sessionsLoading } = useQuery<LaunchpadSession[]>({
    queryKey: ['/api/launchpad/sessions'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('targetYear', targetYear.toString());
      if (targetQuarter !== "all") {
        formData.append('targetQuarter', targetQuarter);
      }
      
      // Include the current tenant ID header to ensure entities are created in the correct tenant
      const tenantId = localStorage.getItem("currentTenantId");
      const headers: Record<string, string> = {};
      if (tenantId) {
        headers["x-tenant-id"] = tenantId;
      }
      
      const response = await fetch('/api/launchpad/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (session: LaunchpadSession) => {
      setCurrentSession(session);
      setStep('analyzing');
      analyzeMutation.mutate(session.id);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('POST', `/api/launchpad/${sessionId}/analyze`);
      return response.json();
    },
    onSuccess: (session: LaunchpadSession) => {
      setCurrentSession(session);
      setEditedProposal(session.userEdits || session.aiProposal || null);
      // Restore approval states from session (default to true for new analysis)
      setSectionApprovals({
        mission: (session as any).approveMission ?? true,
        vision: (session as any).approveVision ?? true,
        values: (session as any).approveValues ?? true,
        goals: (session as any).approveGoals ?? true,
        strategies: (session as any).approveStrategies ?? true,
        objectives: (session as any).approveObjectives ?? true,
        bigRocks: (session as any).approveBigRocks ?? true,
      });
      setStep('review');
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/sessions'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error.message,
      });
      setStep('upload');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (overrideBigRockQuarter?: number) => {
      if (!currentSession) throw new Error('No session');
      
      if (editedProposal) {
        await apiRequest('PATCH', `/api/launchpad/${currentSession.id}`, { userEdits: editedProposal });
      }
      
      // Pass section approval flags to backend
      const body: any = {
        approveMission: sectionApprovals.mission,
        approveVision: sectionApprovals.vision,
        approveValues: sectionApprovals.values,
        approveGoals: sectionApprovals.goals,
        approveStrategies: sectionApprovals.strategies,
        approveObjectives: sectionApprovals.objectives,
        approveBigRocks: sectionApprovals.bigRocks,
      };
      if (overrideBigRockQuarter) {
        body.bigRockQuarter = overrideBigRockQuarter;
      }
      
      const response = await apiRequest('POST', `/api/launchpad/${currentSession.id}/approve`, body);
      return response.json();
    },
    onSuccess: (result) => {
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/foundations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] });
      
      const skippedCount = result.created?.skipped?.length || 0;
      const skippedText = skippedCount > 0 ? ` (${skippedCount} sections skipped)` : '';
      toast({
        title: 'Company OS updated!',
        description: `Created ${result.created.objectives} objectives, ${result.created.strategies} strategies, and ${result.created.goals} goals.${skippedText}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Creation failed',
        description: error.message,
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please select a PDF, Word document (.docx), or text file',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const resumeSession = (session: LaunchpadSession) => {
    setCurrentSession(session);
    setEditedProposal(session.userEdits || session.aiProposal || null);
    // Restore saved approval states from session
    setSectionApprovals({
      mission: (session as any).approveMission ?? true,
      vision: (session as any).approveVision ?? true,
      values: (session as any).approveValues ?? true,
      goals: (session as any).approveGoals ?? true,
      strategies: (session as any).approveStrategies ?? true,
      objectives: (session as any).approveObjectives ?? true,
      bigRocks: (session as any).approveBigRocks ?? true,
    });
    if (session.status === 'pending_review') {
      setStep('review');
    } else if (session.status === 'approved') {
      setStep('complete');
    } else if (session.status === 'analyzing') {
      setStep('analyzing');
    }
  };

  const startNew = () => {
    setStep('upload');
    setSelectedFile(null);
    setCurrentSession(null);
    // Reset approvals for new session
    setSectionApprovals({
      mission: true,
      vision: true,
      values: true,
      goals: true,
      strategies: true,
      objectives: true,
      bigRocks: true,
    });
    setEditedProposal(null);
  };

  // Persist approval changes to backend
  const updateApprovalState = async (field: keyof typeof sectionApprovals, checked: boolean) => {
    setSectionApprovals(prev => ({ ...prev, [field]: checked }));
    
    if (currentSession) {
      const fieldMap: Record<string, string> = {
        mission: 'approveMission',
        vision: 'approveVision',
        values: 'approveValues',
        goals: 'approveGoals',
        strategies: 'approveStrategies',
        objectives: 'approveObjectives',
        bigRocks: 'approveBigRocks',
      };
      try {
        await apiRequest('PATCH', `/api/launchpad/${currentSession.id}`, {
          [fieldMap[field]]: checked,
        });
      } catch (error) {
        console.error('Failed to persist approval state:', error);
      }
    }
  };

  const updateProposalField = (path: string[], value: any) => {
    if (!editedProposal) return;
    
    const updated = { ...editedProposal };
    let current: any = updated;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (Array.isArray(current[key])) {
        current[key] = [...current[key]];
        current = current[key];
      } else {
        current[key] = { ...current[key] };
        current = current[key];
      }
    }
    current[path[path.length - 1]] = value;
    setEditedProposal(updated);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Launchpad</h1>
          <p className="text-muted-foreground">Upload a document and let AI build your Company OS</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8">
        <StepIndicator step={1} current={step} label="Upload" completed={step !== 'upload'} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator step={2} current={step} label="Analyze" completed={step === 'review' || step === 'complete'} active={step === 'analyzing'} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator step={3} current={step} label="Review" completed={step === 'complete'} active={step === 'review'} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator step={4} current={step} label="Complete" active={step === 'complete'} />
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Your Document
              </CardTitle>
              <CardDescription>
                Upload a strategic plan, annual report, or business plan. Our AI will extract mission, vision, values, goals, strategies, and OKRs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {selectedFile ? (
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT (max 10MB)</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target-year">Target Year</Label>
                  <Select value={targetYear.toString()} onValueChange={(v) => setTargetYear(parseInt(v))}>
                    <SelectTrigger id="target-year" data-testid="select-target-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target-quarter">OKR Quarter (optional)</Label>
                  <Select value={targetQuarter} onValueChange={setTargetQuarter}>
                    <SelectTrigger id="target-quarter" data-testid="select-target-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Annual (all quarters)</SelectItem>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Leave as "Annual" for full-year strategic plans</p>
                </div>
              </div>

              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-analyze"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {sessions && sessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Previous Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sessions.slice(0, 5).map(session => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => resumeSession(session)}
                      data-testid={`session-${session.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{session.sourceDocumentName || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.targetYear}{session.targetQuarter ? ` Q${session.targetQuarter}` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        session.status === 'approved' ? 'default' :
                        session.status === 'pending_review' ? 'secondary' :
                        session.status === 'analyzing' ? 'outline' : 'destructive'
                      }>
                        {session.status === 'pending_review' ? 'Ready for Review' : session.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 'analyzing' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Analyzing Your Document</h2>
                <p className="text-muted-foreground">
                  AI is extracting organizational elements from your document...
                </p>
              </div>
              <Progress value={currentSession?.analysisProgress || 30} className="max-w-md mx-auto" />
              <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && editedProposal && (
        <div className="space-y-6">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              Review the AI-generated proposal below. Use the switches to approve or skip each section.
              {existingData && (existingData.mission || existingData.vision) && (
                <span className="block mt-1 text-xs">Existing data is shown for comparison. Skipped sections will keep your current data.</span>
              )}
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" defaultValue={['foundation', 'goals', 'strategies', 'objectives']} className="space-y-4">
            <AccordionItem value="foundation" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Flag className="h-4 w-4 text-primary" />
                  <span>Foundation</span>
                  <Badge variant="secondary" className="ml-2">
                    {(editedProposal.values?.length || 0)} values
                  </Badge>
                  {existingData?.mission && (
                    <Badge variant="outline" className="ml-auto mr-2 text-xs">Has existing data</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pt-4">
                {/* Mission Section */}
                {(editedProposal.mission || existingData?.mission) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Mission</Label>
                      {editedProposal.mission && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {sectionApprovals.mission ? 'Will update' : 'Keeping existing'}
                          </span>
                          <Switch
                            checked={sectionApprovals.mission}
                            onCheckedChange={(checked) => updateApprovalState('mission', checked)}
                            data-testid="switch-approve-mission"
                          />
                        </div>
                      )}
                    </div>
                    {existingData?.mission && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Current Mission:</p>
                        <p className="text-sm">{existingData.mission}</p>
                      </div>
                    )}
                    {editedProposal.mission && sectionApprovals.mission && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Proposed Mission:</p>
                        <Textarea
                          value={editedProposal.mission || ''}
                          onChange={(e) => updateProposalField(['mission'], e.target.value)}
                          className="mt-1"
                          data-testid="input-mission"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Vision Section */}
                {(editedProposal.vision || existingData?.vision) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Vision</Label>
                      {editedProposal.vision && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {sectionApprovals.vision ? 'Will update' : 'Keeping existing'}
                          </span>
                          <Switch
                            checked={sectionApprovals.vision}
                            onCheckedChange={(checked) => updateApprovalState('vision', checked)}
                            data-testid="switch-approve-vision"
                          />
                        </div>
                      )}
                    </div>
                    {existingData?.vision && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Current Vision:</p>
                        <p className="text-sm">{existingData.vision}</p>
                      </div>
                    )}
                    {editedProposal.vision && sectionApprovals.vision && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Proposed Vision:</p>
                        <Textarea
                          value={editedProposal.vision || ''}
                          onChange={(e) => updateProposalField(['vision'], e.target.value)}
                          className="mt-1"
                          data-testid="input-vision"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Values Section */}
                {(editedProposal.values?.length || existingData?.values?.length) ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Values ({editedProposal.values?.length || 0} proposed)</Label>
                      {editedProposal.values?.length ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {sectionApprovals.values ? 'Will update' : 'Keeping existing'}
                          </span>
                          <Switch
                            checked={sectionApprovals.values}
                            onCheckedChange={(checked) => updateApprovalState('values', checked)}
                            data-testid="switch-approve-values"
                          />
                        </div>
                      ) : null}
                    </div>
                    {existingData?.values && existingData.values.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Current Values ({existingData.values.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {existingData.values.map((v, i) => (
                            <Badge key={i} variant="secondary">{v.title}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {editedProposal.values && editedProposal.values.length > 0 && sectionApprovals.values && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-muted-foreground">Proposed Values:</p>
                        {editedProposal.values.map((value, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={value.title}
                              onChange={(e) => {
                                const newValues = [...(editedProposal.values || [])];
                                newValues[idx] = { ...newValues[idx], title: e.target.value };
                                setEditedProposal({ ...editedProposal, values: newValues });
                              }}
                              placeholder="Value title"
                              className="w-1/3"
                              data-testid={`input-value-title-${idx}`}
                            />
                            <Input
                              value={value.description}
                              onChange={(e) => {
                                const newValues = [...(editedProposal.values || [])];
                                newValues[idx] = { ...newValues[idx], description: e.target.value };
                                setEditedProposal({ ...editedProposal, values: newValues });
                              }}
                              placeholder="Description"
                              className="flex-1"
                              data-testid={`input-value-desc-${idx}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newValues = editedProposal.values?.filter((_, i) => i !== idx);
                                setEditedProposal({ ...editedProposal, values: newValues });
                              }}
                              data-testid={`button-remove-value-${idx}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="goals" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Annual Goals (Targets)</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.goals?.length || 0} proposed
                  </Badge>
                  {existingData?.annualGoals && existingData.annualGoals.length > 0 && (
                    <Badge variant="outline" className="ml-auto mr-2 text-xs">{existingData.annualGoals.length} existing</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Add new annual goals from the document</p>
                  {editedProposal.goals?.length ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sectionApprovals.goals ? 'Will add' : 'Skip adding'}
                      </span>
                      <Switch
                        checked={sectionApprovals.goals}
                        onCheckedChange={(checked) => updateApprovalState('goals', checked)}
                        data-testid="switch-approve-goals"
                      />
                    </div>
                  ) : null}
                </div>
                {existingData?.annualGoals && existingData.annualGoals.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Current Goals ({existingData.annualGoals.length}):</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {existingData.annualGoals.map((goal, i) => (
                        <li key={i}>{typeof goal === 'string' ? goal : goal.title} {typeof goal !== 'string' && goal.year ? `(${goal.year})` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sectionApprovals.goals && editedProposal.goals?.map((goal, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={goal.title}
                        onChange={(e) => {
                          const newGoals = [...(editedProposal.goals || [])];
                          newGoals[idx] = { ...newGoals[idx], title: e.target.value };
                          setEditedProposal({ ...editedProposal, goals: newGoals });
                        }}
                        className="font-medium flex-1"
                        data-testid={`input-goal-title-${idx}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newGoals = editedProposal.goals?.filter((_, i) => i !== idx);
                          setEditedProposal({ ...editedProposal, goals: newGoals });
                        }}
                        data-testid={`button-remove-goal-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={goal.description}
                      onChange={(e) => {
                        const newGoals = [...(editedProposal.goals || [])];
                        newGoals[idx] = { ...newGoals[idx], description: e.target.value };
                        setEditedProposal({ ...editedProposal, goals: newGoals });
                      }}
                      className="text-sm"
                      data-testid={`input-goal-desc-${idx}`}
                    />
                  </div>
                ))}
                {(!editedProposal.goals || editedProposal.goals.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">No new goals proposed from the document.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="strategies" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span>Strategies</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.strategies?.length || 0} proposed
                  </Badge>
                  {existingData?.strategies && existingData.strategies.length > 0 && (
                    <Badge variant="outline" className="ml-auto mr-2 text-xs">{existingData.strategies.length} existing</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Add new strategies from the document</p>
                  {editedProposal.strategies?.length ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sectionApprovals.strategies ? 'Will add' : 'Skip adding'}
                      </span>
                      <Switch
                        checked={sectionApprovals.strategies}
                        onCheckedChange={(checked) => updateApprovalState('strategies', checked)}
                        data-testid="switch-approve-strategies"
                      />
                    </div>
                  ) : null}
                </div>
                {existingData?.strategies && existingData.strategies.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Current Strategies ({existingData.strategies.length}):</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {existingData.strategies.map((s, i) => (
                        <li key={i}>{s.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sectionApprovals.strategies && editedProposal.strategies?.map((strategy, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={strategy.title}
                        onChange={(e) => {
                          const newStrategies = [...(editedProposal.strategies || [])];
                          newStrategies[idx] = { ...newStrategies[idx], title: e.target.value };
                          setEditedProposal({ ...editedProposal, strategies: newStrategies });
                        }}
                        className="font-medium flex-1"
                        data-testid={`input-strategy-title-${idx}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newStrategies = editedProposal.strategies?.filter((_, i) => i !== idx);
                          setEditedProposal({ ...editedProposal, strategies: newStrategies });
                        }}
                        data-testid={`button-remove-strategy-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={strategy.description}
                      onChange={(e) => {
                        const newStrategies = [...(editedProposal.strategies || [])];
                        newStrategies[idx] = { ...newStrategies[idx], description: e.target.value };
                        setEditedProposal({ ...editedProposal, strategies: newStrategies });
                      }}
                      className="text-sm"
                      data-testid={`input-strategy-desc-${idx}`}
                    />
                  </div>
                ))}
                {(!editedProposal.strategies || editedProposal.strategies.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">No new strategies proposed from the document.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="objectives" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Objectives & Key Results</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.objectives?.length || 0} proposed
                  </Badge>
                  {existingData?.objectives && existingData.objectives.length > 0 && (
                    <Badge variant="outline" className="ml-auto mr-2 text-xs">{existingData.objectives.length} existing</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Add new objectives from the document</p>
                  {editedProposal.objectives?.length ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sectionApprovals.objectives ? 'Will add' : 'Skip adding'}
                      </span>
                      <Switch
                        checked={sectionApprovals.objectives}
                        onCheckedChange={(checked) => updateApprovalState('objectives', checked)}
                        data-testid="switch-approve-objectives"
                      />
                    </div>
                  ) : null}
                </div>
                {existingData?.objectives && existingData.objectives.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Current Objectives ({existingData.objectives.length}):</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {existingData.objectives.map((o, i) => (
                        <li key={i}>{o.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sectionApprovals.objectives && editedProposal.objectives?.map((obj, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0">{obj.level}</Badge>
                      <Input
                        value={obj.title}
                        onChange={(e) => {
                          const newObjectives = [...(editedProposal.objectives || [])];
                          newObjectives[idx] = { ...newObjectives[idx], title: e.target.value };
                          setEditedProposal({ ...editedProposal, objectives: newObjectives });
                        }}
                        className="font-medium flex-1"
                        data-testid={`input-objective-title-${idx}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newObjectives = editedProposal.objectives?.filter((_, i) => i !== idx);
                          setEditedProposal({ ...editedProposal, objectives: newObjectives });
                        }}
                        data-testid={`button-remove-objective-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={obj.description}
                      onChange={(e) => {
                        const newObjectives = [...(editedProposal.objectives || [])];
                        newObjectives[idx] = { ...newObjectives[idx], description: e.target.value };
                        setEditedProposal({ ...editedProposal, objectives: newObjectives });
                      }}
                      className="text-sm"
                      data-testid={`input-objective-desc-${idx}`}
                    />
                    {obj.keyResults && obj.keyResults.length > 0 && (
                      <div className="pl-4 border-l-2 border-muted space-y-2">
                        <Label className="text-xs text-muted-foreground">Key Results</Label>
                        {obj.keyResults.map((kr, krIdx) => (
                          <div key={krIdx} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>{kr.title}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {kr.targetValue} {kr.unit}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bigRocks" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Big Rocks (Initiatives)</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal?.bigRocks?.length || 0} proposed
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Major quarterly initiatives from the document</p>
                  {editedProposal?.bigRocks?.length ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sectionApprovals.bigRocks ? 'Will add' : 'Skip adding'}
                      </span>
                      <Switch
                        checked={sectionApprovals.bigRocks}
                        onCheckedChange={(checked) => updateApprovalState('bigRocks', checked)}
                        data-testid="switch-approve-bigrocks"
                      />
                    </div>
                  ) : null}
                </div>
                {sectionApprovals.bigRocks && editedProposal?.bigRocks?.map((br, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={br.title}
                        onChange={(e) => {
                          const newBigRocks = [...(editedProposal.bigRocks || [])];
                          newBigRocks[idx] = { ...newBigRocks[idx], title: e.target.value };
                          setEditedProposal({ ...editedProposal, bigRocks: newBigRocks });
                        }}
                        className="font-medium flex-1"
                        data-testid={`input-bigrock-title-${idx}`}
                      />
                      <Badge variant="outline">{br.priority || 'P1'}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newBigRocks = editedProposal.bigRocks?.filter((_, i) => i !== idx);
                          setEditedProposal({ ...editedProposal, bigRocks: newBigRocks });
                        }}
                        data-testid={`button-remove-bigrock-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={br.description}
                      onChange={(e) => {
                        const newBigRocks = [...(editedProposal.bigRocks || [])];
                        newBigRocks[idx] = { ...newBigRocks[idx], description: e.target.value };
                        setEditedProposal({ ...editedProposal, bigRocks: newBigRocks });
                      }}
                      className="text-sm"
                      data-testid={`input-bigrock-desc-${idx}`}
                    />
                  </div>
                ))}
                {(!editedProposal?.bigRocks || editedProposal.bigRocks.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">No standalone big rocks proposed. Note: Big rocks attached to objectives are shown in the Objectives section above.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex gap-3">
            <Button variant="outline" onClick={startNew} data-testid="button-start-over">
              Start Over
            </Button>
            <Button 
              onClick={() => {
                // Check if this is an annual session with big rocks
                const hasBigRocks = editedProposal?.objectives?.some(obj => obj.bigRocks && obj.bigRocks.length > 0);
                const isAnnual = currentSession?.targetQuarter === null;
                
                if (isAnnual && hasBigRocks) {
                  // Ask which quarter to use for big rocks
                  setShowBigRockQuarterDialog(true);
                } else {
                  approveMutation.mutate(undefined);
                }
              }} 
              disabled={approveMutation.isPending}
              className="flex-1"
              size="lg"
              data-testid="button-create-company-os"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Company OS
                </>
              )}
            </Button>
          </div>

          <Dialog open={showBigRockQuarterDialog} onOpenChange={setShowBigRockQuarterDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Which quarter for Big Rocks?</DialogTitle>
                <DialogDescription>
                  You're creating annual objectives. Big rocks need to be assigned to a specific quarter.
                  Which quarter should the big rocks be placed in?
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={bigRockQuarter} onValueChange={setBigRockQuarter}>
                  <SelectTrigger data-testid="select-big-rock-quarter">
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBigRockQuarterDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    setShowBigRockQuarterDialog(false);
                    approveMutation.mutate(parseInt(bigRockQuarter));
                  }}
                  data-testid="button-confirm-big-rock-quarter"
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {step === 'complete' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Company OS Created!</h2>
                <p className="text-muted-foreground">
                  Your organizational structure has been set up. Explore your new foundation, strategies, and OKRs.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={startNew} data-testid="button-new-session">
                  Start Another
                </Button>
                <Button asChild data-testid="button-view-dashboard">
                  <a href="/dashboard">View Dashboard</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ step, current, label, completed, active }: { 
  step: number; 
  current: Step; 
  label: string; 
  completed?: boolean; 
  active?: boolean;
}) {
  const isActive = active || (
    (current === 'upload' && step === 1) ||
    (current === 'analyzing' && step === 2) ||
    (current === 'review' && step === 3) ||
    (current === 'complete' && step === 4)
  );
  
  return (
    <div className={`flex items-center gap-2 ${isActive ? 'text-primary' : completed ? 'text-green-600' : 'text-muted-foreground'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
        ${completed ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : 
          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {completed ? <Check className="h-3 w-3" /> : step}
      </div>
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </div>
  );
}
