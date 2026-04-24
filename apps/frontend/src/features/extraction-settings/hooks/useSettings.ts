'use client';

import { useState, useEffect, useCallback } from 'react';

export type ExtractionMode = 'AUTO_APPROVE' | 'MANUAL_REVIEW';

export interface UserSettings {
  extractionMode: ExtractionMode;
}

/**
 * Hook to manage user extraction settings
 * Fetches and updates extraction mode from backend
 */
export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get userId from localStorage (portfolio MVP)
  const getUserId = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || 'default-user';
    }
    return 'default-user';
  }, []);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const userId = getUserId();
      const response = await fetch(`http://localhost:3001/users/settings?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default if fetch fails
      setSettings({ extractionMode: 'MANUAL_REVIEW' });
    } finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Update settings
  const updateSettings = useCallback(
    async (extractionMode: ExtractionMode) => {
      try {
        setLoading(true);
        const userId = getUserId();

        const response = await fetch(`http://localhost:3001/users/settings?userId=${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionMode })
        });

        if (!response.ok) {
          throw new Error(`Failed to update settings: ${response.statusText}`);
        }

        const data = await response.json();
        setSettings(data);
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getUserId]
  );

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings
  };
}
