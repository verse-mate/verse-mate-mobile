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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildWidgetVerseRoute,
  parseChapterShareUrl,
} from '@/utils/sharing/generate-chapter-share-url';
import { buildDeepLink, fetchVerse, pickWidgetSize } from '@/widgets/widget-task-handler';

process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
process.env.EXPO_PUBLIC_API_URL = 'https://api.versemate.org';

// react-native-android-widget pulls in native-only code at import; the handler
// only references its JSX widget components, which we don't render here.
jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
}));

const originalFetch = global.fetch;

describe('widget-task-handler', () => {
  // fetchVerse persists every successful payload; drop it between tests so the
  // fallback assertions below exercise the no-cache path.
  beforeEach(async () => {
    await AsyncStorage.removeItem('widget-verse-cache');
  });

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

    // The expanded widget's "Why it matters" block is a second tap zone that must
    // land on the reader's summary tab — the full chain the tap travels:
    // buildDeepLink → parseChapterShareUrl → buildWidgetVerseRoute.
    it('carries the note zone tab through to the reader route', () => {
      const ref = { bookId: 19, chapterNumber: 139, verseStart: 14, verseEnd: null };
      const url = buildDeepLink(ref, 'summary');

      expect(url).toContain('src=widget');
      expect(url).toContain('tab=summary');

      const parsed = parseChapterShareUrl(url);
      expect(parsed).toEqual({
        bookId: 19,
        chapterNumber: 139,
        verseStart: 14,
        tab: 'summary',
      });

      const route = buildWidgetVerseRoute(
        // biome-ignore lint/style/noNonNullAssertion: asserted non-null above
        parsed!.bookId,
        // biome-ignore lint/style/noNonNullAssertion: asserted non-null above
        parsed!.chapterNumber,
        14,
        undefined,
        true,
        parsed?.tab
      );
      expect(route).toBe('/bible/19/139?verse=14&src=widget&tab=summary');
    });

    it('drops an unknown tab rather than forwarding it', () => {
      const ref = { bookId: 43, chapterNumber: 3, verseStart: 16, verseEnd: null };
      const parsed = parseChapterShareUrl(buildDeepLink(ref, 'not-a-tab'));
      expect(parsed).toEqual({ bookId: 43, chapterNumber: 3, verseStart: 16 });
    });
  });

  // The design's two Android compositions ship as two providers, because the
  // widget's own height is not discoverable (portrait reports the provider's max
  // resize bound: a 4×2 and a 4×4 both read 358dp on the Pixel launcher).
  describe('pickWidgetSize', () => {
    it('selects the composition from the provider name, not a size', () => {
      expect(pickWidgetSize('VerseOfTheDay')).toBe('compact');
      expect(pickWidgetSize('VerseOfTheDayNote')).toBe('expanded');
    });

    it('falls back to compact for an unknown provider', () => {
      // A stale widget from an older install must never paint a clipped note
      // panel; verse-only is the safe composition at any size.
      expect(pickWidgetSize('SomethingElse')).toBe('compact');
      expect(pickWidgetSize('')).toBe('compact');
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

    // The expanded composition's note panel is data-gated: it only paints when
    // the API serves a summary, which it does not do yet.
    it('plumbs the version label and an explanation when present, null when not', async () => {
      const base = {
        empty: false,
        referenceText: 'Psalm 139:14',
        verses: [{ verseNumber: 14, text: 'I am fearfully and wonderfully made' }],
        reference: { bookId: 19, chapterNumber: 139, verseStart: 14, verseEnd: null },
        versionKey: 'NASB1995',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ ...base, explanation: 'David pictures God weaving him together.' }),
      }) as unknown as typeof fetch;
      const withNote = await fetchVerse();
      expect(withNote.versionLabel).toBe('NASB1995');
      expect(withNote.explanation).toBe('David pictures God weaving him together.');
      expect(withNote.noteDeepLink).toContain('tab=summary');

      // Today's payload: no explanation field at all.
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => base,
      }) as unknown as typeof fetch;
      const withoutNote = await fetchVerse();
      expect(withoutNote.explanation).toBeNull();
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

    // The reported "sometimes it doesn't load any content": the OS reruns the
    // widget task only every few hours, so before this a single failed fetch
    // left the widget empty until the next tick.
    it.each([
      ['fetch throws', () => jest.fn().mockRejectedValue(new Error('network down'))],
      [
        'the API errors out (e.g. invalid_date)',
        () => jest.fn().mockResolvedValue({ json: async () => ({ error: 'invalid_date' }) }),
      ],
    ])('serves the last good verse when %s', async (_label, makeFetch) => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          empty: false,
          referenceText: 'John 3:16',
          verses: [{ verseNumber: 16, text: 'For God so loved the world' }],
          reference: { bookId: 43, chapterNumber: 3, verseStart: 16, verseEnd: null },
          versionKey: 'NASB1995',
        }),
      }) as unknown as typeof fetch;
      await fetchVerse();

      global.fetch = makeFetch() as unknown as typeof fetch;
      const result = await fetchVerse();

      expect(result.verses).toEqual([{ verseNumber: 16, text: 'For God so loved the world' }]);
      expect(result.reference).toBe('John 3:16');
    });

    // A device offline for days should show the honest "open the app" state
    // rather than last week's verse under a "VERSE OF THE DAY" header.
    it('ignores a cached verse older than yesterday', async () => {
      await AsyncStorage.setItem(
        'widget-verse-cache',
        JSON.stringify({
          date: '2020-01-01',
          data: { verses: [{ verseNumber: 1, text: 'stale' }], reference: 'Gen 1:1' },
        })
      );
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      const result = await fetchVerse();

      expect(result.verses).toBeNull();
      expect(result.fallbackText).toBe("Open VerseMate to see today's verse");
    });
  });
});
