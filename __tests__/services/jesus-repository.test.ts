/**
 * Jesus repository.
 *
 * The behaviour worth pinning is the failure posture: every call resolves to an
 * empty-or-null shape instead of throwing, so a network blip renders an empty
 * state rather than tearing down the screen. React Query then caches a resolved
 * value, which is why the screens branch on `data == null` rather than on
 * `isError`.
 *
 * Also pinned: `/jesus/events/life` returns `{ periods: [...] }`, not an array.
 * Reading it as an array yields a silently empty timeline, which is exactly the
 * kind of shape mismatch a test should hold still.
 */
import * as repo from '@/services/jesus-repository';

jest.mock('@/lib/api/authenticated-fetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const { authenticatedFetch } = require('@/lib/api/authenticated-fetch') as {
  authenticatedFetch: jest.Mock;
};

const ok = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => authenticatedFetch.mockReset());

describe('jesus-repository', () => {
  it('unwraps { periods } from the life endpoint', async () => {
    authenticatedFetch.mockResolvedValue(
      ok({ periods: [{ slug: 'preparation', name: 'Preparation', events: [] }] })
    );
    const periods = await repo.fetchLife();
    expect(periods).toHaveLength(1);
    expect(periods[0].slug).toBe('preparation');
  });

  it('returns an empty overview rather than throwing when the request fails', async () => {
    authenticatedFetch.mockRejectedValue(new Error('offline'));
    const overview = await repo.fetchEventOverview();
    expect(overview.total_events).toBe(0);
    expect(overview.sections).toEqual([]);
  });

  it('returns null for a missing event rather than throwing', async () => {
    authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(repo.fetchEvent('nope')).resolves.toBeNull();
  });

  it('encodes the slug so a path separator cannot escape the route', async () => {
    authenticatedFetch.mockResolvedValue(ok({}));
    await repo.fetchEvent('a/b');
    expect(authenticatedFetch.mock.calls[0][0]).toContain('/jesus/events/a%2Fb');
  });

  it('omits empty query values instead of sending "undefined"', async () => {
    authenticatedFetch.mockResolvedValue(ok({ events: [] }));
    await repo.fetchEventsForPassage({ bookId: 41, chapter: 4 });
    const url = authenticatedFetch.mock.calls[0][0] as string;
    expect(url).toContain('book_id=41');
    expect(url).toContain('chapter=4');
    expect(url).not.toContain('verse=');
  });

  it('reads events off the for-passage envelope', async () => {
    authenticatedFetch.mockResolvedValue(ok({ events: [{ slug: 'event-storm-stilled' }] }));
    const events = await repo.fetchEventsForPassage({ bookId: 41, chapter: 4, verse: 39 });
    expect(events[0].slug).toBe('event-storm-stilled');
  });

  it("sends the reader's translation on the routes that quote scripture", async () => {
    // Without it the passage references come back in the default version while
    // the chapter above them is in another — wrong, and silently so.
    authenticatedFetch.mockResolvedValue(ok({ events: [] }));
    await repo.fetchEventsForPassage({ bookId: 41, chapter: 4, bibleVersion: 'KJV' });
    expect(authenticatedFetch.mock.calls[0][0]).toContain('bible_version=KJV');

    authenticatedFetch.mockResolvedValue(ok({ periods: [] }));
    await repo.fetchLife('KJV');
    expect(authenticatedFetch.mock.calls[1][0]).toContain('bible_version=KJV');

    authenticatedFetch.mockResolvedValue(ok({}));
    await repo.fetchEventOverview('KJV');
    expect(authenticatedFetch.mock.calls[2][0]).toContain('bible_version=KJV');
  });
});
