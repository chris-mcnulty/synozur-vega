import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { getCurrentQuarter, generateQuarters } from "@/lib/fiscal-utils";
import { useTenant } from "@/contexts/TenantContext";

type Quarter = {
  id: string;
  label: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
};

const STORAGE_KEY_PREFIX = "vega-global-time-period";

function getStorageKey(tenantId?: string) {
  return tenantId ? `${STORAGE_KEY_PREFIX}-${tenantId}` : STORAGE_KEY_PREFIX;
}

const currentYear = new Date().getFullYear();
const allQuarters: Quarter[] = [
  { id: `annual-${currentYear + 1}`, label: `Annual ${currentYear + 1}`, year: currentYear + 1, quarter: 0, startDate: "Jan 1", endDate: "Dec 31" },
  ...generateQuarters(currentYear + 1),
  { id: `annual-${currentYear}`, label: `Annual ${currentYear}`, year: currentYear, quarter: 0, startDate: "Jan 1", endDate: "Dec 31" },
  ...generateQuarters(currentYear),
  { id: `annual-${currentYear - 1}`, label: `Annual ${currentYear - 1}`, year: currentYear - 1, quarter: 0, startDate: "Jan 1", endDate: "Dec 31" },
  ...generateQuarters(currentYear - 1),
  { id: `annual-${currentYear - 2}`, label: `Annual ${currentYear - 2}`, year: currentYear - 2, quarter: 0, startDate: "Jan 1", endDate: "Dec 31" },
  ...generateQuarters(currentYear - 2),
];

interface TimePeriodContextValue {
  selectedQuarterId: string;
  setSelectedQuarterId: (id: string) => void;
  selectedQuarter: Quarter | undefined;
  quarter: number;
  year: number;
  allQuarters: Quarter[];
  isAnnual: boolean;
}

const TimePeriodContext = createContext<TimePeriodContextValue | null>(null);

export function TimePeriodProvider({ children }: { children: ReactNode }) {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const prevTenantIdRef = useRef<string | null>(null);

  const getDefaultQuarterId = useCallback(() => {
    const tenantTimePeriod = currentTenant?.defaultTimePeriod as { mode?: string; year?: number; quarter?: number } | null;
    if (tenantTimePeriod?.mode === "specific" && tenantTimePeriod.year && tenantTimePeriod.quarter != null) {
      if (tenantTimePeriod.quarter === 0) {
        return `annual-${tenantTimePeriod.year}`;
      }
      return `q${tenantTimePeriod.quarter}-${tenantTimePeriod.year}`;
    }
    const { quarter, year } = getCurrentQuarter();
    return `q${quarter}-${year}`;
  }, [currentTenant?.defaultTimePeriod]);

  const getInitialQuarterId = () => {
    const storageKey = getStorageKey(currentTenant?.id);
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    return saved || getDefaultQuarterId();
  };

  const [selectedQuarterId, setSelectedQuarterIdRaw] = useState(getInitialQuarterId);

  useEffect(() => {
    if (!tenantLoading && currentTenant) {
      const tenantId = currentTenant.id;
      if (prevTenantIdRef.current !== tenantId) {
        prevTenantIdRef.current = tenantId;
        const storageKey = getStorageKey(tenantId);
        const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        setSelectedQuarterIdRaw(saved || getDefaultQuarterId());
      }
    }
  }, [currentTenant, tenantLoading, getDefaultQuarterId]);

  const setSelectedQuarterId = useCallback((id: string) => {
    setSelectedQuarterIdRaw(id);
    const storageKey = getStorageKey(currentTenant?.id);
    localStorage.setItem(storageKey, id);
  }, [currentTenant?.id]);

  const selectedQuarter = useMemo(
    () => allQuarters.find((q) => q.id === selectedQuarterId),
    [selectedQuarterId]
  );

  const value = useMemo<TimePeriodContextValue>(() => ({
    selectedQuarterId,
    setSelectedQuarterId,
    selectedQuarter,
    quarter: selectedQuarter?.quarter ?? getCurrentQuarter().quarter,
    year: selectedQuarter?.year ?? getCurrentQuarter().year,
    allQuarters,
    isAnnual: selectedQuarter?.quarter === 0,
  }), [selectedQuarterId, setSelectedQuarterId, selectedQuarter]);

  return (
    <TimePeriodContext.Provider value={value}>
      {children}
    </TimePeriodContext.Provider>
  );
}

export function useTimePeriod() {
  const ctx = useContext(TimePeriodContext);
  if (!ctx) throw new Error("useTimePeriod must be used within TimePeriodProvider");
  return ctx;
}
