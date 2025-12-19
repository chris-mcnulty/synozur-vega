import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Camera, 
  FileText, 
  LayoutTemplate, 
  Plus, 
  Trash2, 
  Calendar, 
  Target, 
  CheckCircle2, 
  AlertTriangle,
  TrendingUp,
  Download,
  Eye,
  RefreshCw,
  Clock
} from "lucide-react";
import { format } from "date-fns";

const currentYear = new Date().getFullYear();
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);

const generateQuarterOptions = () => {
  const options = [];
  for (let year = currentYear + 1; year >= currentYear - 2; year--) {
    for (let q = 4; q >= 1; q--) {
      options.push({
        value: `${year}-Q${q}`,
        label: `Q${q} ${year}`,
        year,
        quarter: q,
      });
    }
  }
  return options;
};

const quarterOptions = generateQuarterOptions();

type Snapshot = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  reviewType: string;
  quarter: number | null;
  year: number | null;
  snapshotDate: string;
  overallProgress: number | null;
  objectivesCompleted: number | null;
  objectivesTotal: number | null;
  keyResultsCompleted: number | null;
  keyResultsTotal: number | null;
  status: string;
  createdAt: string;
};

type ReportInstance = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  reportType: string;
  periodType: string;
  quarter: number | null;
  year: number | null;
  status: string;
  generatedAt: string | null;
  reportData: any;
  createdAt: string;
};

type ReportSummary = {
  summary: {
    totalObjectives: number;
    completedObjectives: number;
    averageProgress: number;
    totalKeyResults: number;
    completedKeyResults: number;
    totalBigRocks: number;
    completedBigRocks: number;
  };
  objectivesByStatus: {
    onTrack: number;
    atRisk: number;
    behind: number;
  };
  quarter: number | null;
  year: number;
};

