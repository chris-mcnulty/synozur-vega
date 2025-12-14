import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export type DefaultTimePeriod = {
  mode: 'current' | 'specific';
  year?: number;
  quarter?: number;
};

export type Tenant = {
  id: string;
  name: string;
  color: string | null;
  logoUrl?: string | null;
  allowedDomains?: string[] | null;
  defaultTimePeriod?: DefaultTimePeriod | null;
};

type TenantContextType = {
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  tenants: Tenant[];
  isLoading: boolean;
};

const DEFAULT_TENANT: Tenant = {
  id: "f328cd4e-0fe1-4893-a637-941684749c55",
  name: "The Synozur Alliance LLC",
  color: "#A855F7",
  allowedDomains: null,
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant>(DEFAULT_TENANT);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  useEffect(() => {
    if (tenants.length === 0) return;
    
    const savedTenantId = localStorage.getItem("currentTenantId");
    if (savedTenantId) {
      const savedTenant = tenants.find((t) => t.id === savedTenantId);
      if (savedTenant) {
        setCurrentTenant(savedTenant);
      } else {
        setCurrentTenant(tenants[0]);
      }
    } else {
      setCurrentTenant(tenants[0]);
    }
  }, [tenants]);

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
