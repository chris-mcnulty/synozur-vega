import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedView, PageFilterState } from "@shared/schema";

export type SavedViewPage = "outcomes" | "my_focus" | "big_rocks";

const URL_KEY = (page: SavedViewPage) => `view_${page}`;

function encodeState(state: PageFilterState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state ?? {}))));
}

function decodeState(s: string): PageFilterState | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (parsed && typeof parsed === "object") return parsed as PageFilterState;
  } catch {}
  return null;
}

function readUrlState(page: SavedViewPage): PageFilterState | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(URL_KEY(page));
  return raw ? decodeState(raw) : null;
}

function writeUrlState(page: SavedViewPage, state: PageFilterState | null) {
  const params = new URLSearchParams(window.location.search);
  if (!state || Object.keys(state).length === 0) {
    params.delete(URL_KEY(page));
  } else {
    params.set(URL_KEY(page), encodeState(state));
  }
  const qs = params.toString();
  const newUrl = `${window.location.pathname}${qs ? "?" + qs : ""}${window.location.hash}`;
  if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, "", newUrl);
  }
}

export function filterStatesEqual(a: PageFilterState | null | undefined, b: PageFilterState | null | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

type UseSavedViewsOptions = {
  /** The page's current filter/sort/group/search state, owned by the page. */
  currentState: PageFilterState;
  /** Called when the hook needs to push state into the page (URL hydrate, default view, applying a saved view, clearing). */
  onApply: (state: PageFilterState) => void;
  /** Current user id — required so default-view auto-apply is scoped to views the user owns. */
  currentUserId?: string;
};

export function useSavedViews(page: SavedViewPage, opts: UseSavedViewsOptions) {
  const { currentState, onApply, currentUserId } = opts;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const viewsQuery = useQuery<SavedView[]>({
    queryKey: ["/api/saved-views", { page }],
    queryFn: async () => {
      const res = await fetch(`/api/saved-views?page=${page}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load saved views");
      return res.json();
    },
  });

  // Hydrate from URL on first mount
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    const fromUrl = readUrlState(page);
    if (fromUrl) {
      onApplyRef.current(fromUrl);
      hydratedRef.current = true;
    }
  }, [page]);

  // Apply user's default view on first load if no URL state
  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultRef.current) return;
    if (!viewsQuery.data) return;
    appliedDefaultRef.current = true;
    if (hydratedRef.current) return; // URL wins
    // Defaults are per-user: only auto-apply a default that the current user
    // owns. Shared views marked default by another user must NOT auto-load
    // for everyone in the tenant.
    const def = currentUserId
      ? viewsQuery.data.find((v) => v.isDefault && v.ownerUserId === currentUserId)
      : undefined;
    if (def) {
      const state = (def.filterJson as PageFilterState) ?? {};
      onApplyRef.current(state);
      setActiveViewId(def.id);
    }
  }, [viewsQuery.data, currentUserId]);

  // Sync currentState -> URL (namespaced, preserves other params)
  useEffect(() => {
    writeUrlState(page, currentState);
  }, [page, currentState]);

  // If user diverges from active view, deselect chip
  useEffect(() => {
    if (!activeViewId) return;
    const active = viewsQuery.data?.find((v) => v.id === activeViewId);
    if (!active) return;
    if (!filterStatesEqual(currentState, (active.filterJson as PageFilterState) ?? {})) {
      // Just leave activeViewId; isDirty is computed below
    }
  }, [currentState, activeViewId, viewsQuery.data]);

  const applyView = (id: string) => {
    const view = viewsQuery.data?.find((v) => v.id === id);
    if (!view) return;
    onApplyRef.current((view.filterJson as PageFilterState) ?? {});
    setActiveViewId(id);
  };

  const clearView = () => {
    onApplyRef.current({});
    setActiveViewId(null);
  };

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; visibility: "private" | "shared"; isDefault: boolean }) => {
      const res = await apiRequest("POST", "/api/saved-views", {
        page,
        name: input.name,
        visibility: input.visibility,
        isDefault: input.isDefault,
        filterJson: currentState,
      });
      return res.json();
    },
    onSuccess: (created: SavedView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", { page }] });
      setActiveViewId(created.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      data: Partial<{ name: string; visibility: "private" | "shared"; isDefault: boolean; filterJson: PageFilterState }>;
    }) => {
      const res = await apiRequest("PATCH", `/api/saved-views/${input.id}`, input.data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", { page }] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-views/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views", { page }] });
      if (activeViewId === id) {
        setActiveViewId(null);
        onApplyRef.current({});
      }
    },
  });

  const activeView = useMemo(
    () => viewsQuery.data?.find((v) => v.id === activeViewId) ?? null,
    [viewsQuery.data, activeViewId]
  );

  const isDirty = useMemo(() => {
    if (!activeView) return Object.keys(currentState ?? {}).length > 0;
    return !filterStatesEqual(currentState, (activeView.filterJson as PageFilterState) ?? {});
  }, [activeView, currentState]);

  return {
    views: viewsQuery.data ?? [],
    isLoading: viewsQuery.isLoading,
    activeView,
    activeViewId,
    currentState,
    applyView,
    clearView,
    isDirty,
    createView: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateView: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteView: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
