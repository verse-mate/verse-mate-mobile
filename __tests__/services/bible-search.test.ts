import { HttpResponse, http } from 'msw';
import { mockEastAndWest } from '@/__tests__/mocks/handlers/bible-search.handlers';
import { server } from '@/__tests__/mocks/server';
import { searchVerses } from '@/services/bible-search';
import { hasOfflineVerses, searchVersesOffline } from '@/services/offline/verse-search';

jest.mock('@/services/offline/verse-search', () => ({
  hasOfflineVerses: jest.fn(),
  searchVersesOffline: jest.fn(),
}));

const SEARCH_URL = `${process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org'}/bible/search`;
const offlinePage = {
  results: [],
  nextCursor: null,
  totals: { exact: 0, words: 0 },
  books: [],
  source: 'offline' as const,
};

const request = (overrides: Partial<Parameters<typeof searchVerses>[0]> = {}) => ({
  q: 'east and west',
  versionKey: 'NASB1995',
  filters: {},
  cursor: null,
  isOnline: true,
  ...overrides,
});

describe('searchVerses', () => {
  beforeEach(() => {
    jest.mocked(hasOfflineVerses).mockReset();
    jest.mocked(searchVersesOffline).mockReset().mockResolvedValue(offlinePage);
  });

  it('asks the API, with the version, filters and cursor, and marks the page online', async () => {
    let seen = new URLSearchParams();
    server.use(
      http.get(SEARCH_URL, ({ request: req }) => {
        seen = new URL(req.url).searchParams;
        return HttpResponse.json(mockEastAndWest);
      })
    );

    const page = await searchVerses(
      request({ filters: { testament: 'NT', book: 40 }, cursor: '20' })
    );

    expect(page.source).toBe('online');
    expect(page.results[0].bookName).toBe('Matthew');
    expect(Object.fromEntries(seen)).toEqual({
      q: 'east and west',
      bible_version: 'NASB1995',
      limit: '20',
      testament: 'NT',
      book: '40',
      cursor: '20',
    });
    expect(searchVersesOffline).not.toHaveBeenCalled();
  });

  it('falls back to the device when the request fails and the version is downloaded', async () => {
    server.use(http.get(SEARCH_URL, () => HttpResponse.error()));
    jest.mocked(hasOfflineVerses).mockResolvedValue(true);

    const page = await searchVerses(request());

    expect(page.source).toBe('offline');
    expect(searchVersesOffline).toHaveBeenCalled();
  });

  it('fails when the request fails and nothing is on the device', async () => {
    server.use(http.get(SEARCH_URL, () => new HttpResponse(null, { status: 503 })));
    jest.mocked(hasOfflineVerses).mockResolvedValue(false);

    await expect(searchVerses(request())).rejects.toThrow('HTTP 503');
  });

  it('goes straight to the device when offline', async () => {
    jest.mocked(hasOfflineVerses).mockResolvedValue(true);

    const page = await searchVerses(request({ isOnline: false }));

    expect(page.source).toBe('offline');
  });

  it('does not fall back for a search the user typed past', async () => {
    server.use(
      http.get(SEARCH_URL, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json(mockEastAndWest);
      })
    );
    jest.mocked(hasOfflineVerses).mockResolvedValue(true);
    const controller = new AbortController();

    const pending = searchVerses(request({ signal: controller.signal }));
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(searchVersesOffline).not.toHaveBeenCalled();
  });
});
