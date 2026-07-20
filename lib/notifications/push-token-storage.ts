/**
 * Persisted Expo push token + the daily-verse opt-in flag (GH-281).
 *
 * The token is stored so logout can unregister it from the backend *before*
 * the access token is cleared. The opt-in flag drives the Settings toggle and
 * gates registration on login (D-5: on once OS permission is granted).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'versemate_push_token';
const DAILY_VERSE_ENABLED_KEY = 'versemate_daily_verse_notification_enabled';

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
 * Daily-verse opt-in. Defaults to enabled (D-5) — absence of the key means the
 * user hasn't opted out, so once permission is granted they receive the verse.
 */
export async function isDailyVerseNotificationEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DAILY_VERSE_ENABLED_KEY);
  return value === null ? true : value === 'true';
}

export async function setDailyVerseNotificationEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(DAILY_VERSE_ENABLED_KEY, String(enabled));
}
