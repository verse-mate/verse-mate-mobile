# Spec Requirements: Native Page-Based Swipe Navigation

## Initial Description
Implement native page-based swipe navigation for chapter navigation in the VerseMate mobile app.

Context from user: "option D looks perfect and more native"

This refers to implementing page-based navigation (like ViewPager) instead of the current ScrollView + GestureDetector approach, which is causing native crashes.

**Current Issue:**
- The app crashes when users swipe to navigate between Bible chapters
- Current implementation: GestureDetector wrapping a ScrollView
- The Pan gesture conflicts with scroll gestures, causing native-level crashes
- ErrorBoundary cannot catch these crashes as they're native, not JavaScript errors

**Proposed Solution:**
- Implement page-based navigation similar to React Native's ViewPager
- Native swipe gestures for chapter navigation (left/right)
- Smooth page transitions with proper gesture handling
- No conflicts with vertical scrolling within each chapter

## Requirements Discussion

### First Round Questions

**Q1:** I assume you want to maintain the current URL pattern `/bible/[bookId]/[chapterNumber]` and update it as users swipe between chapters. Is that correct, or would you prefer a different approach?

**Answer:** Yes, maintain current URL pattern and update it.

**Q2:** For cross-book navigation (e.g., swiping from Genesis 50 to Exodus 1), should the swipe automatically jump to the next book's first chapter, or should it show some visual boundary/confirmation?

**Answer:** Allow swiping into the next book automatically without confirmation (seamless continuation).

**Q3:** I'm thinking we should use `react-native-pager-view` library (the official React Native ViewPager). Should we install this as a new dependency, or do you have a preference for a different library?

**Answer:** Install `react-native-pager-view` as the solution.

**Q4:** For the page-based approach, I assume we should render 3 pages at once (previous, current, next) to enable smooth transitions. Is that correct, or would you prefer a different buffer size?

**Answer:** Yes, render 3 pages (previous, current, next) for smooth transitions.

**Q5:** Should we preserve the existing floating action buttons for chapter navigation, or can we remove them since swipe will be the primary navigation method?

**Answer:** Keep the floating action buttons as an alternative navigation method (accessibility and user preference).

**Q6:** I'm assuming we should maintain the existing prefetching logic for adjacent chapters. Should this continue to work the same way with the new page-based approach?

**Answer:** Yes, maintain existing prefetching logic and adapt it to the page-based approach.

**Q7:** When a user is viewing content in "Explanations" mode with a specific tab selected (summary/byline/detailed), should swiping to the next chapter preserve that tab selection?

**Answer:** Yes, preserve the active tab and view mode when swiping between chapters.

**Q8:** Are there any specific features or interactions you explicitly DO NOT want in this implementation?

**Answer:** No specific exclusions mentioned.

### Follow-up Questions

**Follow-up 1:** The user was unsure if Bible book structure data (chapter counts, book order) exists in the codebase. RESEARCH CONDUCTED - Found comprehensive Bible book metadata in the following locations:
- **Type definitions:** `/types/bible.ts` - Contains `BookMetadata` interface with `id`, `name`, `testament`, `genre`, and `chapterCount`
- **Mock data:** `/__tests__/mocks/data/bible-books.data.ts` - Contains all 66 books with accurate chapter counts
- **API hook:** `useBibleTestaments()` in `/src/api/generated/hooks.ts` - Returns transformed array of all Bible books with metadata
- **Book ID validation constants:** `BOOK_ID_MIN = 1`, `BOOK_ID_MAX = 66`, `OLD_TESTAMENT_MAX_BOOK_ID = 39`, `NEW_TESTAMENT_MIN_BOOK_ID = 40`

**Answer:** Bible structure data EXISTS and is comprehensive. The `useBibleTestaments()` hook returns all 66 books with their chapter counts, which will be essential for cross-book navigation logic.

**Follow-up 2:** Book ID format verification requested. RESEARCH CONDUCTED - Book IDs are confirmed to be numeric (1-66):
- **URL routing:** `/app/bible/[bookId]/[chapterNumber].tsx` uses numeric route parameters
- **Type definitions:** All book IDs are typed as `number` throughout the codebase
- **Validation logic:** Lines 106-126 in chapter screen validate `bookId` must be 1-66
- **API calls:** All API endpoints accept numeric book IDs (e.g., `getBibleBookByBookIdByChapterNumberOptions`)

**Answer:** Book ID format is CONFIRMED numeric (1-66).

**Follow-up 3:** Navigation state management - user asks "what is the better pattern here?" regarding URL update timing (during swipe vs after completion).

**EXPERT RECOMMENDATION:**

