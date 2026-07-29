/**
 * Notification deep-link routing (GH-281).
 *
 * Pure functions that map a verse-of-the-day notification's `data.deepLink`
 * (a `versemate:///bible/{bookId}/{chapterNumber}?verseStart=…&src=notification`
 * URL, produced by the backend) onto the in-app reader route. Kept as plain
 * functions — no `expo-notifications`, no router — so they're unit-testable
 * with zero mocking (mirrors the widget's `buildWidgetVerseRoute`).
 */
import { parseChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

/** Where a malformed / unparseable notification link lands. */
export const NOTIFICATION_FALLBACK_ROUTE = '/bible/1/1';

export interface NotificationRoute {
  /** Reader route to push, e.g. `/bible/43/3?verse=16&src=notification`. */
  route: string;
  bookId: number;
  chapterNumber: number;
  verseStart?: number;
  verseEnd?: number;
}

/**
 * Resolve a notification deep link into a reader route (with `src=notification`
 * so analytics/reader can distinguish notification opens from widget opens).
 * Returns null when the link can't be parsed — callers use
 * {@link NOTIFICATION_FALLBACK_ROUTE}.
 */
export function resolveNotificationRoute(
  deepLink: string,
): NotificationRoute | null {
  const parsed = parseChapterShareUrl(deepLink);
  if (!parsed) return null;

  const { bookId, chapterNumber, verseStart, verseEnd } = parsed;
  if (bookId < 1 || bookId > 66 || chapterNumber < 1) return null;

  const params = new URLSearchParams();
  if (verseStart) {
    params.set('verse', String(verseStart));
    if (verseEnd) params.set('endVerse', String(verseEnd));
  }
  params.set('src', 'notification');

  return {
    route: `/bible/${bookId}/${chapterNumber}?${params.toString()}`,
    bookId,
    chapterNumber,
    verseStart,
    verseEnd,
  };
}
