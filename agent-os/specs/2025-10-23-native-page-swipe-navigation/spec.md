# Specification: Native Page-Based Swipe Navigation

## Goal
Replace the current crash-prone GestureDetector + ScrollView swipe implementation with a native page-based navigation system using react-native-pager-view. This will eliminate native-level crashes caused by gesture conflicts while providing smooth, intuitive chapter-to-chapter navigation through horizontal swipes.

## User Stories
- As a Bible reader, I want to swipe left/right to navigate between chapters so that I can seamlessly read through the Bible without tapping buttons
- As a Bible reader, I want to continue reading across book boundaries (e.g., Genesis 50 to Exodus 1) without interruption so that my reading flow isn't broken
- As a Bible reader experiencing app crashes, I want stable swipe navigation that doesn't crash so that I can use the app reliably
- As a Bible reader, I want my active tab (summary/byline/detailed) to persist when I swipe to a new chapter so that I don't have to re-select my preferred reading mode
- As a Bible reader with accessibility needs, I want button navigation to remain available alongside swipe gestures so that I have multiple ways to navigate

## Core Requirements
- Horizontal swipe gestures navigate between chapters (swipe left = next, swipe right = previous)
- Seamless cross-book navigation (Genesis 50 → Exodus 1) without confirmation dialogs
- URL updates to `/bible/[bookId]/[chapterNumber]` after swipe animation completes
- Three-page rendering strategy (previous, current, next) for smooth transitions
- Active tab and view mode preserved across chapter changes
- Skeleton loaders displayed for chapters that haven't loaded yet
- Floating action buttons maintained as alternative navigation method
- Vertical scroll within chapters takes priority over horizontal swipe gestures
- Existing prefetching logic adapted to work with page-based approach

## Visual Design
No mockups provided. Implementation maintains visual consistency with existing Bible reading interface:
- Existing ChapterHeader component (unchanged)
- Existing ChapterContentTabs component (unchanged)
- Existing FloatingActionButtons component (unchanged)
- Existing SkeletonLoader for loading states
- Existing ProgressBar component (unchanged)
- Smooth native page transitions with standard iOS/Android swipe animations

## Reusable Components

### Existing Code to Leverage
**Components:**
- `SkeletonLoader` - Reuse for loading states during page transitions
- `ChapterReader` - Reuse for displaying chapter content in each page
- `FloatingActionButtons` - Keep for alternative navigation (accessibility)
- `ChapterContentTabs` - Preserve tab state across swipes
- `ChapterHeader` - Display book/chapter title (unchanged)
- `ProgressBar` - Show reading progress (unchanged)
- `OfflineIndicator` - Show offline status (unchanged)
- `HamburgerMenu` - Menu functionality (unchanged)
- `BibleNavigationModal` - Chapter selection modal (unchanged)

**API Hooks:**
- `useBibleTestaments()` - Get all 66 books with chapter counts for navigation logic
- `useBibleChapter()` - Fetch chapter content for each page
- `useBibleSummary()`, `useBibleByLine()`, `useBibleDetailed()` - Fetch explanations per tab
- `usePrefetchNextChapter()` - Adapt for page-based prefetching
- `usePrefetchPreviousChapter()` - Adapt for page-based prefetching
- `useSaveLastRead()` - Save reading position on chapter change
- `useActiveTab()` - Persist tab selection across swipes
- `useBookProgress()` - Calculate reading progress

**Patterns:**
- Route validation logic (lines 105-126 in `/app/bible/[bookId]/[chapterNumber].tsx`)
- Navigation handlers (handlePrevious/handleNext functions)
- React Query caching to avoid re-fetching previously viewed chapters
- URL updates using `router.replace()` (not `push()` to avoid history pollution)
- Crossfade animations for tab content switching

### New Components Required
**ChapterPagerView:**
- Wraps `react-native-pager-view` for chapter pagination
- Manages 3-page sliding window (previous, current, next)
- Calculates page indices based on book/chapter navigation
- Handles cross-book boundary logic
- Updates URL on `onPageSelected` callback
- Preserves view mode and tab state across pages
- Why new: Page-based architecture fundamentally different from current ScrollView approach

