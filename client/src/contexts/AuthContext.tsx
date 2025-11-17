import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string; isDemo?: boolean }) => Promise<void>;
  signup: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Fetch current user on mount
  // Use returnNull on 401 to avoid throwing errors when not authenticated
  const { data, isLoading } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  useEffect(() => {
    // Only update user state when we have data
    if (data?.user) {
      console.log('[AuthContext] Setting user from query data:', data.user.email);
      setUser(data.user);
    } else if (!isLoading && !data) {
      // Only clear user if we're not loading AND we have no data
      console.log('[AuthContext] Clearing user - no data from query');
      setUser(null);
    } else {
      console.log('[AuthContext] Still loading user data...');
    }
  }, [data, isLoading]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; isDemo?: boolean }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return await res.json();
    },
    onSuccess: (data: { user: User }) => {
      setUser(data.user);
      // Set the query data directly instead of invalidating to avoid refetch race conditions
      queryClient.setQueryData(["/api/auth/me"], { user: data.user });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; name?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      return await res.json();
    },
    onSuccess: (data: { user: User }) => {
      setUser(data.user);
      // Set the query data directly instead of invalidating to avoid refetch race conditions
      queryClient.setQueryData(["/api/auth/me"], { user: data.user });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      setUser(null);
      // Set query data to null and clear all other queries
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });

  const login = async (credentials: { email: string; password: string; isDemo?: boolean }) => {
    await loginMutation.mutateAsync(credentials);
  };

  const signup = async (data: { email: string; password: string; name?: string }) => {
    await signupMutation.mutateAsync(data);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
