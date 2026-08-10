import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { ProjectPlan } from '@maintain/shared';

export interface GeneratePlanVariables {
    machineProfileId: string;
    measureIds: string[];
}

async function generatePlanRequest(variables: GeneratePlanVariables, userId: string): Promise<ProjectPlan> {
    const response = await fetch('http://localhost:3001/maintenance/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...variables, userId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate plan: ${response.statusText}`);
    }

    return response.json();
}

export function usePlan() {
    const { userId } = useAuth();

    return useMutation({
        mutationFn: (variables: GeneratePlanVariables) => {
            const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
            return generatePlanRequest(variables, currentUserId);
        },
        onSuccess: () => {
            toast.success('Maintenance plan generated');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
        },
    });
}

async function fetchPlanRequest(planId: string): Promise<ProjectPlan> {
    const response = await fetch(`http://localhost:3001/maintenance/plans/${planId}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to load plan: ${response.statusText}`);
    }
    return response.json();
}

export function usePlanQuery(planId: string) {
    return useQuery({
        queryKey: ['plan', planId],
        queryFn: () => fetchPlanRequest(planId),
        enabled: !!planId,
    });
}

export async function approvePlan(planId: string, userId: string): Promise<void> {
    const response = await fetch(`http://localhost:3001/maintenance/plans/${planId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to approve plan: ${response.statusText}`);
    }
}

export async function rejectPlan(planId: string, userId: string): Promise<void> {
    const response = await fetch(`http://localhost:3001/maintenance/plans/${planId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to reject plan: ${response.statusText}`);
    }
}
