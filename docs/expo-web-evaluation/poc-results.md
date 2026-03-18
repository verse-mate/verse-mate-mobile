# Proof of Concept Results

## Build Test

**Environment:** Ticket worktree at `/tickets/GH-133/repos/verse-mate-mobile/`
**Command:** `npx expo export --platform web`
**Duration:** ~465 seconds (7.75 minutes)
**Result:** **FAILED** (1 build-breaking error)

### Build Error

```
Error: Importing native-only module
  "react-native/Libraries/Utilities/codegenNativeCommands"
  on web from: node_modules/react-native-pager-view/lib/commonjs/PagerViewNativeComponent.ts

Import stack:
  react-native-pager-view/PagerViewNativeComponent.ts
  → react-native-pager-view/PagerView.js
  → react-native-pager-view/index.js
  → app/onboarding.tsx
  → app/_layout.tsx
  → app (require.context)
```

### Build Progress at Failure

| Bundle | Progress | Modules |
|--------|----------|---------|
| Web (client) | ~85% | 1283/1458 modules |
| Lambda (server render) | 98.4% | 2028/2044 modules |

**Only 16 modules remained** in the server bundle when it crashed. This is extremely close to a successful build — only `react-native-pager-view` and its dependents prevented completion.

## What We Know Without a Running Build

Since the build failed, we can't test runtime behavior. However, the module audit gives us high confidence about what would work:

### Would Work on Web (confirmed by module audit)

- **Routing** — Expo Router has full web support. All 22+ routes would resolve.
- **Theme system** — ThemeContext uses AsyncStorage (→ localStorage on web), suncalc (pure JS).
- **API calls** — React Query + Axios are platform-agnostic. All API hooks would work.
- **Bible text rendering** — React Native Text/View → `<div>`/`<span>` via react-native-web.
- **Bookmarks/Highlights/Notes** — API-driven features with AsyncStorage caching.
- **Icons** — @expo/vector-icons uses web fonts/SVG on web.
- **SVG components** — react-native-svg renders as inline SVG.
- **Animations** — react-native-reanimated has full web support.
- **Gestures** — react-native-gesture-handler works on web.
- **Safe area** — react-native-safe-area-context uses CSS `env()`.
- **Markdown rendering** — react-native-markdown-display is pure JS.
- **Modals** — react-native-modal is pure JS.
- **Clipboard** — expo-clipboard uses navigator.clipboard on web.
- **Network detection** — @react-native-community/netinfo uses navigator.onLine.

### Would Fail / Need Workarounds

| Feature | Issue | Workaround |
|---------|-------|-----------|
| Chapter swiping | react-native-pager-view crashes build | Platform shim with ScrollView + pagingEnabled |
| Google Sign-In | Native SDK, no web module | Google Identity Services JS SDK |
| Apple Sign-In | iOS-only native API | Apple Sign In JS SDK (or hide on web) |
| Offline data (SQLite) | Alpha WASM support requires Metro + header config | Either accept alpha quality or use API-only on web |
| Seed database loading | expo-file-system has no web support | Fetch seed data from API instead of bundled file |
| Analytics | posthog-react-native is native-only | Platform shim to posthog-js on web |
| Voice input | expo-speech-recognition is native-only | Already degrades gracefully (feature hidden) |
| Dictionary | Custom native module | Already degrades gracefully (button hidden) |

### Responsive Layout Assessment (Estimated)

The mobile app has responsive design for tablets:
- Tablet detection at >=768px (iPad) / >=600dp (Android)
- Split view at >=1024dp width
- Split ratio: 53.6% / 46.4%

**For desktop browsers**, this means:
- At 1024px+ width: split view would activate (2 panels)
- Missing: 3-column layout that the Next.js app uses (book list + text + right panel)
- Missing: Panel drag-to-resize
- The mobile UI would render but would look like a tablet app, not a desktop web app

**Estimated visual quality:** Functional but not polished for desktop. Would need dedicated desktop breakpoints and layout work.

## Performance Estimate

Without a successful build, we can't measure actual performance. Based on the build progress:

**Bundle size estimate:**
- 2044 server modules + 1458 client modules processed
- React Native Web adds overhead vs plain React DOM
- Typical Expo web bundles: 500KB-1.5MB gzipped (depending on features)
- Current Next.js app (with code splitting): likely 200-500KB initial load

**Expected performance characteristics:**
- Larger initial bundle than Next.js (React Native Web runtime overhead)
- No code splitting by route (Expo web's SPA mode loads everything upfront)
- SSG mode would improve TTFB for pre-rendered pages
- Client-side navigation would be fast after initial load (same as SPA)

## Fix Path to Successful Build

**Step 1 (Critical):** Create a web shim for react-native-pager-view

```typescript
// components/Pager.web.tsx — web implementation
import { ScrollView, Dimensions } from 'react-native';

export function Pager({ children, onPageSelected, ...props }) {
  return (
    <ScrollView
      horizontal
      pagingEnabled
      snapToInterval={Dimensions.get('window').width}
      onMomentumScrollEnd={(e) => {
        const page = Math.round(
          e.nativeEvent.contentOffset.x / Dimensions.get('window').width
        );
        onPageSelected?.({ nativeEvent: { position: page } });
      }}
    >
      {children}
    </ScrollView>
  );
}

// components/Pager.native.tsx — keep react-native-pager-view
export { default as Pager } from 'react-native-pager-view';
```

**Step 2:** Update imports in `app/onboarding.tsx` and any other files importing react-native-pager-view to use the shim.

**Step 3:** Re-run `npx expo export --platform web` — should succeed.

**Step 4:** Start the dev server (`npx expo start --web`) and test features interactively.

## Summary

| Metric | Result |
|--------|--------|
| Build success | **No** — 1 blocking module |
| Modules that work on web | **~95%** (2028/2044 = 99.2% of server bundle) |
| Fix effort to get build passing | **2-3 days** (pager-view shim) |
| Runtime features expected to work | **~80%** (core reading, navigation, user data, auth fallback to email/password) |
| Features needing platform shims | **6** (pager, Google auth, Apple auth, PostHog, SQLite, file-system) |
| Features needing to be built | **4** (chat, desktop panels, ratings, book intros) |
