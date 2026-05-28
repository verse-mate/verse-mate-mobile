/**
 * Bible Version Hook
 *
 * Manages Bible version selection and persistence using AsyncStorage.
 * Provides similar API to web's useBibleVersion hook.
 *
 * Uses a module-level subscriber pattern (same as `usePreferredLanguage`)
 * so that calling `setBibleVersion` from any component re-notifies every
 * mounted consumer. Without this, Settings updates its own local state
 * but the already-mounted ChapterScreen instance reads stale `useState`
 * and the chapter fetch never picks up the new version.
 *
 * @see Task 4.3 - Analytics tracking for preferred_bible_version
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { getPostHogInstance } from '@/lib/analytics/posthog-provider';

const BIBLE_VERSION_KEY = 'bible-version';
const DEFAULT_VERSION = 'NASB1995';

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedVersion: string | null = null;

function notifyBibleVersionChanged(): void {
  for (const fn of listeners) fn();
}

/**
 * Reset the module-level cache. Test-only — Jest's AsyncStorage.clear()
 * doesn't touch this module's state, so without an explicit reset the
 * cached value from one test bleeds into the next.
 */
export function resetCachedVersion(): void {
  cachedVersion = null;
}

export function useBibleVersion() {
  const [bibleVersion, setBibleVersionState] = useState<string>(cachedVersion ?? DEFAULT_VERSION);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const stored = await AsyncStorage.getItem(BIBLE_VERSION_KEY);
        const resolved = stored || DEFAULT_VERSION;
        cachedVersion = resolved;
        if (active) {
          setBibleVersionState(resolved);
          console.log('[bible-version] refresh →', resolved);
        }
      } catch (error) {
        console.error('Failed to load Bible version:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    refresh();
    listeners.add(refresh);

    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);

  const setBibleVersion = async (version: string) => {
    try {
      await AsyncStorage.setItem(BIBLE_VERSION_KEY, version);
      cachedVersion = version;
      setBibleVersionState(version);
      console.log('[bible-version] setBibleVersion →', version);

      const posthog = getPostHogInstance();
      if (posthog) {
        posthog.capture('$set', {
          $set: { preferred_bible_version: version },
        });
      }

      notifyBibleVersionChanged();
    } catch (error) {
      console.error('Failed to save Bible version:', error);
      throw error;
    }
  };

  return {
    bibleVersion,
    setBibleVersion,
    isLoading,
  };
}
