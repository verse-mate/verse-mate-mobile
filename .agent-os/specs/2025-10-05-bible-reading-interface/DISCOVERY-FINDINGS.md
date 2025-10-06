# Discovery Findings - Bible Reading Interface

> Date: 2025-10-06
> Phase: Discovery (Task 1)
> Status: Complete

## Executive Summary

The web app (`https://app.versemate.org`) uses a **fundamentally different architecture** than assumed in the spec. Most architectural assumptions are **INVALID** and need to be reconsidered for mobile implementation.

## Critical Discoveries

### 1. ❌ NO URL-Based Routing

**Assumption**: The web app uses `/bible/[bookId]/[chapter]` URL structure
**Reality**:
- `/bible` returns **404**
- `/bible/1/50` returns **404**
- `/bible/{bookId}/{chapter}` pattern does **NOT exist**

**Impact**: The entire routing strategy in the spec is invalid for matching web app behavior.

### 2. ✅ Homepage IS the Bible Reader

**Assumption**: Homepage leads to a separate Bible reading interface
**Reality**:
- `/` (homepage) **IS** the Bible reading interface
- Loads directly to Genesis Chapter 1 by default
- All navigation happens client-side (SPA)

**Impact**: No hierarchical page navigation - single-page application with component-based navigation.

### 3. ⚠️ Dropdown-Based Navigation (Not Hierarchical Pages)

**Assumption**: Separate testament selection → book selection → chapter selection pages
**Reality**:
- **Single dropdown selector** at top left showing "Genesis 1"
- No separate testament/book/chapter selection screens
- All selection happens within one dropdown component

**Impact**: Mobile app should NOT implement multi-screen navigation flow. Consider modal/bottom sheet with tabs instead.

### 4. ✅ Tab-Based Content Views

**Discovered**: Three tabs for chapter content presentation:
- **Summary**: AI-generated chapter summary
- **By Line**: Verse-by-verse breakdown
- **Detailed**: Full chapter text

**Impact**: Spec didn't account for Summary and By Line views. Mobile implementation needs all three tabs.

## Design System - Real Values Extracted

### Typography

| Element | Font Family | Size | Weight | Line Height |
|---------|------------|------|--------|-------------|
| Body | system-ui, -apple-system, Segoe UI, Roboto | 16px | 400 | 24px |
| H1 (Chapter Title) | **MerriweatherItalic**, sans-serif | **32px** | **700** | **44px** |
| H2 (Subtitles) | **MerriweatherItalic**, sans-serif | **22px** | **700** | **28px** |
| P (Chapter Text) | **MerriweatherItalic**, sans-serif | **22px** | **400** | **28px** |
| Button | system-ui, -apple-system, Segoe UI, Roboto | 16px | 400 | 24px |

**✅ VALIDATED**: Spec assumptions about MerriweatherItalic were **CORRECT**
**❌ INVALID**: Spec assumed "Roboto Serif" for body text - actual is **MerriweatherItalic**

### Colors (RGB Values from Computed Styles)

| Element | Color | RGB Value | Hex Equivalent |
|---------|-------|-----------|----------------|
| Body Text | Night | rgb(33, 37, 49) | #212531 |
| H1 Text | Black | rgb(0, 0, 0) | #000000 |
| H2 Text | Night | rgb(33, 37, 49) | #212531 |
| P Text | Muted | rgb(62, 70, 77) | #3E464D |
| Button Text | White | rgb(255, 255, 255) | #FFFFFF |

**⚠️ PARTIAL**: Spec color assumptions partially correct
- ✅ #212531 (night) is correct
- ❌ #b09a6d (dust), #f6f3ec (fantasy) colors not observed yet (may be in other UI elements)

### Design Tokens

**Finding**: **NO CSS custom properties** used in the web app
**Impact**: Cannot extract design tokens - must use computed styles directly

## Navigation Patterns Discovered

### Book/Chapter Selection
- **Pattern**: Dropdown selector (not hierarchical pages)
- **Location**: Top left of interface
- **Format**: Shows current selection (e.g., "Genesis 1")
- **Behavior**: Clicks open dropdown (structure not yet captured)