**Update URL after swipe animation completes** (not during swipe). Here's why:

1. **Deep Linking Integrity:** URLs should represent stable, shareable states. Updating mid-swipe creates transient URLs that don't reflect the user's intended destination.

2. **Browser Back Button:** In React Native with Expo Router, the navigation history should only include intentional destinations. Mid-swipe updates would pollute the history with intermediate states.

3. **Performance:** URL updates trigger route param changes, which can cause re-renders. Deferring until completion avoids unnecessary renders during animation.

4. **React Native ViewPager Pattern:** The standard pattern with `react-native-pager-view` is:
   - User swipes
   - ViewPager handles animation natively
   - `onPageSelected` callback fires when page change completes
   - Update URL in the `onPageSelected` callback

5. **Gesture Cancellation:** Users can start a swipe and cancel it (by not completing the threshold). URL should only update for committed navigations.

**Recommended Implementation:**
```typescript
const handlePageSelected = (event: PageSelectedEvent) => {
  const newPageIndex = event.nativeEvent.position;
  const { bookId, chapterNumber } = getChapterFromPageIndex(newPageIndex);
  router.replace(`/bible/${bookId}/${chapterNumber}`);
};
```

**Answer:** Update URL after swipe animation completes using the `onPageSelected` callback. This ensures URLs are shareable, history is clean, and performance is optimal.

**Follow-up 4:** Loading states during swipe navigation.

**Answer:** DECISION MADE - Allow swipe but show skeleton loader on the new page if content hasn't loaded yet. This provides immediate feedback while maintaining smooth navigation.

### Existing Code to Reference

**Similar Features Identified:**

Based on research, the following existing code should be referenced:

**1. Current Chapter Screen:** `/app/bible/[bookId]/[chapterNumber].tsx`
- Lines 254-275: Existing swipe gesture implementation (to be replaced)
- Lines 168-191: Prefetching logic for adjacent chapters
- Lines 209-245: Navigation handlers (`handlePrevious`, `handleNext`)
- Lines 105-126: Book/chapter validation logic
- Lines 88-95: Books metadata fetching with `useBibleTestaments()`

**2. Bible API Hooks:** `/src/api/generated/hooks.ts`
- Lines 59-67: `useBibleTestaments()` - Returns all 66 books with chapter counts
- Lines 74-87: `useBibleChapter()` - Fetches chapter content
- Lines 305-330: `usePrefetchNextChapter()` - Prefetching logic
- Lines 332-357: `usePrefetchPreviousChapter()` - Prefetching logic

**3. Type Definitions:** `/types/bible.ts`
- Lines 156-161: Book ID constants and validation
- Lines 191-208: Helper functions (`isValidBookId`, `getTestamentFromBookId`)

**4. Mock Data (for testing):** `/__tests__/mocks/data/bible-books.data.ts`
- All 66 books with accurate chapter counts
- Helper functions for testing book navigation

**Components to potentially reuse:**
- `SkeletonLoader` component for loading states
- `ChapterReader` component for displaying chapter content
- `FloatingActionButtons` for alternative navigation
- `ChapterContentTabs` for maintaining tab state across swipes

**Backend logic to reference:**
- Existing prefetching pattern using React Query's `queryClient.prefetchQuery()`
- URL validation and redirect logic for invalid book/chapter combinations

**Navigation patterns to model after:**
- Expo Router's `router.replace()` for URL updates (not `push()` to avoid history stack pollution)
- React Query's caching to avoid re-fetching when returning to previously viewed chapters

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No design mockups or wireframes were provided. Implementation should maintain visual consistency with the existing Bible reading interface.

## Requirements Summary

### Functional Requirements

**Core Functionality:**
1. Replace current `GestureDetector` + `ScrollView` swipe implementation with page-based navigation using `react-native-pager-view`
2. Enable horizontal swipe gestures to navigate between chapters:
   - Swipe left = next chapter
   - Swipe right = previous chapter
3. Support seamless cross-book navigation (e.g., Genesis 50 → Exodus 1) without confirmation
4. Render 3 pages simultaneously (previous, current, next) for smooth transitions
5. Update URL to `/bible/[bookId]/[chapterNumber]` after swipe animation completes
6. Preserve active tab (summary/byline/detailed) and view mode (bible/explanations) across chapter changes
7. Show skeleton loader for pages that haven't loaded yet (allow swipe before content ready)
8. Maintain existing floating action buttons as alternative navigation method

