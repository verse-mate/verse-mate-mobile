/**
 * useRedLetterEnabled Hook
 *
 * Master on/off toggle for red-letter (words of Jesus) rendering, persisted to
 * AsyncStorage. Works for logged-in and logged-out users as a local preference,
 * default OFF — mirroring verse-mate-web's `redLetter` setting (PR #226).
 *
 * Like useLexiconUnderlines, it keeps a module-level subscriber set so toggling
 * "Jesus's Words" on the Highlights screen updates an already-mounted reader
 * live, without needing the reader screen to remount.
 *
 * @example
 * ```tsx
 * const { isEnabled, setEnabled } = useRedLetterEnabled();
 * <Switch value={isEnabled} onValueChange={setEnabled} />
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@versemate:red_letter_enabled';
const DEFAULT_ENABLED = false;

// Module-level cache + subscribers so every mounted consumer stays in sync
// and remounts don't flicker.
let inMemoryCache: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function notify(value: boolean) {
  inMemoryCache = value;
  for (const listener of listeners) listener(value);
}

/** FOR TEST ENVIRONMENTS ONLY — resets the in-memory cache. */
export function __TEST_ONLY_RESET_CACHE() {
  inMemoryCache = null;
  listeners.clear();
}

export interface UseRedLetterEnabledResult {
  /** Whether the words of Jesus are shown in red. */
  isEnabled: boolean;
  /** Update the preference (persists to AsyncStorage, updates all consumers). */
  setEnabled: (value: boolean) => Promise<void>;
  /** Whether the initial load from storage is in progress. */
  isLoading: boolean;
}

export function useRedLetterEnabled(): UseRedLetterEnabledResult {
  const [isEnabled, setState] = useState<boolean>(inMemoryCache ?? DEFAULT_ENABLED);
  const [isLoading, setIsLoading] = useState(inMemoryCache === null);

  // Subscribe to cross-component updates.
  useEffect(() => {
    const listener = (value: boolean) => setState(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Load persisted value once.
  useEffect(() => {
    let isMounted = true;
    if (inMemoryCache !== null) return;

    (async () => {
      try {
        setIsLoading(true);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const value = stored === null ? DEFAULT_ENABLED : stored === 'true';
        if (isMounted) {
          inMemoryCache = value;
          setState(value);
        }
      } catch {
        if (isMounted) {
          inMemoryCache = DEFAULT_ENABLED;
          setState(DEFAULT_ENABLED);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setEnabled = async (value: boolean): Promise<void> => {
    notify(value); // update all consumers immediately
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch (err) {
      if (__DEV__) {
        console.error('useRedLetterEnabled: failed to persist preference:', err);
      }
    }
  };

  return { isEnabled, setEnabled, isLoading };
}
