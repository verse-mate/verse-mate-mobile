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
 * handler matches) and an https link to the web app (EXPO_PUBLIC_WEB_URL, the
 * one associated domain), whose Jesus URLs are path-identical to ours.
 */

/**
 * The sections with a `[slug]` route under app/jesus/. `collection` is not one:
 * neither app has a collection screen, so such a link opens the hub.
 */
const SLUG_SECTIONS = ['event', 'browse', 'theme', 'study', 'entry'] as const;

/**
 * Matched against the PATH only, anchored at its start, so a Jesus URL sitting
 * inside another link's query string is not mistaken for this one. The
 * trailing lookahead is what stops `/jesus-quotes` being read as `/jesus`.
 */
const JESUS_PATH = new RegExp(
  `^/jesus(?:/(life)|/(${SLUG_SECTIONS.join('|')})/([^/?#]+))?(?=$|[/?#])`
);

/** The web app's origin, the one https host whose links are ours. */
function webOrigin(): string | null {
  const raw = process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://app.versemate.org';
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** The path of a link this app owns, or null for anyone else's link. */
function ownPath(url: string): string | null {
  // Expo emits an empty authority: versemate:///jesus/... (the same shape the
  // names-of-god handler matches).
  if (url.startsWith('versemate://')) {
    const rest = url.slice('versemate://'.length);
    return rest.startsWith('/') ? rest : null;
  }
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== webOrigin()) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** The route this url should open, or null when it is not a Jesus link at all. */
export function resolveJesusDeepLink(url: string): string | null {
  const path = ownPath(url);
  if (!path) return null;
  const match = path.match(JESUS_PATH);
  if (!match) return null;

  const [, life, section, slug] = match;
  if (life) return '/jesus/life';
  if (section && slug) return `/jesus/${section}/${slug}`;
  return '/jesus';
}
