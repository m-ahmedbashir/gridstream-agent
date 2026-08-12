'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiagnosticsListResponse, FaultDiagnostic } from '@gridstream/shared';
import { apiFetch } from '@/lib/api-client';

const DIAGNOSTICS_QUERY_KEY = 'diagnostics';

export function useDiagnosticsQuery(status?: FaultDiagnostic['status']) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: [DIAGNOSTICS_QUERY_KEY, status ?? 'ALL'],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ limit: '100' });
      if (status) params.set('status', status);
      return apiFetch<DiagnosticsListResponse>(`/diagnostics?${params.toString()}`, { token });
    },
    // No websocket/queue-to-frontend infra exists — polling is the honest
    // simple option for near-live updates on a human-review queue.
    refetchInterval: 15_000,
  });
}

function useDecisionMutation(action: 'approve' | 'reject') {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch<FaultDiagnostic>(`/diagnostics/${id}/${action}`, { token, method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DIAGNOSTICS_QUERY_KEY] });
    },
  });
}

export function useApproveDiagnosticMutation() {
  return useDecisionMutation('approve');
}

export function useRejectDiagnosticMutation() {
  return useDecisionMutation('reject');
}
