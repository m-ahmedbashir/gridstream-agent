'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

export type ExtractionMode = 'AUTO_APPROVE' | 'MANUAL_REVIEW';

export interface UserSettings {
  extractionMode: ExtractionMode;
}

/**
 * Hook to manage user extraction settings
 * Fetches and updates extraction mode from backend using TanStack React Query
 */
export function useSettings() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isPending: loading, error, refetch } = useQuery<UserSettings>({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      // If no valid auth user, fallback to local storage or default user (or throw error)
      const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
      
      const response = await fetch(`http://localhost:3001/users/settings?userId=${currentUserId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }
      return response.json();
    },
    // Only fire query when we have at least mounted on client, but it handles suspense anyway
  });

  const { mutateAsync: updateSettingsMutation } = useMutation({
    mutationFn: async (extractionMode: ExtractionMode) => {
      const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';

      const response = await fetch(`http://localhost:3001/users/settings?userId=${currentUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionMode })
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (newSettings) => {
      // Invalidate and aggressively refetch userSettings
      queryClient.setQueryData(['userSettings', userId], newSettings);
    }
  });

  return {
    settings,
    loading,
    error: error ? error.message : null,
    updateSettings: async (mode: ExtractionMode) => {
      try {
        await updateSettingsMutation(mode);
        return true;
      } catch (err) {
        return false;
      }
    },
    refetch,
  };
}
