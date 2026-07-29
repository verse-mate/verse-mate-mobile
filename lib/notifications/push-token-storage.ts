/**
 * Persisted Expo push token + the daily-verse opt-in flag (GH-281).
 *
 * The token is stored so logout can unregister it from the backend *before*
 * the access token is cleared. The opt-in flag drives the Settings toggle and
 * gates registration on login (D-5: on once OS permission is granted).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@versemate:push_token';
const DAILY_VERSE_ENABLED_KEY = '@versemate:daily_verse_notification_enabled';

// Module-level cache so the Settings toggle can seed its initial value
// synchronously and avoid the OFF→ON flash an async-only read would cause.
let enabledCache: boolean | null = null;

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function setStoredPushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function clearStoredPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

/**
 * Synchronous best-effort read of the opt-in, for initial render. Returns the
 * last known value, or the default (enabled, D-5) before the first async read.
 */
export function getDailyVerseNotificationEnabledCached(): boolean {
  return enabledCache ?? true;
}

/**
 * Daily-verse opt-in. Defaults to enabled (D-5) — absence of the key means the
 * user hasn't opted out. Populates the module cache for synchronous reads.
 */
export async function isDailyVerseNotificationEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DAILY_VERSE_ENABLED_KEY);
  enabledCache = value === null ? true : value === 'true';
  return enabledCache;
}

export async function setDailyVerseNotificationEnabled(
  enabled: boolean,
): Promise<void> {
  enabledCache = enabled;
  await AsyncStorage.setItem(DAILY_VERSE_ENABLED_KEY, String(enabled));
}
