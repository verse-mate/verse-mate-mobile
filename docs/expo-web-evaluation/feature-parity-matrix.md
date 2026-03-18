# Feature Parity Matrix: Next.js Web vs Expo Web

## Complete Feature Inventory

### Core Reading Features

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| Bible chapter reading | Yes — panel layout | Yes — scroll view | High — works with react-native-web | N/A |
| Chapter navigation (swipe) | Yes — react-swipeable | Yes — react-native-pager-view | Medium — needs platform shim for pager-view | 2-3 days |
| Multi-version support | Yes | Yes | High — API-driven, platform-agnostic | N/A |
| Verse selection & actions | Yes — click/tap | Yes — long press | High — gesture handler works on web | N/A |
| Last read position | Yes — cookie/API | Yes — AsyncStorage/API | High — AsyncStorage uses localStorage on web | N/A |
| Reading progress bar | Yes | Yes | High — pure React component | N/A |
| Deep linking by book/chapter | Yes — SSR URLs | Yes — Expo Router | High — Expo Router handles web URLs | N/A |

### AI & Content Features

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| AI Explanations | Yes — multiple types | Yes | High — API-driven | N/A |
| AI Chat / Conversation | Yes — sidebar chat | **No** | N/A — would need to be built | 1-2 weeks |
| Topics browsing | Yes — category/slug URLs | Yes — topic ID URLs | High | N/A |
| Book introductions | Yes | **No** | N/A — would need to be built | 2-3 days |
| Dictionary lookup | Yes — DictionaryPopover | Yes — native module | Medium — native module degrades, needs web API | 1-2 days |

### User Data Features

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| Bookmarks | Yes | Yes | High — API + AsyncStorage | N/A |
| Highlights (color-coded) | Yes | Yes | High — pure React + API | N/A |
| Notes (CRUD) | Yes | Yes | High — pure React + API | N/A |
| Auto-highlights | Yes | Yes | High — API-driven | N/A |
| Ratings (1-5 stars) | Yes | **No** | N/A — would need to be built | 1-2 days |

### Authentication

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| Email/password login | Yes | Yes | High — form + API, works on web | N/A |
| Google OAuth | Yes — redirect flow | Yes — native SDK | Medium — needs GIS JS SDK on web | 1-2 days |
| Apple Sign-In | Yes — redirect flow | Yes — native SDK | Medium — needs Apple JS SDK on web | 1-2 days |
| Token refresh | Yes — httpOnly cookies | Yes — AsyncStorage | Medium — need to decide cookie vs localStorage | 1 day |

### Offline & Data

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| Offline reading | Yes — PWA/Service Worker | Yes — SQLite + sync queue | Low-Medium — expo-sqlite WASM is alpha, or need abstraction | 1-2 weeks |
| Download management | No | Yes | N/A — mobile-only feature | N/A |
| PWA install prompt | Yes | No | Medium — would need web-specific manifest | 1-2 days |

### Layout & UX

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| Desktop panel layout (3 columns) | Yes — resizable panels | Yes — split view (2 panels, tablet) | Medium — split view exists but optimized for tablet, not desktop | 1 week |
| Panel resizing (drag) | Yes — PanelResizer | No | Low — would need custom implementation | 3-5 days |
| Guided tours | Yes — driver.js | No | Low — would need to be built | 2-3 days |
| Responsive design | Yes — mobile-first CSS | Yes — tablet breakpoints | Medium — breakpoints exist but need desktop optimization | 3-5 days |
| Confetti celebrations | Yes — canvas-confetti | No | Low — trivially addable | Half day |

### Analytics & Admin

| Feature | Next.js Web | Mobile App | Expo Web Feasibility | Gap Effort |
|---------|-------------|------------|---------------------|------------|
| PostHog analytics | Yes — posthog-js | Yes — posthog-react-native | Medium — need platform shim to posthog-js | Half day |
| Session replay | Yes — posthog-js built-in | Yes — posthog-react-native-session-replay | Medium — switch to posthog-js on web | Half day |
| Admin dashboard | Yes | **No** | Out of scope — stays as separate web app | N/A |

### Mobile-Only Features (Reverse Gaps)

| Feature | Mobile App | Web Equivalent Needed? |
|---------|------------|----------------------|
| Voice input (speech-to-text) | Yes | Optional — Web Speech API exists |
| Haptic feedback | Yes | No — web doesn't support haptics |
| Downloads management | Yes | No — web uses PWA caching |
| Onboarding flow | Yes | Maybe — could reuse for web |
| Push notifications | Infrastructure only | Optional — Web Push API |

## SEO Assessment

### SEO-Critical Pages

| Page | Current Next.js Approach | Expo Web Capability |
|------|-------------------------|-------------------|
| `/bible/[book]/[chapter]` | SSR — dynamic content | SSG possible (generate all book/chapter combos at build time) |
| `/topic/[category]/[slug]` | SSR — dynamic content | SSG possible (generate all topics at build time) |
| `/login`, `/create-account` | Client-rendered | SPA fine (no SEO value) |
| Landing page | SSG (separate marketing site) | **Out of scope** — marketing site stays as-is |

### Expo Router Rendering Modes

| Mode | Status | Suitable For |
|------|--------|-------------|
| `single` (SPA) | Stable | App shell, authenticated pages |
| `static` (SSG) | Stable | Bible chapters, topics (pre-renderable content) |
| `server` (SSR) | **Alpha** (SDK 55) | Dynamic content, personalized pages |

### SEO Verdict

**Not a hard blocker.** SSG can pre-render Bible chapters and topics at build time. The content is relatively static (Bible text doesn't change). SSG is production-ready in Expo Router.

For truly dynamic content (user-specific, frequently changing), SSR would be needed — but that's alpha in SDK 55. The current app's SSR pages could be adequately served by SSG.

### @expo/next-adapter (Hybrid Approach)

**Deprecated.** The expo-cli repository was archived January 2024. @expo/next-adapter is no longer maintained. This is NOT a viable path. Expo Router's own SSG/SSR is the official direction.

## Gap Summary

### Features to Build (web has, mobile doesn't)

| Feature | Effort | Priority |
|---------|--------|----------|
| AI Chat / Conversation | 1-2 weeks | High — differentiating feature |
| Desktop 3-column panel layout | 1 week | High — desktop UX |
| Panel drag-to-resize | 3-5 days | Medium — desktop UX |
| Ratings system | 1-2 days | Low |
| Book introductions | 2-3 days | Low |
| Guided tours | 2-3 days | Low |

### Platform Shims Needed (make existing features work on web)

| Shim | Effort | Priority |
|------|--------|----------|
| react-native-pager-view → ScrollView on web | 2-3 days | **Critical** — build-blocking |
| Google Sign-In → GIS JS SDK on web | 1-2 days | High |
| Apple Sign-In → Apple JS SDK on web | 1-2 days | High |
| posthog-react-native → posthog-js on web | Half day | Medium |
| expo-sqlite offline → WASM or API-only on web | 1-2 weeks | Medium-High |
| Desktop responsive breakpoints | 3-5 days | High |

### Total Estimated Effort for Feature Parity

**Minimum viable web (core reading + auth):** 2-3 weeks
**Full feature parity (including chat, panels, offline):** 6-8 weeks
