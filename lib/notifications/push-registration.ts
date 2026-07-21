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
  isGranted,
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
 * On login/app-entry, for an opted-in user (D-5):
 *  - permission already granted → register;
 *  - never asked (UNDETERMINED) → prompt once (spec: "request once after
 *    login/onboarding, not a cold-launch nag"), then register if granted;
 *  - previously denied → do nothing (respect the choice; re-enabling goes
 *    through Settings, which deep-links to OS settings).
 * Without this, the default-ON opt-in would never activate for users who
 * never open Settings (R-001).
 */
export async function maybeRegisterOnLogin(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isDailyVerseNotificationEnabled())) return;

  const perms = await Notifications.getPermissionsAsync();
  if (isGranted(perms)) {
    await acquireAndRegisterPushToken();
    return;
  }
  if (perms.status === Notifications.PermissionStatus.UNDETERMINED) {
    const granted = await requestNotificationPermission();
    if (granted) {
      await acquireAndRegisterPushToken();
    } else {
      analytics.track(AnalyticsEvent.NOTIFICATION_PERMISSION_DENIED, {});
    }
  }
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
