/**
 * Tests for Chapter Share URL Helper Functions
 *
 * Focused tests for URL generation and parsing functions used for deep linking.
 * Tests cover critical behaviors without exhaustive edge case coverage.
 */

import {
  generateChapterShareUrl,
  parseChapterShareUrl,
} from '@/utils/sharing/generate-chapter-share-url';

describe('generateChapterShareUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_WEB_URL;

  beforeEach(() => {
    // Set test environment variable
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
  });

  afterEach(() => {
    // Restore original environment
    process.env.EXPO_PUBLIC_WEB_URL = originalEnv;
  });

  it('generates correct URL for Genesis 1', () => {
    const url = generateChapterShareUrl(1, 1);
    expect(url).toBe('https://app.versemate.org/bible/1/1');
  });

  it('generates correct URL for John 3', () => {
    const url = generateChapterShareUrl(43, 3);
    expect(url).toBe('https://app.versemate.org/bible/43/3');
  });

  it('generates correct URL for Revelation 22', () => {
    const url = generateChapterShareUrl(66, 22);
    expect(url).toBe('https://app.versemate.org/bible/66/22');
  });
});

describe('generateChapterShareUrl - error handling', () => {
  it('throws error when EXPO_PUBLIC_WEB_URL is not set', () => {
    const originalValue = process.env.EXPO_PUBLIC_WEB_URL;
    // biome-ignore lint/performance/noDelete: Required for test to actually unset env variable
    delete process.env.EXPO_PUBLIC_WEB_URL;

    expect(() => generateChapterShareUrl(1, 1)).toThrow('EXPO_PUBLIC_WEB_URL is not configured');

    // Restore
    process.env.EXPO_PUBLIC_WEB_URL = originalValue;
  });
});

describe('parseChapterShareUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_WEB_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = originalEnv;
  });

  it('parses valid Genesis 1 URL', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/1');
    expect(result).toEqual({ bookId: 1, chapterNumber: 1 });
  });

  it('parses valid John 3 URL', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/43/3');
    expect(result).toEqual({ bookId: 43, chapterNumber: 3 });
  });

  it('returns null for malformed URL', () => {
    const result = parseChapterShareUrl('https://example.com/wrong/path');
    expect(result).toBeNull();
  });

  it('returns null for invalid bookId (out of range)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/99/1');
    expect(result).toBeNull();
  });

  it('returns null for invalid chapterNumber (negative)', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/-1');
    expect(result).toBeNull();
  });

  it('returns null for non-numeric bookId', () => {
    const result = parseChapterShareUrl('https://app.versemate.org/bible/john/3');
    expect(result).toBeNull();
  });

  it('returns null when URL does not match base URL', () => {
    const result = parseChapterShareUrl('https://different-domain.com/bible/1/1');
    expect(result).toBeNull();
  });

  it('returns null when EXPO_PUBLIC_WEB_URL is not set', () => {
    // biome-ignore lint/performance/noDelete: Required for test to actually unset env variable
    delete process.env.EXPO_PUBLIC_WEB_URL;
    const result = parseChapterShareUrl('https://app.versemate.org/bible/1/1');
    expect(result).toBeNull();
  });
});
