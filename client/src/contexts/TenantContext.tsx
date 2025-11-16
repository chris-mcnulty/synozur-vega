import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type Tenant = {
  id: string;
  name: string;
  color: string | null;
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
  color: "hsl(277, 98%, 53%)",
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
    setCurrentTenant(tenant);
    localStorage.setItem("currentTenantId", tenant.id);
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
