import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

export interface MachineProfileSummary {
    id: string;
    machineId: string;
    machineType: string;
    criticality: string;
    location: string | null;
    extractedAt: string;
    isDemo: boolean;
}

export function useMachineProfiles() {
    const { userId } = useAuth();
    const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';

    return useQuery<{ machines: MachineProfileSummary[] }>({
        queryKey: ['maintenance-machines', currentUserId],
        queryFn: async () => {
            const response = await fetch(`http://localhost:3001/maintenance/machines?userId=${encodeURIComponent(currentUserId)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch machines: ${response.statusText}`);
            }
            return response.json();
        },
    });
}
