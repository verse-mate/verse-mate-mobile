/**
 * useActiveTab Hook
 *
 * Manages the user's active reading tab preference (Summary, By Line, Detailed)
 * with persistence to AsyncStorage. The selected tab persists across app restarts
 * and chapter navigation.
 *
 * Task Group 8.3: Refactored to remove module-level cache
 * - Cache is now stored in React state within the hook
 * - Eliminates stale state bugs between component instances
 * - Improves testability (no need for manual cache resets)
 * - Removed __TEST_ONLY_RESET_CACHE() function as it's no longer needed
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
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

  // Use ref to track if we've already loaded from storage
  // This prevents re-loading on every render while still allowing proper cleanup
  const hasLoadedRef = useRef(false);

  // Load persisted tab from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;

    async function loadPersistedTab() {
      // Skip if already loaded in this hook instance
      if (hasLoadedRef.current) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const storedTab = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);

        if (isMounted) {
          const finalTab = storedTab && isContentTabType(storedTab) ? storedTab : 'summary';
          setActiveTabState(finalTab);
          hasLoadedRef.current = true;
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load active tab'));
          setActiveTabState('summary');
          hasLoadedRef.current = true;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPersistedTab();

    return () => {
      isMounted = false;
    };
  }, []);

  const setActiveTab = useCallback(async (tab: ContentTabType): Promise<void> => {
    try {
      if (!isContentTabType(tab)) {
        throw new Error(`Invalid tab type: ${tab}. Must be 'summary', 'byline', or 'detailed'.`);
      }

      // Update state immediately
      setActiveTabState(tab);

      // Track analytics: EXPLANATION_TAB_CHANGED event
      analytics.track(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: tab,
      });

      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
      setError(null);
    } catch (err) {
      const storageError = err instanceof Error ? err : new Error('Failed to save active tab');
      setError(storageError);
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
