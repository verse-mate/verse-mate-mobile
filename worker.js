/**
 * Cloudflare Worker for serving the VerseMate mobile web export
 * (Expo for web / expo-router).
 *
 * Responsibilities:
 *   1. Static asset serving from the Expo web build output (dist/).
 *   2. SPA fallback to /index.html for any non-asset path so
 *      expo-router handles client-side routing.
 *
 * No legacy URL redirects here — those live in verse-mate-web's
 * Worker for app.versemate.org. The mobile.versemate.org surface is
 * new and only ever serves the Expo web shell.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    if (!url.pathname.includes('.')) {
      const indexRequest = new Request(new URL('/index.html', request.url).toString(), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return response;
  },
};
