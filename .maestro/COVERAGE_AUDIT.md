# Maestro E2E Test Coverage Audit

**Date:** 2026-03-30
**Ticket:** [GH-237](https://github.com/verse-mate/verse-mate-mobile/issues/237)

---

## 1. Test Inventory

### Mobile Tests (30 flows)

| # | Folder | File | Type | What It Tests |
|---|--------|------|------|---------------|
| 1 | `auth/` | `auth-flow.yaml` | User Flow | Login/signup screen navigation (UI only, no real auth) |
| 2 | `bible-reading/` | `bible-reading-flow.yaml` | User Flow | Core Bible reading, view icons, tab visibility |
| 3 | `bible-reading/` | `view-switcher-flow.yaml` | User Flow | Bible/Explanations toggle, tab persistence across view switches and chapters |
| 4 | `bookmarks/` | `bookmark-flow.yaml` | User Flow | Bookmark toggle & menu navigation (unauthenticated -- login prompt only) |
| 5 | `dictionary/` | `dictionary-lookup-flow.yaml` | User Flow | Long-press word lookup, tooltip display, dismiss |
| 6 | `highlights/` | `highlights-flow.yaml` | User Flow | Highlights screen navigation, auto-highlights toggle (unauthenticated) |
| 7 | `navigation/` | `chapter-navigation-flow.yaml` | User Flow | FAB next/previous chapter buttons (Gen 1->2->3->2->1) |
| 8 | `navigation/` | `hamburger-menu-flow.yaml` | User Flow | Menu open, all 4 destinations, close button, backdrop close |
| 9 | `navigation/` | `navigation-modal-flow.yaml` | User Flow | Book/chapter picker modal, OT/NT tabs, book+chapter selection |
| 10 | `navigation/` | `psalms-chapter-grid-flow.yaml` | Regression | Psalms 150-chapter grid scrolling + navigation |
| 11 | `navigation/` | `tab-switching-flow.yaml` | User Flow | Summary/By-Line/Detailed tabs, persistence across chapters |
| 12 | `notes/` | `notes-flow.yaml` | User Flow | Notes screen navigation (unauthenticated -- login prompt only) |
| 13 | `regression/` | `content-rendering-assertions.yaml` | Regression | No placeholder/TODO text on Bible or Explanations screens |
| 14 | `regression/` | `cross-chapter-count-navigation-test.yaml` | Regression | Psalm 119 (176v) to 120 (7v) extreme verse-count differential |
| 15 | `regression/` | `mixed-navigation-sync-test.yaml` | Regression | FAB + swipe + picker mixed navigation header sync |
| 16 | `regression/` | `rapid-fab-navigation-test.yaml` | Regression | 5 forward + 3 backward FAB taps, header sync |
| 17 | `regression/` | `reverse-direction-stress-test.yaml` | Regression | 10 rapid direction alternations (FAB + swipe) |
| 18 | `regression/` | `skeleton-flash-test.yaml` | Regression | No skeleton flash during swipe in Explanations view |
| 19 | `settings/` | `settings-flow.yaml` | User Flow | Settings screen navigation, Bible Version, sign-in prompt |
| 20 | `split-view/` | `landscape-split-view-basic.yaml` | Regression | Tablet split-view renders both panels, no placeholders |
| 21 | `split-view/` | `split-view-bible-sync.yaml` | Regression | Tablet split-view panels stay in sync during navigation |
| 22 | `split-view/` | `dictionary-tablet-flow.yaml` | User Flow | Dictionary popup positioning on tablet split-view |
| 23 | `swipe/` | `book-crossing-swipe-test.yaml` | Regression | OT/NT boundary crossing (Malachi 4 -> Matthew 1) |
| 24 | `swipe/` | `swipe-boundary-test.yaml` | Regression | Genesis 1 + Revelation 22 boundary blocking |
| 25 | `swipe/` | `swipe-header-sync-test.yaml` | Regression | 5 consecutive left swipes, header sync |
| 26 | `swipe/` | `swipe-navigation-basic.yaml` | User Flow | Basic swipe left/right within same book |
| 27 | `swipe/` | `swipe-navigation-boundaries.yaml` | User Flow | Genesis 1 boundary (simplified) |
| 28 | `topics/` | `topics-reading-flow.yaml` | User Flow | Topic selection via modal, category verification |
| 29 | `topics/` | `topics-swipe-navigation.yaml` | User Flow | Topic swipe left/right with circular wrap |
| 30 | `topics/` | `topics-view-switching.yaml` | User Flow | Topic Bible/Insight view toggle + tab switching |

### Web Desktop Tests (6 Maestro flows)

| # | File | What It Tests |
|---|------|---------------|
| 31 | `web-desktop/split-view-basic-web.yaml` | Desktop web split-view rendering |
| 32 | `web-desktop/split-view-sync-web.yaml` | Desktop web panel sync |
| 33 | `web-desktop/split-view-tabs-web.yaml` | Explanation tab switching in split view |
| 34 | `web-desktop/split-view-navigation-web.yaml` | Navigation flows in split view |
| 35 | `web-desktop/split-view-topics-web.yaml` | Topics in desktop split view |
| 36 | `web-desktop/split-view-regression-web.yaml` | Content assertions in split view |

### Web Mobile Tests (24 flows in `web/`)

Mirror the mobile tests 1:1, running in Chromium via `setup-web.yaml`. Same coverage profile as mobile.

### Playwright Desktop Specs (3 specs in `e2e/desktop/`)

| # | File | What It Tests |
|---|------|---------------|
| 37 | `split-view-breakpoint.spec.ts` | 1023px/1024px breakpoint, dynamic resize |
| 38 | `split-view-divider.spec.ts` | Divider visibility, panel widths, drag-to-snap |
| 39 | `split-view-edge-tabs.spec.ts` | Edge tab visibility in full-screen modes |

### Shared Setup Flows (8 files)

- `setup.yaml` -- Clean state, skip onboarding, wait for Bible screen
- `setup-warm.yaml` -- Warm launch without clearing state
- `setup-web.yaml` -- Web browser setup with onboarding skip
- `setup-warm-web.yaml` -- Warm web setup
- `setup-desktop-web.yaml` -- Desktop web with split-view wait
- `setup-warm-tablet.yaml` -- Tablet with clean state for split-view
- `warmup.yaml` -- CI warmup (preserves EAS Update)
- `warmup-tablet.yaml` -- CI tablet warmup

---

## 2. Coverage Matrix

| Feature / User Flow | Status | Test Files | Notes |
|---------------------|--------|------------|-------|
| **Core Reading** | | | |
| App launch + Genesis 1 loads | COVERED | `bible-reading-flow` | Clean launch, verify content |
| Bible view (verse text) | COVERED | `bible-reading-flow` | Verifies tabs hidden in Bible view |
| Explanations view (tabs) | COVERED | `view-switcher-flow`, `tab-switching-flow` | Summary/By-Line/Detailed |
| Tab persistence (across chapters) | COVERED | `view-switcher-flow`, `tab-switching-flow` | Tab survives chapter change |
| View persistence (across chapters) | PARTIAL | `view-switcher-flow` | Only tests one chapter change |
| **Navigation** | | | |
| Swipe left/right | COVERED | `swipe-navigation-basic`, `swipe-header-sync-test` | Basic + 5-swipe sync test |
| FAB next/previous buttons | COVERED | `chapter-navigation-flow`, `rapid-fab-navigation-test` | Basic + stress test |
| Navigation modal (book/chapter picker) | COVERED | `navigation-modal-flow`, `psalms-chapter-grid-flow` | OT/NT tabs, 150-chapter grid |
| Cross-book boundary (OT/NT) | COVERED | `book-crossing-swipe-test` | Malachi 4 -> Matthew 1 |
| Bible boundary (Gen 1, Rev 22) | COVERED | `swipe-boundary-test`, `swipe-navigation-boundaries` | Both boundaries tested |
| Mixed navigation methods | COVERED | `mixed-navigation-sync-test` | FAB + swipe + picker |
| Rapid direction changes | COVERED | `reverse-direction-stress-test` | 10 alternations |
| **Hamburger Menu** | | | |
| Menu open/close | COVERED | `hamburger-menu-flow` | Close button + backdrop |
| Menu -> Bookmarks | COVERED | `hamburger-menu-flow` | Navigate + back |
| Menu -> Highlights | COVERED | `hamburger-menu-flow` | Navigate + back |
| Menu -> Notes | COVERED | `hamburger-menu-flow` | Navigate + back |
| Menu -> Settings | COVERED | `hamburger-menu-flow` | Navigate + back |
| **Authentication** | | | |
| Login screen UI | COVERED | `auth-flow` | Form fields present |
| Signup screen UI | COVERED | `auth-flow` | Form fields present |
| Login -> Signup link | COVERED | `auth-flow` | Navigation between screens |
| Actual login with credentials | NOT COVERED | -- | No test credentials or API auth |
| Actual signup flow | NOT COVERED | -- | No test account creation |
| Google Sign-In | NOT COVERED | -- | OAuth difficult to automate |
| Session persistence | NOT COVERED | -- | No auth state tests |
| Logout flow | NOT COVERED | -- | Requires authenticated state |
| **Bookmarks** | | | |
| Unauthenticated login prompt | COVERED | `bookmark-flow` | Toggle + menu entry |
| Bookmark add/remove | NOT COVERED | -- | Requires authentication |
| Bookmark list with data | NOT COVERED | -- | Requires authentication |
| Bookmark navigation to chapter | NOT COVERED | -- | Requires authentication |
| **Highlights** | | | |
| Auto-highlights toggle | COVERED | `highlights-flow` | Unauthenticated, master toggle |
| Highlight creation (tap verse) | NOT COVERED | -- | Requires authentication |
| Highlight list with data | NOT COVERED | -- | Requires authentication |
| Highlight deletion | NOT COVERED | -- | Requires authentication |
| **Notes** | | | |
| Unauthenticated login prompt | COVERED | `notes-flow` | Menu entry + login prompt |
| Note creation | NOT COVERED | -- | Requires authentication |
| Note editing | NOT COVERED | -- | Requires authentication |
| Note list with data | NOT COVERED | -- | Requires authentication |
| **Settings** | | | |
| Settings screen navigation | COVERED | `settings-flow` | Menu entry + back |
| Bible Version display | COVERED | `settings-flow` | "Bible Version" text visible |
| Theme switching (dark/light) | NOT COVERED | -- | Only checks presence |
| Font size adjustment | NOT COVERED | -- | No testID for font controls |
| Profile editing | NOT COVERED | -- | Requires authentication |
| Language selection | NOT COVERED | -- | Not tested |
| **Topics** | | | |
| Topic selection via modal | COVERED | `topics-reading-flow` | Search + select |
| Topic swipe navigation | COVERED | `topics-swipe-navigation` | Circular wrap, rapid swipes |
| Topic view switching | COVERED | `topics-view-switching` | Bible/Insight toggle, tabs |
| Return to Bible from topic | COVERED | `topics-reading-flow` | Modal -> OT -> Genesis |
| **Dictionary** | | | |
| Word long-press lookup | COVERED | `dictionary-lookup-flow` | Tooltip appears + dismiss |
| Dictionary on tablet | COVERED | `dictionary-tablet-flow` | Split-view positioning |
| Dictionary on Topics/Insights | NOT COVERED | -- | Should work universally (GH-193) |
| **Split View (Tablet)** | COVERED | 3 flows | Both panels, sync, dictionary |
| **Split View (Web Desktop)** | COVERED | 6 flows + 3 Playwright | Comprehensive |
| **Search** | NOT COVERED | -- | Zero tests, recently broken |
| **Recents/History** | NOT COVERED | -- | Zero tests, recent bug |
| **Sharing** | NOT COVERED | -- | No share tests |
| **Offline Mode** | NOT COVERED | -- | No offline tests |
| **Verse Insight (bottom sheet)** | NOT COVERED | -- | Tap verse -> insight panel |
| **Dark Mode** | NOT COVERED | -- | No visual verification |
| **Onboarding (full flow)** | NOT COVERED | -- | Always skipped in setup |
| **About / Help / Giving** | NOT COVERED | -- | Screens exist but never navigated |

---

## 3. Identified Gaps -- Prioritized

### CRITICAL (Recent regressions with zero test coverage)

| # | Gap | Recent Bug | Impact |
|---|-----|------------|--------|
| 1 | Authenticated user flows (bookmark/note/highlight CRUD) | Bookmark + Notes infinite spinner (GH-231) | All user data features untested |
| 2 | Search feature | Search broken (GH-233) | Zero coverage |
| 3 | Recents/history | Not showing current book (GH-233) | Zero coverage |
| 4 | Commentary tab scroll independence | GH-189 active bug | No regression test |

### HIGH (Important user flows, no coverage)

| # | Gap | Why Important |
|---|-----|---------------|
| 5 | Actual login/signup with credentials | Auth is gateway to all user features |
| 6 | Theme switching | Core UX feature, no functional test |
| 7 | Verse Insight bottom sheet | Primary feature, completely untested |
| 8 | Scroll position on view switch (GH-201) | Active bug |
| 9 | Specific chapter loading (Galatians 6, GH-199) | User-reported failure |

### MEDIUM (Secondary features)

| # | Gap |
|---|-----|
| 10 | Onboarding flow (currently always skipped) |
| 11 | Sharing |
| 12 | Offline mode / downloads |
| 13 | Font size adjustment |
| 14 | About / Help / Giving screens |
| 15 | Dictionary on Topics/Insights (GH-193) |

### LOW (Edge cases)

| # | Gap |
|---|-----|
| 16 | Logout flow |
| 17 | Language selection |
| 18 | Profile editing |
| 19 | Dark mode content readability |

---

## 4. Plan to Fill Gaps

### Phase 0: Enable Authenticated Testing (Prerequisite)

Before writing any authenticated-flow tests:

1. **Test user credentials** -- Create a dedicated test account (email/password) in the staging API
2. **`setup-authenticated.yaml`** -- Shared flow that runs `setup.yaml` then logs in with test credentials
3. **Environment variables** -- Use Maestro's `${ENV_VAR}` syntax to keep credentials out of YAML files

### Phase 1: Critical Gaps (est. 12-16 hours)

| Task | Effort | Proposed File |
|------|--------|---------------|
| Authenticated bookmark CRUD flow | 2-3h | `.maestro/bookmarks/bookmark-authenticated-flow.yaml` |
| Authenticated note CRUD flow | 2-3h | `.maestro/notes/notes-authenticated-flow.yaml` |
| Authenticated highlight CRUD flow | 2-3h | `.maestro/highlights/highlights-authenticated-flow.yaml` |
| Search feature flow | 2h | `.maestro/search/search-flow.yaml` |
| Recents/history flow | 1-2h | `.maestro/recents/recents-flow.yaml` |
| Commentary tab scroll regression | 1-2h | `.maestro/regression/tab-scroll-independence-test.yaml` |

### Phase 2: High Priority Gaps (est. 6-8 hours)

| Task | Effort | Proposed File |
|------|--------|---------------|
| Login with test credentials | 1-2h | `.maestro/auth/auth-login-flow.yaml` |
| Theme switching verification | 1h | `.maestro/settings/theme-switching-flow.yaml` |
| Verse Insight bottom sheet | 2h | `.maestro/bible-reading/verse-insight-flow.yaml` |
| Scroll position view switch regression | 1-2h | `.maestro/regression/scroll-position-view-switch-test.yaml` |
| Galatians 6 chapter load test | 1h | `.maestro/regression/specific-chapter-load-test.yaml` |

### Phase 3: Medium Priority Gaps (est. 7-10 hours)

| Task | Effort |
|------|--------|
| Onboarding full walkthrough | 1-2h |
| Sharing feature | 1-2h |
| Offline mode basic check | 2-3h |
| Dictionary on Topics | 1h |
| About/Help/Giving navigation | 1h |

---

## 5. CI/CD Integration

### Current State

- **Trigger:** Manual only (`workflow_dispatch`)
- **Mobile:** Pixel 6 (API 34) for phone, Nexus 10 (API 34) for tablet/split-view
- **Web Desktop:** Xvfb + Chromium for Maestro, Playwright for desktop specs
- **APK Strategy:** Reuses latest EAS `e2e-test` APK with OTA JS updates; fresh build only when native code changes

### Recommendation

Add a **PR-triggered subset** of critical regression tests (e.g., the `regression/` folder) to catch regressions before merge rather than after.

---

## 6. Summary Statistics

| Metric | Value |
|--------|-------|
| Total Maestro flows (mobile) | 30 |
| Total Maestro flows (web) | 24 |
| Total Maestro flows (web-desktop) | 6 |
| Total Playwright specs | 3 |
| Shared setup flows | 8 |
| Feature folders | 13 |
| Features with COVERED status | 16 |
| Features with NOT COVERED status | 20+ |
| Features with recent regressions and no test | 4 |
| Estimated effort for critical gaps | 12-16 hours |
| Estimated effort for all gaps | 25-35 hours |
