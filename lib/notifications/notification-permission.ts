/**
 * OS notification permission helpers (GH-281).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android requires a channel before notifications display; safe to call repeatedly. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Daily Verse',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Treats iOS provisional/ephemeral authorization as granted (like the OS does). */
export function isGranted(
  status: Notifications.NotificationPermissionsStatus,
): boolean {
  if (status.granted) return true;
  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function getNotificationPermissionGranted(): Promise<boolean> {
  return isGranted(await Notifications.getPermissionsAsync());
}

/** Requests permission (creating the Android channel first). Returns whether granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const status = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return isGranted(status);
}
