import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ListTodo, CheckCircle, XCircle, RefreshCw, Link2, Unlink, Loader2 } from "lucide-react";

interface PlannerStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  scopes: string[];
}

export function PlannerConnectionCard() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<PlannerStatus>({
    queryKey: ["/auth/entra/planner/status"],
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
        const error = new Error(data.error || data.message || "Sync failed");
        (error as any).reconnectRequired = data.reconnectRequired;
        throw error;
      }
      return data;
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Planner synced", 
        description: `Synced ${data.planCount} plans, ${data.bucketCount} buckets, ${data.taskCount} tasks` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
    },
    onError: (error: any) => {
      if (error.reconnectRequired) {
        queryClient.invalidateQueries({ queryKey: ["/auth/entra/planner/status"] });
      }
      toast({ 
        title: "Sync failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/auth/entra/planner/disconnect");
    },
    onSuccess: () => {
      toast({ title: "Planner disconnected" });
      queryClient.invalidateQueries({ queryKey: ["/auth/entra/planner/status"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Disconnect failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleConnect = () => {
    window.location.href = "/auth/entra/planner/connect";
  };

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
            Connect Microsoft Planner to link tasks with your OKRs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Microsoft Planner integration requires Azure AD configuration. 
              Contact your administrator to enable this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Microsoft Planner Integration
            </CardTitle>
            <CardDescription>
              Connect Microsoft Planner to link tasks with your OKRs
            </CardDescription>
          </div>
          {status.connected ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status.connected ? (
          <div className="flex items-center gap-2">
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
            <Button
              variant="ghost"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-planner"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} data-testid="button-connect-planner">
            <Link2 className="h-4 w-4 mr-2" />
            Connect Microsoft Planner
          </Button>
        )}

        {status.connected && status.expiresAt && (
          <p className="text-xs text-muted-foreground mt-3">
            Token expires: {new Date(status.expiresAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
