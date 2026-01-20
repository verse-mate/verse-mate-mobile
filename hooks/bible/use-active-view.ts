/**
 * useActiveView Hook
 *
 * Manages the user's active view mode preference (bible or explanations)
 * with persistence to AsyncStorage. The selected view persists across app restarts
 * and chapter navigation.
 *
 * Task Group 8.2: Refactored to remove module-level cache
 * - Cache is now stored in React state within the hook
 * - Eliminates stale state bugs between component instances
 * - Improves testability (no need for manual cache resets)
 *
 * @example
 * ```tsx
 * const { activeView, setActiveView, isLoading } = useActiveView();
 *
 * // Display loading state
 * if (isLoading) {
 *   return <ActivityIndicator />;
 * }
 *
 * // Toggle view
 * <Button onPress={() => setActiveView('explanations')} />
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import type { UseActiveViewResult, ViewModeType } from '@/types/bible';
import { isViewModeType, STORAGE_KEYS } from '@/types/bible';

/**
 * Hook to manage active view state with AsyncStorage persistence
 *
 * @returns {UseActiveViewResult} Object containing:
 *   - activeView: Currently active view ('bible' | 'explanations')
 *   - setActiveView: Function to change active view (updates state AND storage)
 *   - isLoading: Whether initial load from storage is in progress
 *   - error: Error object if loading or saving failed
 */
export function useActiveView(): UseActiveViewResult {
  const [activeView, setActiveViewState] = useState<ViewModeType>('bible');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to track if we've already loaded from storage
  // This prevents re-loading on every render while still allowing proper cleanup
  const hasLoadedRef = useRef(false);

  // Load persisted view from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;

    async function loadPersistedView() {
      // Skip if already loaded in this hook instance
      if (hasLoadedRef.current) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const storedView = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW);

        if (isMounted) {
          const finalView = storedView && isViewModeType(storedView) ? storedView : 'bible';
          setActiveViewState(finalView);
          hasLoadedRef.current = true;
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load active view'));
          setActiveViewState('bible');
          hasLoadedRef.current = true;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPersistedView();

    return () => {
      isMounted = false;
    };
  }, []); // Run only on mount

  /**
   * Set active view and persist to AsyncStorage
   */
  const setActiveView = useCallback(async (view: ViewModeType): Promise<void> => {
    try {
      if (!isViewModeType(view)) {
        throw new Error(`Invalid view type: ${view}. Must be 'bible' or 'explanations'.`);
      }

      // Update state immediately
      setActiveViewState(view);

      // Track analytics: VIEW_MODE_SWITCHED event
      analytics.track(AnalyticsEvent.VIEW_MODE_SWITCHED, {
        mode: view,
      });

      // Persist to storage
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, view);
      setError(null);
    } catch (err) {
      const storageError = err instanceof Error ? err : new Error('Failed to save active view');
      setError(storageError);
      console.error('useActiveView: Failed to persist view to storage:', storageError);
    }
  }, []);

  return {
    activeView,
    setActiveView,
    isLoading,
    error,
  };
}