**useChapterNavigation hook:**
- Encapsulates cross-book navigation logic
- Calculates next/previous chapter considering book boundaries
- Returns navigation metadata (canGoNext, canGoPrevious, nextChapter, prevChapter)
- Why new: Complex cross-book logic needs centralized, testable implementation

## Technical Approach

### Library Installation
Install `react-native-pager-view` compatible with Expo SDK 54 and React Native 0.81.4:
```bash
bun add react-native-pager-view
```

### Component Architecture
Replace current implementation at `/app/bible/[bookId]/[chapterNumber].tsx`:
- Remove `GestureDetector` wrapping `ScrollView` (lines 254-275, 355-400)
- Replace with `PagerView` component rendering 3 pages
- Each page contains its own `ScrollView` with chapter content
- Vertical scroll within each page's ScrollView (no gesture conflicts)
- Horizontal swipe handled natively by PagerView

### Data Flow
1. User swipes horizontally
2. PagerView animates to next/previous page natively
3. `onPageSelected` callback fires with new page index
4. Calculate `(bookId, chapterNumber)` from page index using books metadata
5. Update URL with `router.replace(/bible/${bookId}/${chapterNumber})`
6. Save reading position to API
7. Prefetch adjacent chapters based on new position

### State Management
**Page Index Calculation:**
- Track absolute page index across all Bible books (not just current book)
- Convert `(bookId, chapterNumber)` to absolute index using book metadata
- Example: Exodus 1 = Genesis chapterCount (50) + 1 = index 51
- Use `useBibleTestaments()` to get chapter counts for all 66 books

**Tab State Preservation:**
- `useActiveTab()` hook persists tab selection in AsyncStorage
- Tab state remains constant across page changes
- ChapterContentTabs component receives same `activeTab` prop on all pages

**View Mode Preservation:**
- `activeView` state (bible/explanations) managed at parent level
- Passed as prop to all pages in PagerView
- Remains constant during swipe transitions

### Pre-loading Strategy
**Chapters:**
- Adapt `usePrefetchNextChapter` and `usePrefetchPreviousChapter` hooks
- Prefetch based on current page's bookId/chapterNumber (not gesture-based)
- Trigger prefetch in `useEffect` after page change completes (1 second delay)
- React Query cache ensures already-loaded chapters aren't re-fetched

**Explanations:**
- Only load explanations for active tab in current page (enabled flag)
- Don't prefetch explanations for adjacent pages (too heavy)
- Load on-demand when user swipes to new page
- Show skeleton loader while explanation loads

### URL Routing Pattern
Use `onPageSelected` callback to update URL after animation completes:
```typescript
const handlePageSelected = (event: PageSelectedEvent) => {
  const pageIndex = event.nativeEvent.position;
  const { bookId, chapterNumber } = calculateChapterFromPageIndex(pageIndex);
  router.replace(`/bible/${bookId}/${chapterNumber}`);
  saveLastRead({ user_id: 'guest', book_id: bookId, chapter_number: chapterNumber });
};
```
- Use `router.replace()` not `push()` to avoid polluting navigation history
- URL updates are atomic (no intermediate states during swipe)
- Gesture cancellation doesn't update URL (only committed navigations)

## Implementation Details

### Bible Book Metadata Usage
**Book Structure:**
- 66 books total (IDs 1-66)
- Old Testament: Books 1-39
- New Testament: Books 40-66
- Each book has `{ id, name, chapterCount, testament, genre }`
- Example: Genesis (id: 1, chapterCount: 50), Revelation (id: 66, chapterCount: 22)

**Accessing Metadata:**
```typescript
const { data: booksMetadata } = useBibleTestaments();
const currentBook = booksMetadata?.find(b => b.id === bookId);
const totalChapters = currentBook?.chapterCount || 1;
```

### Cross-Book Navigation Logic
**Next Chapter Logic:**
```typescript
if (currentChapter < totalChapters) {
  // Same book: navigate to next chapter
  return { bookId, chapterNumber: currentChapter + 1 };
} else if (bookId < 66) {
  // End of book: navigate to first chapter of next book
  return { bookId: bookId + 1, chapterNumber: 1 };
} else {
  // Revelation 22: no next chapter
  return null;
}
```

