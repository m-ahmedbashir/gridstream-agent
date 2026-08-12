'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import type { DevicesListResponse } from '@gridstream/shared';
import { apiFetch } from '@/lib/api-client';

export function useDevicesQuery() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<DevicesListResponse>('/devices?limit=100', { token });
    },
  });
}
