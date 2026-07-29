/**
 * Runtime switch between the gesture-driven pager and the ViewPager2 one.
 *
 * ## Why a flag rather than a replacement
 *
 * Chapter paging is the app's most-used interaction and the ViewPager path carries
 * a year of fixes for problems that are invisible until they bite: trailing
 * page-selected events causing phantom rewinds, slot-vs-chapter keys losing scroll
 * position, the pending-nav fallback timer, boundary pages. The gesture pager is
 * built to sidestep the class of bug that caused them, but "built to" is not
 * "measured to", and swapping outright would leave no way to tell a regression
 * from a coincidence.
 *
 * One build serving both arms means a capture can compare them in the same session
 * on the same device, and it is the escape hatch if the new path misbehaves on
 * hardware we do not have.
 *
 * Mirrors `use-native-text`, including its module-level subscriber list so
 * toggling updates an already-mounted reader live.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@versemate:gesture_pager';

/**
 * ON by default, as of 2026-07-29.
 *
 * It has now met both conditions the previous comment set: measured against ViewPager2, and driven
 * by hand. The decisive number is fast-swipe reliability — a rapid run of swipes lands **20/20**
 * chapter navigations on this pager and **11/20** on ViewPager2, which drops nine outright. That is
 * the operator's primary complaint ("the swiping is what matters here", MyBible swipes "basically
 * endlessly"), and dropping half of a fast run is a correctness failure, not a smoothness one.
 *
 * Its jank percentage IS higher in a paired capture (5.64% vs 2.68%) and that is not hidden here —
 * but it performs about 80% MORE navigations in the same window, so it is doing more work per unit
 * time rather than the same work worse. A pager that ignores half your gestures has a flattering
 * frame profile precisely because it rendered nothing.
 *
 * The stored preference still wins, so anyone who flips it off keeps ViewPager2.
 */
const DEFAULT_ENABLED = true;

let inMemoryCache: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function notify(value: boolean): void {
  inMemoryCache = value;
  for (const listener of listeners) listener(value);
}

/** FOR TEST ENVIRONMENTS ONLY — resets the in-memory cache. */
export function __TEST_ONLY_RESET_GESTURE_PAGER_CACHE(): void {
  inMemoryCache = null;
  listeners.clear();
}

export interface UseGesturePagerResult {
  useGesturePager: boolean;
  setUseGesturePager: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

export function useGesturePager(): UseGesturePagerResult {
  const [enabled, setEnabled] = useState<boolean>(inMemoryCache ?? DEFAULT_ENABLED);
  const [isLoading, setIsLoading] = useState(inMemoryCache === null);

  useEffect(() => {
    const listener = (value: boolean) => setEnabled(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (inMemoryCache !== null) return;
    let isMounted = true;

    (async () => {
      try {
        setIsLoading(true);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const value = stored === null ? DEFAULT_ENABLED : stored === 'true';
        if (isMounted) {
          inMemoryCache = value;
          setEnabled(value);
          // Announced so a capture can verify which pager it measured rather than
          // infer it. Inferring the arm has already produced one wrong conclusion
          // in this project.
          if (__DEV__) console.log(`[VMPERF] pager arm gesture=${value}`);
        }
      } catch {
        if (isMounted) {
          inMemoryCache = DEFAULT_ENABLED;
          setEnabled(DEFAULT_ENABLED);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setUseGesturePager = async (value: boolean): Promise<void> => {
    notify(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Preference is lost on restart; the current session still honours it.
    }
  };

  return { useGesturePager: enabled, setUseGesturePager, isLoading };
}