export default function Reporting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedQuarter, setSelectedQuarter] = useState(`${currentYear}-Q${getCurrentQuarter()}`);
  const [createSnapshotOpen, setCreateSnapshotOpen] = useState(false);
  const [generateReportOpen, setGenerateReportOpen] = useState(false);
  const [viewSnapshotOpen, setViewSnapshotOpen] = useState(false);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportInstance | null>(null);
  
  const parsedQuarter = quarterOptions.find(q => q.value === selectedQuarter);
  const quarter = parsedQuarter?.quarter || getCurrentQuarter();
  const year = parsedQuarter?.year || currentYear;

  // Helper to get tenant header for API calls
  const getTenantHeader = (): Record<string, string> => {
    const tenantId = localStorage.getItem("currentTenantId");
    return tenantId ? { "x-tenant-id": tenantId } : {};
  };

  // Fetch current summary
  const { data: summary, isLoading: summaryLoading } = useQuery<ReportSummary>({
    queryKey: ['/api/reporting/summary', String(quarter), String(year)],
    queryFn: async () => {
      const res = await fetch(`/api/reporting/summary?quarter=${quarter}&year=${year}`, { 
        credentials: 'include',
        headers: getTenantHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    },
  });

  // Fetch snapshots
  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery<Snapshot[]>({
    queryKey: ['/api/reporting/snapshots', String(year)],
    queryFn: async () => {
      const res = await fetch(`/api/reporting/snapshots?year=${year}`, { 
        credentials: 'include',
        headers: getTenantHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      return res.json();
    },
  });

  // Fetch generated reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportInstance[]>({
    queryKey: ['/api/reporting/reports', String(year)],
    queryFn: async () => {
      const res = await fetch(`/api/reporting/reports?year=${year}`, { 
        credentials: 'include',
        headers: getTenantHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
  });

  // Create snapshot mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; reviewType: string; quarter: number; year: number }) => {
      const res = await apiRequest('POST', '/api/reporting/snapshots', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snapshot created", description: "Current state has been captured successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/reporting/snapshots', String(year)] });
      setCreateSnapshotOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create snapshot", variant: "destructive" });
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (data: { snapshotId?: string; periodType: string; quarter: number; year: number; title: string }) => {
      const periodStart = new Date(data.year, (data.quarter - 1) * 3, 1);
      const periodEnd = new Date(data.year, data.quarter * 3, 0);
      const res = await apiRequest('POST', '/api/reporting/reports/generate', {
        ...data,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Report generated", description: "Your report has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/reporting/reports', String(year)] });
      setGenerateReportOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate report", variant: "destructive" });
    },
  });

  // Delete snapshot mutation
  const deleteSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/reporting/snapshots/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Snapshot deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/reporting/snapshots', String(year)] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete snapshot", variant: "destructive" });
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/reporting/reports/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Report deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/reporting/reports', String(year)] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete report", variant: "destructive" });
    },
  });

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return "text-green-600";
    if (progress >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      in_review: "outline",
      finalized: "default",
      completed: "default",
      pending: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Reporting</h1>
          <p className="text-muted-foreground mt-1">
            Capture snapshots, generate reports, and track progress over time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-[140px]" data-testid="select-quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarterOptions.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-2" data-testid="tab-snapshots">
            <Camera className="h-4 w-4" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2" data-testid="tab-reports">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-16 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Overall Progress</p>
                        <p className={`text-3xl font-bold ${getProgressColor(summary.summary.averageProgress)}`}>
                          {summary.summary.averageProgress}%
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <Progress value={summary.summary.averageProgress} className="mt-3" />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Objectives</p>
                        <p className="text-3xl font-bold">
                          {summary.summary.completedObjectives}/{summary.summary.totalObjectives}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {summary.summary.totalObjectives > 0 
                        ? Math.round((summary.summary.completedObjectives / summary.summary.totalObjectives) * 100)
                        : 0}% completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Key Results</p>
                        <p className="text-3xl font-bold">
                          {summary.summary.completedKeyResults}/{summary.summary.totalKeyResults}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {summary.summary.totalKeyResults > 0 
                        ? Math.round((summary.summary.completedKeyResults / summary.summary.totalKeyResults) * 100)
                        : 0}% completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Big Rocks</p>
                        <p className="text-3xl font-bold">
                          {summary.summary.completedBigRocks}/{summary.summary.totalBigRocks}
                        </p>
                      </div>
                      <Calendar className="h-8 w-8 text-purple-600" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {summary.summary.totalBigRocks > 0 
                        ? Math.round((summary.summary.completedBigRocks / summary.summary.totalBigRocks) * 100)
                        : 0}% completed
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.objectivesByStatus.onTrack}</p>
                      <p className="text-sm text-muted-foreground">On Track</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.objectivesByStatus.atRisk}</p>
                      <p className="text-sm text-muted-foreground">At Risk</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.objectivesByStatus.behind}</p>
                      <p className="text-sm text-muted-foreground">Behind</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>Capture the current state or generate a report</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Button onClick={() => setCreateSnapshotOpen(true)} data-testid="button-create-snapshot">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Snapshot
                  </Button>
                  <Button variant="outline" onClick={() => setGenerateReportOpen(true)} data-testid="button-generate-report">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No data available for this period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="snapshots" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Snapshots</h2>
              <p className="text-sm text-muted-foreground">Point-in-time captures of your OKR state</p>
            </div>
            <Button onClick={() => setCreateSnapshotOpen(true)} data-testid="button-create-snapshot-tab">
              <Plus className="h-4 w-4 mr-2" />
              Create Snapshot
            </Button>
          </div>

          {snapshotsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-16 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : snapshots.length > 0 ? (
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <Card key={snapshot.id} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Camera className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{snapshot.title}</h3>
                            {getStatusBadge(snapshot.status)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(snapshot.snapshotDate), 'MMM d, yyyy h:mm a')}
                            </span>
                            <span>
                              {snapshot.objectivesCompleted}/{snapshot.objectivesTotal} objectives
                            </span>
                            <span className={getProgressColor(snapshot.overallProgress || 0)}>
                              {snapshot.overallProgress}% progress
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedSnapshot(snapshot);
                            setViewSnapshotOpen(true);
                          }}
                          data-testid={`button-view-snapshot-${snapshot.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this snapshot?')) {
                              deleteSnapshotMutation.mutate(snapshot.id);
                            }
                          }}
                          data-testid={`button-delete-snapshot-${snapshot.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No snapshots yet</p>
                <Button onClick={() => setCreateSnapshotOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Snapshot
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Generated Reports</h2>
              <p className="text-sm text-muted-foreground">View and manage your generated reports</p>
            </div>
            <Button onClick={() => setGenerateReportOpen(true)} data-testid="button-generate-report-tab">
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>

          {reportsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-16 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{report.title}</h3>
                            <Badge variant="outline">{report.reportType.replace('_', ' ')}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {report.generatedAt 
                                ? format(new Date(report.generatedAt), 'MMM d, yyyy h:mm a')
                                : 'Pending'
                              }
                            </span>
                            {report.quarter && (
                              <span>Q{report.quarter} {report.year}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedReport(report);
                            setViewReportOpen(true);
                          }}
                          data-testid={`button-view-report-${report.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this report?')) {
                              deleteReportMutation.mutate(report.id);
                            }
                          }}
                          data-testid={`button-delete-report-${report.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No reports generated yet</p>
                <Button onClick={() => setGenerateReportOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Your First Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Snapshot Dialog */}
      <Dialog open={createSnapshotOpen} onOpenChange={setCreateSnapshotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Capture the current state of your OKRs and Big Rocks for Q{quarter} {year}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createSnapshotMutation.mutate({
                title: formData.get('title') as string,
                description: formData.get('description') as string || undefined,
                reviewType: formData.get('reviewType') as string || 'quarterly',
                quarter,
                year,
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={`Q${quarter} ${year} Review Snapshot`}
                  required
                  data-testid="input-snapshot-title"
                />
              </div>
              <div>
                <Label htmlFor="reviewType">Review Type</Label>
                <Select name="reviewType" defaultValue="quarterly">
                  <SelectTrigger data-testid="select-review-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Notes about this snapshot..."
                  data-testid="input-snapshot-description"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setCreateSnapshotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSnapshotMutation.isPending} data-testid="button-submit-snapshot">
                {createSnapshotMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Create Snapshot
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={generateReportOpen} onOpenChange={setGenerateReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Generate a report from current state or a previous snapshot
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              generateReportMutation.mutate({
                title: formData.get('title') as string,
                snapshotId: formData.get('snapshotId') as string || undefined,
                periodType: formData.get('periodType') as string || 'quarter',
                quarter,
                year,
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="reportTitle">Report Title</Label>
                <Input
                  id="reportTitle"
                  name="title"
                  defaultValue={`Q${quarter} ${year} Progress Report`}
                  required
                  data-testid="input-report-title"
                />
              </div>
              <div>
                <Label htmlFor="periodType">Report Type</Label>
                <Select name="periodType" defaultValue="quarter">
                  <SelectTrigger data-testid="select-period-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly Status</SelectItem>
                    <SelectItem value="month">Monthly Report</SelectItem>
                    <SelectItem value="quarter">Quarterly Business Review</SelectItem>
                    <SelectItem value="year">Annual Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {snapshots.length > 0 && (
                <div>
                  <Label htmlFor="snapshotId">Use Snapshot (optional)</Label>
                  <Select name="snapshotId" defaultValue="">
                    <SelectTrigger data-testid="select-snapshot">
                      <SelectValue placeholder="Use current state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Use current state</SelectItem>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title} - {format(new Date(s.snapshotDate), 'MMM d')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setGenerateReportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateReportMutation.isPending} data-testid="button-submit-report">
                {generateReportMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Snapshot Dialog */}
      <Dialog open={viewSnapshotOpen} onOpenChange={setViewSnapshotOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSnapshot?.title}</DialogTitle>
            <DialogDescription>
              Snapshot captured on {selectedSnapshot && format(new Date(selectedSnapshot.snapshotDate), 'MMMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Overall Progress</p>
                    <p className={`text-2xl font-bold ${getProgressColor(selectedSnapshot.overallProgress || 0)}`}>
                      {selectedSnapshot.overallProgress}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Objectives Completed</p>
                    <p className="text-2xl font-bold">
                      {selectedSnapshot.objectivesCompleted}/{selectedSnapshot.objectivesTotal}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Key Results Completed</p>
                    <p className="text-2xl font-bold">
                      {selectedSnapshot.keyResultsCompleted}/{selectedSnapshot.keyResultsTotal}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedSnapshot.status)}</div>
                  </CardContent>
                </Card>
              </div>
              {selectedSnapshot.description && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-muted-foreground">{selectedSnapshot.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Report Dialog */}
      <Dialog open={viewReportOpen} onOpenChange={setViewReportOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>
              Generated on {selectedReport?.generatedAt && format(new Date(selectedReport.generatedAt), 'MMMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          {selectedReport?.reportData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Objectives</p>
                    <p className="text-xl font-bold">
                      {selectedReport.reportData.summary?.completedObjectives || 0}/
                      {selectedReport.reportData.summary?.totalObjectives || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Key Results</p>
                    <p className="text-xl font-bold">
                      {selectedReport.reportData.summary?.completedKeyResults || 0}/
                      {selectedReport.reportData.summary?.totalKeyResults || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Big Rocks</p>
                    <p className="text-xl font-bold">
                      {selectedReport.reportData.summary?.completedBigRocks || 0}/
                      {selectedReport.reportData.summary?.totalBigRocks || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className={`text-xl font-bold ${getProgressColor(selectedReport.reportData.summary?.averageProgress || 0)}`}>
                      {selectedReport.reportData.summary?.averageProgress || 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {selectedReport.reportData.objectives?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Objectives Summary</h4>
                  <div className="space-y-2">
                    {selectedReport.reportData.objectives.slice(0, 5).map((obj: any) => (
                      <div key={obj.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="font-medium">{obj.title}</span>
                        <div className="flex items-center gap-3">
                          <Progress value={obj.progress || 0} className="w-24" />
                          <span className={`text-sm ${getProgressColor(obj.progress || 0)}`}>
                            {obj.progress || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedReport.reportData.objectives.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{selectedReport.reportData.objectives.length - 5} more objectives
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
