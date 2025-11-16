import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Tenant = {
  id: string;
  name: string;
  color: string | null;
};

type TenantContextType = {
  currentTenant: Tenant;
  setCurrentTenant: (tenant: Tenant) => void;
  tenants: Tenant[];
};

const DEFAULT_TENANT: Tenant = {
  id: "f7229583-c9c9-4e80-88cf-5bbfd2819770",
  name: "Acme Corporation",
  color: "hsl(220, 85%, 38%)",
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant>(DEFAULT_TENANT);
  const [tenants] = useState<Tenant[]>([
    { id: "f7229583-c9c9-4e80-88cf-5bbfd2819770", name: "Acme Corporation", color: "hsl(220, 85%, 38%)" },
    { id: "f328cd4e-0fe1-4893-a637-941684749c55", name: "The Synozur Alliance LLC", color: "hsl(277, 98%, 53%)" },
    { id: "33c48024-917b-4045-a1ef-0542c2da57ca", name: "TechStart Inc", color: "hsl(328, 94%, 45%)" },
    { id: "f689f005-63ff-40d8-ac04-79e476615c9b", name: "Global Ventures", color: "hsl(200, 75%, 45%)" },
  ]);

  useEffect(() => {
    const savedTenantId = localStorage.getItem("currentTenantId");
    if (savedTenantId) {
      const savedTenant = tenants.find((t) => t.id === savedTenantId);
      if (savedTenant) {
        setCurrentTenant(savedTenant);
      }
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
