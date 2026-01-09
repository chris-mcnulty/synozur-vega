import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

// ============================================
// STALE TIME CONSTANTS
// ============================================
// Different data types have different freshness requirements

/** Data that changes frequently (OKR progress, check-ins, real-time status) */
export const STALE_TIME_FREQUENT = 30 * 1000; // 30 seconds

/** Data that changes occasionally (objectives, strategies, meetings) */
export const STALE_TIME_STANDARD = 2 * 60 * 1000; // 2 minutes

/** Data that rarely changes (tenant settings, user info, vocabulary) */
export const STALE_TIME_LONG = 5 * 60 * 1000; // 5 minutes

/** Static data that almost never changes (service plans, system config) */
export const STALE_TIME_STATIC = 30 * 60 * 1000; // 30 minutes

// ============================================
// CACHE TIME (gcTime) CONSTANTS
// ============================================
// How long to keep data in cache after it becomes inactive

/** Standard cache retention */
export const CACHE_TIME_STANDARD = 10 * 60 * 1000; // 10 minutes

/** Extended cache for expensive queries */
export const CACHE_TIME_EXTENDED = 30 * 60 * 1000; // 30 minutes

// ============================================
// RETRY CONFIGURATION
// ============================================

/**
 * Custom retry function with exponential backoff
 * Retries on network errors and 5xx responses, but not on 4xx (client errors)
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Max 3 retries
  if (failureCount >= 3) return false;

  // Check if it's a network error or server error (5xx)
  if (error instanceof Error) {
    const message = error.message;
    
    // Don't retry on client errors (4xx)
    if (message.startsWith("400:") || 
        message.startsWith("401:") || 
        message.startsWith("403:") || 
        message.startsWith("404:") ||
        message.startsWith("422:")) {
      return false;
    }
    
    // Retry on server errors (5xx) and network errors
    if (message.startsWith("5") || message.includes("fetch") || message.includes("network")) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 * 1st retry: 1 second, 2nd: 2 seconds, 3rd: 4 seconds
 */
function getRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * Math.pow(2, attemptIndex), 10000);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getTenantHeader(): Record<string, string> {
  const tenantId = localStorage.getItem("currentTenantId");
  return tenantId ? { "x-tenant-id": tenantId } : {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getTenantHeader(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // First element is the base URL, subsequent elements are query parameters
    // If there's only one element, use it directly (may already contain query params)
    let url: string;
    if (queryKey.length === 1) {
      url = queryKey[0] as string;
    } else {
      // Build URL with query parameters from array elements
      const baseUrl = queryKey[0] as string;
      const params = queryKey.slice(1);
      if (params.length > 0 && params.every(p => typeof p === 'object' && p !== null)) {
        // If params are objects, treat them as key-value pairs
        const searchParams = new URLSearchParams();
        for (const param of params) {
          for (const [key, value] of Object.entries(param as Record<string, string>)) {
            if (value !== undefined && value !== null) {
              searchParams.append(key, String(value));
            }
          }
        }
        url = searchParams.toString() ? `${baseUrl}?${searchParams.toString()}` : baseUrl;
      } else {
        // Legacy behavior: join with "/" for backwards compatibility with existing code
        url = queryKey.join("/") as string;
      }
    }

    const res = await fetch(url, {
      credentials: "include",
      cache: "no-cache", // Disable HTTP caching to avoid 304 responses
      headers: getTenantHeader(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// ============================================
// QUERY CLIENT CONFIGURATION
// ============================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      
      // Data becomes stale after 2 minutes by default
      // Individual queries can override this based on their data type
      staleTime: STALE_TIME_STANDARD,
      
      // Keep inactive data in cache for 10 minutes
      gcTime: CACHE_TIME_STANDARD,
      
      // Retry configuration with exponential backoff
      retry: shouldRetry,
      retryDelay: getRetryDelay,
      
      // Don't automatically refetch in background
      // (avoids unnecessary API calls, users can manually refresh)
      refetchInterval: false,
      refetchOnWindowFocus: false,
      
      // Do refetch on mount if data is stale
      refetchOnMount: true,
      
      // Keep previous data while fetching new data (smoother UX)
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once on failure (with same logic as queries)
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        return shouldRetry(failureCount, error);
      },
      retryDelay: getRetryDelay,
    },
  },
});

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

/**
 * Invalidate all queries that start with the given prefix
 * Useful after mutations that affect multiple related queries
 * 
 * Example: invalidateQueriesStartingWith('/api/objectives') will invalidate:
 * - /api/objectives
 * - /api/objectives/123
 * - /api/objectives/hierarchy
 */
export function invalidateQueriesStartingWith(prefix: string): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      if (Array.isArray(queryKey) && typeof queryKey[0] === 'string') {
        return queryKey[0].startsWith(prefix);
      }
      return false;
    },
  });
}

/**
 * Invalidate OKR-related queries
 * Call this after creating, updating, or deleting objectives/key results/big rocks
 */
export async function invalidateOKRQueries(): Promise<void> {
  await Promise.all([
    invalidateQueriesStartingWith('/api/okr/objectives'),
    invalidateQueriesStartingWith('/api/okr/key-results'),
    invalidateQueriesStartingWith('/api/okr/big-rocks'),
    invalidateQueriesStartingWith('/api/okr/check-ins'),
    invalidateQueriesStartingWith('/api/okr/hierarchy'),
  ]);
}

/**
 * Invalidate strategy-related queries
 */
export async function invalidateStrategyQueries(): Promise<void> {
  await invalidateQueriesStartingWith('/api/strategies');
}

/**
 * Invalidate meeting-related queries
 */
export async function invalidateMeetingQueries(): Promise<void> {
  await invalidateQueriesStartingWith('/api/meetings');
}

/**
 * Invalidate tenant-related queries
 */
export async function invalidateTenantQueries(): Promise<void> {
  await Promise.all([
    invalidateQueriesStartingWith('/api/tenants'),
    invalidateQueriesStartingWith('/api/users'),
    invalidateQueriesStartingWith('/api/foundations'),
  ]);
}

/**
 * Reset all queries (useful after logout or tenant switch)
 */
export function resetAllQueries(): void {
  queryClient.clear();
}

/**
 * Prefetch a query to warm the cache
 * Useful for prefetching data the user is likely to need
 */
export function prefetchQuery(queryKey: QueryKey, staleTime?: number): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey,
    staleTime: staleTime ?? STALE_TIME_STANDARD,
  });
}
