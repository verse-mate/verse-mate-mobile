/**
 * useActiveTab Hook
 *
 * Manages the user's active reading tab preference (Summary, By Line, Detailed)
 * with persistence to AsyncStorage. The selected tab persists across app restarts
 * and chapter navigation.
 *
 * @example
 * ```tsx
 * const { activeTab, setActiveTab, isLoading } = useActiveTab();
 *
 * // Display loading state
 * if (isLoading) {
 *   return <ActivityIndicator />;
 * }
 *
 * // Render tabs
 * <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
 * ```
 *
 * @see Spec: agent-os/specs/2025-10-14-bible-reading-mobile/spec.md (lines 492-515)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { ContentTabType, UseActiveTabResult } from '@/types/bible';
import { isContentTabType, STORAGE_KEYS } from '@/types/bible';

/**
 * Hook to manage active tab state with AsyncStorage persistence
 *
 * @returns {UseActiveTabResult} Object containing:
 *   - activeTab: Currently active tab ('summary' | 'byline' | 'detailed')
 *   - setActiveTab: Function to change active tab (updates state AND storage)
 *   - isLoading: Whether initial load from storage is in progress
 *   - error: Error object if loading or saving failed
 */
export function useActiveTab(): UseActiveTabResult {
  const [activeTab, setActiveTabState] = useState<ContentTabType>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load persisted tab from AsyncStorage on mount
  useEffect(() => {
    async function loadPersistedTab() {
      try {
        setIsLoading(true);
        setError(null);

        const storedTab = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);

        // Validate stored value is a valid tab type
        if (storedTab && isContentTabType(storedTab)) {
          setActiveTabState(storedTab);
        } else {
          // Invalid or missing value - use default 'summary'
          setActiveTabState('summary');
        }
      } catch (err) {
        // Handle storage read error gracefully
        setError(err instanceof Error ? err : new Error('Failed to load active tab'));
        // Fall back to default on error
        setActiveTabState('summary');
      } finally {
        setIsLoading(false);
      }
    }

    loadPersistedTab();
  }, []); // Run only on mount

  /**
   * Set active tab and persist to AsyncStorage
   * Updates both local state and storage atomically
   */
  const setActiveTab = useCallback(async (tab: ContentTabType): Promise<void> => {
    try {
      // Validate tab type
      if (!isContentTabType(tab)) {
        throw new Error(`Invalid tab type: ${tab}. Must be 'summary', 'byline', or 'detailed'.`);
      }

      // Update state immediately for responsive UI
      setActiveTabState(tab);

      // Persist to storage (async, but don't block UI)
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);

      // Clear any previous errors
      setError(null);
    } catch (err) {
      // Handle storage write error
      const storageError = err instanceof Error ? err : new Error('Failed to save active tab');
      setError(storageError);

      // Log error for debugging but don't throw (graceful degradation)
      console.error('useActiveTab: Failed to persist tab to storage:', storageError);
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    isLoading,
    error,
  };
}
