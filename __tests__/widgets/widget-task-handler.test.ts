/**
 * Tests for the Android Verse-of-the-Day widget task handler (GH-265).
 *
 * Covers:
 *  - buildDeepLink ↔ parseChapterShareUrl cross-module contract: the deep link
 *    the handler emits must round-trip back to the same bookId/chapter/verse
 *    through the real parser (locks the host + path + query-param shape).
 *  - fetchVerse: happy path, empty pool (fallback message), and fetch error.
 *
 * EXPO_PUBLIC_WEB_URL is pinned so the deep link the handler builds shares a
 * host with the parser's expected base URL (L-003).
 */

// Pin web/api hosts BEFORE importing the handler — both read process.env at
// module load time.
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
process.env.EXPO_PUBLIC_API_URL = 'https://api.versemate.org';

// react-native-android-widget pulls in native-only code at import; the handler
// only references its JSX widget components, which we don't render here.
jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseChapterShareUrl } from '@/utils/sharing/generate-chapter-share-url';
import { buildDeepLink, fetchVerse } from '@/widgets/widget-task-handler';

const originalFetch = global.fetch;

describe('widget-task-handler', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('buildDeepLink ↔ parseChapterShareUrl round-trip', () => {
    it('round-trips a single-verse reference', () => {
      const ref = { bookId: 43, chapterNumber: 3, verseStart: 16, verseEnd: null };
      const url = buildDeepLink(ref);

      // Custom scheme (not the https App Link host) so the tap always opens the
      // native app without depending on App Links domain verification.
      expect(url).toMatch(/^versemate:\/\/\/bible\//);
      // src=widget must survive for the layout to fire WIDGET_TAPPED.
      expect(url).toContain('src=widget');
      expect(url).toContain('verseStart=16');
      expect(url).not.toContain('verseEnd');

      const parsed = parseChapterShareUrl(url);
      expect(parsed).toEqual({ bookId: 43, chapterNumber: 3, verseStart: 16 });
    });

    it('round-trips a passage reference (verseStart + verseEnd)', () => {
      const ref = { bookId: 45, chapterNumber: 8, verseStart: 38, verseEnd: 39 };
      const url = buildDeepLink(ref);

      expect(url).toContain('verseStart=38');
      expect(url).toContain('verseEnd=39');

      const parsed = parseChapterShareUrl(url);
      expect(parsed).toEqual({
        bookId: 45,
        chapterNumber: 8,
        verseStart: 38,
        verseEnd: 39,
      });
    });

    it('falls back to Genesis 1 when no reference is provided', () => {
      const url = buildDeepLink(undefined);
      const parsed = parseChapterShareUrl(url);
      expect(parsed).toEqual({ bookId: 1, chapterNumber: 1 });
    });
  });

  describe('fetchVerse', () => {
    it('returns verse text + reference on the happy path', async () => {
      await AsyncStorage.setItem('bible-version', 'KJV');
      const apiResponse = {
        empty: false,
        referenceText: 'John 3:16',
        verses: [{ verseNumber: 16, text: 'For God so loved the world' }],
        reference: { bookId: 43, chapterNumber: 3, verseStart: 16, verseEnd: null },
      };
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => apiResponse,
      }) as unknown as typeof fetch;

      const result = await fetchVerse();

      // Uses the stored version in the request.
      expect((global.fetch as unknown as jest.Mock).mock.calls[0][0]).toContain(
        'bible_version=KJV'
      );
      expect(result.verses).toEqual([{ verseNumber: 16, text: 'For God so loved the world' }]);
      expect(result.reference).toBe('John 3:16');
      expect(parseChapterShareUrl(result.deepLink)).toEqual({
        bookId: 43,
        chapterNumber: 3,
        verseStart: 16,
      });
    });

    it('sends pid when a user id is stored, omits it otherwise (PD-7)', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        json: async () => ({ empty: true, fallbackMessage: 'x' }),
      }) as unknown as typeof fetch;

      // Logged out: no widget-user-id stored → no pid param.
      await AsyncStorage.removeItem('widget-user-id');
      global.fetch = fetchMock;
      await fetchVerse();
      expect((fetchMock as unknown as jest.Mock).mock.calls[0][0]).not.toContain('pid=');

      // Logged in: id mirrored into AsyncStorage → pid param present.
      await AsyncStorage.setItem('widget-user-id', 'user-123');
      await fetchVerse();
      expect((fetchMock as unknown as jest.Mock).mock.calls[1][0]).toContain('pid=user-123');
      await AsyncStorage.removeItem('widget-user-id');
    });

    it('returns the fallback message when the verse pool is empty', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ empty: true, fallbackMessage: 'No verse today' }),
      }) as unknown as typeof fetch;

      const result = await fetchVerse();

      expect(result.verses).toBeNull();
      expect(result.fallbackText).toBe('No verse today');
      expect(result.reference).toBe('');
      // No reference → Genesis 1 fallback link.
      expect(parseChapterShareUrl(result.deepLink)).toEqual({ bookId: 1, chapterNumber: 1 });
    });

    it('returns a branded fallback when fetch throws', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      const result = await fetchVerse();

      expect(result.verses).toBeNull();
      expect(result.fallbackText).toBe("Open VerseMate to see today's verse");
      expect(result.reference).toBe('');
      expect(parseChapterShareUrl(result.deepLink)).toEqual({ bookId: 1, chapterNumber: 1 });
    });
  });
});
