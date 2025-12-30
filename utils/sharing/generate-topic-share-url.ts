/**
 * Topic Share URL Utilities
 *
 * Helper functions for generating and parsing shareable URLs for topics.
 * These URLs use Universal Links (iOS) / App Links (Android) to open directly in
 * the mobile app when installed, or fallback to the web version.
 *
 * URL Format: ${EXPO_PUBLIC_WEB_URL}/topic/{category-slug}/{topic-slug}?tab={insightType}
 * Example: https://app.versemate.org/topic/events/the-resurrection
 * Example: https://app.versemate.org/topic/events/the-resurrection?tab=summary
 */

import type { ContentTabType } from '@/types/bible';
import { buildTopicUrl, parseTopicUrl } from '../topicSlugs';

/**
 * Generates a shareable URL for a topic
 *
 * Creates a URL that can be shared via the system share sheet. The URL uses
 * HTTPS and will open in the mobile app (via Universal/App Links) if installed,
 * or fallback to the web version with app detection.
 *
 * @param category - Topic category (e.g., "EVENT", "PROPHECY", "PARABLE", "THEME")
 * @param topicTitle - Topic title (e.g., "The Resurrection")
 * @param insightType - Optional insight tab type (summary, byline, detailed)
 * @returns Formatted HTTPS URL for sharing with category and topic slugs and optional tab query param
 * @throws Error if EXPO_PUBLIC_WEB_URL environment variable is not configured
 *
 * @example
 * generateTopicShareUrl("EVENT", "The Resurrection")
 * // Returns: "https://app.versemate.org/topic/events/the-resurrection"
 *
 * @example
 * generateTopicShareUrl("EVENT", "The Resurrection", "summary")
 * // Returns: "https://app.versemate.org/topic/events/the-resurrection?tab=summary"
 */
export function generateTopicShareUrl(
  category: string,
  topicTitle: string,
  insightType?: ContentTabType
): string {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();

  // Treat undefined/null strings as missing
  if (!baseUrl || baseUrl === 'undefined' || baseUrl === 'null') {
    console.error('EXPO_PUBLIC_WEB_URL environment variable is not set');
    throw new Error('EXPO_PUBLIC_WEB_URL is not configured');
  }

  const topicPath = buildTopicUrl(category, topicTitle);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  let url = `${normalizedBaseUrl}${topicPath}`;

  // Append insight tab query parameter if provided
  if (insightType) {
    url += `?tab=${insightType}`;
  }

  return url;
}

/**
 * Parses a topic share URL to extract category and topic slug
 *
 * Validates and extracts the category and topic slug from a shareable URL.
 * Used for handling incoming deep links when the app is opened from a shared link.
 *
 * Validation Rules:
 * - URL must match the expected base URL from EXPO_PUBLIC_WEB_URL
 * - URL must follow format: /topic/{category-slug}/{topic-slug}
 * - category-slug must be valid (events, prophecies, parables, themes)
 * - topic-slug must be a valid slug format
 *
 * @param url - The HTTPS URL to parse
 * @returns Object with category and slug, or null if URL is invalid
 *
 * @example
 * parseTopicShareUrl('https://app.versemate.org/topic/events/the-resurrection')
 * // Returns: { category: "EVENT", slug: "the-resurrection" }
 *
 * @example
 * parseTopicShareUrl('https://example.com/wrong/path')
 * // Returns: null
 */
export function parseTopicShareUrl(url: string): { category: string; slug: string } | null {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();

  // Treat undefined/null strings as missing
  if (!baseUrl || baseUrl === 'undefined' || baseUrl === 'null') {
    console.warn('EXPO_PUBLIC_WEB_URL environment variable is not set - cannot parse deep link');
    return null;
  }

  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Verify scheme and host match expected base URL
    if (urlObj.protocol !== baseUrlObj.protocol || urlObj.host !== baseUrlObj.host) {
      return null;
    }

    // If base URL has a path prefix, ensure it matches and remove it
    let pathname = urlObj.pathname;
    const basePath = baseUrlObj.pathname.replace(/\/+$/, '');
    if (basePath && basePath !== '/') {
      if (!pathname.startsWith(`${basePath}/`) && pathname !== basePath) {
        return null;
      }
      pathname = pathname.slice(basePath.length) || '/';
    }

    // Extract path components: /topic/{category-slug}/{topic-slug}
    const pathParts = pathname.split('/').filter(Boolean);

    // Validate path structure
    if (pathParts.length !== 3 || pathParts[0] !== 'topic') {
      return null;
    }

    const categorySlug = pathParts[1];
    const topicSlug = pathParts[2];

    // Parse and validate category and slug
    return parseTopicUrl(categorySlug, topicSlug);
  } catch (error) {
    console.warn('Failed to parse topic share URL:', error);
    return null;
  }
}
