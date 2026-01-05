import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export type DefaultTimePeriod = {
  mode: 'current' | 'specific';
  year?: number;
  quarter?: number;
};

export type TenantBranding = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  reportHeaderText?: string;
  reportFooterText?: string;
  tagline?: string;
  emailFromName?: string;
  emailSignature?: string;
};

export type Tenant = {
  id: string;
  name: string;
  color: string | null;
  logoUrl?: string | null;
  logoUrlDark?: string | null;
  faviconUrl?: string | null;
  branding?: TenantBranding | null;
  allowedDomains?: string[] | null;
  defaultTimePeriod?: DefaultTimePeriod | null;
};

type TenantContextType = {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant) => void;
  tenants: Tenant[];
  isLoading: boolean;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantSelectionComplete, setTenantSelectionComplete] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  const { data: tenants = [], isLoading: queryLoading, isError, isFetched } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    retry: 2, // Retry a couple times in case of transient failures
    retryDelay: 500,
  });

  useEffect(() => {
    // Reset selection state when query starts loading
    if (queryLoading) {
      setTenantSelectionComplete(false);
      return;
    }
    
    // Mark that we've attempted a fetch (helps distinguish loading from truly no tenants)
    if (isFetched) {
      setHasAttemptedFetch(true);
    }
    
    // If there was an error (like 401), keep loading - auth might not be ready yet
    if (isError) {
      return;
    }
    
    // Query is done - now handle tenant selection
    if (tenants.length === 0) {
      // Only mark as complete if we've successfully fetched with no error
      // This prevents the "No Organization Access" flash during auth race
      if (isFetched && !isError) {
        setTenantSelectionComplete(true);
      }
      return;
    }
    
    const savedTenantId = localStorage.getItem("currentTenantId");
    if (savedTenantId) {
      const savedTenant = tenants.find((t) => t.id === savedTenantId);
      if (savedTenant) {
        setCurrentTenant(savedTenant);
      } else {
        // Saved tenant not in user's accessible tenants - use first available
        setCurrentTenant(tenants[0]);
        localStorage.setItem("currentTenantId", tenants[0].id);
      }
    } else {
      // No saved tenant - use user's first tenant
      setCurrentTenant(tenants[0]);
      localStorage.setItem("currentTenantId", tenants[0].id);
    }
    setTenantSelectionComplete(true);
  }, [tenants, queryLoading, isError, isFetched]);

  // Loading is true until both the query is done AND tenant selection is complete
  // Also stay loading if we haven't even attempted a fetch yet
  const isLoading = queryLoading || !tenantSelectionComplete || (!hasAttemptedFetch && !currentTenant);

  // Apply favicon when tenant changes (reset to default if no tenant favicon)
  useEffect(() => {
    const existingFavicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    const faviconUrl = currentTenant?.faviconUrl || "/favicon.png"; // Default fallback to bundled asset
    
    if (existingFavicon) {
      existingFavicon.setAttribute("href", faviconUrl);
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [currentTenant?.faviconUrl]);

  const handleSetCurrentTenant = (tenant: Tenant) => {
    const previousTenantId = currentTenant?.id;
    setCurrentTenant(tenant);
    localStorage.setItem("currentTenantId", tenant.id);
    
    // Invalidate all queries when tenant changes to refetch data for new tenant
    if (previousTenantId && previousTenantId !== tenant.id) {
      queryClient.invalidateQueries();
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        setCurrentTenant: handleSetCurrentTenant,
        tenants,
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/**
 * Hook for components that require a tenant to be loaded.
 * Returns the tenant (non-null) and a loading flag.
 * Use the loading flag to show a loading state while tenant is loading.
 * After loading is false, tenant is guaranteed to be non-null.
 */
export function useRequiredTenant(): { tenant: Tenant; isLoading: false } | { tenant: null; isLoading: true } {
  const { currentTenant, isLoading } = useTenant();
  
  if (isLoading || !currentTenant) {
    return { tenant: null, isLoading: true };
  }
  
  return { tenant: currentTenant, isLoading: false };
}
