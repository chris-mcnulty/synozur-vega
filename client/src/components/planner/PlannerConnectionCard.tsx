import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ListTodo, CheckCircle, XCircle, RefreshCw, Loader2, Settings } from "lucide-react";

interface PlannerStatus {
  configured: boolean;
  connected: boolean;
  planCount: number;
  taskCount: number;
}

export function PlannerConnectionCard() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<PlannerStatus>({
    queryKey: ["/api/planner/status"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const tenantId = localStorage.getItem("currentTenantId");
      const res = await fetch("/api/planner/sync", {
        method: "POST",
        credentials: "include",
        headers: tenantId ? { "x-tenant-id": tenantId } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Sync failed");
      }
      return data;
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Planner synced", 
        description: `Synced ${data.planCount} plans, ${data.bucketCount} buckets, ${data.taskCount} tasks` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planner/status"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Microsoft Planner Integration
          </CardTitle>
          <CardDescription>
            Sync Microsoft Planner tasks with your OKRs and Big Rocks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Microsoft Planner integration requires Azure AD app registration credentials.
              Set PLANNER_TENANT_ID, PLANNER_CLIENT_ID, and PLANNER_CLIENT_SECRET environment 
              variables to enable this integration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Microsoft Planner Integration
            </CardTitle>
            <CardDescription>
              Sync Microsoft Planner tasks with your OKRs and Big Rocks
            </CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Configured
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-planner-data"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Planner Data
          </Button>
        </div>

        {status.planCount > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {status.planCount} plans, {status.taskCount} tasks synced
          </p>
        )}
      </CardContent>
    </Card>
  );
}
