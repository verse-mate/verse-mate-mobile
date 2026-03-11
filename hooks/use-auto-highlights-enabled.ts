/**
 * Auto-Highlights Enabled Hook
 *
 * Manages the master on/off toggle for auto-highlights using AsyncStorage.
 * Works for both logged-in and logged-out users as a local preference.
 *
 * - `undefined` = not yet set by user (falls back to server default behavior)
 * - `true` = user explicitly enabled auto-highlights
 * - `false` = user explicitly disabled auto-highlights
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const AUTO_HIGHLIGHTS_ENABLED_KEY = 'auto-highlights-enabled';

export function useAutoHighlightsEnabled() {
  const [isEnabled, setIsEnabledState] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTO_HIGHLIGHTS_ENABLED_KEY);
        if (stored !== null) {
          setIsEnabledState(stored === 'true');
        }
      } catch (error) {
        console.error('Failed to load auto-highlights preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreference();
  }, []);

  const setEnabled = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(AUTO_HIGHLIGHTS_ENABLED_KEY, String(value));
      setIsEnabledState(value);
    } catch (error) {
      console.error('Failed to save auto-highlights preference:', error);
      throw error;
    }
  };

  return {
    isEnabled,
    setEnabled,
    isLoading,
  };
}
