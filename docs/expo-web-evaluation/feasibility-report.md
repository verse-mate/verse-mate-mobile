# Feasibility Report: Expo Web Support

## 1. Expo SDK & react-native-web Compatibility

| Component | Version | Web Support |
|-----------|---------|-------------|
| Expo SDK | 54.0.27 | Yes — latest stable |
| React Native | 0.81.5 | Via react-native-web |
| react-native-web | 0.21.0 | Production-ready |
| React | 19.1.0 | Full support |
| Expo Router | 6.0.17 | Full web support with file-based routing |
| New Architecture | Enabled | Compatible with web |
| React Compiler | Enabled | Compatible with web |

The app.config.js already has web output configured as `static`. react-native-web is already a dependency. The infrastructure is in place.

## 2. Native Module Web Support Audit

### Critical Blockers (3)

| Module | Issue | Impact | Web Alternative | Effort |
|--------|-------|--------|----------------|--------|
| **react-native-pager-view** | Imports native-only `codegenNativeCommands`. Build crashes on web. | **Build-breaking** — can't compile at all. Used for Bible chapter swiping and onboarding. | Platform shim: `.native.tsx`/`.web.tsx` files. Use horizontal ScrollView with `pagingEnabled` + `snapToInterval` on web. | Medium (2-3 days) |
| **expo-sqlite** | Alpha web support via WASM (SharedArrayBuffer). Requires specific Metro config + COOP/COEP headers. | **Critical** if offline required on web. Entire offline system (40+ DB operations) depends on this. | Option A: Use expo-sqlite alpha WASM. Option B: Abstract data layer, use IndexedDB on web. Option C: Skip offline for web, fetch from API only. | High (1-2 weeks for abstraction) or Low (if WASM alpha is acceptable) |
| **expo-file-system** | No web support. Tied to SQLite seed database loading. | **Critical** — part of offline data pipeline. | OPFS (Origin Private File System) API or eliminate by fetching from API. | Tied to SQLite decision |

### Medium Impact (3)

| Module | Issue | Impact | Web Alternative | Effort |
|--------|-------|--------|----------------|--------|
| **@react-native-google-signin** | Native SDK, no web support. | Google SSO won't work. App gracefully degrades — button hidden, email/password still works. | Google Identity Services JS SDK. | Low-Medium (1-2 days) |
| **posthog-react-native** | Native analytics SDK. | Analytics won't track on web. | posthog-js — Platform.select between native/web SDKs. | Low (half day) |
| **expo-speech-recognition** | Native speech APIs. | Voice-to-text feature unavailable on web. Already gracefully degrades (`isRecognitionAvailable()` returns false). | Web Speech API (`SpeechRecognition`). Chrome/Edge supported. | Low (1 day) |

### Low Impact — Already Gracefully Degrade (7)

These modules have no web support but the app already handles their absence:

| Module | Behavior on Web |
|--------|----------------|
| expo-haptics | No-op — purely cosmetic UX |
| expo-apple-authentication | Gated to `Platform.OS === 'ios'` — button hidden on web |
| @versemate/dictionary | Guards `Platform.OS !== 'web'` — falls back to non-native lookup |
| expo-navigation-bar | Gated to `Platform.OS === 'android'` — irrelevant on web |
| expo-sensors (LightSensor) | "Ambient" theme option hidden when unavailable |
| @react-native-community/datetimepicker | Not imported anywhere — unused dependency |
| expo-sharing | Not imported anywhere — unused dependency |

### Full Web Support (20+ modules)

These work out of the box on web: expo-router, expo-clipboard, expo-image, expo-linking, expo-localization, expo-constants, expo-font, expo-status-bar, @expo/vector-icons, react-native-reanimated, react-native-gesture-handler, react-native-safe-area-context, react-native-screens, react-native-svg, react-native-modal, react-native-markdown-display, @react-native-async-storage/async-storage, @react-native-community/netinfo, @tanstack/react-query, axios, suncalc.

### Unused Dependencies (can be removed)

- expo-sharing, expo-application, expo-updates, expo-symbols, @react-native-community/datetimepicker

## 3. Web Build Test Results

**Command:** `npx expo export --platform web`

**Result:** Build **FAILED** after ~465 seconds (7.75 minutes).

**Error:**
```
Error: Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands"
on web from: node_modules/react-native-pager-view/lib/commonjs/PagerViewNativeComponent.ts

Import stack:
  react-native-pager-view/PagerViewNativeComponent.ts
  → react-native-pager-view/PagerView.js
  → react-native-pager-view/index.js
  → app/onboarding.tsx
  → app/_layout.tsx
  → app (require.context)
```

**Analysis:** The server render bundle (λ) failed at ~98.4% completion (2028/2044 modules). The client bundle (Web) had progressed to ~85%. This means only 1 module (react-native-pager-view) prevented a successful build. Once resolved, the build is very likely to succeed.

**Severity classification:**
- Build-breaking errors: **1** (react-native-pager-view)
- Runtime errors: Unknown (build never completed)
- Visual glitches: Unknown (build never completed)

**Fix path:** Create a platform shim for react-native-pager-view. Use `.web.tsx` extension or `Platform.select` to provide a ScrollView-based pager on web.

## 4. Expo Router Web Routing Assessment

Expo Router 6 provides full web routing support:

- **File-based routing** works identically on web — maps to URL paths
- **Dynamic routes** (`[bookId]/[chapterNumber]`) become URL parameters
- **Stack navigation** renders as page transitions on web
- **Modal routes** (auth flow) supported via `presentation: 'modal'`
- **Static rendering** configured — SSG generates HTML per route at build time
- **Link component** generates `<a>` tags with proper `href` on web

**Compared to Next.js App Router:**
- Expo Router does NOT support React Server Components (stable)
- SSR is alpha in SDK 55 (not available in current SDK 54)
- SSG is production-ready — suitable for Bible chapter pages and topics
- No API routes in current SDK (server functions are SDK 55+)
- No middleware support in current SDK

**Routing verdict:** Adequate for a consumer web app. All 22+ routes would work on web. SEO via SSG is possible for static content.

## 5. Summary

| Question | Answer |
|----------|--------|
| Can the app compile for web? | **Almost** — 1 build-breaking module (react-native-pager-view). Fix is straightforward. |
| Do most modules work on web? | **Yes** — 20+ modules have full web support. 7 gracefully degrade. 3 critical, 3 medium. |
| Is the fix effort reasonable? | **Yes** — The #1 blocker (pager-view) is a 2-3 day platform shim. SQLite is the hardest (1-2 weeks if abstraction needed, but alpha WASM support may suffice). |
| Can Expo Router handle web routing? | **Yes** — File-based routing, dynamic routes, SSG all work. SSR is alpha. |
| Is this a dead end? | **No** — The app is closer to web-ready than expected. The codebase already has many Platform.OS guards. |
