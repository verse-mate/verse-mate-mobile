/**
 * GH-281 — pure routing unit tests (no expo-notifications, no router).
 */
import {
  NOTIFICATION_FALLBACK_ROUTE,
  resolveNotificationRoute,
} from './notification-routing';

describe('resolveNotificationRoute', () => {
  const OLD_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_WEB_URL = OLD_WEB_URL;
  });

  it('maps a versemate:// verse deep link to a reader route with src=notification', () => {
    const result = resolveNotificationRoute(
      'versemate:///bible/43/3?verseStart=16&src=notification',
    );
    expect(result).not.toBeNull();
    expect(result?.route).toBe('/bible/43/3?verse=16&src=notification');
    expect(result?.bookId).toBe(43);
    expect(result?.verseStart).toBe(16);
  });

  it('includes endVerse for a passage range', () => {
    const result = resolveNotificationRoute(
      'versemate:///bible/1/1?verseStart=1&verseEnd=3&src=notification',
    );
    expect(result?.route).toBe(
      '/bible/1/1?verse=1&endVerse=3&src=notification',
    );
  });

  it('routes to the chapter (no verse params) when no verseStart', () => {
    const result = resolveNotificationRoute('versemate:///bible/43/3');
    expect(result?.route).toBe('/bible/43/3?src=notification');
  });

  it('returns null for a non-bible / unparseable link (caller uses fallback)', () => {
    expect(resolveNotificationRoute('versemate:///settings')).toBeNull();
    expect(resolveNotificationRoute('not a url')).toBeNull();
    expect(NOTIFICATION_FALLBACK_ROUTE).toBe('/bible/1/1');
  });
});
