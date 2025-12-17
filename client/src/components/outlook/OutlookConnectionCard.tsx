import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar, CheckCircle, XCircle, Link2, Unlink, Loader2 } from "lucide-react";

interface OutlookStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  scopes: string[];
}

export function OutlookConnectionCard() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<OutlookStatus>({
    queryKey: ["/auth/entra/outlook/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/auth/entra/outlook/disconnect");
    },
    onSuccess: () => {
      toast({ title: "Outlook Calendar disconnected" });
      queryClient.invalidateQueries({ queryKey: ["/auth/entra/outlook/status"] });
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
    window.location.href = "/auth/entra/outlook/connect";
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
            <Calendar className="h-5 w-5" />
            Outlook Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect Outlook Calendar to import meeting notes and sync events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Outlook Calendar integration requires Azure AD configuration. 
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
              <Calendar className="h-5 w-5" />
              Outlook Calendar Integration
            </CardTitle>
            <CardDescription>
              Connect Outlook Calendar to import meeting notes and sync events
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
              variant="ghost"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-outlook"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} data-testid="button-connect-outlook">
            <Link2 className="h-4 w-4 mr-2" />
            Connect Outlook Calendar
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
