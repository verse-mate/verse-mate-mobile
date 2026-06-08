/**
 * Bridge the user's preferred Bible version into the iOS widget's shared
 * container (GH-265).
 *
 * The iOS Verse-of-the-Day widget runs in a separate process and reads the
 * preferred version from the App Group `group.org.versemate.app`. We mirror
 * the version there whenever it changes. Android needs nothing here — its
 * widget task handler reads the same AsyncStorage key directly (shared JS
 * sandbox).
 *
 * Authored without an Apple toolchain — verify the App Group write on device.
 */
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.org.versemate.app';
const VERSION_KEY = 'preferred_bible_version';

export async function syncWidgetBibleVersion(version: string): Promise<void> {
  // iOS-only: Android's widget reads AsyncStorage in its own JS task handler.
  if (Platform.OS !== 'ios') return;
  try {
    await SharedGroupPreferences.setItem(VERSION_KEY, version, APP_GROUP);
  } catch (error) {
    if (__DEV__) {
      console.warn('[widget] failed to sync Bible version to App Group:', error);
    }
  }
}
