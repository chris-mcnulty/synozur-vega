import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Target,
  TrendingUp,
  BarChart2,
  Calendar,
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Rocket,
  Settings,
  HelpCircle,
  Activity,
  Flag,
  Sparkles,
  Mountain,
  LifeBuoy,
  BookOpen,
  Clock,
  Loader2,
  CalendarDays,
  X,
} from "lucide-react";
import type { SearchResult, SearchEntityType, SearchResponse } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

function getTenantHeader(tenantId: string | null | undefined): Record<string, string> {
  return tenantId ? { "x-tenant-id": tenantId } : {};
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_ITEMS = [
  { title: "Company OS", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Focus", url: "/focus", icon: Activity },
  { title: "Executive Dashboard", url: "/executive", icon: BarChart2 },
  { title: "Team Mode", url: "/team", icon: Users },
  { title: "Foundations", url: "/foundations", icon: Building2 },
  { title: "Strategy", url: "/strategy", icon: Target },
  { title: "Outcomes", url: "/planning", icon: TrendingUp },
  { title: "Focus Rhythm", url: "/focus-rhythm", icon: Calendar },
  { title: "Reporting", url: "/reporting", icon: FileText },
  { title: "Launchpad", url: "/launchpad", icon: Rocket },
  { title: "Support", url: "/support", icon: LifeBuoy },
  { title: "My Settings", url: "/settings", icon: Settings },
  { title: "User Guide", url: "/help", icon: HelpCircle },
];

const TYPE_META: Record<
  SearchEntityType,
  { label: string; group: string; icon: React.ComponentType<{ className?: string }> }
> = {
  objective: { label: "Objective", group: "Objectives", icon: Target },
  key_result: { label: "Key Result", group: "Key Results", icon: TrendingUp },
  big_rock: { label: "Big Rock", group: "Big Rocks", icon: Mountain },
  strategy: { label: "Strategy", group: "Strategies", icon: Flag },
  ambition: { label: "Ambition", group: "Ambitions", icon: Sparkles },
  team: { label: "Team", group: "Teams", icon: Users },
  meeting: { label: "Meeting", group: "Meetings", icon: Calendar },
  ticket: { label: "Ticket", group: "Tickets", icon: LifeBuoy },
  document: { label: "Document", group: "Documents", icon: BookOpen },
};

const GROUP_ORDER: SearchEntityType[] = [
  "objective",
  "key_result",
  "big_rock",
  "strategy",
  "ambition",
  "team",
  "meeting",
  "ticket",
  "document",
];

// Recents are scoped per (user, tenant) so they cannot leak across logins
// or tenant switches on a shared browser.
const MAX_RECENT = 6;
function recentSearchesKey(userId: string, tenantId: string) {
  return `vega_recent_searches::${userId}::${tenantId}`;
}
function recentViewedKey(userId: string, tenantId: string) {
  return `vega_recent_viewed::${userId}::${tenantId}`;
}

// Filters persist for the current browser session only, scoped per (user, tenant).
function filtersKey(userId: string, tenantId: string) {
  return `vega_search_filters::${userId}::${tenantId}`;
}

type SearchFilters = {
  types: SearchEntityType[];
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
};

const EMPTY_FILTERS: SearchFilters = { types: [], dateFrom: "", dateTo: "" };

// Entities that have a meaningful date column on the server. Date filter is a
// no-op for other types and so should be marked as such in the UI.
const DATE_FILTERABLE_TYPES: SearchEntityType[] = ["meeting", "ticket"];

function loadFilters(userId: string, tenantId: string): SearchFilters {
  try {
    const raw = sessionStorage.getItem(filtersKey(userId, tenantId));
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw) as Partial<SearchFilters>;
    return {
      types: Array.isArray(parsed.types) ? (parsed.types as SearchEntityType[]) : [],
      dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : "",
      dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : "",
    };
  } catch {
    return EMPTY_FILTERS;
  }
}

function saveFilters(userId: string, tenantId: string, filters: SearchFilters) {
  try {
    sessionStorage.setItem(filtersKey(userId, tenantId), JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

type RecentViewed = {
  type: SearchEntityType;
  id: string;
  title: string;
  parentContext?: string;
  url: string;
  viewedAt: number;
};

function loadRecentSearches(userId: string, tenantId: string): string[] {
  try {
    const raw = localStorage.getItem(recentSearchesKey(userId, tenantId));
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(userId: string, tenantId: string, query: string) {
  try {
    const existing = loadRecentSearches(userId, tenantId);
    const filtered = existing.filter((q) => q.toLowerCase() !== query.toLowerCase());
    const next = [query, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(recentSearchesKey(userId, tenantId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function loadRecentViewed(userId: string, tenantId: string): RecentViewed[] {
  try {
    const raw = localStorage.getItem(recentViewedKey(userId, tenantId));
    return raw ? (JSON.parse(raw) as RecentViewed[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentViewed(userId: string, tenantId: string, item: Omit<RecentViewed, "viewedAt">) {
  try {
    const existing = loadRecentViewed(userId, tenantId);
    const filtered = existing.filter((v) => !(v.type === item.type && v.id === item.id));
    const next: RecentViewed[] = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(recentViewedKey(userId, tenantId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function sendTelemetry(
  tenantId: string | null | undefined,
  payload: {
    event: "query" | "result_clicked" | "no_results";
    query?: string;
    resultType?: string;
    totalResults?: number;
  },
) {
  try {
    fetch("/api/search/telemetry", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getTenantHeader(tenantId) },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = currentTenant?.id ?? null;
  const recentsScoped = !!(userId && tenantId);

  const [input, setInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentViewed, setRecentViewed] = useState<RecentViewed[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const lastTelemetryQuery = useRef<string>("");

  const filtersScoped = recentsScoped;
  const updateFilters = useCallback(
    (next: SearchFilters) => {
      setFilters(next);
      if (filtersScoped && userId && tenantId) {
        saveFilters(userId, tenantId, next);
      }
    },
    [filtersScoped, userId, tenantId],
  );

  const toggleType = useCallback(
    (t: SearchEntityType) => {
      const has = filters.types.includes(t);
      updateFilters({
        ...filters,
        types: has ? filters.types.filter((x) => x !== t) : [...filters.types, t],
      });
    },
    [filters, updateFilters],
  );

  const clearAllFilters = useCallback(() => {
    updateFilters(EMPTY_FILTERS);
  }, [updateFilters]);

  const hasDateFilter = !!(filters.dateFrom || filters.dateTo);
  const activeFilterCount =
    filters.types.length + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  // Debounce input -> debouncedQuery (200ms)
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(input.trim()), 200);
    return () => clearTimeout(handle);
  }, [input]);

  // Reset transient state on close. Recents are loaded only when scoped to a
  // (user, tenant) pair, and re-loaded whenever that scope changes so a tenant
  // switch never displays the previous tenant's data.
  useEffect(() => {
    if (!open) {
      setInput("");
      setResults([]);
      lastTelemetryQuery.current = "";
      return;
    }
    if (recentsScoped && userId && tenantId) {
      setRecentSearches(loadRecentSearches(userId, tenantId));
      setRecentViewed(loadRecentViewed(userId, tenantId));
      setFilters(loadFilters(userId, tenantId));
    } else {
      setRecentSearches([]);
      setRecentViewed([]);
      setFilters(EMPTY_FILTERS);
    }
  }, [open, userId, tenantId, recentsScoped]);

  // Run search when debouncedQuery changes
  useEffect(() => {
    if (!open) return;
    if (!debouncedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const ctrl = new AbortController();
    const params = new URLSearchParams({
      q: debouncedQuery,
      limit: "8",
    });
    if (filters.types.length > 0) params.set("types", filters.types.join(","));
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    fetch(`/api/search?${params.toString()}`, {
      credentials: "include",
      signal: ctrl.signal,
      headers: getTenantHeader(tenantId),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return (await res.json()) as SearchResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setIsSearching(false);
        // Telemetry: only fire once per debounced query
        if (lastTelemetryQuery.current !== debouncedQuery) {
          lastTelemetryQuery.current = debouncedQuery;
          if (data.results.length === 0) {
            sendTelemetry(tenantId, { event: "no_results", query: debouncedQuery, totalResults: 0 });
          } else {
            sendTelemetry(tenantId, {
              event: "query",
              query: debouncedQuery,
              totalResults: data.results.length,
            });
            // Persist successful queries (with at least one result) to recent searches.
            if (recentsScoped && userId && tenantId) {
              saveRecentSearch(userId, tenantId, debouncedQuery);
            }
          }
        }
      })
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        console.error("[search] error:", err);
        setResults([]);
        setIsSearching(false);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [debouncedQuery, open, filters.types, filters.dateFrom, filters.dateTo]);

  const navigate = useCallback(
    (url: string) => {
      setLocation(url);
      onOpenChange(false);
    },
    [setLocation, onOpenChange]
  );

  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      if (recentsScoped && userId && tenantId) {
        saveRecentViewed(userId, tenantId, {
          type: result.type,
          id: result.id,
          title: result.title,
          parentContext: result.parentContext,
          url: result.url,
        });
        if (debouncedQuery) {
          saveRecentSearch(userId, tenantId, debouncedQuery);
        }
      }
      sendTelemetry(tenantId, {
        event: "result_clicked",
        query: debouncedQuery,
        resultType: result.type,
        totalResults: results.length,
      });
      navigate(result.url);
    },
    [debouncedQuery, results.length, navigate, recentsScoped, userId, tenantId]
  );

  // Group results by type, preserving GROUP_ORDER
  const grouped = useMemo(() => {
    const map = new Map<SearchEntityType, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return GROUP_ORDER.filter((t) => map.has(t)).map((t) => ({
      type: t,
      items: map.get(t)!,
    }));
  }, [results]);

  const showDefault = !debouncedQuery;
  const hasResults = results.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across objectives, key results, big rocks, strategies, ambitions, teams, meetings, support tickets, and grounding documents.
        </DialogDescription>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <div className="relative">
            <CommandInput
              placeholder="Search objectives, key results, big rocks, strategies, meetings..."
              value={input}
              onValueChange={setInput}
              data-testid="input-search-command"
            />
            {isSearching && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                data-testid="status-searching"
              />
            )}
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
            data-testid="search-filters-bar"
          >
            {GROUP_ORDER.map((t) => {
              const meta = TYPE_META[t];
              const Icon = meta.icon;
              const active = filters.types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={`Filter by ${meta.label}`}
                  onClick={() => toggleType(t)}
                  data-testid={`chip-filter-type-${t}`}
                  data-active={active}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Badge
                    variant={active ? "default" : "outline"}
                    className="gap-1 pointer-events-none"
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </button>
              );
            })}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant={hasDateFilter ? "default" : "outline"}
                  className="gap-1"
                  data-testid="button-filter-date"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {hasDateFilter
                    ? `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`
                    : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="start">
                <div className="text-xs text-muted-foreground">
                  Filters meetings and tickets by date.
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium" htmlFor="search-date-from">
                    From
                  </label>
                  <Input
                    id="search-date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      updateFilters({ ...filters, dateFrom: e.target.value })
                    }
                    data-testid="input-filter-date-from"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium" htmlFor="search-date-to">
                    To
                  </label>
                  <Input
                    id="search-date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) =>
                      updateFilters({ ...filters, dateTo: e.target.value })
                    }
                    data-testid="input-filter-date-to"
                  />
                </div>
                {hasDateFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() =>
                      updateFilters({ ...filters, dateFrom: "", dateTo: "" })
                    }
                    data-testid="button-clear-date-filter"
                  >
                    Clear date range
                  </Button>
                )}
                {filters.types.length > 0 &&
                  !filters.types.some((t) => DATE_FILTERABLE_TYPES.includes(t)) && (
                    <div className="text-xs text-muted-foreground">
                      Note: selected types don&apos;t support date filtering.
                    </div>
                  )}
              </PopoverContent>
            </Popover>
            {activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto gap-1 text-muted-foreground"
                onClick={clearAllFilters}
                data-testid="button-clear-all-filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
      <CommandList className="max-h-[480px]">
        {/* Empty state when actively searching */}
        {!showDefault && !isSearching && !hasResults && (
          <CommandEmpty data-testid="text-no-results">
            No results found for &quot;{debouncedQuery}&quot;.
          </CommandEmpty>
        )}

        {/* DEFAULT STATE (no query): Recent searches, Recently viewed, Pages */}
        {showDefault && (
          <>
            {recentSearches.length > 0 && (
              <CommandGroup heading="Recent searches">
                {recentSearches.map((q) => (
                  <CommandItem
                    key={`recent-${q}`}
                    value={`recent-search-${q}`}
                    onSelect={() => setInput(q)}
                    data-testid={`item-recent-search-${q}`}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{q}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {recentViewed.length > 0 && (
              <>
                {recentSearches.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Recently viewed">
                  {recentViewed.map((v) => {
                    const Icon = TYPE_META[v.type]?.icon ?? FileText;
                    const typeLabel = TYPE_META[v.type]?.label ?? v.type;
                    return (
                      <CommandItem
                        key={`viewed-${v.type}-${v.id}`}
                        value={`viewed-${v.type}-${v.title}-${v.id}`}
                        onSelect={() => navigate(v.url)}
                        data-testid={`item-recent-viewed-${v.id}`}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{v.title}</div>
                          {v.parentContext && (
                            <div className="text-xs text-muted-foreground truncate">
                              {v.parentContext}
                            </div>
                          )}
                        </div>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {typeLabel}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {(recentSearches.length > 0 || recentViewed.length > 0) && <CommandSeparator />}

            <CommandGroup heading="Pages">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`nav-${item.title}`}
                  onSelect={() => navigate(item.url)}
                  data-testid={`item-nav-${item.url.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* SEARCH RESULTS - grouped by entity type */}
        {!showDefault && hasResults && (
          <>
            {/* Page navigation matches (only show pages whose title contains the query) */}
            {(() => {
              const pageMatches = NAV_ITEMS.filter((item) =>
                item.title.toLowerCase().includes(debouncedQuery.toLowerCase())
              );
              if (pageMatches.length === 0) return null;
              return (
                <>
                  <CommandGroup heading="Pages">
                    {pageMatches.map((item) => (
                      <CommandItem
                        key={item.url}
                        value={`page-${item.title}`}
                        onSelect={() => navigate(item.url)}
                        data-testid={`item-page-${item.url.replace(/[^a-z0-9]/gi, "-")}`}
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{highlightMatch(item.title, debouncedQuery)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              );
            })()}

            {grouped.map(({ type, items }, groupIdx) => {
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type}>
                  {groupIdx > 0 && <CommandSeparator />}
                  <CommandGroup heading={meta.group}>
                    {items.map((r) => (
                      <CommandItem
                        key={`${type}-${r.id}`}
                        value={`result-${type}-${r.id}`}
                        onSelect={() => handleResultSelect(r)}
                        data-testid={`item-search-result-${r.id}`}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {highlightMatch(r.title, debouncedQuery)}
                          </div>
                          {(r.parentContext || r.snippet) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {r.parentContext && (
                                <span data-testid={`text-parent-context-${r.id}`}>
                                  {r.parentContext}
                                </span>
                              )}
                              {r.parentContext && r.snippet && " · "}
                              {r.snippet && (
                                <span>{highlightMatch(r.snippet, debouncedQuery)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
          </>
        )}
      </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
