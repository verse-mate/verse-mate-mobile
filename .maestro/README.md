# Maestro E2E Testing

This directory contains end-to-end tests for VerseMate Mobile using [Maestro](https://maestro.mobile.dev/).

## Table of Contents

- [Running Tests](#running-tests)
- [Test Organization](#test-organization)
- [Test Files](#test-files)
- [testID Inventory](#testid-inventory)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

---

## Running Tests

### Run All Tests

Maestro recursively discovers tests in subfolders, so running all tests is the same as before:

```bash
maestro test .maestro
```

### Run Tests by Feature Folder

Target a specific feature area by passing the subfolder path:

```bash
# Run only swipe tests
maestro test .maestro/swipe/

# Run only auth tests
maestro test .maestro/auth/

# Run only navigation tests
maestro test .maestro/navigation/

# Run only split-view tests (requires tablet emulator or iPad in landscape)
maestro test .maestro/split-view/
```

### Run a Specific Test

```bash
maestro test .maestro/auth/auth-flow.yaml
maestro test .maestro/swipe/book-crossing-swipe-test.yaml
```

### Interactive Debugging

```bash
maestro studio
```

### iOS (Local Development)

iOS remains the recommended platform for local E2E testing. Run on an iOS simulator:

```bash
maestro test .maestro
```

### Android (Local Development)

**Limitation**: Maestro does not support Android API 35. Use API 34 or lower.

```bash
# Install API 34 system image
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"

# Create new AVD with API 34
avdmanager create avd -n Pixel_API_34 -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_6
```

---

## Test Organization

### Directory Structure

Tests are organized into feature-based subfolders for easier navigation and selective execution:

```
.maestro/
├── README.md                                    # This documentation
├── auth/
│   └── auth-flow.yaml                           # Authentication flows
├── bible-reading/
│   ├── bible-reading-flow.yaml                  # Core Bible reading
│   └── view-switcher-flow.yaml                  # View switching
├── bookmarks/
│   └── bookmark-flow.yaml                       # Bookmarks feature
├── highlights/
│   └── highlights-flow.yaml                     # Highlights feature
├── navigation/
│   ├── chapter-navigation-flow.yaml             # Button navigation
│   ├── hamburger-menu-flow.yaml                 # Menu navigation
│   ├── navigation-modal-flow.yaml               # Navigation modal
│   └── tab-switching-flow.yaml                  # Content tab switching
├── notes/
│   └── notes-flow.yaml                          # Notes feature
├── regression/
│   ├── content-rendering-assertions.yaml        # No placeholder/TODO text
│   └── skeleton-flash-test.yaml                 # Loading skeleton
├── settings/
│   └── settings-flow.yaml                       # Settings management
├── split-view/
│   ├── landscape-split-view-basic.yaml          # Split view rendering (landscape)
│   └── split-view-bible-sync.yaml               # Split view panel sync (landscape)
├── swipe/
│   ├── book-crossing-swipe-test.yaml            # Cross-book swipe header sync
│   ├── swipe-boundary-test.yaml                 # Bible boundary handling
│   ├── swipe-header-sync-test.yaml              # Header sync during rapid swiping
│   ├── swipe-navigation-basic.yaml              # Basic swipe gestures
│   └── swipe-navigation-boundaries.yaml         # Boundary edge cases
└── topics/
    ├── topics-reading-flow.yaml                 # Topics reading
    ├── topics-swipe-navigation.yaml             # Topic swipe with circular wrap
    └── topics-view-switching.yaml               # Topic Bible/Insight view switching
```

**Total**: 23 test files across 11 feature folders

### File Naming Conventions

- **`{feature}-flow.yaml`**: Complete user journey tests (e.g., `auth-flow.yaml`, `highlights-flow.yaml`)
- **`{feature}-test.yaml`**: Regression or specific behavior tests (e.g., `skeleton-flash-test.yaml`)

### Tag Meanings

| Tag | Meaning |
|-----|---------|
| `critical` | Must pass for release - blocks deployment if failing |
| `auth` | Authentication-related tests |
| `user-flow` | Complete user journey from start to finish |
| `regression` | Prevents specific bugs from recurring |
| `navigation` | Tests navigation features and flows |
| `settings` | Settings and configuration tests |
| `split-view` | Split view / landscape tests (require tablet emulator) |
| `landscape` | Tests requiring landscape orientation |

---

## Test Files

| Folder | File | Type | Description | Tags |
|--------|------|------|-------------|------|
| `auth/` | `auth-flow.yaml` | User Flow | Login, signup, and authentication flows | `critical`, `auth` |
| `bible-reading/` | `bible-reading-flow.yaml` | User Flow | Core Bible reading and view switching | `critical`, `user-flow` |
| `bible-reading/` | `view-switcher-flow.yaml` | User Flow | Bible/Explanations view switching | `navigation` |
| `bookmarks/` | `bookmark-flow.yaml` | User Flow | Bookmark creation, viewing, and navigation | `user-flow` |
| `highlights/` | `highlights-flow.yaml` | User Flow | Highlight creation and management | `user-flow` |
| `navigation/` | `chapter-navigation-flow.yaml` | User Flow | Chapter navigation via buttons | `navigation` |
| `navigation/` | `hamburger-menu-flow.yaml` | User Flow | Hamburger menu navigation to all destinations | `navigation` |
| `navigation/` | `navigation-modal-flow.yaml` | User Flow | Bible navigation modal (book/chapter selection) | `navigation` |
| `navigation/` | `tab-switching-flow.yaml` | User Flow | Content tab switching (Summary/By-Line/Detailed) | `navigation` |
| `notes/` | `notes-flow.yaml` | User Flow | Note creation and management | `user-flow` |
| `regression/` | `content-rendering-assertions.yaml` | Regression | No placeholder/TODO text on any screen | `critical`, `regression`, `content-rendering` |
| `regression/` | `skeleton-flash-test.yaml` | Regression | Skeleton loader display during loading | `regression` |
| `settings/` | `settings-flow.yaml` | User Flow | Settings, theme switching, profile editing | `critical`, `settings` |
| `split-view/` | `landscape-split-view-basic.yaml` | Regression | Split view renders both panels (requires landscape) | `critical`, `split-view`, `landscape`, `regression` |
| `split-view/` | `split-view-bible-sync.yaml` | Regression | Split view panels stay in sync (requires landscape) | `critical`, `split-view`, `landscape`, `sync`, `regression` |
| `swipe/` | `book-crossing-swipe-test.yaml` | Regression | Cross-book swipe updates header correctly | `critical`, `cross-book` |
| `swipe/` | `swipe-boundary-test.yaml` | Regression | Bible boundaries block navigation correctly | `critical`, `boundary-handling`, `swipe` |
| `swipe/` | `swipe-header-sync-test.yaml` | Regression | Header syncs correctly during rapid swiping | `critical`, `header-sync`, `swipe` |
| `swipe/` | `swipe-navigation-basic.yaml` | User Flow | Basic swipe gesture navigation | `navigation` |
| `swipe/` | `swipe-navigation-boundaries.yaml` | User Flow | Genesis 1 and Revelation 22 boundary cases | `navigation` |
| `topics/` | `topics-reading-flow.yaml` | User Flow | Topic navigation and reading | `user-flow` |
| `topics/` | `topics-swipe-navigation.yaml` | User Flow | Topic swipe navigation with circular wrap | `critical`, `topics`, `swipe`, `navigation` |
| `topics/` | `topics-view-switching.yaml` | User Flow | Topic Bible/Insight view switching | `topics`, `navigation`, `view-switching` |

**Note**: Tests in `split-view/` require running on an Android tablet emulator in landscape orientation (or iPad simulator in landscape for local testing). See the split-view test files for setup instructions.

---

## testID Inventory

All tests use `id:` (testID) selectors for stability. Below is the complete inventory of available testIDs.

### Bible Chapter Screen

| testID | Element | Description |
|--------|---------|-------------|
| `chapter-header` | View | Main header container |
| `chapter-selector-button` | Pressable | Opens navigation modal, displays "Book Chapter" |
| `bible-view-icon` | Pressable | Switches to Bible reading view |
| `explanations-view-icon` | Pressable | Switches to Explanations view |
| `hamburger-menu-button` | Pressable | Opens hamburger menu |
| `chapter-pager-view` | PagerView | Swipeable chapter content container |

### Topics Screen

| testID | Element | Description |
|--------|---------|-------------|
| `topic-header` | View | Main header container |
| `topic-selector-button` | Pressable | Opens navigation modal |
| `bible-view-icon` | Pressable | Switches to Bible reading view |
| `explanations-view-icon` | Pressable | Switches to Explanations view |

### Navigation Components

#### FloatingActionButtons

| testID | Element | Description |
|--------|---------|-------------|
| `previous-chapter-button` | Pressable | Navigate to previous chapter |
| `next-chapter-button` | Pressable | Navigate to next chapter |

#### BibleNavigationModal

| testID | Element | Description |
|--------|---------|-------------|
| `bible-navigation-modal` | Animated.View | Modal container |
| `book-item-{book-name}` | Pressable | Book selection (lowercase, hyphenated: `book-item-genesis`) |
| `chapter-{number}` | Pressable | Chapter selection button |
| `topic-item-{topic-name}` | Pressable | Topic selection (lowercase, hyphenated) |

#### HamburgerMenu

| testID | Element | Description |
|--------|---------|-------------|
| `hamburger-menu-modal` | Modal | Menu modal container |
| `hamburger-menu` | Animated.View | Menu content container |
| `menu-backdrop` | Pressable | Backdrop to close menu |
| `menu-close-button` | Pressable | X button to close menu |
| `menu-item-bookmarks` | Pressable | Navigate to Bookmarks |
| `menu-item-highlights` | Pressable | Navigate to Highlights |
| `menu-item-notes` | Pressable | Navigate to Notes |
| `menu-item-settings` | Pressable | Navigate to Settings |
| `menu-item-login` | Pressable | Navigate to Login (unauthenticated) |
| `menu-item-signup` | Pressable | Navigate to Signup (unauthenticated) |
| `menu-item-logout` | Pressable | Logout (authenticated) |

#### ChapterContentTabs

| testID | Element | Description |
|--------|---------|-------------|
| `chapter-content-tabs` | View | Tabs container |
| `tab-summary` | Pressable | Summary tab |
| `tab-byline` | Pressable | By-Line tab |
| `tab-detailed` | Pressable | Detailed tab |

### Loading Components

#### SkeletonLoader

| testID | Element | Description |
|--------|---------|-------------|
| `skeleton-loader` | View | Main skeleton container |
| `skeleton-title` | Animated.View | Title placeholder |
| `skeleton-subtitle` | Animated.View | Subtitle placeholder |
| `skeleton-paragraph-1` | Animated.View | First paragraph placeholder |
| `skeleton-paragraph-2` | Animated.View | Second paragraph placeholder |
| `skeleton-paragraph-3` | Animated.View | Third paragraph placeholder |

#### ProgressBar

| testID | Element | Description |
|--------|---------|-------------|
| `progress-bar` | View | Progress bar container |
| `progress-bar-fill` | Animated.View | Filled portion |
| `progress-bar-percentage` | Text | Percentage text |

### Authentication Screens

#### Login Screen

| testID | Element | Description |
|--------|---------|-------------|
| `login-email` | TextInput | Email input field |
| `login-password` | TextInput | Password input field |
| `login-submit` | Button | Login button |
| `login-signup-link` | TouchableOpacity | Link to signup |
| `login-continue-without-account` | TouchableOpacity | Skip login |

#### Signup Screen

| testID | Element | Description |
|--------|---------|-------------|
| `signup-first-name` | TextInput | First name input |
| `signup-last-name` | TextInput | Last name input |
| `signup-email` | TextInput | Email input |
| `signup-password` | TextInput | Password input |
| `signup-submit` | Button | Signup button |
| `signup-login-link` | TouchableOpacity | Link to login |

### User Data Screens

#### Bookmarks Screen

| testID | Element | Description |
|--------|---------|-------------|
| `bookmarks-list` | FlatList | List of bookmarks |
| `bookmark-item-{bookId}-{chapterNumber}` | Pressable | Individual bookmark |
| `bookmarks-back-button` | Pressable | Back navigation |
| `bookmarks-login-button` | Pressable | Login prompt |

#### Highlights Screen

| testID | Element | Description |
|--------|---------|-------------|
| `highlights-list` | SectionList | List of highlights |
| `chapter-group-{bookId}-{chapterNumber}` | View | Chapter group header |
| `highlight-item-{id}` | Pressable | Individual highlight |
| `highlights-back-button` | Pressable | Back navigation |

#### Notes Screen

| testID | Element | Description |
|--------|---------|-------------|
| `notes-list` | SectionList | List of notes |
| `chapter-group-{bookId}-{chapterNumber}` | View | Chapter group header |
| `notes-back-button` | Pressable | Back navigation |

#### Settings Screen

| testID | Element | Description |
|--------|---------|-------------|
| `settings-back-button` | Pressable | Back navigation |
| `settings-first-name-input` | TextInput | First name field |
| `settings-last-name-input` | TextInput | Last name field |
| `settings-email-input` | TextInput | Email display |
| `settings-logout-button` | Pressable | Logout button |
| `settings-sign-in-button` | Pressable | Sign in prompt |
| `theme-selector` | Pressable | Theme selection |

---

## Writing New Tests

### Choosing the Right Folder

Place new test files in the feature folder that best matches the area being tested. If a test spans multiple features, choose the primary feature being validated.

### testID Naming Conventions

- **Component-based**: `{component}-{element}` (e.g., `skeleton-loader`, `menu-close-button`)
- **Action-based**: `{feature}-{action}` (e.g., `login-submit`, `bookmarks-back-button`)
- **Dynamic IDs**: `{component}-{identifier}` (e.g., `chapter-{number}`, `book-item-{name}`)

### Test Template

```yaml
---
appId: org.versemate.mobile
name: Feature Flow
description: Tests feature X functionality
tags:
  - user-flow
  - navigation

---

# Feature E2E Test Flow
#
# This flow tests:
# 1. Step one
# 2. Step two

# ============================================
# Test Setup: Launch App
# ============================================

- launchApp:
    appId: org.versemate.mobile

- waitForAnimationToEnd

- assertVisible:
    id: "chapter-selector-button"

# ============================================
# Test 1: Your Test Case
# ============================================

- tapOn:
    id: "your-testid"

- waitForAnimationToEnd

- assertVisible:
    id: "expected-element"
```

### Best Practices

1. **Always use `id:` selectors** instead of `text:` selectors for stability
2. **Add `waitForAnimationToEnd`** after navigation actions
3. **Use `optional: true`** for elements that may not be visible in all states
4. **Use 4-space indentation** for nested properties under commands
5. **Add section comments** to organize test steps clearly
6. **Include frontmatter** with appId, name, description, and tags

---

## Troubleshooting

### Maestro Version

Ensure you have the latest version:
```bash
maestro --version  # Should be 2.0.8 or higher
curl -Ls "https://get.maestro.mobile.dev" | bash  # Upgrade if needed
```

### Test Syntax Errors

- Maestro 2.x uses simplified scroll syntax: use `scroll` or `scrollUp` instead of `scroll: { direction: DOWN }`
- Nested properties (`optional`, `timeout`) must use 4-space indentation
- Use `- back:` with colon when adding properties (e.g., `optional: true`)

### Android Connectivity Issues

1. Check Android emulator is running: `adb devices`
2. Check Android API level: `adb shell getprop ro.build.version.sdk`
3. If API 35, use iOS or create an API 34 emulator

### Element Not Found

1. Verify the testID exists in the component source code
2. Check if the element is conditionally rendered (use `optional: true`)
3. Add `waitForAnimationToEnd` before asserting visibility

---

## CI/CD Integration

### GitHub Actions Workflow

The `maestro-e2e.yml` workflow runs Maestro E2E tests on Android emulators in GitHub Actions CI using `ubuntu-latest` runners with KVM hardware acceleration.

**Trigger**: Manual only via `workflow_dispatch` (non-blocking, does not gate PRs or deployments)

**How to run from GitHub**:
1. Go to Actions > "Maestro E2E Tests"
2. Click "Run workflow"
3. Optionally specify a `test-folder` (e.g., `swipe`, `auth`, `topics`) to run only that feature folder
4. Leave `test-folder` empty to run all tests

**Android CI Details**:
- Android API 34 (highest supported by Maestro)
- Phone tests: Standard emulator runs all folders except `split-view/`
- Tablet tests: Nexus 10 AVD in landscape runs `split-view/` tests only
- APK built via EAS CLI using the `e2e-test` profile (cached via `@expo/fingerprint` hash)
- Test artifacts (screenshots, logs) uploaded on every run for debugging

### Local Testing

For local development, iOS remains the recommended platform. Use `maestro test .maestro` to run all tests or target a specific folder.

---

## Recent Changes

- **2026-02-09**: Reorganized 23 test files from flat directory into 11 feature-based subfolders
- **2026-02-09**: Adapted split-view tests from iPad to Android tablet emulator
- **2026-02-09**: Added CI/CD integration with GitHub Actions (`maestro-e2e.yml`)
- **2026-02-09**: Added 5 new tests from Maestro audit: landscape-split-view-basic, content-rendering-assertions, topics-swipe-navigation, topics-view-switching, split-view-bible-sync
- **2025-11-28**: Major cleanup - migrated all tests to testID selectors, removed obsolete files
- **2025-11-28**: Created new tests: highlights, notes, settings, hamburger-menu, topics-reading
- **2025-11-28**: Promoted WIP tests: navigation-modal, view-switcher, tab-switching
- **2025-11-28**: Consolidated swipe navigation tests (removed gesture-priority, tab-persistence)
- **2025-11-03**: Fixed scroll command syntax for Maestro 2.x compatibility
- **2025-11-03**: Documented Android API 35 limitation
