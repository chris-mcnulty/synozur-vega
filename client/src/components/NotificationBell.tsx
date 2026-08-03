import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Settings as SettingsIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, STALE_TIME_FREQUENT } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Notification } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  assigned: "Assignments",
  behind_pace: "Behind Pace",
  support_reply: "Support",
  ticket_status: "Support",
  check_in_due: "Check-ins",
  mention: "Mentions",
  plan_expiration: "Plan",
  system: "System",
  reassignment_received: "Reassignments",
  reassignment_performed: "Reassignments",
};

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const unreadCountQuery = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60000,
    staleTime: STALE_TIME_FREQUENT,
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;

    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource("/api/notifications/stream", { withCredentials: true });
      } catch {
        return;
      }
      es.addEventListener("ready", () => {
        retryDelay = 2000;
      });
      es.addEventListener("notification", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      });
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (closed) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (es) es.close();
    };
  }, []);

  const listQuery = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { limit: 20 }],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: open,
    staleTime: STALE_TIME_FREQUENT,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unread = unreadCountQuery.data?.count ?? 0;
  const items = listQuery.data ?? [];

  // Group by type
  const grouped = items.reduce<Record<string, Notification[]>>((acc, n) => {
    const k = TYPE_LABELS[n.type] ?? "Other";
    if (!acc[k]) acc[k] = [];
    acc[k].push(n);
    return acc;
  }, {});

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.linkUrl) {
      setLocation(n.linkUrl);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          data-testid="button-notification-bell"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] tabular-nums"
              data-testid="badge-notification-unread-count"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" data-testid="popover-notifications">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllRead.mutate()}
              disabled={unread === 0 || markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {listQuery.isLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center" data-testid="text-notifications-loading">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center" data-testid="text-notifications-empty">
              You're all caught up.
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(grouped).map(([group, groupItems]) => (
                <div key={group}>
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {group}
                  </div>
                  {groupItems.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full text-left px-3 py-2 hover-elevate active-elevate-2 flex gap-2 items-start",
                        !n.isRead && "bg-accent/30"
                      )}
                      data-testid={`notification-item-${n.id}`}
                    >
                      {!n.isRead && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm truncate", !n.isRead && "font-medium")}>
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                      {!n.isRead && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Mark read"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate(n.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              markRead.mutate(n.id);
                            }
                          }}
                          className="opacity-60 hover:opacity-100 p-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`button-mark-read-${n.id}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setLocation("/notifications");
            }}
            data-testid="button-view-all-notifications"
          >
            View all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setLocation("/notifications/preferences");
            }}
            data-testid="button-notification-preferences"
          >
            <SettingsIcon className="h-3.5 w-3.5 mr-1" />
            Preferences
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
