/**
 * useLastReadPosition Hook
 *
 * Manages the user's last read position with persistence to AsyncStorage.
 * Tracks Bible chapters or topics along with view/tab preferences.
 * Used on app launch to restore the user to their last reading location.
 *
 * @example
 * ```tsx
 * // In app/index.tsx (app launch)
 * const { lastPosition, isLoading } = useLastReadPosition();
 *
 * if (isLoading) {
 *   return <SplashScreen />;
 * }
 *
 * // Redirect to last position or default to Genesis 1
 * if (lastPosition?.type === 'bible') {
 *   return <Redirect href={`/bible/${lastPosition.bookId}/${lastPosition.chapterNumber}`} />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // In ChapterScreen - save position on navigation
 * const { savePosition } = useLastReadPosition();
 *
 * useEffect(() => {
 *   savePosition({
 *     type: 'bible',
 *     bookId: 1,
 *     chapterNumber: 5,
 *     activeTab: 'summary',
 *     activeView: 'explanations',
 *   });
 * }, [bookId, chapterNumber]);
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { LastReadPosition, UseLastReadPositionResult } from '@/types/bible';
import { STORAGE_KEYS } from '@/types/bible';

/**
 * Hook to manage last read position state with AsyncStorage persistence
 *
 * @returns {UseLastReadPositionResult} Object containing:
 *   - lastPosition: Last saved reading position (null if none saved)
 *   - savePosition: Function to save current reading position
 *   - clearPosition: Function to clear saved position
 *   - isLoading: Whether initial load from storage is in progress
 *   - error: Error object if loading or saving failed
 */
export function useLastReadPosition(): UseLastReadPositionResult {
  const [lastPosition, setLastPosition] = useState<LastReadPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load persisted position from AsyncStorage on mount
  useEffect(() => {
    async function loadPersistedPosition() {
      try {
        setIsLoading(true);
        setError(null);

        const storedPosition = await AsyncStorage.getItem(STORAGE_KEYS.LAST_READ_POSITION);

        if (storedPosition) {
          try {
            const parsed = JSON.parse(storedPosition) as LastReadPosition;

            // Validate required fields based on type
            if (parsed.type === 'bible') {
              if (
                typeof parsed.bookId === 'number' &&
                typeof parsed.chapterNumber === 'number' &&
                parsed.bookId >= 1 &&
                parsed.bookId <= 66 &&
                parsed.chapterNumber >= 1
              ) {
                setLastPosition(parsed);
              } else {
                // Invalid Bible position data, clear it
                console.warn('Invalid Bible position data in storage, clearing');
                await AsyncStorage.removeItem(STORAGE_KEYS.LAST_READ_POSITION);
                setLastPosition(null);
              }
            } else if (parsed.type === 'topic') {
              if (typeof parsed.topicId === 'string' && parsed.topicId.length > 0) {
                setLastPosition(parsed);
              } else {
                // Invalid topic position data, clear it
                console.warn('Invalid topic position data in storage, clearing');
                await AsyncStorage.removeItem(STORAGE_KEYS.LAST_READ_POSITION);
                setLastPosition(null);
              }
            } else {
              // Unknown type, clear it
              console.warn('Unknown position type in storage, clearing');
              await AsyncStorage.removeItem(STORAGE_KEYS.LAST_READ_POSITION);
              setLastPosition(null);
            }
          } catch (parseError) {
            // Invalid JSON, clear it
            console.error('Failed to parse stored position, clearing:', parseError);
            await AsyncStorage.removeItem(STORAGE_KEYS.LAST_READ_POSITION);
            setLastPosition(null);
          }
        } else {
          // No stored position
          setLastPosition(null);
        }
      } catch (err) {
        // Handle storage read error gracefully
        setError(err instanceof Error ? err : new Error('Failed to load last read position'));
        setLastPosition(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadPersistedPosition();
  }, []); // Run only on mount

  /**
   * Save current reading position to AsyncStorage
   * Automatically adds timestamp
   */
  const savePosition = useCallback(
    async (position: Omit<LastReadPosition, 'timestamp'>): Promise<void> => {
      try {
        // Validate position data based on type
        if (position.type === 'bible') {
          if (
            typeof position.bookId !== 'number' ||
            typeof position.chapterNumber !== 'number' ||
            position.bookId < 1 ||
            position.bookId > 66 ||
            position.chapterNumber < 1
          ) {
            throw new Error(
              'Invalid Bible position: bookId must be 1-66 and chapterNumber must be >= 1'
            );
          }
        } else if (position.type === 'topic') {
          if (typeof position.topicId !== 'string' || position.topicId.length === 0) {
            throw new Error('Invalid topic position: topicId must be a non-empty string');
          }
        } else {
          throw new Error(`Invalid position type: ${position.type}`);
        }

        // Create position object with timestamp
        const positionWithTimestamp: LastReadPosition = {
          ...position,
          timestamp: Date.now(),
        };

        // Update state immediately for responsive UI
        setLastPosition(positionWithTimestamp);

        // Persist to storage (async, but don't block UI)
        await AsyncStorage.setItem(
          STORAGE_KEYS.LAST_READ_POSITION,
          JSON.stringify(positionWithTimestamp)
        );

        // Clear any previous errors
        setError(null);
      } catch (err) {
        // Handle storage write error
        const storageError =
          err instanceof Error ? err : new Error('Failed to save last read position');
        setError(storageError);

        // Log error for debugging but don't throw (graceful degradation)
        console.error('useLastReadPosition: Failed to persist position to storage:', storageError);
      }
    },
    []
  );

  /**
   * Clear saved reading position from AsyncStorage
   */
  const clearPosition = useCallback(async (): Promise<void> => {
    try {
      setLastPosition(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_READ_POSITION);
      setError(null);
    } catch (err) {
      const storageError =
        err instanceof Error ? err : new Error('Failed to clear last read position');
      setError(storageError);
      console.error('useLastReadPosition: Failed to clear position from storage:', storageError);
    }
  }, []);

  return {
    lastPosition,
    savePosition,
    clearPosition,
    isLoading,
    error,
  };
}
