# Discovery Phase Updates to Technical Spec

> Date: 2025-10-06
> Status: Addendum to technical-spec.md
> Based on: DISCOVERY-FINDINGS.md

## Overview

This document contains corrections to `technical-spec.md` based on real web app analysis. The original spec contained many assumptions that proved to be incorrect.

## Major Architecture Changes Required

### 1. Routing & Navigation

**Original Spec Assumption**:
```
- **Expo Router**: File-based routing with `/bible/[bookId]/[chapter]` structure
- **URL State Management**: Testament excluded from URL path
- **Book Order Mapping**: Sequential 1-66 book ID system
```

**Discovery Reality**:
- Web app has **NO URL routing** (`/bible` returns 404)
- Homepage `/` IS the Bible reader
- All navigation is client-side via dropdown

**Mobile Implementation Decision**:
```
RECOMMENDATION: Implement BETTER routing than web app
- Use Expo Router with `/bible/[bookId]/[chapter]` structure
- This is a MOBILE ENHANCEMENT (not web app matching)
- Provides deep linking, shareable URLs, browser back/forward
- Better UX than web app's client-only navigation
```

### 2. Navigation Components

**Original Spec Assumption**:
```
- **BibleNavigator**: Root component managing testament/book/chapter selection state
- **TestamentTabs**: Tab-based interface with Old/New Testament switching
- **BookAccordion**: Expandable accordion for hierarchical book organization
- **VerseGrid**: 5-column grid layout for chapter selection
- **GlobalSearch**: Universal search component
```

**Discovery Reality**:
- Single **dropdown selector** at top left
- No separate testament/book/chapter screens
- No accordion, no grid, no hierarchical pages
- Unknown if search exists in dropdown (not captured)

**Mobile Implementation Decision**:
```
RECOMMENDATION: Modal/Bottom Sheet with Testament Tabs
- Single "Book & Chapter" button/selector
- Opens bottom sheet/modal (not new screen)
- Testament tabs within modal (if web app has them)
- Book list with chapter selection inline
- Search bar within modal
- Maintains single-screen experience like web app
```

### 3. Content Tabs - NEW DISCOVERY

**Original Spec**:
- Only mentioned chapter reading view
- No mention of multiple content presentations

