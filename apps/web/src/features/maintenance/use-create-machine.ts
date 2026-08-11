import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

export interface CreateMachineVariables {
    machineId: string;
    machineType: string;
    criticality: string;
    location?: string;
}

export interface CreateMachineResult {
    id: string;
    machineId: string;
}

async function createMachineRequest(variables: CreateMachineVariables, userId: string): Promise<CreateMachineResult> {
    const response = await fetch('http://localhost:3001/maintenance/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...variables, userId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create machine: ${response.statusText}`);
    }

    return response.json();
}

export function useCreateMachine() {
    const { userId } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (variables: CreateMachineVariables) => {
            const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
            return createMachineRequest(variables, currentUserId);
        },
        onSuccess: () => {
            toast.success('Machine added');
            queryClient.invalidateQueries({ queryKey: ['maintenance-machines'] });
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to add machine');
        },
    });
}
