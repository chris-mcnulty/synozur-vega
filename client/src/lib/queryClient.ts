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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
