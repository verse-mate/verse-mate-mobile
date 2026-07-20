/**
 * Imperative push-token registration lifecycle (GH-281).
 *
 * Separated from the hook so Settings + AuthContext can drive register/unregister
 * without importing a React hook. All backend calls are best-effort.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { analytics } from '@/lib/analytics';
import { AnalyticsEvent } from '@/lib/analytics/types';
import {
  getNotificationPermissionGranted,
  requestNotificationPermission,
} from './notification-permission';
import { registerDeviceToken, unregisterDeviceToken } from './push-api';
import {
  clearStoredPushToken,
  getStoredPushToken,
  isDailyVerseNotificationEnabled,
  setDailyVerseNotificationEnabled,
  setStoredPushToken,
} from './push-token-storage';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

function currentPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Acquire the Expo push token, register it with the backend, and persist it
 * (so logout can unregister it). Returns the token, or null on any failure /
 * unsupported platform.
 */
export async function acquireAndRegisterPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const projectId = getProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return null;
    await setStoredPushToken(token);
    await registerDeviceToken(token, currentPlatform());
    return token;
  } catch (error) {
    console.warn('[notifications] token registration failed:', error);
    return null;
  }
}

/**
 * On login/app-entry: register only if the user is opted-in (D-5) AND OS
 * permission is already granted. Never prompts here — the prompt belongs to
 * onboarding / the Settings toggle.
 */
export async function maybeRegisterOnLogin(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isDailyVerseNotificationEnabled())) return;
  if (!(await getNotificationPermissionGranted())) return;
  await acquireAndRegisterPushToken();
}

/** Settings toggle ON: prompt if needed, register, persist. Returns whether granted. */
export async function enableDailyVerseNotifications(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    analytics.track(AnalyticsEvent.NOTIFICATION_PERMISSION_DENIED, {});
    return false;
  }
  await setDailyVerseNotificationEnabled(true);
  await acquireAndRegisterPushToken();
  analytics.track(AnalyticsEvent.NOTIFICATION_ENABLED, {});
  return true;
}

/** Settings toggle OFF: unregister the token + persist the opt-out. */
export async function disableDailyVerseNotifications(): Promise<void> {
  await setDailyVerseNotificationEnabled(false);
  const token = await getStoredPushToken();
  if (token) {
    await unregisterDeviceToken(token);
    await clearStoredPushToken();
  }
  analytics.track(AnalyticsEvent.NOTIFICATION_DISABLED, {});
}

/**
 * Logout: unregister the stored token while the session (access token) is still
 * valid. Must be called BEFORE the auth tokens are cleared (D-15).
 */
export async function unregisterPushOnLogout(): Promise<void> {
  const token = await getStoredPushToken();
  if (token) {
    await unregisterDeviceToken(token);
    await clearStoredPushToken();
  }
}
