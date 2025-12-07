import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ListTodo, Link2, Unlink, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

interface PlannerTask {
  id: string;
  planId: string;
  bucketId: string | null;
  title: string;
  percentComplete: number;
  priority: number;
  startDateTime: string | null;
  dueDateTime: string | null;
  completedDateTime: string | null;
  graphTaskId: string;
}

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

interface PlannerTaskLinkPanelProps {
  entityType: "objective" | "bigrock";
  entityId: string;
  entityTitle: string;
}

function getTaskStatusBadge(percentComplete: number) {
  if (percentComplete === 100) {
    return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
  } else if (percentComplete > 0) {
    return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>;
  }
  return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Not Started</Badge>;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No date";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Invalid date";
  }
}

export function PlannerTaskLinkPanel({ entityType, entityId, entityTitle }: PlannerTaskLinkPanelProps) {
  const { toast } = useToast();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedBucketId, setSelectedBucketId] = useState<string>("");

  const apiEndpoint = entityType === "objective" 
    ? `/api/planner/objectives/${entityId}/tasks`
    : `/api/planner/bigrocks/${entityId}/tasks`;

  const linkEndpoint = entityType === "objective"
    ? `/api/planner/link/objective/${entityId}/task`
    : `/api/planner/link/bigrock/${entityId}/task`;

  const { data: linkedTasks = [], isLoading: tasksLoading } = useQuery<PlannerTask[]>({
    queryKey: [apiEndpoint],
  });

  const { data: plannerStatus } = useQuery<{
    connected: boolean;
    planCount: number;
    taskCount: number;
  }>({
    queryKey: ["/api/planner/status"],
  });

  const { data: plans = [] } = useQuery<PlannerPlan[]>({
    queryKey: ["/api/planner/plans"],
    enabled: plannerStatus?.connected && linkDialogOpen,
  });

  const { data: buckets = [] } = useQuery<PlannerBucket[]>({
    queryKey: ["/api/planner/plans", selectedPlanId, "buckets"],
    enabled: !!selectedPlanId && linkDialogOpen,
  });

  const { data: availableTasks = [] } = useQuery<PlannerTask[]>({
    queryKey: ["/api/planner/buckets", selectedBucketId, "tasks"],
    enabled: !!selectedBucketId && linkDialogOpen,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/planner/sync");
    },
    onSuccess: () => {
      toast({ title: "Planner data synced successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `${linkEndpoint}/${taskId}`);
    },
    onSuccess: () => {
      toast({ title: "Task linked successfully" });
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setLinkDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to link task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `${linkEndpoint}/${taskId}`);
    },
    onSuccess: () => {
      toast({ title: "Task unlinked successfully" });
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to unlink task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  if (!plannerStatus?.connected) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Microsoft Planner Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connect Microsoft Planner in your account settings to link tasks.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Microsoft Planner Tasks
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-planner"
              >
                <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLinkDialogOpen(true)}
                data-testid="button-link-task"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : linkedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No Planner tasks linked yet
            </p>
          ) : (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-md border hover-elevate"
                  data-testid={`linked-task-${task.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{task.title}</span>
                      {getTaskStatusBadge(task.percentComplete)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={task.percentComplete} className="h-1 flex-1" />
                      <span className="text-xs text-muted-foreground">{task.percentComplete}%</span>
                    </div>
                    {task.dueDateTime && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Due: {formatDate(task.dueDateTime)}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => unlinkMutation.mutate(task.id)}
                    disabled={unlinkMutation.isPending}
                    data-testid={`button-unlink-task-${task.id}`}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Planner Task</DialogTitle>
            <DialogDescription>
              Select a Planner task to link to "{entityTitle}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Plan</label>
              <Select value={selectedPlanId} onValueChange={(v) => {
                setSelectedPlanId(v);
                setSelectedBucketId("");
              }}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Choose a plan..." />
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
                <label className="text-sm font-medium">Select Bucket</label>
                <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                  <SelectTrigger data-testid="select-bucket">
                    <SelectValue placeholder="Choose a bucket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {buckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedBucketId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Task</label>
                <ScrollArea className="h-[200px] border rounded-md">
                  {availableTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tasks in this bucket
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {availableTasks.map((task) => {
                        const isAlreadyLinked = linkedTasks.some(t => t.id === task.id);
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${
                              isAlreadyLinked ? "opacity-50" : "hover-elevate"
                            }`}
                            onClick={() => !isAlreadyLinked && linkMutation.mutate(task.id)}
                            data-testid={`task-option-${task.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{task.title}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {getTaskStatusBadge(task.percentComplete)}
                                {task.dueDateTime && (
                                  <span className="text-xs text-muted-foreground">
                                    Due: {formatDate(task.dueDateTime)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isAlreadyLinked && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {linkMutation.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
