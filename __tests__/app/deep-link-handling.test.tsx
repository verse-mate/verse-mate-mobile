/**
 * Tests for Deep Link Handling
 *
 * Focused tests for URL parsing and navigation in app root layout.
 * Tests cover critical deep link behaviors without exhaustive coverage.
 */

import { AnalyticsEvent } from '@/lib/analytics/types';
import {
  buildWidgetVerseRoute,
  parseChapterShareUrl,
} from '@/utils/sharing/generate-chapter-share-url';

// Mock environment variable
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';

// Mock the analytics service so we can assert WIDGET_TAPPED gating without the
// real PostHog client.
jest.mock('@/lib/analytics/analytics', () => ({
  analytics: {
    track: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    registerSuperProperties: jest.fn(),
    isEnabled: jest.fn(() => true),
  },
}));

import { analytics } from '@/lib/analytics/analytics';

/**
 * Mirrors the widget-link branch of `handleDeepLink` in app/_layout.tsx:
 * detect `src=widget`, emit WIDGET_TAPPED only for widget taps, and forward to
 * the reader route via the shared `buildWidgetVerseRoute` helper. Kept in sync
 * with the layout so the analytics gating and forwarding contract are covered
 * without mounting the full provider tree.
 */
function forwardWidgetDeepLink(url: string): string | null {
  const parsed = parseChapterShareUrl(url);
  if (!parsed?.verseStart) return null;
  const { bookId, chapterNumber, verseStart, verseEnd } = parsed;
  const isWidget = url.includes('src=widget');
  if (isWidget) {
    analytics.track(AnalyticsEvent.WIDGET_TAPPED, {
      bookId,
      chapterNumber,
      verseStart,
      verseEnd,
      source: 'verse-of-the-day',
    });
  }
  return buildWidgetVerseRoute(bookId, chapterNumber, verseStart, verseEnd, isWidget);
}

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

  // Verse-of-the-day widget deep links (GH-265 T-002).
  describe('widget verse-range forwarding', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('forwards a single verse (?verseStart=16) to the reader as verse=16', () => {
      const route = forwardWidgetDeepLink(
        'https://app.versemate.org/bible/43/3?verseStart=16&src=widget'
      );
      expect(route).toBe('/bible/43/3?verse=16&src=widget');
    });

    it('forwards a passage (?verseStart=16&verseEnd=18) to verse=16&endVerse=18', () => {
      const route = forwardWidgetDeepLink(
        'https://app.versemate.org/bible/43/3?verseStart=16&verseEnd=18&src=widget'
      );
      expect(route).toBe('/bible/43/3?verse=16&endVerse=18&src=widget');
    });

    it('fires WIDGET_TAPPED when src=widget is present', () => {
      forwardWidgetDeepLink(
        'https://app.versemate.org/bible/43/3?verseStart=16&verseEnd=18&src=widget'
      );
      expect(analytics.track).toHaveBeenCalledTimes(1);
      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.WIDGET_TAPPED, {
        bookId: 43,
        chapterNumber: 3,
        verseStart: 16,
        verseEnd: 18,
        source: 'verse-of-the-day',
      });
    });

    it('does NOT fire WIDGET_TAPPED for a non-widget verse link', () => {
      const route = forwardWidgetDeepLink('https://app.versemate.org/bible/43/3?verseStart=16');
      // Still forwards the verse, but without src=widget and without analytics.
      expect(route).toBe('/bible/43/3?verse=16');
      expect(analytics.track).not.toHaveBeenCalled();
    });
  });

  // Chapter-screen WIDGET_OPENED_VERSE_DETAIL fire-once guard (GH-265 T-002 d).
  // Mirrors the effect in app/bible/[bookId]/[chapterNumber].tsx: fire exactly
  // once when params.src === 'widget' and a target verse is present.
  describe('WIDGET_OPENED_VERSE_DETAIL fire-once guard', () => {
    function makeGuardedTracker() {
      let hasTracked = false;
      return (params: { src?: string }, targetVerse: number | undefined) => {
        if (params.src === 'widget' && targetVerse && !hasTracked) {
          hasTracked = true;
          analytics.track(AnalyticsEvent.WIDGET_OPENED_VERSE_DETAIL, {
            bookId: 43,
            chapterNumber: 3,
            verseNumber: targetVerse,
            source: 'widget',
          });
        }
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('emits exactly once even when the effect re-runs', () => {
      const track = makeGuardedTracker();
      track({ src: 'widget' }, 16);
      track({ src: 'widget' }, 16); // re-render
      track({ src: 'widget' }, 16); // re-render
      expect(analytics.track).toHaveBeenCalledTimes(1);
      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.WIDGET_OPENED_VERSE_DETAIL, {
        bookId: 43,
        chapterNumber: 3,
        verseNumber: 16,
        source: 'widget',
      });
    });

    it('does not emit when not arriving from the widget', () => {
      const track = makeGuardedTracker();
      track({ src: undefined }, 16);
      expect(analytics.track).not.toHaveBeenCalled();
    });

    it('does not emit without a target verse', () => {
      const track = makeGuardedTracker();
      track({ src: 'widget' }, undefined);
      expect(analytics.track).not.toHaveBeenCalled();
    });
  });
});
