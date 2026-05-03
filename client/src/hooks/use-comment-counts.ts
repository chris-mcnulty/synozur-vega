import { createContext, createElement, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type CommentEntityType = "objective" | "key_result" | "big_rock" | "check_in";

type CountsMap = Record<string, number>;

const CommentCountsContext = createContext<Partial<Record<CommentEntityType, CountsMap>>>({});

export function useCommentCount(entityType: CommentEntityType, entityId: string): number {
  const ctx = useContext(CommentCountsContext);
  return ctx?.[entityType]?.[entityId] ?? 0;
}

function useBatchedCounts(entityType: CommentEntityType, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))).sort();
  const key = unique.join(",");
  return useQuery<CountsMap>({
    queryKey: ["/api/comments/counts", entityType, key],
    queryFn: async () => {
      if (unique.length === 0) return {};
      const res = await fetch("/api/comments/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityType, entityIds: unique }),
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: unique.length > 0,
    staleTime: 30_000,
  });
}

interface ProviderProps {
  objectiveIds?: string[];
  keyResultIds?: string[];
  bigRockIds?: string[];
  children: ReactNode;
}

export function CommentCountsProvider({
  objectiveIds = [],
  keyResultIds = [],
  bigRockIds = [],
  children,
}: ProviderProps) {
  const { data: objCounts } = useBatchedCounts("objective", objectiveIds);
  const { data: krCounts } = useBatchedCounts("key_result", keyResultIds);
  const { data: brCounts } = useBatchedCounts("big_rock", bigRockIds);

  const value: Partial<Record<CommentEntityType, CountsMap>> = {
    objective: objCounts ?? {},
    key_result: krCounts ?? {},
    big_rock: brCounts ?? {},
  };

  return createElement(CommentCountsContext.Provider, { value }, children);
}