**Questions Remaining**:
- Does dropdown have testament tabs?
- Is there a search/filter in the dropdown?
- How are books organized in the dropdown?

### Chapter Navigation
- **Pattern**: Unknown (selectors for "next" button not found)
- **Cross-book navigation**: Cannot validate (URL routing doesn't work)

**Questions Remaining**:
- Are there prev/next chapter buttons?
- Does swipe navigation exist on web?
- How does user navigate between chapters?

## Chapter Display Patterns

### From Screenshots Observed:
- ✅ **Full chapter display** (not paginated)
- ✅ **Inline verse numbers** visible as superscript
- ✅ **Subtitle sections** present ("The Creation", "Days 1-3", etc.)
- ✅ **Three content tabs**: Summary, By Line, Detailed

### Verse Formatting:
- Verse numbers appear as small superscript numbers
- Text flows continuously with inline verse markers
- Subtitles break content into sections with verse ranges

## Loading States & Error Handling

### Error Page (404):
- **Background**: Dark (#1a1a1a or similar)
- **Logo**: "VERSE|MATE" in white
- **Error**: Large "404" text
- **Message**: "Page not found" with explanation
- **Action**: Gold/tan "Go Back" button (#b09a6d color visible here!)

### Loading States:
- Not yet observed (pages loaded instantly in tests)

## Spec Assumptions - Validation Results

| Assumption | Status | Reality |
|------------|--------|---------|
| URL routing `/bible/[bookId]/[chapter]` | ❌ INVALID | No URL routing, 404 errors |
| Hierarchical navigation (testament → book → chapter pages) | ❌ INVALID | Single-page dropdown navigation |
| Testament tabs or toggle | ⚠️ UNKNOWN | Not yet observed in dropdown |
| Book accordion/list | ⚠️ UNKNOWN | Dropdown structure not captured |
| 5-column chapter grid | ❌ INVALID | No chapter grid visible |
| Floating navigation buttons | ❌ NOT FOUND | No prev/next buttons found |
| Cross-book navigation | ⚠️ CANNOT TEST | URL routing doesn't work |
| MerriweatherItalic typography | ✅ CORRECT | Validated in computed styles |
| Roboto Serif body text | ❌ INVALID | Actually MerriweatherItalic |
| Color values (#b09a6d, #212531) | ⚠️ PARTIAL | #212531 correct, #b09a6d in 404 button |
| Complete chapter display | ✅ CORRECT | No pagination observed |
| Skeleton loading screens | ⚠️ UNKNOWN | Not yet observed |

## Mobile Implementation Recommendations

### 1. Routing Strategy
**DO NOT** replicate web app's SPA approach with client-only navigation.
**DO** implement proper deep linking with Expo Router:
- Use `/bible/[bookId]/[chapter]` for mobile
- This is a **mobile enhancement**, not web app matching

### 2. Navigation UI
**Consider**:
- Modal or bottom sheet for book/chapter selection (not separate screens)
- Tabs within modal for testament organization
- Search/filter capability within modal

**Avoid**:
- Multi-screen navigation flow (not in web app)
- Separate testament/book/chapter selection screens

### 3. Content Presentation
**Must implement** all three tabs:
- Summary (AI-generated overview)
- By Line (verse-by-verse)
- Detailed (full chapter - current spec focus)

### 4. Chapter Navigation
**Options**:
- Add swipe gestures (mobile enhancement)
- Add floating prev/next buttons (mobile enhancement)
- Both are mobile-specific features (not in web app)

## Next Steps

1. ✅ ~~Create journey to capture dropdown structure~~
2. ✅ ~~Extract complete design system~~
3. ✅ ~~Document navigation patterns~~
4. ⏳ **Update technical spec with real findings**
5. ⏳ **Create revised implementation plan**
6. ⏳ **Validate API endpoints in Swagger**
7. ⏳ **Design mobile-specific navigation flow**

## Files Generated

- `.agent-os/references/journeys/bible-navigation-flow/` - Homepage navigation exploration
- `.agent-os/references/journeys/chapter-navigation/` - Chapter navigation testing
- Metadata: computed-styles.json, html-structure.json, design-tokens.json (empty)
- Screenshots: 18 total (6 steps × 3 viewports per journey)
