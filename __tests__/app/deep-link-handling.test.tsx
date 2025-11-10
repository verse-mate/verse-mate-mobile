/**
 * Tests for Deep Link Handling
 *
 * Focused tests for URL parsing and navigation in app root layout.
 * Tests cover critical deep link behaviors without exhaustive coverage.
 */

import { parseChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';

// Mock environment variable
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';

describe('Deep Link Handling', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
  });

  it('parses valid chapter URL correctly', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/43/3');
    expect(result).toEqual({ bookId: 43, chapterNumber: 3 });
  });

  it('returns null for invalid bookId (out of range)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/99/1');
    expect(result).toBeNull();
  });

  it('returns null for invalid chapter number (zero)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/0');
    expect(result).toBeNull();
  });

  it('returns null for malformed URL', () => {
    const result = parseChapterShareUrl('https://example.com/wrong/path');
    expect(result).toBeNull();
  });

  it('handles Genesis 1 (minimum valid values)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/1');
    expect(result).toEqual({ bookId: 1, chapterNumber: 1 });
  });

  it('handles Revelation 22 (maximum book ID)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/66/22');
    expect(result).toEqual({ bookId: 66, chapterNumber: 22 });
  });

  it('returns null when environment variable not set', () => {
    // biome-ignore lint/performance/noDelete: Required for test to actually unset env variable
    delete process.env.EXPO_PUBLIC_WEB_URL;
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/1');
    expect(result).toBeNull();
  });

  it('returns null for non-numeric path components', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/john/three');
    expect(result).toBeNull();
  });
});
