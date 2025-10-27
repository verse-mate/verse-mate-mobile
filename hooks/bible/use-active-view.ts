/**
 * useActiveView Hook
 *
 * Manages the user's active view mode preference (bible or explanations)
 * with persistence to AsyncStorage. The selected view persists across app restarts
 * and chapter navigation.
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
import { useCallback, useEffect, useState } from 'react';
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

  // Load persisted view from AsyncStorage on mount
  useEffect(() => {
    async function loadPersistedView() {
      try {
        setIsLoading(true);
        setError(null);

        const storedView = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW);

        // Validate stored value is a valid view type
        if (storedView && isViewModeType(storedView)) {
          setActiveViewState(storedView);
        } else {
          // Invalid or missing value - use default 'bible'
          setActiveViewState('bible');
        }
      } catch (err) {
        // Handle storage read error gracefully
        setError(err instanceof Error ? err : new Error('Failed to load active view'));
        // Fall back to default on error
        setActiveViewState('bible');
      } finally {
        setIsLoading(false);
      }
    }

    loadPersistedView();
  }, []); // Run only on mount

  /**
   * Set active view and persist to AsyncStorage
   * Updates both local state and storage atomically
   */
  const setActiveView = useCallback(async (view: ViewModeType): Promise<void> => {
    try {
      // Validate view type
      if (!isViewModeType(view)) {
        throw new Error(`Invalid view type: ${view}. Must be 'bible' or 'explanations'.`);
      }

      // Update state immediately for responsive UI
      setActiveViewState(view);

      // Persist to storage (async, but don't block UI)
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, view);

      // Clear any previous errors
      setError(null);
    } catch (err) {
      // Handle storage write error
      const storageError = err instanceof Error ? err : new Error('Failed to save active view');
      setError(storageError);

      // Log error for debugging but don't throw (graceful degradation)
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