**Previous Chapter Logic:**
```typescript
if (currentChapter > 1) {
  // Same book: navigate to previous chapter
  return { bookId, chapterNumber: currentChapter - 1 };
} else if (bookId > 1) {
  // First chapter of book: navigate to last chapter of previous book
  const prevBook = booksMetadata?.find(b => b.id === bookId - 1);
  return { bookId: bookId - 1, chapterNumber: prevBook?.chapterCount || 1 };
} else {
  // Genesis 1: no previous chapter
  return null;
}
```

**Special Cases:**
- Single-chapter books (Obadiah id:31, Philemon id:57, 2 John id:63, 3 John id:64, Jude id:65)
  - Swipe left goes to next book's chapter 1
  - Swipe right goes to previous book's last chapter
- Old Testament to New Testament transition (Malachi 4 → Matthew 1)
  - Seamless transition using standard next-book logic

### Gesture Priority
PagerView natively handles gesture priority:
- Vertical scroll within page's ScrollView takes precedence
- Horizontal swipe only triggers when vertical velocity is low
- No custom gesture configuration needed (native behavior)
- Resolves current crash issue from competing GestureDetector and ScrollView gestures

### Loading States and Skeleton Loaders
**Initial Page Load:**
- Show full-screen SkeletonLoader until first chapter loads
- Existing pattern from current implementation

**Swipe to Unloaded Page:**
- Allow swipe to complete (smooth animation)
- Show SkeletonLoader in new page while content fetches
- Chapter content appears when loaded (crossfade transition)
- User can swipe back/forward while loading

**Explanation Loading:**
- If user switches to explanations view on unloaded page:
  - Show SkeletonLoader for active tab
  - Load explanation on-demand
  - Crossfade to content when loaded

## Edge Cases

### Genesis 1 Boundary
- Page index 0 (first chapter of Bible)
- No previous page available
- PagerView should disable leftward swipe (set page count accordingly)
- FloatingActionButtons hide "Previous" button (`showPrevious={false}`)

### Revelation 22 Boundary
- Last chapter of Bible (book 66, chapter 22)
- No next page available
- PagerView should disable rightward swipe
- FloatingActionButtons hide "Next" button (`showNext={false}`)

### Old Testament to New Testament Transition
- Malachi 4 (book 39, chapter 4) → Matthew 1 (book 40, chapter 1)
- Use standard cross-book navigation logic
- No special UI treatment (seamless transition)

### Slow Network Handling
- Allow swipe even if adjacent page content hasn't loaded
- Show SkeletonLoader in new page while fetching
- Prefetching helps minimize this scenario
- User can swipe back if they want to wait

### Invalid Book/Chapter Redirects
- Maintain existing validation logic (lines 105-126 in current chapter screen)
- Invalid bookId (< 1 or > 66) redirects to Genesis 1
- Invalid chapterNumber redirects to book's first chapter
- Validation runs before page index calculation

### Tab State Edge Cases
- User switches tabs mid-swipe: tab change completes, then swipe animation continues
- User switches view mode mid-swipe: same behavior (independent state)
- Tab state persists in AsyncStorage, survives app restarts

## Migration Plan

### Removing Existing Implementation
**Files to modify:**
- `/app/bible/[bookId]/[chapterNumber].tsx`
  - Remove `GestureDetector` import and usage (lines 25, 255-275, 355-400)
  - Remove `Gesture.Pan()` swipe gesture (lines 255-275)
  - Remove gesture wrapping of ScrollView (lines 355-400)
  - Keep all other functionality (header, tabs, floating buttons, modals)

**Dependencies to remove:**
- No dependencies removed (react-native-gesture-handler still used by other components)

**Dependencies to add:**
- `react-native-pager-view` (install via bun)

### Backward Compatibility
- URL pattern unchanged: `/bible/[bookId]/[chapterNumber]`
- All existing navigation paths continue to work (modal, buttons, deep links)
- Reading position API unchanged
- Tab persistence mechanism unchanged
- No breaking changes to other screens or components

