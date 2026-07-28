/**
 * Backend calls for push notifications (GH-281).
 *
 * Uses the raw `authenticatedFetch` wrapper (the documented fallback for
 * endpoints not in the generated client) — the device + preferred-version
 * routes were added to the backend in the same feature and aren't in the
 * committed OpenAPI schema yet. All calls are best-effort: failures are logged,
 * never thrown, so notification plumbing never blocks a user flow.
 */
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.versemate.org';

export type DevicePlatform = 'ios' | 'android';

/** Register/refresh this device's Expo push token for the current user. */
export async function registerDeviceToken(
  token: string,
  platform: DevicePlatform,
): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/notifications/device`, {
      method: 'PUT',
      body: JSON.stringify({ token, platform }),
    });
    return res.ok;
  } catch (error) {
    console.warn('[notifications] registerDeviceToken failed:', error);
    return false;
  }
}

/** Unregister this device's token (Settings toggle off / logout). */
export async function unregisterDeviceToken(token: string): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/notifications/device`, {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch (error) {
    console.warn('[notifications] unregisterDeviceToken failed:', error);
    return false;
  }
}

/**
 * Persist the user's preferred Bible version server-side so the daily
 * verse-of-the-day notification renders in it (the backend worker reads
 * `user.preferred_bible_version`).
 */
export async function syncPreferredBibleVersion(
  version: string,
): Promise<boolean> {
  try {
    const res = await authenticatedFetch(
      `${API_BASE}/user/preferred-bible-version`,
      { method: 'POST', body: JSON.stringify({ version }) },
    );
    return res.ok;
  } catch (error) {
    console.warn('[notifications] syncPreferredBibleVersion failed:', error);
    return false;
  }
}
