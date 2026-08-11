'use client';

import { useQuery } from '@tanstack/react-query';

export interface ModelOption {
  key: string;
  provider: string;
  modelId: string;
  supportsVision: boolean;
}

/**
 * Fetches the available model registry entries from the backend, so the
 * frontend never hand-duplicates the list — GET /extraction/models is the
 * single source of truth (see model-registry.ts on the backend).
 */
export function useModelOptions() {
  const { data: models, isPending: loading } = useQuery<ModelOption[]>({
    queryKey: ['modelOptions'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/extraction/models');
      if (!response.ok) {
        throw new Error(`Failed to fetch model options: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // the registry rarely changes — no need to refetch aggressively
  });

  return { models: models ?? [], loading };
}
