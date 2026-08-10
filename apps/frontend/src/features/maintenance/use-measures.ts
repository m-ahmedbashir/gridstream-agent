import { useQuery } from '@tanstack/react-query';
import type { Measure } from '@maintain/shared';

export interface MeasuresResponse {
    measures: Measure[];
}

export function useMeasures(machineProfileId: string | undefined) {
    return useQuery<MeasuresResponse>({
        queryKey: ['maintenance-measures', machineProfileId],
        queryFn: async () => {
            if (!machineProfileId) {
                throw new Error('machineProfileId is required');
            }
            const response = await fetch(`http://localhost:3001/maintenance/measures?machineProfileId=${machineProfileId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch measures: ${response.statusText}`);
            }
            return response.json();
        },
        enabled: Boolean(machineProfileId),
    });
}
