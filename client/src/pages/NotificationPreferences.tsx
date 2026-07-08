import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NOTIFICATION_TYPES, type NotificationType } from "@shared/schema";
import { Helmet } from "react-helmet-async";

interface PrefRow {
  eventType: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  assigned: { label: "Assignments", description: "When something is assigned to you" },
  behind_pace: { label: "Behind Pace", description: "When your goals fall behind pace" },
  support_reply: { label: "Support Replies", description: "Replies and updates on support tickets" },
  ticket_status: { label: "Ticket Status", description: "Status changes on your support tickets" },
  check_in_due: { label: "Check-ins Due", description: "Reminders to update progress" },
  mention: { label: "Mentions", description: "When you're @mentioned in comments" },
  plan_expiration: { label: "Plan Expiration", description: "Subscription plan expiration reminders" },
  system: { label: "System", description: "Important system announcements" },
};

export default function NotificationPreferences() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<PrefRow[]>([]);

  const prefsQuery = useQuery<PrefRow[]>({
    queryKey: ["/api/notifications/preferences"],
  });

  const meQuery = useQuery<{ user: { id: string; notifPrefWeeklyDigest?: boolean } } | null>({
    queryKey: ["/api/auth/me"],
  });

  const digestPrefMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/me/notif-pref/weekly-digest", { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Updated", description: "Weekly digest preference saved." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Could not update weekly digest preference.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (preferences: PrefRow[]) => {
      const res = await apiRequest("PATCH", "/api/notifications/preferences", { preferences });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Could not update preferences.", variant: "destructive" });
    },
  });

  const updatePref = (type: NotificationType, key: "inAppEnabled" | "emailEnabled", value: boolean) => {
    setPrefs((curr) => curr.map((p) => (p.eventType === type ? { ...p, [key]: value } : p)));
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full space-y-4">
      <Helmet><title>Notification Preferences | Vega</title></Helmet>
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/notifications")}
          data-testid="button-back-to-notifications"
          aria-label="Back to notifications"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Bell className="h-5 w-5" />
        <h1 className="text-2xl font-semibold">Notification Preferences</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly AI digest</CardTitle>
          <CardDescription>
            Every Monday morning, get a personalized email summarizing your OKR progress for the week — what needs attention and your wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">Email me my weekly digest</div>
              <div className="text-xs text-muted-foreground">Sent Monday at 6:00 AM in your organization's local time. Your admin can disable digests org-wide.</div>
            </div>
            <Switch
              checked={meQuery.data?.user?.notifPrefWeeklyDigest ?? true}
              onCheckedChange={(v) => digestPrefMutation.mutate(v)}
              disabled={digestPrefMutation.isPending || meQuery.isLoading}
              data-testid="switch-weekly-digest"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choose how you're notified</CardTitle>
          <CardDescription>
            Toggle in-app notifications and email for each event type. Changes save when you click Save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prefsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-[1fr_auto_auto] gap-6 px-1 pb-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                <span>Event</span>
                <span className="w-16 text-center">In-app</span>
                <span className="w-16 text-center">Email</span>
              </div>
              {NOTIFICATION_TYPES.map((t) => {
                const p = prefs.find((x) => x.eventType === t) ?? { eventType: t, inAppEnabled: true, emailEnabled: true };
                const meta = TYPE_LABELS[t];
                return (
                  <div
                    key={t}
                    className="grid grid-cols-[1fr_auto_auto] gap-6 items-center px-1 py-3"
                    data-testid={`row-pref-${t}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{meta?.label ?? t}</div>
                      <div className="text-xs text-muted-foreground">{meta?.description ?? ""}</div>
                    </div>
                    <div className="w-16 flex justify-center">
                      <Switch
                        checked={p.inAppEnabled}
                        onCheckedChange={(v) => updatePref(t, "inAppEnabled", v)}
                        data-testid={`switch-inapp-${t}`}
                      />
                    </div>
                    <div className="w-16 flex justify-center">
                      <Switch
                        checked={p.emailEnabled}
                        onCheckedChange={(v) => updatePref(t, "emailEnabled", v)}
                        data-testid={`switch-email-${t}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button
              onClick={() => saveMutation.mutate(prefs)}
              disabled={saveMutation.isPending || prefsQuery.isLoading}
              data-testid="button-save-preferences"
            >
              {saveMutation.isPending ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
