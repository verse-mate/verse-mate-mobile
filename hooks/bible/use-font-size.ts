/**
 * useFontSize Hook
 *
 * Manages the user's preferred Bible text font size with persistence
 * to AsyncStorage. The font size persists across app restarts and
 * chapter navigation.
 *
 * @example
 * ```tsx
 * const { fontSize, setFontSize, isLoading } = useFontSize();
 *
 * // Apply to verse text
 * <Text style={{ fontSize }}>In the beginning...</Text>
 *
 * // Settings slider
 * <Slider value={fontSize} onValueChange={setFontSize} />
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@versemate:font_size';
const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 13;
const MAX_FONT_SIZE = 26;

// Module-level cache to prevent flickering on remount
let inMemoryCache: number | null = null;

// ============================================================================
// Types
// ============================================================================

export interface UseFontSizeResult {
  /** Current font size in pixels */
  fontSize: number;
  /** Update font size (persists to AsyncStorage) */
  setFontSize: (size: number) => Promise<void>;
  /** Whether initial load from storage is in progress */
  isLoading: boolean;
  /** Error if loading or saving failed */
  error: Error | null;
  /** Minimum allowed font size */
  minFontSize: number;
  /** Maximum allowed font size */
  maxFontSize: number;
  /** Default font size */
  defaultFontSize: number;
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * FOR TEST ENVIRONMENTS ONLY
 * Resets the in-memory cache for this hook.
 */
export function __TEST_ONLY_RESET_CACHE() {
  inMemoryCache = null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to manage font size state with AsyncStorage persistence
 */
export function useFontSize(): UseFontSizeResult {
  const [fontSize, setFontSizeState] = useState<number>(inMemoryCache || DEFAULT_FONT_SIZE);
  const [isLoading, setIsLoading] = useState(!inMemoryCache);
  const [error, setError] = useState<Error | null>(null);

  // Load persisted font size from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;

    async function loadPersistedFontSize() {
      if (inMemoryCache !== null) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);

        if (isMounted) {
          let finalSize = DEFAULT_FONT_SIZE;
          if (stored) {
            const parsed = Number(stored);
            if (Number.isFinite(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
              finalSize = parsed;
            }
          }
          setFontSizeState(finalSize);
          inMemoryCache = finalSize;
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load font size'));
          setFontSizeState(DEFAULT_FONT_SIZE);
          inMemoryCache = DEFAULT_FONT_SIZE;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPersistedFontSize();

    return () => {
      isMounted = false;
    };
  }, []);

  const setFontSize = async (size: number): Promise<void> => {
    try {
      const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(size)));
      setFontSizeState(clamped);
      inMemoryCache = clamped;
      await AsyncStorage.setItem(STORAGE_KEY, String(clamped));
      setError(null);
    } catch (err) {
      const storageError = err instanceof Error ? err : new Error('Failed to save font size');
      setError(storageError);
      console.error('useFontSize: Failed to persist font size to storage:', storageError);
    }
  };

  return {
    fontSize,
    setFontSize,
    isLoading,
    error,
    minFontSize: MIN_FONT_SIZE,
    maxFontSize: MAX_FONT_SIZE,
    defaultFontSize: DEFAULT_FONT_SIZE,
  };
}
