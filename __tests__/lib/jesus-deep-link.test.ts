/**
 * Jesus deep-link routing.
 *
 * The failure this guards against is silent: a link that stops matching does
 * not error, it just falls through to the next handler and the reader opens
 * instead. So both directions are pinned — every shape that must route, and the
 * near-misses that must not.
 */
import { resolveJesusDeepLink } from '@/lib/jesus/deep-link';

describe('resolveJesusDeepLink', () => {
  describe('custom scheme', () => {
    // Expo emits an empty authority, so the path starts at the third slash.
    // This is the same shape the names-of-god handler matches.
    it.each([
      ['versemate:///jesus', '/jesus'],
      ['versemate:///jesus/life', '/jesus/life'],
      ['versemate:///jesus/event/calming-the-storm', '/jesus/event/calming-the-storm'],
      ['versemate:///jesus/browse/miracles', '/jesus/browse/miracles'],
      ['versemate:///jesus/collection/passion-week', '/jesus/collection/passion-week'],
    ])('%s -> %s', (url, route) => {
      expect(resolveJesusDeepLink(url)).toBe(route);
    });
  });

  describe('web links', () => {
    // The web app's Jesus URLs are path-identical, so a link shared out of the
    // browser has to open the same screen in the app.
    it.each([
      ['https://versemate.org/jesus', '/jesus'],
      ['https://versemate.org/jesus/life', '/jesus/life'],
      ['https://app.versemate.org/jesus/event/the-last-supper', '/jesus/event/the-last-supper'],
      ['http://localhost:5173/jesus/browse/parables', '/jesus/browse/parables'],
    ])('%s -> %s', (url, route) => {
      expect(resolveJesusDeepLink(url)).toBe(route);
    });

    it('ignores a query string and a fragment', () => {
      expect(resolveJesusDeepLink('https://versemate.org/jesus/event/x?utm_source=slack')).toBe(
        '/jesus/event/x'
      );
      expect(resolveJesusDeepLink('https://versemate.org/jesus/life#periods')).toBe('/jesus/life');
    });
  });

  describe('near misses', () => {
    it('does not treat a longer word starting with jesus as the section', () => {
      expect(resolveJesusDeepLink('https://versemate.org/jesus-quotes')).toBeNull();
    });

    it('leaves other sections alone', () => {
      expect(resolveJesusDeepLink('https://versemate.org/bible/41/4')).toBeNull();
      expect(resolveJesusDeepLink('versemate:///names-of-god/el-shaddai')).toBeNull();
    });

    it('opens the hub for a sub-route it does not know', () => {
      // Better than falling through to the reader: the user asked for the
      // Jesus section and gets the Jesus section.
      expect(resolveJesusDeepLink('https://versemate.org/jesus/timeline')).toBe('/jesus');
    });
  });
});
