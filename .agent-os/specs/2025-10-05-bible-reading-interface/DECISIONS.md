# Implementation Decisions

> Date: 2025-10-06
> Status: User Approved
> Source: User feedback and screenshot analysis

## All Decisions Finalized

### 1. Routing & Parameters ✅

**Q1: What does `verseId` parameter do?**
- **Answer**: Bug in web app URL - actually means CHAPTER, not verse
- **Decision**: Ignore `verseId` in web app, use `chapter` in mobile

**Q2: Verse-level deep linking?**
- **Answer**: Chapter level is perfect
- **Decision**: `/bible/[bookId]/[chapter]` (no verse parameter)

**Mobile Routing Structure**:
```
/bible/1/1      → Genesis Chapter 1
/bible/1/50     → Genesis Chapter 50
/bible/2/1      → Exodus Chapter 1
/bible/40/5     → Matthew Chapter 5
/bible/66/22    → Revelation Chapter 22
```

### 2. Navigation UI ✅

**Q3: Prev/Next button position?**
- **Answer**: D) All of the above (buttons + swipe)
- **Decision**: Implement both buttons AND swipe gestures

**Button Position**: Floating on left/right screen edges (centered vertically)
- Similar to Instagram stories navigation
- Always visible (no hover required)
- Auto-hide after 3 seconds of inactivity
- Reappear on tap or scroll

**Q4: Swipe gesture direction?**
- **Answer**: A) Left swipe = next chapter (like turning page forward)
- **Decision**:
  - Swipe left → Next chapter (page turn forward)
  - Swipe right → Previous chapter (page turn back)
  - Web app has swipe too

### 3. Content Tabs ✅

**Q5: Tab bar position?**
- **Question**: What's best for mobile/social media apps?
- **Decision**: **Sticky at top** (Option A)
  - Reason: Matches social media patterns (Instagram, TikTok)
  - Always accessible without scrolling back up
  - Clear context of current view
  - Standard mobile app pattern

**Q6: Tab selection persistence?**
- **Answer**: A) Global preference
- **Decision**: Remember last used tab globally
  - User preference saved to AsyncStorage
  - Opens to last selected tab (Summary/ByLine/Detailed)
  - Doesn't reset per chapter

### 4. Book/Chapter Selection Modal ✅

**Q7: Dropdown structure captured**
- **Answer**: B) Screenshot provided
- **Status**: ✅ Analyzed (see DROPDOWN-ANALYSIS.md)

**Q8: Testament tabs exist?**
- **Answer**: Yes, two tabs "Old Testament" | "New Testament"
- **Structure Discovered**:
  ```
  Testament Tabs (OT/NT)
  ↓
  Search Input ("Filter Books...")
  ↓
  Book List (scrollable, checkmark on selected)
  ↓
  Chapter Grid (5 columns)
  ↓
  Progress Bar (% completion)
  ```

### 5. Priority & Scope ✅

**Q9: Capture dropdown in Phase 1?**
- **Answer**: B) Skip for now, implement best guess, iterate later
- **Status**: Got screenshot anyway - now have full spec!

**Q10: Summary/ByLine tabs priority?**
- **Answer**: A) Implement in Phase 1 (full feature)
- **Decision**: All three tabs in initial implementation
  - Summary tab (AI-generated overview)
  - By Line tab (verse-by-verse)
  - Detailed tab (full chapter)

## Implementation Specifications

### Routing System

```typescript
// Expo Router structure
app/
  bible/
    [bookId]/
      [chapter].tsx  // Main chapter screen

// URL examples
/bible/1/1          // Genesis 1
/bible/40/5         // Matthew 5

// Derive testament from bookId
const getTestament = (bookId: number): 'OT' | 'NT' => {
  return bookId <= 39 ? 'OT' : 'NT';
};
```

### Navigation Controls

```typescript
// Floating buttons
const FloatingNavigation = {
  position: 'edges',        // Left/right screen edges
  verticalAlign: 'center',  // Middle of screen height
  autoHide: true,
  autoHideDelay: 3000,      // 3 seconds
  iconType: 'chevron',      // < and > arrows
  size: 48,                 // 48px touch target
  offset: 16,               // 16px from screen edge
};

// Swipe gestures
const SwipeConfig = {
  leftSwipe: 'nextChapter',     // Left = forward in book
  rightSwipe: 'previousChapter', // Right = back in book
  threshold: 50,                // 50px to trigger
  velocity: 0.3,                // Minimum velocity
  hapticFeedback: true,         // Vibrate on swipe
};
```

### Content Tabs

