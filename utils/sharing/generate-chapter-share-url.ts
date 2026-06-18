/**
 * Chapter Share URL Utilities
 *
 * Helper functions for generating and parsing shareable URLs for Bible chapters.
 * These URLs use Universal Links (iOS) / App Links (Android) to open directly in
 * the mobile app when installed, or fallback to the web version.
 *
 * URL Format: ${EXPO_PUBLIC_WEB_URL}/bible/[bookSlug]/[chapterNumber]?tab=[insightType]
 * Example: https://app.versemate.org/bible/john/3 (John 3)
 * Example: https://app.versemate.org/bible/john/3?tab=summary (John 3 Summary insight)
 */

import type { ContentTabType } from '@/types/bible';
import { getBookSlug, parseBookParam } from '../bookSlugs';

/**
 * Generates a shareable URL for a Bible chapter
 *
 * Creates a URL that can be shared via the system share sheet. The URL uses
 * HTTPS and will open in the mobile app (via Universal/App Links) if installed,
 * or fallback to the web version with app detection.
 *
 * @param bookId - Bible book ID (1-66, where 1=Genesis, 66=Revelation)
 * @param chapterNumber - Chapter number within the book (positive integer)
 * @param insightType - Optional insight tab type (summary, byline, detailed, study, visuals)
 * @returns Formatted HTTPS URL for sharing with book slug and optional tab query param
 * @throws Error if EXPO_PUBLIC_WEB_URL environment variable is not configured
 *
 * @example
 * generateChapterShareUrl(43, 3)
 * // Returns: "https://app.versemate.org/bible/john/3"
 *
 * @example
 * generateChapterShareUrl(43, 3, 'summary')
 * // Returns: "https://app.versemate.org/bible/john/3?tab=summary"
 */
export function generateChapterShareUrl(
  bookId: number,
  chapterNumber: number,
  insightType?: ContentTabType
): string {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL;

  if (!baseUrl) {
    console.error('EXPO_PUBLIC_WEB_URL environment variable is not set');
    throw new Error('EXPO_PUBLIC_WEB_URL is not configured');
  }

  const bookSlug = getBookSlug(bookId);
  if (!bookSlug) {
    console.error(`Invalid bookId: ${bookId}. Must be between 1-66.`);
    throw new Error(`Invalid bookId: ${bookId}`);
  }

  let url = `${baseUrl}/bible/${bookSlug}/${chapterNumber}`;

  // Append insight tab query parameter if provided
  if (insightType) {
    url += `?tab=${insightType}`;
  }

  return url;
}

/**
 * Parses a chapter share URL to extract book ID and chapter number
 *
 * Validates and extracts the bookId and chapterNumber from a shareable URL.
 * Used for handling incoming deep links when the app is opened from a shared link.
 * Supports both slug-based URLs (new) and numeric IDs (backward compatible).
 *
 * Validation Rules:
 * - URL must match the expected base URL from EXPO_PUBLIC_WEB_URL
 * - URL must follow format: /bible/[bookSlug|bookId]/[chapterNumber]
 * - bookSlug must be valid (e.g., "genesis", "john") OR bookId numeric (1-66)
 * - chapterNumber must be a positive integer
 *
 * @param url - The HTTPS URL to parse
 * @returns Object with bookId and chapterNumber, or null if URL is invalid
 *
 * @example
 * parseChapterShareUrl('https://app.versemate.org/bible/john/3')
 * // Returns: { bookId: 43, chapterNumber: 3 }
 *
 * @example
 * parseChapterShareUrl('https://app.versemate.org/bible/43/3')
 * // Returns: { bookId: 43, chapterNumber: 3 } (backward compatible)
 *
 * @example
 * parseChapterShareUrl('https://example.com/wrong/path')
 * // Returns: null
 */
export function parseChapterShareUrl(url: string): {
  bookId: number;
  chapterNumber: number;
  verseStart?: number;
  verseEnd?: number;
} | null {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL;

  if (!baseUrl) {
    console.warn('EXPO_PUBLIC_WEB_URL environment variable is not set - cannot parse deep link');
    return null;
  }

  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Accept either an https App Link on our web host, or the app's own custom
    // scheme (versemate://) used by the home-screen widget — the latter always
    // opens the native app without relying on App Links domain verification.
    // Custom-scheme URLs are emitted as `versemate:///bible/...` (empty
    // authority), so the path shape below is identical to the web host's.
    const isAppScheme = urlObj.protocol === 'versemate:';
    if (!isAppScheme && urlObj.host !== baseUrlObj.host) {
      return null;
    }

    // Extract path components: /bible/[bookSlug|bookId]/[chapterNumber]
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Validate path structure
    if (pathParts.length !== 3 || pathParts[0] !== 'bible') {
      return null;
    }

    // Parse bookId (accepts both slugs like "john" and numeric IDs like "43")
    const bookIdOrSlug = pathParts[1];
    const bookId = parseBookParam(bookIdOrSlug);

    // Validate bookId
    if (!bookId) {
      return null;
    }

    // Parse chapterNumber
    const chapterNumber = Number.parseInt(pathParts[2], 10);

    // Validate chapterNumber is positive
    if (Number.isNaN(chapterNumber) || chapterNumber < 1) {
      return null;
    }

    // Optional verse range (used by the verse-of-the-day widget deep link):
    // ?verseStart=N&verseEnd=M. Invalid/absent values are simply omitted.
    const parsePositiveInt = (raw: string | null): number | undefined => {
      if (!raw) return undefined;
      const n = Number.parseInt(raw, 10);
      return Number.isNaN(n) || n < 1 ? undefined : n;
    };
    const verseStart = parsePositiveInt(urlObj.searchParams.get('verseStart'));
    const verseEnd = parsePositiveInt(urlObj.searchParams.get('verseEnd'));

    return {
      bookId,
      chapterNumber,
      ...(verseStart !== undefined ? { verseStart } : {}),
      ...(verseEnd !== undefined ? { verseEnd } : {}),
    };
  } catch (error) {
    console.warn('Failed to parse chapter share URL:', error);
    return null;
  }
}

/**
 * Builds the in-app reader route for a verse-of-the-day widget deep link.
 *
 * Maps the parsed `verseStart`/`verseEnd` onto the reader's existing
 * `verse`/`endVerse` query params (which drive scroll-to + highlight). When the
 * link came from the widget (`?src=widget`), `src=widget` is preserved so the
 * chapter screen can fire its WIDGET_OPENED_VERSE_DETAIL re-entry event.
 *
 * Pure string builder — extracted from the deep-link handler so the forwarding
 * mapping is unit-testable (GH-265 T-002).
 *
 * @param bookId - Validated Bible book ID (1-66)
 * @param chapterNumber - Validated chapter number (>= 1)
 * @param verseStart - First verse to scroll to / highlight
 * @param verseEnd - Optional last verse of the passage
 * @param isWidget - Whether the originating link carried `?src=widget`
 * @returns Reader route, e.g. `/bible/43/3?verse=16&endVerse=18&src=widget`
 */
export function buildWidgetVerseRoute(
  bookId: number,
  chapterNumber: number,
  verseStart: number,
  verseEnd: number | undefined,
  isWidget: boolean
): string {
  const verseParams = new URLSearchParams();
  verseParams.set('verse', String(verseStart));
  if (verseEnd) verseParams.set('endVerse', String(verseEnd));
  if (isWidget) verseParams.set('src', 'widget');
  return `/bible/${bookId}/${chapterNumber}?${verseParams.toString()}`;
}
