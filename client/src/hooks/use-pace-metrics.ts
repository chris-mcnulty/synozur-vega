import { useQuery } from "@tanstack/react-query";
import type { PaceMetrics } from "@/components/PaceBadge";

interface ObjectivePaceResponse {
  objectiveId: string;
  title: string;
  metrics: PaceMetrics;
  description: string;
}

interface KeyResultPaceResponse {
  keyResultId: string;
  title: string;
  metrics: PaceMetrics;
  description: string;
}

interface BulkPaceResponse {
  objectives: ObjectivePaceResponse[];
  summary: {
    total: number;
    ahead: number;
    onTrack: number;
    behind: number;
    atRisk: number;
    noData: number;
    attentionNeeded: number;
    stalled: number;
  };
}

async function fetchPaceData<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch pace metrics');
  }
  return response.json();
}

export function useObjectivePace(objectiveId: string | undefined) {
  return useQuery<ObjectivePaceResponse>({
    queryKey: ['/api/okr/objectives', objectiveId, 'pace'],
    queryFn: () => fetchPaceData<ObjectivePaceResponse>(`/api/okr/objectives/${objectiveId}/pace`),
    enabled: !!objectiveId,
  });
}

export function useKeyResultPace(keyResultId: string | undefined) {
  return useQuery<KeyResultPaceResponse>({
    queryKey: ['/api/okr/key-results', keyResultId, 'pace'],
    queryFn: () => fetchPaceData<KeyResultPaceResponse>(`/api/okr/key-results/${keyResultId}/pace`),
    enabled: !!keyResultId,
  });
}

export function useBulkPaceMetrics(options?: { quarter?: number; year?: number; tenantId?: string }) {
  const { quarter, year, tenantId } = options || {};
  
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  if (quarter !== undefined) params.set('quarter', quarter.toString());
  if (year !== undefined) params.set('year', year.toString());
  
  const queryString = params.toString();
  const url = `/api/okr/pace-metrics${queryString ? `?${queryString}` : ''}`;
  
  return useQuery<BulkPaceResponse>({
    queryKey: ['/api/okr/pace-metrics', tenantId, quarter, year],
    queryFn: () => fetchPaceData<BulkPaceResponse>(url),
    enabled: !!tenantId,
  });
}
