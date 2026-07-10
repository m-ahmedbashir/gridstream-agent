'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

export type ExtractionMode = 'AUTO_APPROVE' | 'MANUAL_REVIEW';

export interface UserSettings {
  extractionMode: ExtractionMode;
  modelKey: string;
  /** Whether a BYOK provider key is saved — never the key itself, which is write-only once saved. */
  hasApiKey: boolean;
}

export interface SettingsUpdate {
  extractionMode?: ExtractionMode;
  modelKey?: string;
  /** Plaintext key to save (sent once, over HTTPS in production, encrypted server-side before storage). Pass '' to remove a saved key. */
  apiKey?: string;
}

function resolveUserId(userId: string | null | undefined) {
  return userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
}

/**
 * Hook to manage user extraction settings (extraction mode + model preference).
 * Fetches and updates settings from the backend using TanStack React Query.
 */
export function useSettings() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isPending: loading, error, refetch } = useQuery<UserSettings>({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      const currentUserId = resolveUserId(userId);

      const response = await fetch(`http://localhost:3001/users/settings?userId=${currentUserId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { mutateAsync: updateSettingsMutation } = useMutation({
    mutationFn: async (update: SettingsUpdate) => {
      const currentUserId = resolveUserId(userId);

      const response = await fetch(`http://localhost:3001/users/settings?userId=${currentUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (newSettings) => {
      // Merge rather than replace — the PUT response only reflects the fields
      // that were sent, and we don't want a partial update to blank out the rest.
      queryClient.setQueryData(['userSettings', userId], (previous: UserSettings | undefined) => ({
        ...previous,
        ...newSettings,
      }));
    },
  });

  return {
    settings,
    loading,
    error: error ? error.message : null,
    updateSettings: async (update: SettingsUpdate) => {
      try {
        await updateSettingsMutation(update);
        return true;
      } catch (err) {
        return false;
      }
    },
    refetch,
  };
}