```typescript
// Tab configuration
const ContentTabs = {
  position: 'sticky-top',    // Sticky at top of content area
  tabs: [
    { id: 'summary', label: 'Summary', icon: '📝' },
    { id: 'byline', label: 'By Line', icon: '📖' },
    { id: 'detailed', label: 'Detailed', icon: '📜' },
  ],
  defaultTab: 'detailed',    // Default to Bible text
  persistence: 'global',     // Save preference globally
  storageKey: 'preferredContentTab',
};
```

### Book/Chapter Selection Modal

```typescript
// Bottom sheet modal
const SelectionModal = {
  type: 'bottom-sheet',
  height: '85%',             // 85% of screen height
  snapPoints: ['85%', '50%'], // Can collapse to 50%
  closeOnOutsidePress: true,

  structure: [
    'TestamentTabs',         // OT/NT switcher
    'SearchInput',           // "Filter Books..."
    'BookList',              // Scrollable with checkmarks
    'ChapterGrid',           // 5 columns
    'ProgressBar',           // Reading completion %
  ],
};

// Chapter Grid
const ChapterGrid = {
  columns: 5,
  gap: 8,                    // 8px between items
  itemSize: 48,              // 48px minimum touch target
  borderRadius: 8,           // Rounded corners

  states: {
    selected: {
      background: '#b09a6d',  // Tan/gold
      textColor: '#FFFFFF',   // White
    },
    read: {
      background: '#d4c5a6',  // Light beige
      textColor: '#000000',   // Black
    },
    unread: {
      background: 'transparent',
      textColor: '#000000',
    },
  },
};
```

### Progress Tracking

```typescript
// Reading progress
interface ReadingProgress {
  bookId: number;
  chaptersRead: number[];      // Array of chapter numbers read
  lastChapterRead: number;
  totalChapters: number;
  percentage: number;          // % completion for book
}

// Store in AsyncStorage
const PROGRESS_KEY = 'reading_progress';
```

## Mobile Enhancements (Not in Web App)

### 1. Path-Based Routing ✅
- Web: `?bookId=1&verseId=1&testament=OT`
- Mobile: `/bible/1/1`
- Benefit: Cleaner, shareable, deep-linkable

### 2. Always-Visible Navigation ✅
- Web: Buttons appear on hover only
- Mobile: Always visible (auto-hide after 3s)
- Benefit: No hover on mobile, better discoverability

### 3. Swipe Gestures ✅
- Web: Has swipe (confirmed by user)
- Mobile: Enhanced with haptic feedback
- Benefit: Native mobile feel

### 4. Bottom Sheet Modal ✅
- Web: Dropdown panel
- Mobile: Bottom sheet with snap points
- Benefit: Better mobile UX, familiar pattern

### 5. Haptic Feedback ✅
- Web: None
- Mobile: On swipe, button tap, chapter selection
- Benefit: Native app feel

## Color System (From Screenshot)

```typescript
const colors = {
  // Primary
  primary: '#b09a6d',          // Tan/gold (validated)
  primaryLight: '#d4c5a6',     // Light beige (read chapters)

  // Text
  textPrimary: '#000000',      // Black
  textSecondary: '#8B7355',    // Tan/muted
  textOnPrimary: '#FFFFFF',    // White on tan

  // Backgrounds
  background: '#FFFFFF',        // White
  backgroundSecondary: '#F5F5F5', // Light gray

  // Progress
  progressFill: '#b09a6d',     // Tan/gold
  progressBg: '#E5E5E5',       // Light gray

  // From previous discoveries
  night: '#212531',            // rgb(33, 37, 49) - main text
  muted: '#3E464D',            // rgb(62, 70, 77) - muted text
};
```

## Typography (Combined Sources)

```typescript
const typography = {
  // Chapter content (from metadata)
  h1: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 44,
  },
  h2: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  paragraph: {
    fontFamily: 'MerriweatherItalic',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
  },

  // UI elements
  button: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  tabLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  chapterNumber: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
};
```

## Updated Requirements Summary

### Must Have (Phase 1)

✅ Three content tabs (Summary, ByLine, Detailed)
✅ Bottom sheet modal for book/chapter selection
✅ Testament tabs (OT/NT)
✅ Search/filter books
✅ 5-column chapter grid
✅ Progress bar
✅ Floating prev/next buttons
✅ Swipe gestures
✅ Haptic feedback
✅ Path-based routing (`/bible/[bookId]/[chapter]`)
✅ Global tab preference persistence

### Removed from Original Spec

❌ Separate testament selection screen
❌ Separate book selection screen
❌ Separate chapter selection screen
❌ Roboto Serif typography
❌ `verseId` parameter support
❌ Hover-only navigation buttons

### Changed from Original Spec

- Modal instead of hierarchical screens
- MerriweatherItalic for all text (not just titles)
- Path routing instead of query params
- Always-visible buttons (not hover-only)

---

**Status**: ✅ All decisions finalized
**Next**: Update technical spec, validate Swagger, create final implementation plan
