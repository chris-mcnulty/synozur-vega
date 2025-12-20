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
import { Upload, Rocket, FileText, Sparkles, Check, ChevronRight, Target, Flag, Lightbulb, CheckCircle2, Loader2, AlertCircle, X, Edit2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import type { LaunchpadSession, LaunchpadProposal } from '@shared/schema';

type Step = 'upload' | 'analyzing' | 'review' | 'complete';

export default function Launchpad() {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetQuarter, setTargetQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
  const [currentSession, setCurrentSession] = useState<LaunchpadSession | null>(null);
  const [editedProposal, setEditedProposal] = useState<LaunchpadProposal | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: sessions, isLoading: sessionsLoading } = useQuery<LaunchpadSession[]>({
    queryKey: ['/api/launchpad/sessions'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('targetYear', targetYear.toString());
      formData.append('targetQuarter', targetQuarter.toString());
      
      const response = await fetch('/api/launchpad/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
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
    mutationFn: async () => {
      if (!currentSession) throw new Error('No session');
      
      if (editedProposal) {
        await apiRequest('PATCH', `/api/launchpad/${currentSession.id}`, { userEdits: editedProposal });
      }
      
      const response = await apiRequest('POST', `/api/launchpad/${currentSession.id}/approve`);
      return response.json();
    },
    onSuccess: (result) => {
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/foundations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] });
      toast({
        title: 'Company OS created!',
        description: `Created ${result.created.objectives} objectives, ${result.created.strategies} strategies, and ${result.created.goals} goals.`,
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
    setEditedProposal(null);
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
                  <Label htmlFor="target-quarter">Target Quarter</Label>
                  <Select value={targetQuarter.toString()} onValueChange={(v) => setTargetQuarter(parseInt(v))}>
                    <SelectTrigger id="target-quarter" data-testid="select-target-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(q => (
                        <SelectItem key={q} value={q.toString()}>Q{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                            {session.targetYear} Q{session.targetQuarter}
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
              Review the AI-generated proposal below. Click any section to edit before creating your Company OS.
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" defaultValue={['foundation', 'strategies', 'objectives']} className="space-y-4">
            <AccordionItem value="foundation" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <span>Foundation</span>
                  <Badge variant="secondary" className="ml-2">
                    {(editedProposal.values?.length || 0)} values
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label>Mission</Label>
                  <Textarea
                    value={editedProposal.mission || ''}
                    onChange={(e) => updateProposalField(['mission'], e.target.value)}
                    className="mt-1"
                    data-testid="input-mission"
                  />
                </div>
                <div>
                  <Label>Vision</Label>
                  <Textarea
                    value={editedProposal.vision || ''}
                    onChange={(e) => updateProposalField(['vision'], e.target.value)}
                    className="mt-1"
                    data-testid="input-vision"
                  />
                </div>
                <div>
                  <Label>Values ({editedProposal.values?.length || 0})</Label>
                  <div className="space-y-2 mt-2">
                    {editedProposal.values?.map((value, idx) => (
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
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="goals" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Annual Goals</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.goals?.length || 0}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                {editedProposal.goals?.map((goal, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <Input
                      value={goal.title}
                      onChange={(e) => {
                        const newGoals = [...(editedProposal.goals || [])];
                        newGoals[idx] = { ...newGoals[idx], title: e.target.value };
                        setEditedProposal({ ...editedProposal, goals: newGoals });
                      }}
                      className="font-medium"
                      data-testid={`input-goal-title-${idx}`}
                    />
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="strategies" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span>Strategies</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.strategies?.length || 0}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                {editedProposal.strategies?.map((strategy, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <Input
                      value={strategy.title}
                      onChange={(e) => {
                        const newStrategies = [...(editedProposal.strategies || [])];
                        newStrategies[idx] = { ...newStrategies[idx], title: e.target.value };
                        setEditedProposal({ ...editedProposal, strategies: newStrategies });
                      }}
                      className="font-medium"
                      data-testid={`input-strategy-title-${idx}`}
                    />
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="objectives" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Objectives & Key Results</span>
                  <Badge variant="secondary" className="ml-2">
                    {editedProposal.objectives?.length || 0} objectives
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {editedProposal.objectives?.map((obj, idx) => (
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
                        className="font-medium"
                        data-testid={`input-objective-title-${idx}`}
                      />
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
          </Accordion>

          <div className="flex gap-3">
            <Button variant="outline" onClick={startNew} data-testid="button-start-over">
              Start Over
            </Button>
            <Button 
              onClick={() => approveMutation.mutate()} 
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
