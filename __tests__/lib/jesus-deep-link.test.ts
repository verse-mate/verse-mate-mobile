/**
 * Jesus deep-link routing.
 *
 * The failure this guards against is silent: a link that stops matching does
 * not error, it just falls through to the next handler and the reader opens
 * instead. So both directions are pinned — every shape that must route, and the
 * near-misses that must not — and every route it produces must be a real
 * screen under app/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveJesusDeepLink } from '@/lib/jesus/deep-link';

const ORIGINAL_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;
beforeAll(() => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_WEB_URL = ORIGINAL_WEB_URL;
});

const ROUTING = [
  ['versemate:///jesus', '/jesus'],
  ['versemate:///jesus/life', '/jesus/life'],
  ['versemate:///jesus/event/calming-the-storm', '/jesus/event/calming-the-storm'],
  ['versemate:///jesus/browse/miracles', '/jesus/browse/miracles'],
  ['versemate:///jesus/theme/kingdom', '/jesus/theme/kingdom'],
  ['versemate:///jesus/study/sermon-on-the-mount', '/jesus/study/sermon-on-the-mount'],
  ['versemate:///jesus/entry/born-again', '/jesus/entry/born-again'],
  ['https://app.versemate.org/jesus', '/jesus'],
  ['https://app.versemate.org/jesus/life', '/jesus/life'],
  ['https://app.versemate.org/jesus/event/the-last-supper', '/jesus/event/the-last-supper'],
  ['https://app.versemate.org/jesus/theme/kingdom', '/jesus/theme/kingdom'],
] as const;

describe('resolveJesusDeepLink', () => {
  it.each(ROUTING)('%s -> %s', (url, route) => {
    expect(resolveJesusDeepLink(url)).toBe(route);
  });

  it('ignores a query string and a fragment', () => {
    expect(resolveJesusDeepLink('https://app.versemate.org/jesus/event/x?utm_source=slack')).toBe(
      '/jesus/event/x'
    );
    expect(resolveJesusDeepLink('https://app.versemate.org/jesus/life#periods')).toBe(
      '/jesus/life'
    );
  });

  it('opens the hub for a collection link — there is no collection screen', () => {
    expect(resolveJesusDeepLink('versemate:///jesus/collection/passion-week')).toBe('/jesus');
  });

  it('opens the hub for a sub-route it does not know', () => {
    // Better than falling through to the reader: the user asked for the Jesus
    // section and gets the Jesus section.
    expect(resolveJesusDeepLink('https://app.versemate.org/jesus/timeline')).toBe('/jesus');
  });

  describe('near misses', () => {
    it('does not treat a longer word starting with jesus as the section', () => {
      expect(resolveJesusDeepLink('https://app.versemate.org/jesus-quotes')).toBeNull();
    });

    it('leaves other sections alone', () => {
      expect(resolveJesusDeepLink('https://app.versemate.org/bible/41/4')).toBeNull();
      expect(resolveJesusDeepLink('versemate:///names-of-god/el-shaddai')).toBeNull();
    });

    it('does not pick a Jesus URL out of another link', () => {
      expect(
        resolveJesusDeepLink('versemate:///bible/1/1?r=https://evil.example/jesus/event/foo')
      ).toBeNull();
      expect(
        resolveJesusDeepLink('https://app.versemate.org/bible/1/1?next=/jesus/event/foo')
      ).toBeNull();
    });

    it("ignores another site's /jesus links", () => {
      expect(resolveJesusDeepLink('https://evil.example/jesus/event/foo')).toBeNull();
    });
  });

  it('only ever produces routes that have a screen under app/', () => {
    const appDir = path.resolve(__dirname, '../../app');
    const screenFor = (route: string) => {
      const parts = route.split('/').filter(Boolean);
      if (parts.length === 1) return path.join(appDir, parts[0], 'index.tsx');
      if (parts.length === 2) return path.join(appDir, parts[0], `${parts[1]}.tsx`);
      return path.join(appDir, parts[0], parts[1], '[slug].tsx');
    };
    const routes = new Set<string>(ROUTING.map(([, r]) => r));
    routes.add(resolveJesusDeepLink('versemate:///jesus/collection/x') as string);
    for (const route of routes) {
      const file = route.startsWith('/jesus/browse/')
        ? path.join(appDir, 'jesus', 'browse', '[type].tsx')
        : screenFor(route);
      expect([route, fs.existsSync(file)]).toEqual([route, true]);
    }
  });
});
