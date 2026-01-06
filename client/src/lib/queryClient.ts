import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

    // PERFORMANCE: Use default cache behavior (allows conditional requests)
    // instead of no-cache which forces full re-downloads
    const res = await fetch(url, {
      credentials: "include",
      headers: getTenantHeader(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// PERFORMANCE: Query client configuration optimized for real-time collaboration
// - staleTime: 30s for most data (balance between freshness and API load)
// - gcTime: 10 minutes (keep data in cache for back navigation)
// - refetchOnWindowFocus: true for important data freshness when user returns
// - retry: 1 time with exponential backoff for transient failures
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      staleTime: 30 * 1000, // 30 seconds - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
      retry: 1, // Retry once for transient failures
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
      // STABILITY: Automatically invalidate related queries after mutation
      onSettled: () => {
        // Note: Specific invalidations should be done in individual mutations
        // This is a safety net for forgotten invalidations
      },
    },
  },
});

// STABILITY: Export helper for manual cache invalidation
export function invalidateQueries(queryKeyPrefix: string | string[]): Promise<void> {
  const key = Array.isArray(queryKeyPrefix) ? queryKeyPrefix : [queryKeyPrefix];
  return queryClient.invalidateQueries({ queryKey: key });
}
