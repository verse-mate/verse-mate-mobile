/**
 * useLexiconUnderlines Hook
 *
 * Manages the user's preference for showing the gold underline under
 * lexicon-tappable words in the Bible reader, persisted to AsyncStorage.
 *
 * Andy (MOBILE-1001 #7) asked to be able to turn the underlines off (and for
 * a thinner line — see HighlightedText's LEX_UNDERLINE note; RN can't set
 * underline thickness cross-platform, so the line is lightened instead).
 *
 * Turning underlines OFF only removes the visual hint — the words stay
 * tappable for definitions.
 *
 * Unlike useFontSize, this hook keeps a module-level subscriber set so a
 * toggle in Settings updates an already-mounted reader live, without needing
 * the reader screen to remount.
 *
 * @example
 * ```tsx
 * const { showUnderlines, setShowUnderlines } = useLexiconUnderlines();
 * <Switch value={showUnderlines} onValueChange={setShowUnderlines} />
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@versemate:lexicon_underlines';
const DEFAULT_SHOW_UNDERLINES = true;

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

export interface UseLexiconUnderlinesResult {
  /** Whether the lexicon underline hint is shown. */
  showUnderlines: boolean;
  /** Update the preference (persists to AsyncStorage, updates all consumers). */
  setShowUnderlines: (value: boolean) => Promise<void>;
  /** Whether the initial load from storage is in progress. */
  isLoading: boolean;
}

export function useLexiconUnderlines(): UseLexiconUnderlinesResult {
  const [showUnderlines, setState] = useState<boolean>(inMemoryCache ?? DEFAULT_SHOW_UNDERLINES);
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
        const value = stored === null ? DEFAULT_SHOW_UNDERLINES : stored === 'true';
        if (isMounted) {
          inMemoryCache = value;
          setState(value);
        }
      } catch {
        if (isMounted) {
          inMemoryCache = DEFAULT_SHOW_UNDERLINES;
          setState(DEFAULT_SHOW_UNDERLINES);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setShowUnderlines = async (value: boolean): Promise<void> => {
    notify(value); // update all consumers immediately
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch (err) {
      if (__DEV__) {
        console.error('useLexiconUnderlines: failed to persist preference:', err);
      }
    }
  };

  return { showUnderlines, setShowUnderlines, isLoading };
}
