/**
 * Jesus deep links → an in-app route.
 *
 * Kept out of `app/_layout.tsx` and behind a plain function because this is the
 * part of the feature with no UI to notice when it breaks: a wrong pattern here
 * means a shared link opens the reader instead, silently, and only a user
 * following a link from outside the app ever sees it.
 *
 * Both link shapes the app receives are handled: the custom scheme Expo emits
 * (`versemate:///jesus/...`, empty authority — the same shape the names-of-god
 * handler matches) and an https link to the web app, whose Jesus URLs are
 * path-identical to ours.
 */

/**
 * One pattern rather than five, so a section we forget to list still resolves
 * to the hub instead of falling through to whatever handler comes next. The
 * trailing lookahead is what stops `/jesus-quotes` being read as `/jesus`.
 */
const JESUS_LINK =
  /(?:versemate:\/\/|https?:\/\/[^/]+)\/jesus(?:\/(life)|\/(event|browse|collection)\/([^/?#]+))?(?=$|[/?#])/;

/** The route this url should open, or null when it is not a Jesus link at all. */
export function resolveJesusDeepLink(url: string): string | null {
  const match = url.match(JESUS_LINK);
  if (!match) return null;

  const [, life, section, slug] = match;
  if (life) return '/jesus/life';
  if (section && slug) return `/jesus/${section}/${slug}`;
  return '/jesus';
}
