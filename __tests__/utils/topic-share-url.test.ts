/**
 * Tests for Topic Share URL Utilities
 *
 * Tests URL generation and parsing for topic sharing functionality.
 * Covers both slug-based URLs and error cases.
 */

import {
  generateTopicShareUrl,
  parseTopicShareUrl,
} from '@/utils/sharing/generate-topic-share-url';

// Mock environment variable
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';

describe('generateTopicShareUrl', () => {
  it('generates slug-based URL for EVENT topic', () => {
    const url = generateTopicShareUrl('EVENT', 'The Resurrection');
    expect(url).toBe('https://app.versemate.org/topic/events/the-resurrection');
  });

  it('generates slug-based URL for PROPHECY topic', () => {
    const url = generateTopicShareUrl('PROPHECY', 'The Messiah');
    expect(url).toBe('https://app.versemate.org/topic/prophecies/the-messiah');
  });

  it('generates slug-based URL for PARABLE topic', () => {
    const url = generateTopicShareUrl('PARABLE', 'The Good Samaritan');
    expect(url).toBe('https://app.versemate.org/topic/parables/the-good-samaritan');
  });

  it('generates slug-based URL for THEME topic', () => {
    const url = generateTopicShareUrl('THEME', 'Faith and Hope');
    expect(url).toBe('https://app.versemate.org/topic/themes/faith-and-hope');
  });

  it('handles topics with special characters', () => {
    const url = generateTopicShareUrl('EVENT', "Paul's Conversion");
    expect(url).toBe('https://app.versemate.org/topic/events/pauls-conversion');
  });

  it('handles topics with numbers', () => {
    const url = generateTopicShareUrl('EVENT', 'The 10 Commandments');
    expect(url).toBe('https://app.versemate.org/topic/events/the-10-commandments');
  });

  it('handles multiple spaces in topic title', () => {
    const url = generateTopicShareUrl('THEME', 'Love   and   Mercy');
    expect(url).toBe('https://app.versemate.org/topic/themes/love-and-mercy');
  });

  it('handles lowercase category input', () => {
    const url = generateTopicShareUrl('event', 'The Creation');
    expect(url).toBe('https://app.versemate.org/topic/events/the-creation');
  });

  it('handles plural category format (EVENTS)', () => {
    const url = generateTopicShareUrl('EVENTS', 'The Flood');
    expect(url).toBe('https://app.versemate.org/topic/events/the-flood');
  });

  it('throws error for invalid category', () => {
    expect(() => generateTopicShareUrl('INVALID', 'Some Topic')).toThrow('Invalid topic category');
  });

  it('throws error when EXPO_PUBLIC_WEB_URL is not set', () => {
    const originalUrl = process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_WEB_URL = undefined;

    expect(() => generateTopicShareUrl('EVENT', 'The Resurrection')).toThrow(
      'EXPO_PUBLIC_WEB_URL is not configured'
    );

    process.env.EXPO_PUBLIC_WEB_URL = originalUrl;
  });
});

describe('parseTopicShareUrl', () => {
  it('parses slug-based EVENT topic URL', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/events/the-resurrection');
    expect(result).toEqual({ category: 'EVENT', slug: 'the-resurrection' });
  });

  it('parses slug-based PROPHECY topic URL', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/prophecies/the-messiah');
    expect(result).toEqual({ category: 'PROPHECY', slug: 'the-messiah' });
  });

  it('parses slug-based PARABLE topic URL', () => {
    const result = parseTopicShareUrl(
      'https://app.versemate.org/topic/parables/the-good-samaritan'
    );
    expect(result).toEqual({ category: 'PARABLE', slug: 'the-good-samaritan' });
  });

  it('parses slug-based THEME topic URL', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/themes/faith-and-hope');
    expect(result).toEqual({ category: 'THEME', slug: 'faith-and-hope' });
  });

  it('normalizes slug to lowercase', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/events/The-Resurrection');
    expect(result).toEqual({ category: 'EVENT', slug: 'the-resurrection' });
  });

  it('returns null for malformed URL', () => {
    const result = parseTopicShareUrl('not-a-valid-url');
    expect(result).toBeNull();
  });

  it('returns null for invalid category slug', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/invalid/some-topic');
    expect(result).toBeNull();
  });

  it('returns null for wrong domain', () => {
    const result = parseTopicShareUrl('https://example.com/topic/events/the-resurrection');
    expect(result).toBeNull();
  });

  it('returns null for Bible chapter URL', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/bible/john/3');
    expect(result).toBeNull();
  });

  it('returns null for incorrect path structure (missing category)', () => {
    const result = parseTopicShareUrl('https://app.versemate.org/topic/the-resurrection');
    expect(result).toBeNull();
  });

  it('returns null for incorrect path structure (too many segments)', () => {
    const result = parseTopicShareUrl(
      'https://app.versemate.org/topic/events/the-resurrection/extra'
    );
    expect(result).toBeNull();
  });

  it('returns null when EXPO_PUBLIC_WEB_URL is not set', () => {
    const originalUrl = process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_WEB_URL = undefined;

    const result = parseTopicShareUrl('https://app.versemate.org/topic/events/the-resurrection');
    expect(result).toBeNull();

    process.env.EXPO_PUBLIC_WEB_URL = originalUrl;
  });
});
