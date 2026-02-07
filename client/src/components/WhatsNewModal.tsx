import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

interface WhatsNewData {
  show: boolean;
  version?: string;
  date?: string;
  summary?: string;
  highlights?: string[];
}

export function WhatsNewModal() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<WhatsNewData>({
    queryKey: ["/api/changelog/whats-new"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/changelog/dismiss");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changelog/whats-new"] });
    },
  });

  if (isLoading || !data?.show) {
    return null;
  }

  const handleDismiss = () => {
    dismissMutation.mutate();
  };

  const handleViewChangelog = () => {
    dismissMutation.mutate();
    setLocation("/changelog");
  };

  return (
    <Dialog open={data.show && !dismissMutation.isSuccess} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-lg p-4 sm:p-6"
        data-testid="dialog-whats-new"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg sm:text-xl" data-testid="text-whats-new-title">
              What's New in Vega
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm" data-testid="text-whats-new-version">
            Version {data.version} &middot; {data.date}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2">
          {data.summary ? (
            <>
              <p className="text-sm sm:text-base text-foreground leading-relaxed" data-testid="text-whats-new-summary">
                {data.summary}
              </p>

              {data.highlights && data.highlights.length > 0 && (
                <ul className="space-y-3" data-testid="list-whats-new-highlights">
                  {data.highlights.map((highlight, index) => (
                    <li key={index} className="flex gap-3 items-start">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm sm:text-base text-foreground/90">{highlight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleViewChangelog}
            className="w-full sm:w-auto order-2 sm:order-1 min-h-[44px]"
            data-testid="button-view-changelog"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Changelog
          </Button>
          <Button
            onClick={handleDismiss}
            disabled={dismissMutation.isPending}
            className="w-full sm:w-auto order-1 sm:order-2 min-h-[44px]"
            data-testid="button-dismiss-whats-new"
          >
            {dismissMutation.isPending ? "Saving..." : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
