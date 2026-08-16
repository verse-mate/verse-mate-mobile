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
import { syncWidgetBibleVersion } from '@/hooks/use-shared-widget-prefs';
import { getPostHogInstance } from '@/lib/analytics/posthog-provider';
import { syncPreferredBibleVersion } from '@/lib/notifications/push-api';

const BIBLE_VERSION_KEY = 'bible-version';
const DEFAULT_VERSION = 'NASB1995';

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedVersion: string | null = null;

function notifyBibleVersionChanged(): void {
  for (const fn of listeners) fn();
}

/** Set once the server has been told this install's stored translation. */
const VERSION_BACKFILL_KEY = 'preferred-bible-version-backfilled';

/**
 * Push this install's stored translation to the server once, for users who
 * chose it before GH-281 added the server-side sync.
 *
 * `setBibleVersion` only syncs *on change*, so anyone who picked a translation
 * earlier and never touched it again still has the column default (NASB1995)
 * server-side. The daily verse-of-the-day push reads that column, so they get
 * the right verse rendered in the wrong translation — the widget sends
 * `bible_version` explicitly and is unaffected, which is what makes the
 * mismatch look arbitrary.
 *
 * Called when a session settles as logged in. Flag-guarded so it costs one
 * request per install rather than one per launch; best-effort, never surfaced.
 */
export async function backfillPreferredBibleVersion(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(VERSION_BACKFILL_KEY)) return;
    const version = await AsyncStorage.getItem(BIBLE_VERSION_KEY);
    // Nothing stored means the user never chose one — the server default
    // already matches, and writing it would claim a preference they never set.
    if (!version) return;
    if (await syncPreferredBibleVersion(version)) {
      await AsyncStorage.setItem(VERSION_BACKFILL_KEY, 'true');
    }
  } catch {
    // Best-effort; retried next launch since the flag stays unset.
  }
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

      // Mirror to the iOS widget's App Group so the home-screen widget renders
      // in the newly-selected version (GH-265). Fire-and-forget; no-op on Android.
      void syncWidgetBibleVersion(version);

      // GH-281: persist server-side too, so the daily verse-of-the-day push
      // (which reads user.preferred_bible_version) renders in this version.
      // Best-effort; no-op when logged out (401 ignored).
      void syncPreferredBibleVersion(version);

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
