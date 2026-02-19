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
const MULTI_STORAGE_KEY_PREFIX = "vega-global-time-periods";

function getStorageKey(tenantId?: string) {
  return tenantId ? `${STORAGE_KEY_PREFIX}-${tenantId}` : STORAGE_KEY_PREFIX;
}

function getMultiStorageKey(tenantId?: string) {
  return tenantId ? `${MULTI_STORAGE_KEY_PREFIX}-${tenantId}` : MULTI_STORAGE_KEY_PREFIX;
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
  selectedQuarterIds: string[];
  toggleQuarterId: (id: string) => void;
  setSelectedQuarterIds: (ids: string[]) => void;
  selectedQuarters: Quarter[];
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

  const getInitialQuarterIds = (): string[] => {
    const multiKey = getMultiStorageKey(currentTenant?.id);
    const saved = typeof window !== "undefined" ? localStorage.getItem(multiKey) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [getInitialQuarterId()];
  };

  const [selectedQuarterId, setSelectedQuarterIdRaw] = useState(getInitialQuarterId);
  const [selectedQuarterIds, setSelectedQuarterIdsRaw] = useState<string[]>(getInitialQuarterIds);

  useEffect(() => {
    if (!tenantLoading && currentTenant) {
      const tenantId = currentTenant.id;
      if (prevTenantIdRef.current !== tenantId) {
        prevTenantIdRef.current = tenantId;
        const storageKey = getStorageKey(tenantId);
        const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        const defaultId = saved || getDefaultQuarterId();
        setSelectedQuarterIdRaw(defaultId);

        const multiKey = getMultiStorageKey(tenantId);
        const multiSaved = typeof window !== "undefined" ? localStorage.getItem(multiKey) : null;
        if (multiSaved) {
          try {
            const parsed = JSON.parse(multiSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedQuarterIdsRaw(parsed);
              return;
            }
          } catch {}
        }
        setSelectedQuarterIdsRaw([defaultId]);
      }
    }
  }, [currentTenant, tenantLoading, getDefaultQuarterId]);

  const setSelectedQuarterId = useCallback((id: string) => {
    setSelectedQuarterIdRaw(id);
    setSelectedQuarterIdsRaw([id]);
    const storageKey = getStorageKey(currentTenant?.id);
    localStorage.setItem(storageKey, id);
    const multiKey = getMultiStorageKey(currentTenant?.id);
    localStorage.setItem(multiKey, JSON.stringify([id]));
  }, [currentTenant?.id]);

  const setSelectedQuarterIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedQuarterIdsRaw(ids);
    setSelectedQuarterIdRaw(ids[0]);
    const storageKey = getStorageKey(currentTenant?.id);
    localStorage.setItem(storageKey, ids[0]);
    const multiKey = getMultiStorageKey(currentTenant?.id);
    localStorage.setItem(multiKey, JSON.stringify(ids));
  }, [currentTenant?.id]);

  const toggleQuarterId = useCallback((id: string) => {
    setSelectedQuarterIdsRaw(prev => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter(p => p !== id);
        if (next.length === 0) next = [id];
      } else {
        next = [...prev, id];
      }
      setSelectedQuarterIdRaw(next[0]);
      const storageKey = getStorageKey(currentTenant?.id);
      localStorage.setItem(storageKey, next[0]);
      const multiKey = getMultiStorageKey(currentTenant?.id);
      localStorage.setItem(multiKey, JSON.stringify(next));
      return next;
    });
  }, [currentTenant?.id]);

  const selectedQuarter = useMemo(
    () => allQuarters.find((q) => q.id === selectedQuarterId),
    [selectedQuarterId]
  );

  const selectedQuarters = useMemo(
    () => allQuarters.filter((q) => selectedQuarterIds.includes(q.id)),
    [selectedQuarterIds]
  );

  const value = useMemo<TimePeriodContextValue>(() => ({
    selectedQuarterId,
    setSelectedQuarterId,
    selectedQuarter,
    quarter: selectedQuarter?.quarter ?? getCurrentQuarter().quarter,
    year: selectedQuarter?.year ?? getCurrentQuarter().year,
    allQuarters,
    isAnnual: selectedQuarter?.quarter === 0,
    selectedQuarterIds,
    toggleQuarterId,
    setSelectedQuarterIds,
    selectedQuarters,
  }), [selectedQuarterId, setSelectedQuarterId, selectedQuarter, selectedQuarterIds, toggleQuarterId, setSelectedQuarterIds, selectedQuarters]);

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
