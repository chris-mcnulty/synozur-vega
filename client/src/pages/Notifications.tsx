import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NOTIFICATION_TYPES, type Notification } from "@shared/schema";
import { Helmet } from "react-helmet-async";

const TYPE_LABELS: Record<string, string> = {
  assigned: "Assignments",
  behind_pace: "Behind Pace",
  support_reply: "Support Replies",
  ticket_status: "Ticket Status",
  check_in_due: "Check-ins Due",
  mention: "Mentions",
  plan_expiration: "Plan Expiration",
  system: "System",
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

const PAGE_SIZE = 30;

export default function Notifications() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const infiniteQuery = useInfiniteQuery<Notification[]>({
    queryKey: ["/api/notifications", "infinite", { filter, type: typeFilter }],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageParam));
      if (filter === "unread") params.set("unread", "true");
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/notifications?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
  });

  const items = (infiniteQuery.data?.pages ?? []).flat();
  const hasMore = infiniteQuery.hasNextPage;

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

  useEffect(() => {
    if (!hasMore || infiniteQuery.isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          infiniteQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, infiniteQuery.isFetchingNextPage, items.length]);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full space-y-4">
      <Helmet><title>Notifications | Vega</title></Helmet>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Notifications</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/notifications/preferences")}
            data-testid="button-open-notification-preferences"
          >
            <SettingsIcon className="h-3.5 w-3.5 mr-1" />
            Preferences
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            data-testid="button-page-mark-all-read"
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={filter} onValueChange={(v) => setFilter(v === "unread" ? "unread" : "all")}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-filter-all">All</TabsTrigger>
            <TabsTrigger value="unread" data-testid="tab-filter-unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
            data-testid="filter-type-all"
          >
            All types
          </Button>
          {NOTIFICATION_TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "default" : "outline"}
              onClick={() => setTypeFilter(t)}
              data-testid={`filter-type-${t}`}
            >
              {TYPE_LABELS[t] ?? t}
            </Button>
          ))}
        </div>
      </div>

      <Card className="divide-y" data-testid="card-notifications-list">
        {infiniteQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground" data-testid="text-empty-notifications">
            No notifications.
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.isRead) markRead.mutate(n.id);
                if (n.linkUrl) setLocation(n.linkUrl);
              }}
              className={cn(
                "w-full text-left px-4 py-3 hover-elevate active-elevate-2 flex gap-3 items-start",
                !n.isRead && "bg-accent/30"
              )}
              data-testid={`row-notification-${n.id}`}
            >
              {!n.isRead && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-sm", !n.isRead && "font-medium")}>{n.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </Badge>
                </div>
                {n.body && (
                  <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">
                  {timeAgo(n.createdAt)}
                </div>
              </div>
            </button>
          ))
        )}
      </Card>

      {hasMore && (
        <div
          ref={sentinelRef}
          className="h-8 flex items-center justify-center text-xs text-muted-foreground"
          data-testid="sentinel-load-more"
        >
          {infiniteQuery.isFetchingNextPage ? "Loading more…" : ""}
        </div>
      )}
    </div>
  );
}