### Rollout Strategy
1. Install `react-native-pager-view`
2. Create `useChapterNavigation` hook with cross-book logic
3. Create `ChapterPagerView` component wrapping PagerView
4. Update chapter screen to use PagerView instead of GestureDetector
5. Test cross-book navigation (especially book boundaries)
6. Test tab/view mode persistence across swipes
7. Test loading states and skeleton loaders
8. Remove old gesture code once verified working

## Testing Strategy

### Unit Tests
**useChapterNavigation hook:**
- Test next chapter logic within same book
- Test next chapter at book boundary (e.g., Genesis 50 → Exodus 1)
- Test previous chapter logic within same book
- Test previous chapter at book boundary (e.g., Exodus 1 → Genesis 50)
- Test Genesis 1 boundary (no previous)
- Test Revelation 22 boundary (no next)
- Test single-chapter books (Obadiah, Philemon, etc.)

**Page index calculations:**
- Test conversion from (bookId, chapterNumber) to absolute page index
- Test conversion from absolute page index to (bookId, chapterNumber)
- Test edge cases (first chapter, last chapter, cross-book boundaries)

### Integration Tests
**ChapterPagerView component:**
- Test rendering 3 pages (previous, current, next)
- Test URL updates after swipe completes
- Test tab state preservation across page changes
- Test view mode preservation across page changes
- Test reading position saved on page change
- Test skeleton loader shown for unloaded pages

### E2E Tests (Maestro)
**Swipe Navigation:**
```yaml
- assertVisible: "Genesis 1"
- swipe:
    direction: LEFT
- assertVisible: "Genesis 2"
- swipe:
    direction: RIGHT
- assertVisible: "Genesis 1"
```

**Cross-Book Transitions:**
```yaml
- tapOn: "Chapter Selector"
- tapOn: "Genesis"
- tapOn: "Chapter 50"
- assertVisible: "Genesis 50"
- swipe:
    direction: LEFT
- assertVisible: "Exodus 1"
- swipe:
    direction: RIGHT
- assertVisible: "Genesis 50"
```

**Tab Persistence:**
```yaml
- assertVisible: "Genesis 1"
- tapOn: "Explanations View"
- tapOn: "Detailed Tab"
- swipe:
    direction: LEFT
- assertVisible: "Genesis 2"
- assertVisible: "Detailed Tab" # Tab should still be selected
```

**Boundary Behavior:**
```yaml
- tapOn: "Chapter Selector"
- tapOn: "Genesis"
- tapOn: "Chapter 1"
- swipe:
    direction: RIGHT # Should not navigate (already at first chapter)
- assertVisible: "Genesis 1" # Still on same chapter

- tapOn: "Chapter Selector"
- tapOn: "Revelation"
- tapOn: "Chapter 22"
- swipe:
    direction: LEFT # Should not navigate (already at last chapter)
- assertVisible: "Revelation 22" # Still on same chapter
```

**Loading States:**
```yaml
# Test fast swipe before content loads
- assertVisible: "Genesis 1"
- swipe:
    direction: LEFT
- swipe:
    direction: LEFT
- swipe:
    direction: LEFT
# Should show skeleton loaders for chapters not yet loaded
```

**Gesture Priority:**
```yaml
# Test vertical scroll doesn't trigger chapter navigation
- assertVisible: "Genesis 1"
- scroll:
    direction: DOWN
- assertVisible: "Genesis 1" # Should not navigate to Genesis 2
```

## Success Criteria
- Zero native crashes during swipe navigation (elimination of current crash issue)
- Smooth 60fps page transitions on both iOS and Android
- Cross-book navigation works seamlessly without user confusion
- Tab and view mode state persists 100% of time across swipes
- Loading states (skeleton loaders) appear within 100ms for unloaded pages
- Prefetching reduces visible loading by 90%+ for sequential reading
- Vertical scrolling never triggers horizontal navigation
- E2E tests pass with 100% reliability for all navigation scenarios
