import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Settings2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Unlink
} from "lucide-react";
import plannerIcon from "@assets/IMG_6924_1765505101956.png";

interface PlannerPlan {
  id: string;
  title: string;
  graphPlanId: string;
}

interface PlannerBucket {
  id: string;
  name: string;
  planId: string;
}

interface PlannerMappingProgress {
  mapped: boolean;
  planId?: string;
  planTitle?: string;
  bucketId?: string | null;
  bucketName?: string | null;
  syncEnabled?: boolean;
  lastSyncAt?: string | null;
  syncError?: string | null;
  percentage?: number;
  totalTasks?: number;
  completedTasks?: number;
}

interface PlannerProgressMappingProps {
  entityType: "keyresult" | "bigrock";
  entityId: string;
  entityTitle: string;
  onProgressUpdate?: (progress: number) => void;
}

export function PlannerProgressMapping({ 
  entityType, 
  entityId, 
  entityTitle,
  onProgressUpdate 
}: PlannerProgressMappingProps) {
  const { toast } = useToast();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedBucketId, setSelectedBucketId] = useState<string>("");
  const [syncEnabled, setSyncEnabled] = useState(false);

  const progressEndpoint = `/api/planner/mapping/${entityType}/${entityId}/progress`;
  const mappingEndpoint = `/api/planner/mapping/${entityType}/${entityId}`;
  const syncEndpoint = `/api/planner/mapping/${entityType}/${entityId}/sync`;

  const { data: plannerStatus } = useQuery<{
    connected: boolean;
    planCount: number;
    taskCount: number;
  }>({
    queryKey: ["/api/planner/status"],
  });

  const { data: mappingProgress, isLoading: progressLoading, refetch: refetchProgress } = useQuery<PlannerMappingProgress>({
    queryKey: [progressEndpoint],
    enabled: !!plannerStatus?.connected,
  });

  const { data: plans = [] } = useQuery<PlannerPlan[]>({
    queryKey: ["/api/planner/plans"],
    enabled: plannerStatus?.connected && configDialogOpen,
  });

  const { data: buckets = [] } = useQuery<PlannerBucket[]>({
    queryKey: ["/api/planner/plans", selectedPlanId, "buckets"],
    enabled: !!selectedPlanId && configDialogOpen,
  });

  useEffect(() => {
    if (mappingProgress?.mapped && configDialogOpen) {
      setSelectedPlanId(mappingProgress.planId || "");
      setSelectedBucketId(mappingProgress.bucketId || "");
      setSyncEnabled(mappingProgress.syncEnabled || false);
    }
  }, [mappingProgress, configDialogOpen]);

  const saveMappingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", mappingEndpoint, {
        plannerPlanId: selectedPlanId || null,
        plannerBucketId: selectedBucketId || null,
        plannerSyncEnabled: syncEnabled,
      });
    },
    onSuccess: () => {
      toast({ title: "Planner mapping saved" });
      queryClient.invalidateQueries({ queryKey: [progressEndpoint] });
      setConfigDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save mapping", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const syncProgressMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", syncEndpoint);
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Progress synced", 
        description: `${data.completedTasks}/${data.totalTasks} tasks completed` 
      });
      queryClient.invalidateQueries({ queryKey: [progressEndpoint] });
      if (onProgressUpdate && data.progress !== undefined) {
        onProgressUpdate(data.progress);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync failed", 
        description: error.message,
        variant: "destructive" 
      });
      refetchProgress();
    },
  });

  const removeMappingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", mappingEndpoint, {
        plannerPlanId: null,
        plannerBucketId: null,
        plannerSyncEnabled: false,
      });
    },
    onSuccess: () => {
      toast({ title: "Planner mapping removed" });
      queryClient.invalidateQueries({ queryKey: [progressEndpoint] });
      setSelectedPlanId("");
      setSelectedBucketId("");
      setSyncEnabled(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to remove mapping", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  if (!plannerStatus?.connected) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <img src={plannerIcon} alt="Microsoft Planner" className="h-4 w-4 rounded-sm" data-testid="img-planner-logo" />
              Planner Progress
            </CardTitle>
            <div className="flex gap-1">
              {mappingProgress?.mapped && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncProgressMutation.mutate()}
                  disabled={syncProgressMutation.isPending}
                  data-testid="button-sync-planner-progress"
                >
                  <RefreshCw className={`h-4 w-4 ${syncProgressMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfigDialogOpen(true)}
                data-testid="button-configure-planner-mapping"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {progressLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : mappingProgress?.mapped ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {mappingProgress.planTitle}
                  {mappingProgress.bucketName && ` → ${mappingProgress.bucketName}`}
                </span>
                {mappingProgress.syncEnabled && (
                  <Badge variant="outline" className="text-xs">Auto-sync</Badge>
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{mappingProgress.completedTasks}/{mappingProgress.totalTasks} tasks</span>
                  <span className="font-medium">{mappingProgress.percentage?.toFixed(1)}%</span>
                </div>
                <Progress value={mappingProgress.percentage || 0} className="h-2" />
              </div>

              {mappingProgress.syncError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {mappingProgress.syncError}
                  </AlertDescription>
                </Alert>
              )}

              {mappingProgress.lastSyncAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last synced: {new Date(mappingProgress.lastSyncAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground mb-2">
                Map to a Planner plan to auto-calculate progress
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfigDialogOpen(true)}
                data-testid="button-setup-planner-mapping"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configure Mapping
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={plannerIcon} alt="Microsoft Planner" className="h-5 w-5 rounded-sm" />
              Configure Planner Progress Mapping
            </DialogTitle>
            <DialogDescription>
              Map this {entityType === "keyresult" ? "Key Result" : "Big Rock"} to a Microsoft Planner plan or bucket 
              to automatically calculate progress from task completion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={(value) => {
                setSelectedPlanId(value);
                setSelectedBucketId("");
              }}>
                <SelectTrigger data-testid="select-planner-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlanId && (
              <div className="space-y-2">
                <Label>Bucket (optional)</Label>
                <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                  <SelectTrigger data-testid="select-planner-bucket">
                    <SelectValue placeholder="All tasks in plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tasks in plan</SelectItem>
                    {buckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave empty to include all tasks in the plan, or select a specific bucket
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-sync progress</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically update progress when viewing
                </p>
              </div>
              <Switch
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
                data-testid="switch-auto-sync"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            {mappingProgress?.mapped && (
              <Button
                variant="outline"
                onClick={() => {
                  removeMappingMutation.mutate();
                  setConfigDialogOpen(false);
                }}
                disabled={removeMappingMutation.isPending}
                data-testid="button-remove-mapping"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Remove Mapping
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMappingMutation.mutate()}
                disabled={!selectedPlanId || saveMappingMutation.isPending}
                data-testid="button-save-mapping"
              >
                {saveMappingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Mapping
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
