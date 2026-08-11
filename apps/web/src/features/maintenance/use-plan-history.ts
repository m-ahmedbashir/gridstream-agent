import { useQuery } from '@tanstack/react-query';

export interface PlanHistoryItem {
    id: string;
    status: 'draft' | 'approved' | 'rejected';
    totalInvestment: number;
    totalAnnualSavings: number;
    paybackMonths: number;
    confidence: number;
    executiveSummary: string;
    generatedAt: string;
    approvedAt?: string;
    machineProfile?: {
        machineId: string;
        machineType: string;
    };
}

export interface PlanHistoryResponse {
    plans: PlanHistoryItem[];
}

export function usePlanHistory(userId: string | null | undefined) {
    return useQuery<PlanHistoryResponse>({
        queryKey: ['maintenance-plans', userId],
        queryFn: async () => {
            const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
            // The backend does not expose a user-scoped plans endpoint yet, so we fetch
            // via a generic lookup keyed by machineProfileIds for this demo.
            const response = await fetch(`http://localhost:3001/maintenance/history?userId=${currentUserId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch plan history: ${response.statusText}`);
            }
            return response.json();
        },
        enabled: typeof window !== 'undefined',
    });
}
