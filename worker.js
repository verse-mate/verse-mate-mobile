/**
 * Cloudflare Worker for serving the VerseMate mobile web export
 * (Expo for web / expo-router).
 *
 * The assets binding handles both static asset serving and the SPA
 * fallback to /index.html, via wrangler.jsonc's
 * `assets.not_found_handling: "single-page-application"`. That makes
 * the worker a thin passthrough — kept here so future request-level
 * logic (auth, headers, logging) has an obvious place to land.
 */

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
