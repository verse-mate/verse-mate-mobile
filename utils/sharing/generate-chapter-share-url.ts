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
 * @param insightType - Optional insight tab type (summary, byline, detailed)
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
export function parseChapterShareUrl(
  url: string
): { bookId: number; chapterNumber: number } | null {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL;

  if (!baseUrl) {
    console.warn('EXPO_PUBLIC_WEB_URL environment variable is not set - cannot parse deep link');
    return null;
  }

  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Verify the URL matches our base URL (host must match)
    if (urlObj.host !== baseUrlObj.host) {
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

    return { bookId, chapterNumber };
  } catch (error) {
    console.warn('Failed to parse chapter share URL:', error);
    return null;
  }
}
