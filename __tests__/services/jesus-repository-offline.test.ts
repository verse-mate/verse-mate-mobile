/**
 * The Jesus repository reads LOCAL FIRST.
 *
 * Andy, on a plane (2026-09-28): "Same deal on Jesus feature. Lots of not
 * loading." On plane Wi-Fi NetInfo says online, so network-first reads sat on
 * a spinner for as long as the connection took. These pin the rule that
 * replaced it: a stored response answers without the network; the network is
 * for what the device does not hold; searches get a deadline and fall back to
 * the stored corpus.
 */
import * as repo from '@/services/jesus-repository';
import { jesusCacheKey } from '@/services/offline/jesus-store.web';

jest.mock('@/lib/api/authenticated-fetch', () => ({ authenticatedFetch: jest.fn() }));

const mockStore = new Map<
  string,
  { payload: unknown; bibleVersion: string | null; updatedAt: string }
>();
const mockPut = jest.fn();
const mockReinject = jest.fn();
jest.mock('@/services/offline/jesus-store', () => {
  const web = jest.requireActual('@/services/offline/jesus-store.web');
  return {
    jesusCacheKey: web.jesusCacheKey,
    importJesusSeed: jest.fn(),
    getJesusLocal: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    putJesusLocal: (...a: unknown[]) => mockPut(...a),
    reinjectPassages: (...a: unknown[]) => mockReinject(...a),
  };
});

const { authenticatedFetch } = require('@/lib/api/authenticated-fetch') as {
  authenticatedFetch: jest.Mock;
};
const ok = (body: unknown) => ({ ok: true, json: async () => body });
const fresh = () => new Date().toISOString();
const flush = () => new Promise((r) => setTimeout(r, 0));

const EVENT = {
  event: { slug: 'the-baptism-of-jesus', title: 'The baptism of Jesus' },
  passages: [
    {
      book_id: 40,
      chapter: 3,
      verse_start: 13,
      verse_end: 17,
      verses: [{ verse_number: 13, text: 'Then Jesus arrived' }],
    },
  ],
};

beforeEach(() => {
  mockStore.clear();
  mockPut.mockReset();
  mockReinject.mockReset();
  authenticatedFetch.mockReset();
});

describe('the cache key', () => {
  it('matches the bundle generator: sorted, and without bible_version', () => {
    expect(
      jesusCacheKey('/jesus/events', {
        theme: 'love',
        offset: 0,
        limit: 200,
        bible_version: 'NASB1995',
      })
    ).toBe('/jesus/events?limit=200&offset=0&theme=love');
    expect(jesusCacheKey('/jesus/events/overview', { bible_version: 'KJV' })).toBe(
      '/jesus/events/overview'
    );
  });
});

describe('local first', () => {
  it('answers from the store without touching the network', async () => {
    mockStore.set('/jesus/events/the-baptism-of-jesus', {
      payload: EVENT,
      bibleVersion: 'NASB1995',
      updatedAt: fresh(),
    });
    const detail = await repo.fetchEvent('the-baptism-of-jesus', 'NASB1995');
    expect(detail?.event.title).toBe('The baptism of Jesus');
    await flush();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it('goes to the network only for what the device does not hold, and keeps it', async () => {
    authenticatedFetch.mockResolvedValue(ok(EVENT));
    const detail = await repo.fetchEvent('the-baptism-of-jesus', 'NASB1995');
    expect(detail?.event.slug).toBe('the-baptism-of-jesus');
    await flush();
    expect(mockPut).toHaveBeenCalledWith('/jesus/events/the-baptism-of-jesus', EVENT, 'NASB1995');
  });

  it('refreshes a day-old copy in the background, answering from the copy meanwhile', async () => {
    const old = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    mockStore.set('/jesus/events/overview', {
      payload: { total_events: 207, sections: [] },
      bibleVersion: 'NASB1995',
      updatedAt: old,
    });
    authenticatedFetch.mockResolvedValue(ok({ total_events: 208, sections: [] }));
    const overview = await repo.fetchEventOverview('NASB1995');
    expect(overview.total_events).toBe(207); // the stored copy, immediately
    await flush();
    await flush();
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalled();
  });

  it('slices a theme list stored whole to the page the screen asked for', async () => {
    const events = Array.from({ length: 61 }, (_, i) => ({ slug: `e${i}`, title: `E${i}` }));
    mockStore.set('/jesus/events?limit=200&offset=0&theme=love', {
      payload: { events, total: 61 },
      bibleVersion: null,
      updatedAt: fresh(),
    });
    const page = await repo.fetchEvents({ theme: 'love', limit: 50 }, 'NASB1995');
    expect(page.events).toHaveLength(50);
    expect(page.total).toBe(61);
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });
});

describe('another Bible version', () => {
  beforeEach(() => {
    mockStore.set('/jesus/events/the-baptism-of-jesus', {
      payload: EVENT,
      bibleVersion: 'NASB1995',
      updatedAt: fresh(),
    });
  });

  it('re-renders the scripture from the offline Bible when that version is downloaded', async () => {
    const kjv = {
      ...EVENT,
      passages: [
        { ...EVENT.passages[0], verses: [{ verse_number: 13, text: 'Then cometh Jesus' }] },
      ],
    };
    mockReinject.mockResolvedValue(kjv);
    const detail = await repo.fetchEvent('the-baptism-of-jesus', 'KJV');
    expect(detail?.passages[0].verses?.[0].text).toBe('Then cometh Jesus');
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it('asks the network rather than show the wrong translation, and falls back to it if offline', async () => {
    mockReinject.mockResolvedValue(null); // version not on the device
    authenticatedFetch.mockRejectedValue(new Error('offline'));
    const detail = await repo.fetchEvent('the-baptism-of-jesus', 'KJV');
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(detail?.event.title).toBe('The baptism of Jesus'); // the stored NASB copy beats nothing
  });
});

describe('search', () => {
  it('falls back to searching the stored entries when the server does not answer', async () => {
    mockStore.set('local:entries', {
      payload: {
        entries: [
          {
            slug: 'forgiving-the-woman-caught-in-adultery',
            title: 'The woman caught in adultery',
            kind_label: 'Act of compassion',
            references: [],
          },
          {
            slug: 'calming-the-storm',
            title: 'Calming the storm',
            kind_label: 'Miracle',
            references: [],
          },
        ],
      },
      bibleVersion: null,
      updatedAt: fresh(),
    });
    authenticatedFetch.mockRejectedValue(new Error('offline'));
    const results = await repo.searchEntries('woman caught');
    expect(results.map((e) => e.slug)).toEqual(['forgiving-the-woman-caught-in-adultery']);
  });

  it('uses the server when it answers', async () => {
    authenticatedFetch.mockResolvedValue(ok({ entries: [{ slug: 'from-server', title: 'x' }] }));
    const results = await repo.searchEntries('anything');
    expect(results.map((e) => e.slug)).toEqual(['from-server']);
  });
});
