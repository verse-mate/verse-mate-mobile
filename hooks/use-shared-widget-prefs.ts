/**
 * Bridge per-user widget data (preferred Bible version + personalization id)
 * into the widget's shared container (GH-265).
 *
 * The iOS Verse-of-the-Day widget runs in a separate process and reads from
 * the App Group `group.org.versemate.app`, so we mirror values there. The
 * Android widget task handler reads the same AsyncStorage keys directly
 * (shared JS sandbox).
 *
 * Authored without an Apple toolchain — verify the App Group writes on device.
 */
import { ExtensionStorage } from '@bacons/apple-targets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

import { widgetStrings } from '@/widgets/widget-strings';

const APP_GROUP = 'group.org.versemate.app';
const VERSION_KEY = 'preferred_bible_version';
// Personalization id (the logged-in user's own id). The Android widget reads
// it from AsyncStorage (shared JS sandbox); the iOS widget reads it from the
// App Group. Used as `pid` so the widget shows the user's personal verse
// (PD-7). Cleared on logout so the widget reverts to the global verse.
const USER_ID_ASYNC_KEY = 'widget-user-id';
const USER_ID_GROUP_KEY = 'widget_user_id';
// Pre-resolved widget chrome. The iOS widget is a separate Swift process and
// cannot reach the JS catalogs, so the app resolves and mirrors them; Android
// reads the catalogs directly in its headless task (widgets/widget-strings.ts).
const STRINGS_GROUP_KEY = 'widget_strings';

/**
 * Ask WidgetKit to rebuild the widget's timeline now.
 *
 * Without this an identity change — signing in, switching translation — takes
 * up to 6h to reach the iOS widget, because its timeline policy is the only
 * refresh trigger. Android repaints on app foreground instead.
 *
 * No native module needed: `@bacons/apple-targets`, already a dependency for
 * the widget target itself, exposes WidgetCenter for exactly this. iOS-only and
 * best-effort — a failed reload must never surface in the app.
 */
function reloadIosWidget(): void {
  if (Platform.OS !== 'ios') return;
  try {
    ExtensionStorage.reloadWidget();
  } catch (error) {
    if (__DEV__) console.warn('[widget] reload failed:', error);
  }
}

/**
 * Mirror the resolved chrome for a language into the App Group.
 *
 * Called whenever the app's language changes and on session restore, so the
 * widget's frame matches the app's. Falls back to English when the key was
 * never written — the same limitation that already applies to version and pid.
 */
export async function syncWidgetStrings(languageCode: string | null): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await SharedGroupPreferences.setItem(
      STRINGS_GROUP_KEY,
      JSON.stringify(widgetStrings(languageCode)),
      APP_GROUP
    );
    reloadIosWidget();
  } catch (error) {
    if (__DEV__) console.warn('[widget] failed to sync strings:', error);
  }
}

export async function syncWidgetBibleVersion(version: string): Promise<void> {
  // iOS-only: Android's widget reads AsyncStorage in its own JS task handler.
  if (Platform.OS !== 'ios') return;
  try {
    await SharedGroupPreferences.setItem(VERSION_KEY, version, APP_GROUP);
    reloadIosWidget();
  } catch (error) {
    if (__DEV__) {
      console.warn('[widget] failed to sync Bible version to App Group:', error);
    }
  }
}

/**
 * Mirror the logged-in user's id into the widget container so the widget can
 * request that user's personal verse of the day (PD-7). Pass `null` on logout
 * to clear it (the widget then shows the global verse). Best-effort: failures
 * are swallowed so they never break auth or the widget.
 *
 * Android reads the AsyncStorage key directly (shared JS sandbox); iOS reads
 * the App Group, so we mirror there too.
 */
export async function syncWidgetUserId(userId: string | null): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.setItem(USER_ID_ASYNC_KEY, userId);
    } else {
      await AsyncStorage.removeItem(USER_ID_ASYNC_KEY);
    }
    if (Platform.OS === 'ios') {
      // No delete API — store empty string to represent "no user".
      await SharedGroupPreferences.setItem(USER_ID_GROUP_KEY, userId ?? '', APP_GROUP);
      reloadIosWidget();
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[widget] failed to sync user id:', error);
    }
  }
}