**Discovery Reality**:
- **Three tabs**: Summary, By Line, Detailed
- Summary: AI-generated chapter overview
- By Line: Verse-by-verse breakdown
- Detailed: Full chapter text (spec's focus)

**Mobile Implementation Addition**:
```
NEW REQUIREMENT: Implement all three content tabs

- **SummaryView**: AI-generated chapter summary with sections
- **ByLineView**: Verse-by-verse detailed breakdown
- **DetailedView**: Full chapter text (original spec scope)

TabBar component with three tabs matching web app
```

### 4. Typography System - CORRECTIONS

**Original Spec Assumption**:
```
- Titles: MerriweatherItalic, 32px, 700 weight, 44px line height ✓ CORRECT
- Subtitles: MerriweatherItalic, 22px, 700 weight, 28px line height ✓ CORRECT
- Body Text: Roboto Serif, 18px, 300 weight, 32px line height ❌ WRONG
- Verse Numbers: 12px superscript with 2px margin ⚠️ NOT VALIDATED
```

**Discovery Reality (Computed Styles)**:
```typescript
const typography = {
  h1: {
    fontFamily: 'MerriweatherItalic, sans-serif',
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '44px',
  }, // ✓ CORRECT

  h2: {
    fontFamily: 'MerriweatherItalic, sans-serif',
    fontSize: '22px',
    fontWeight: '700',
    lineHeight: '28px',
  }, // ✓ CORRECT

  p: { // Chapter text paragraphs
    fontFamily: 'MerriweatherItalic, sans-serif', // ❌ NOT Roboto Serif!
    fontSize: '22px', // ❌ NOT 18px!
    fontWeight: '400', // ❌ NOT 300!
    lineHeight: '28px', // ❌ NOT 32px!
  },

  body: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, ...',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '24px',
  },
};
```

**Mobile Implementation Correction**:
```
ALL chapter text uses MerriweatherItalic (not just titles/subtitles)
- Chapter title (h1): MerriweatherItalic 32px/700
- Section subtitles (h2): MerriweatherItalic 22px/700
- Chapter text (p): MerriweatherItalic 22px/400 (NOT Roboto Serif!)
- UI elements (buttons, tabs): system-ui/Roboto 16px/400
```

### 5. Color System - PARTIAL VALIDATION

**Original Spec Assumption**:
```
- Primary Accent: #b09a6d (--dust)
- Background: #f6f3ec (--fantasy)
- Text: #212531 (--night)
- Muted Text: #818990 (--oslo-gray)
- Borders: #d5d8e1 (--border)
```

**Discovery Reality (from computed styles)**:
```typescript
const colors = {
  bodyText: 'rgb(33, 37, 49)',      // #212531 ✓ CORRECT (night)
  h1Text: 'rgb(0, 0, 0)',           // #000000 (pure black)
  h2Text: 'rgb(33, 37, 49)',        // #212531 ✓ CORRECT (night)
  paragraphText: 'rgb(62, 70, 77)', // #3E464D (darker muted)
  buttonText: 'rgb(255, 255, 255)', // #FFFFFF (white)
};

// #b09a6d (dust) FOUND in 404 page "Go Back" button background
// #f6f3ec (fantasy) NOT YET OBSERVED
// #818990 (oslo-gray) NOT OBSERVED - actual muted is #3E464D
```

**Mobile Implementation Note**:
```
Use extracted RGB values as source of truth:
- Main text: #212531 (rgb(33, 37, 49))
- Muted text: #3E464D (rgb(62, 70, 77)) - NOT #818990
- Accent: #b09a6d (observed in 404 button)
- Background: Check in "By Line" or "Summary" tabs for #f6f3ec
```

### 6. Chapter Navigation - NOT FOUND

**Original Spec Assumption**:
```
- **FloatingNavigation**: Persistent floating arrow buttons (40px circular, auto-hide after 3s)
- **GestureNavigation**: Swipe gesture handler for chapter navigation
- **Cross-Book Navigation Logic**: Functions for next/previous book
```

**Discovery Reality**:
- NO prev/next buttons found in screenshots
- No swipe indicators visible
- Cannot test cross-book navigation (URL routing doesn't work)

**Mobile Implementation Decision**:
```
RECOMMENDATION: Add as mobile enhancement (NOT in web app)

These are valuable mobile-specific features:
- Swipe gestures for chapter navigation (mobile UX pattern)
- Floating prev/next buttons (mobile enhancement)
- Cross-book navigation (Genesis 50 → Exodus 1)

But acknowledge: These are NOT web app features
```

### 7. Loading States & Error Handling

**Original Spec Assumption**:
```
- **SkeletonLoader**: Loading placeholder components for chapters and book lists
```

**Discovery Reality**:
- Pages loaded instantly (no loading state observed)
- 404 error page observed (dark background, centered message, "Go Back" button)

**Mobile Implementation Note**:
```
404 Error Page observed:
- Dark background (#1a1a1a or similar)
- Centered layout with logo
- Large "404" text
- Message: "Page not found"
- Gold/tan button: "Go Back" (#b09a6d background)

Implement similar error states for mobile
Loading states still needed (web app is fast, mobile may have slower networks)
```

## Updated Component Architecture

Based on discoveries, here's the REVISED component structure:

### Core Components (Updated)

```
- **BibleReaderScreen**: Main screen (homepage equivalent)
  - **BookChapterSelector**: Dropdown/button to open selection modal
  - **ContentTabs**: TabBar with Summary/ByLine/Detailed
  - **SummaryView**: AI summary with sections (NEW)
  - **ByLineView**: Verse-by-verse breakdown (NEW)
  - **DetailedView**: Full chapter text (original)
    - **ChapterHeader**: H1 with chapter title
    - **ChapterSection**: H2 subtitles + verses
    - **VerseText**: Paragraph with inline verse numbers
  - **FloatingNavigation** (optional): Prev/next buttons (mobile enhancement)
  - **GestureHandler** (optional): Swipe navigation (mobile enhancement)

- **BookSelectionModal**: Bottom sheet for book/chapter selection
  - **TestamentTabs**: OT/NT tabs (if web app has them)
  - **SearchInput**: Filter books/chapters
  - **BookList**: Scrollable list of books
  - **ChapterGrid**: Inline chapter selection per book

- **ErrorBoundary**: 404-style error pages
- **LoadingState**: Skeleton screens for content loading
```

### What to REMOVE from Original Spec

❌ **Remove** these components (not in web app):
- Separate testament selection screen
- Separate book selection screen
- Separate chapter selection screen
- 5-column chapter grid as standalone view
- VerseGrid component
- BookAccordion (unless found in dropdown)

## API Integration - Needs Validation

**Original Spec Endpoints**:
```
- `/bible/testaments` - Get testament and book structure
- `/bible/books` - Get all Bible books with metadata
- `/bible/book/{bookId}/{chapterNumber}` - Get chapter content
```

**Action Required**:
```
VALIDATE AGAINST SWAGGER SPEC: https://api.verse-mate.apegro.dev/swagger/json

Questions to answer:
1. Are these exact endpoint paths correct?
2. What request/response formats are used?
3. Are there additional endpoints for Summary/ByLine views?
4. How does the web app fetch content for different tabs?
```

## Implementation Plan Changes

### What STAYS from Original Spec ✓
- Expo Router for deep linking (mobile enhancement over web app)
- React Query for API caching
- AsyncStorage for reading position
- Gesture Handler + Reanimated for animations
- Complete chapter display (validated in web app)
- Inline verse formatting (validated)
- Subtitle integration (validated)

### What CHANGES ❌→✅
- ❌ Multi-screen navigation → ✅ Modal-based selection
- ❌ Roboto Serif body text → ✅ MerriweatherItalic everywhere
- ❌ Single chapter view → ✅ Three content tabs (Summary/ByLine/Detailed)
- ❌ Hierarchical pages → ✅ Single screen + modal
- ❌ URL routing from web app → ✅ URL routing as mobile enhancement

### What's ADDED (New Requirements) ➕
- ➕ Summary tab view (AI-generated overview)
- ➕ By Line tab view (verse-by-verse breakdown)
- ➕ Book/Chapter selection modal (bottom sheet pattern)
- ➕ Testament tabs within modal (if validated)

## Next Steps for Spec Update

1. ✅ Create this addendum document
2. ⏳ Update `technical-spec.md` Core Components section
3. ⏳ Update `technical-spec.md` Typography section with real values
4. ⏳ Update `technical-spec.md` Navigation section (modal-based)
5. ⏳ Add Summary/ByLine tab requirements
6. ⏳ Mark mobile enhancements clearly (not in web app)
7. ⏳ Validate API endpoints against Swagger
8. ⏳ Create revised implementation plan (Task 1.10)