**Data Management:**
1. Use `useBibleTestaments()` hook to get all 66 books with chapter counts for navigation logic
2. Implement cross-book boundary detection using book metadata
3. Calculate page indices based on current book ID and chapter number
4. Handle edge cases:
   - Genesis 1 (first chapter) - no previous page
   - Revelation 22 (last chapter) - no next page
   - Single-chapter books (e.g., Obadiah, Philemon)

**User Actions Enabled:**
1. Swipe left/right to navigate between chapters
2. Tap floating action buttons to navigate (existing functionality preserved)
3. Cancel swipe mid-gesture by not completing threshold
4. Navigate seamlessly across book boundaries

### Reusability Opportunities

**Components that might exist already:**
- `SkeletonLoader` - EXISTS, reuse for loading states
- `ChapterReader` - EXISTS, reuse for displaying chapter content
- `FloatingActionButtons` - EXISTS, preserve for alternative navigation
- `ChapterContentTabs` - EXISTS, preserve tab state across swipes

**Backend patterns to investigate:**
- React Query prefetching pattern - EXISTS, adapt for page-based navigation
- URL validation and redirect logic - EXISTS, may need adjustments for page transitions

**Similar features to model after:**
- Current chapter screen's validation logic (lines 105-126 in `[chapterNumber].tsx`)
- Existing prefetch hooks (`usePrefetchNextChapter`, `usePrefetchPreviousChapter`)
- Tab state persistence logic (`useActiveTab` hook)

### Scope Boundaries

**In Scope:**
1. Install and configure `react-native-pager-view` library
2. Replace existing swipe gesture implementation with ViewPager
3. Implement 3-page rendering strategy (previous, current, next)
4. Build cross-book navigation logic using Bible book metadata
5. Update URL routing after swipe completion
6. Preserve tab and view mode state across chapter changes
7. Integrate skeleton loading for not-yet-loaded pages
8. Maintain floating action buttons for accessibility
9. Adapt existing prefetching logic for page-based approach
10. Fix native crashes caused by gesture conflicts

**Out of Scope:**
1. Redesigning the chapter reading UI (maintain current design)
2. Adding new navigation gestures beyond left/right swipe
3. Implementing swipe-to-dismiss or other gesture patterns
4. Adding haptic feedback beyond what exists (preserve current patterns)
5. Modifying the floating action buttons design or behavior (beyond integration)
6. Changes to the Bible API or data structure
7. New features for bookmarks, highlights, or notes during navigation

### Technical Considerations

**Integration Points:**
- Expo Router for URL management (`router.replace()` not `push()`)
- React Query for data fetching and caching
- React Native Gesture Handler (may need coordination with ViewPager gestures)
- React Native Reanimated (ViewPager uses native animations)
- Existing Bible API hooks (`useBibleTestaments`, `useBibleChapter`, prefetch hooks)

**Existing System Constraints:**
- Must use Expo SDK 54 compatible version of `react-native-pager-view`
- Must maintain React Native 0.81.4 compatibility
- Must work with existing file-based routing structure
- Must not conflict with vertical scroll gestures within chapters
- Must preserve ErrorBoundary patterns (though this fixes the native crash issue)

**Technology Preferences:**
- Use `react-native-pager-view` (official React Native ViewPager library)
- TypeScript strict mode compliance required
- Follow existing code patterns for hooks and components
- Use Biome and ESLint configurations for code quality

**Similar Code Patterns to Follow:**
1. **Hook Usage Pattern:** Follow existing pattern of custom hooks wrapping generated API hooks
2. **Validation Pattern:** Follow existing book/chapter validation logic (lines 105-126 in chapter screen)
3. **Navigation Pattern:** Use `router.replace()` for URL updates (not `push()` to avoid history pollution)
4. **Prefetching Pattern:** Adapt existing `usePrefetchNextChapter` and `usePrefetchPreviousChapter` logic
5. **Loading State Pattern:** Use skeleton loaders with fade animations (existing pattern)
6. **Error Handling Pattern:** Redirect invalid book/chapter combinations to valid routes

**Cross-Book Navigation Logic Requirements:**
1. When current chapter < total chapters: navigate to next chapter in same book
2. When current chapter = total chapters AND bookId < 66: navigate to chapter 1 of next book
3. When current chapter > 1: navigate to previous chapter in same book
4. When current chapter = 1 AND bookId > 1: navigate to last chapter of previous book
5. Edge cases: Genesis 1 (no previous), Revelation 22 (no next)

**URL Update Timing (Expert Recommendation Applied):**
- Wait for `onPageSelected` callback from ViewPager before updating URL
- Use `router.replace()` to avoid polluting navigation history
- Ensure URL updates are atomic (no intermediate states)
- Handle gesture cancellation gracefully (no URL update if swipe cancelled)
