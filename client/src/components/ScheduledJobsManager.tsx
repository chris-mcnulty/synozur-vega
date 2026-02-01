import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, Settings2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ScheduledJob = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  scheduleExpression: string;
  intervalMs: number | null;
  status: string;
  tenantId: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  config: any;
  createdAt: string;
  updatedAt: string;
};

type JobRun = {
  id: string;
  jobId: string;
  jobName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  triggeredBy: string;
  triggeredByUserId: string | null;
  summary: string | null;
  details: any;
  errorMessage: string | null;
  errorStack: string | null;
};

function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Active</Badge>;
    case 'paused':
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Paused</Badge>;
    case 'disabled':
      return <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">Disabled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case 'success':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
    case 'failed':
      return <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case 'skipped':
      return <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">Skipped</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function CategoryBadge({ category }: { category: string }) {
  switch (category) {
    case 'notification':
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Notification</Badge>;
    case 'sync':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Sync</Badge>;
    case 'maintenance':
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Maintenance</Badge>;
    case 'system':
      return <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30">System</Badge>;
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const SCHEDULE_PRESETS = [
  { label: 'Every minute', value: 'every-minute', schedule: 'Every minute', intervalMs: 60000 },
  { label: 'Every 5 minutes', value: 'every-5-min', schedule: 'Every 5 minutes', intervalMs: 300000 },
  { label: 'Every 15 minutes', value: 'every-15-min', schedule: 'Every 15 minutes', intervalMs: 900000 },
  { label: 'Every 30 minutes', value: 'every-30-min', schedule: 'Every 30 minutes', intervalMs: 1800000 },
  { label: 'Hourly', value: 'hourly', schedule: 'Hourly', intervalMs: 3600000 },
  { label: 'Every 2 hours', value: 'every-2-hours', schedule: 'Every 2 hours', intervalMs: 7200000 },
  { label: 'Every 4 hours', value: 'every-4-hours', schedule: 'Every 4 hours', intervalMs: 14400000 },
  { label: 'Every 6 hours', value: 'every-6-hours', schedule: 'Every 6 hours', intervalMs: 21600000 },
  { label: 'Every 12 hours', value: 'every-12-hours', schedule: 'Every 12 hours', intervalMs: 43200000 },
  { label: 'Daily', value: 'daily', schedule: 'Daily', intervalMs: 86400000 },
];

function JobRow({ job, onRun, onPause, onResume, onEdit, isRunning, canControlJobs }: { 
  job: ScheduledJob; 
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onEdit: () => void;
  isRunning: boolean;
  canControlJobs: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: runs = [] } = useQuery<JobRun[]>({
    queryKey: ['/api/jobs', job.id, 'runs'],
    enabled: isOpen,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover-elevate">
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto" data-testid={`toggle-job-${job.name}`}>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium" data-testid={`job-name-${job.name}`}>{job.displayName}</div>
            <div className="text-sm text-muted-foreground">{job.description}</div>
          </div>
        </TableCell>
        <TableCell><CategoryBadge category={job.category} /></TableCell>
        <TableCell><JobStatusBadge status={job.status} /></TableCell>
        <TableCell className="text-sm text-muted-foreground">{job.scheduleExpression}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {job.lastRunAt ? formatDistanceToNow(new Date(job.lastRunAt), { addSuffix: true }) : 'Never'}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {job.nextRunAt ? formatDistanceToNow(new Date(job.nextRunAt), { addSuffix: true }) : '-'}
        </TableCell>
        <TableCell>
          {canControlJobs ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                title="Edit schedule"
                data-testid={`edit-job-${job.name}`}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRun}
                disabled={isRunning}
                title="Run now"
                data-testid={`run-job-${job.name}`}
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
              {job.status === 'active' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPause}
                  title="Pause"
                  data-testid={`pause-job-${job.name}`}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onResume}
                  title="Resume"
                  data-testid={`resume-job-${job.name}`}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">View only</span>
          )}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-0">
            <div className="p-4">
              <h4 className="text-sm font-medium mb-2">Recent Runs</h4>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No run history available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.slice(0, 10).map((run) => (
                      <TableRow key={run.id}>
                        <TableCell><RunStatusBadge status={run.status} /></TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(run.startedAt), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell className="text-sm">{formatDuration(run.durationMs)}</TableCell>
                        <TableCell className="text-sm capitalize">{run.triggeredBy}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate" title={run.summary || undefined}>
                          {run.summary || '-'}
                          {run.errorMessage && (
                            <span className="text-red-500 block text-xs">{run.errorMessage}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ScheduledJobsManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');

  // Only vega_admin can control jobs (run/pause/resume)
  const canControlJobs = user?.role === 'vega_admin';

  const { data: jobs = [], isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: recentRuns = [] } = useQuery<JobRun[]>({
    queryKey: ['/api/jobs/runs/recent'],
  });

  const runJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setRunningJobId(jobId);
      return await apiRequest('POST', `/api/jobs/${jobId}/run`);
    },
    onSuccess: (data, jobId) => {
      toast({ title: "Job triggered", description: "The job is running..." });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/runs/recent'] });
      setRunningJobId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to run job", description: error.message, variant: "destructive" });
      setRunningJobId(null);
    },
  });

  const pauseJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/pause`);
    },
    onSuccess: () => {
      toast({ title: "Job paused" });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to pause job", description: error.message, variant: "destructive" });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/resume`);
    },
    onSuccess: () => {
      toast({ title: "Job resumed" });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to resume job", description: error.message, variant: "destructive" });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ jobId, schedule, intervalMs }: { jobId: string; schedule: string; intervalMs: number }) => {
      return await apiRequest('PATCH', `/api/jobs/${jobId}`, { schedule, intervalMs });
    },
    onSuccess: () => {
      toast({ title: "Schedule updated", description: "The job schedule has been updated." });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setEditingJob(null);
      setSelectedSchedule('');
    },
    onError: (error: any) => {
      toast({ title: "Failed to update schedule", description: error.message, variant: "destructive" });
    },
  });

  const handleEditSchedule = (job: ScheduledJob) => {
    setEditingJob(job);
    // Find matching preset or default to daily
    const preset = SCHEDULE_PRESETS.find(p => p.intervalMs === job.intervalMs);
    setSelectedSchedule(preset?.value || 'daily');
  };

  const handleSaveSchedule = () => {
    if (!editingJob || !selectedSchedule) return;
    const preset = SCHEDULE_PRESETS.find(p => p.value === selectedSchedule);
    if (!preset) return;
    updateScheduleMutation.mutate({
      jobId: editingJob.id,
      schedule: preset.schedule,
      intervalMs: preset.intervalMs,
    });
  };

  const successfulRuns = recentRuns.filter(r => r.status === 'success').length;
  const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
  const activeJobs = jobs.filter(j => j.status === 'active').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Jobs</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-total-jobs">{jobs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Jobs</CardDescription>
            <CardTitle className="text-2xl text-green-600" data-testid="stat-active-jobs">{activeJobs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful Runs (24h)</CardDescription>
            <CardTitle className="text-2xl text-green-600" data-testid="stat-successful-runs">{successfulRuns}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed Runs (24h)</CardDescription>
            <CardTitle className="text-2xl text-red-600" data-testid="stat-failed-runs">{failedRuns}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs" data-testid="tab-scheduled-jobs">Scheduled Jobs</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-run-history">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduled Jobs
              </CardTitle>
              <CardDescription>
                View and manage all background scheduled jobs. Click on a job to see its run history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      onRun={() => runJobMutation.mutate(job.id)}
                      onPause={() => pauseJobMutation.mutate(job.id)}
                      onResume={() => resumeJobMutation.mutate(job.id)}
                      onEdit={() => handleEditSchedule(job)}
                      isRunning={runningJobId === job.id}
                      canControlJobs={canControlJobs}
                    />
                  ))}
                  {jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No scheduled jobs registered yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Recent Run History
              </CardTitle>
              <CardDescription>
                View the most recent job executions across all scheduled jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Triggered By</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.jobName}</TableCell>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(run.startedAt), 'MMM d, h:mm:ss a')}
                      </TableCell>
                      <TableCell className="text-sm">{formatDuration(run.durationMs)}</TableCell>
                      <TableCell className="text-sm capitalize">{run.triggeredBy}</TableCell>
                      <TableCell className="text-sm max-w-md">
                        {run.summary || '-'}
                        {run.errorMessage && (
                          <div className="text-red-500 text-xs mt-1 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="break-words">{run.errorMessage}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No job runs recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job Schedule</DialogTitle>
            <DialogDescription>
              Change how often "{editingJob?.displayName}" runs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule Frequency</Label>
              <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger id="schedule" data-testid="select-schedule">
                  <SelectValue placeholder="Select a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedSchedule && (
              <p className="text-sm text-muted-foreground">
                This job will run {SCHEDULE_PRESETS.find(p => p.value === selectedSchedule)?.label.toLowerCase()}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSchedule}
              disabled={updateScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {updateScheduleMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Save Schedule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
