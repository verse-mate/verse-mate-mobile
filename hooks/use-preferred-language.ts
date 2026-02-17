/**
 * usePreferredLanguage Hook
 *
 * Returns the user's preferred language, with offline support.
 * When offline, the user can change their language in settings,
 * which gets saved to AsyncStorage. This hook reads from that
 * store so commentary/explanation hooks pick up the change immediately.
 *
 * Uses a module-level subscriber pattern so that when settings
 * calls `notifyLanguageChanged()`, all mounted consumers re-read
 * the stored value without needing navigation focus events.
 *
 * Priority:
 * 1. Offline-stored preference (AsyncStorage) — takes precedence when set
 * 2. User session preference (auth token)
 * 3. Fallback: 'en-US'
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const OFFLINE_LANGUAGE_KEY = '@versemate:preferred_language';

// Module-level subscriber pattern: settings calls notifyLanguageChanged(),
// all mounted hooks re-read from AsyncStorage.
type Listener = () => void;
const listeners = new Set<Listener>();

// Module-level cache: once loaded from AsyncStorage, all new mounts use this
// instantly instead of waiting for an async read. Prevents language flicker
// when components remount (e.g., chapter swipe causing PagerView key change).
let cachedLanguage: string | null = null;

/**
 * Call this after saving a new language to AsyncStorage.
 * All mounted usePreferredLanguage hooks will re-read the value.
 */
export function notifyLanguageChanged(): void {
  for (const fn of listeners) fn();
}

export function usePreferredLanguage(): string {
  const { user } = useAuth();
  const sessionLanguage =
    typeof user?.preferred_language === 'string' ? user.preferred_language : 'en-US';
  const [language, setLanguage] = useState<string>(cachedLanguage ?? sessionLanguage);

  // Read stored language from AsyncStorage
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(OFFLINE_LANGUAGE_KEY);
        const resolved = stored || sessionLanguage;
        cachedLanguage = resolved;
        if (active) {
          setLanguage(resolved);
        }
      } catch {
        if (active) setLanguage(sessionLanguage);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [sessionLanguage]);

  // Subscribe to language change notifications from settings
  useEffect(() => {
    const refresh = async () => {
      try {
        const stored = await AsyncStorage.getItem(OFFLINE_LANGUAGE_KEY);
        const resolved = stored || sessionLanguage;
        cachedLanguage = resolved;
        setLanguage(resolved);
      } catch {
        setLanguage(sessionLanguage);
      }
    };

    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [sessionLanguage]);

  return language;
}
