import { useQuery } from '@tanstack/react-query';

export type ReadingStatus = 'normal' | 'warning' | 'critical';

export interface TelemetryReading {
    id: string;
    metric: string;
    value: number;
    unit: string;
    recordedAt: string;
}

export interface TelemetrySnapshot {
    machineProfileId: string;
    machineId: string;
    /** The machine's static business-importance rating — unrelated to `status` below. */
    criticality: string;
    baseline: number;
    unit: string;
    /** Live sensor health, derived from the latest reading vs. baseline — unrelated to `criticality` above. */
    status: ReadingStatus;
    suggestedIssues: string[];
    readings: TelemetryReading[];
    isSimulated: true;
}

// Refetches while the page is open so the trend chart and status genuinely
// move over time, without needing a server-side push/websocket layer.
const POLL_INTERVAL_MS = 30_000;

export function useTelemetry(machineProfileId: string | undefined) {
    return useQuery<TelemetrySnapshot>({
        queryKey: ['maintenance-telemetry', machineProfileId],
        queryFn: async () => {
            if (!machineProfileId) {
                throw new Error('machineProfileId is required');
            }
            const response = await fetch(`http://localhost:3001/maintenance/machines/${machineProfileId}/telemetry`);
            if (!response.ok) {
                throw new Error(`Failed to fetch telemetry: ${response.statusText}`);
            }
            return response.json();
        },
        enabled: Boolean(machineProfileId),
        refetchInterval: POLL_INTERVAL_MS,
    });
}
