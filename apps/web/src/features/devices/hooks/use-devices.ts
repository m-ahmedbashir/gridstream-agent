'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeviceAsset, DevicesListResponse, DeviceTelemetryHistoryResponse } from '@gridstream/shared';
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

/** Powers the telemetry chart on the alert-detail page (and, later, a device-detail page). */
export function useDeviceTelemetryQuery(deviceId: string, hours = 24) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['devices', deviceId, 'telemetry', hours],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<DeviceTelemetryHistoryResponse>(`/devices/${deviceId}/telemetry?hours=${hours}`, { token });
    },
    enabled: Boolean(deviceId),
  });
}

interface ChaosEventResult {
  deviceId: string;
  deviceType: DeviceAsset['deviceType'];
  serialNumber: string;
}

/**
 * The "Simulate Chaos Event" dashboard button — enqueues a real,
 * threshold-breaching reading (POST /telemetry/simulate-chaos) through the
 * exact same Redis/BullMQ queue the automatic simulator uses. The mutation
 * resolves as soon as the job is *enqueued*, not once the AI agent has
 * actually finished diagnosing it (that takes a few seconds) — the delayed
 * refetch below is what makes the resulting alert show up promptly instead
 * of waiting on useDiagnosticsQuery's normal 15s poll.
 */
export function useSimulateChaosEventMutation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiFetch<ChaosEventResult>('/telemetry/simulate-chaos', { token, method: 'POST' });
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['diagnostics'] });
      }, 6000);
    },
  });
}
