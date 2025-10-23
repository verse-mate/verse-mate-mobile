# Task Breakdown: Native Page-Based Swipe Navigation

## Overview
Replace crash-prone GestureDetector + ScrollView swipe implementation with native page-based navigation using react-native-pager-view. This eliminates native-level crashes from gesture conflicts while enabling smooth chapter-to-chapter navigation.

**Total Task Groups:** 8
**Estimated Total Tasks:** ~35 individual tasks

## Task List

### Task Group 1: Setup & Dependencies
**Dependencies:** None
**Assigned to:** infra-engineer

- [ ] 1.0 Complete setup and dependency installation
  - [ ] 1.1 Install react-native-pager-view package
    - Run: `bun add react-native-pager-view`
    - Verify compatibility with Expo SDK 54 and React Native 0.81.4
    - Check package.json to confirm installation
  - [ ] 1.2 Verify react-native-pager-view works with current build
    - Run: `bun start` to verify no build errors
    - Test on iOS simulator (if available)
    - Test on Android emulator (if available)
  - [ ] 1.3 Document dependency version for future reference
    - Add comment in package.json explaining why this specific version is used
    - Note Expo SDK 54 compatibility requirement

**Acceptance Criteria:**
- react-native-pager-view successfully installed
- No build errors when running development server
- Package version documented with compatibility notes

---

### Task Group 2: Core Navigation Logic
**Dependencies:** Task Group 1
**Assigned to:** backend-engineer

- [ ] 2.0 Complete core navigation logic and utilities
  - [ ] 2.1 Write 2-8 focused tests for useChapterNavigation hook
    - Limit to 2-8 highly focused tests maximum
    - Test critical navigation logic:
      - Next chapter within same book
      - Previous chapter within same book
      - Cross-book forward navigation (Genesis 50 → Exodus 1)
      - Cross-book backward navigation (Exodus 1 → Genesis 50)
      - Genesis 1 boundary (no previous)
      - Revelation 22 boundary (no next)
    - Skip exhaustive edge case testing
    - Location: `__tests__/hooks/use-chapter-navigation.test.ts`
  - [ ] 2.2 Create useChapterNavigation hook
    - Location: `/hooks/bible/use-chapter-navigation.ts`
    - Implement cross-book navigation logic using spec lines 166-201
    - Parameters: `(bookId: number, chapterNumber: number, booksMetadata: BookMetadata[])`
    - Returns: `{ nextChapter, prevChapter, canGoNext, canGoPrevious }`
    - Types: `nextChapter` and `prevChapter` are `{ bookId: number, chapterNumber: number } | null`
    - Handle special cases:
      - Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
      - Testament boundaries (Malachi 4 → Matthew 1)
      - Bible boundaries (Genesis 1, Revelation 22)
    - Reuse: Book metadata from `useBibleTestaments()` hook
  - [ ] 2.3 Write 2-8 focused tests for page index calculation utilities
    - Limit to 2-8 highly focused tests maximum
    - Test critical conversions:
      - (bookId, chapter) → absolute page index
      - Absolute page index → (bookId, chapter)
      - First page (Genesis 1) = index 0
      - Cross-book boundaries (Genesis 50 → index 49, Exodus 1 → index 50)
    - Skip exhaustive testing of all 1,189 chapters
    - Location: `__tests__/utils/chapter-index-utils.test.ts`
  - [ ] 2.4 Create page index calculation utilities
    - Location: `/utils/bible/chapter-index-utils.ts`
    - Implement `getAbsolutePageIndex(bookId, chapterNumber, booksMetadata): number`
      - Calculate cumulative chapter count from all previous books
      - Add current chapter offset
      - Example: Exodus 1 = Genesis chapters (50) + 0 = 50
    - Implement `getChapterFromPageIndex(pageIndex, booksMetadata): { bookId, chapterNumber }`
      - Iterate through books, subtracting chapter counts
      - Return book and chapter when index falls within range
      - Handle edge cases (index 0, max index)
    - Add validation helpers:
      - `isValidPageIndex(pageIndex, booksMetadata): boolean`
      - `getMaxPageIndex(booksMetadata): number`
  - [ ] 2.5 Export navigation types
    - Location: `/types/bible.ts`
    - Add interface: `ChapterNavigation { nextChapter, prevChapter, canGoNext, canGoPrevious }`
    - Add interface: `ChapterLocation { bookId: number, chapterNumber: number }`
  - [ ] 2.6 Ensure navigation logic tests pass
    - Run ONLY tests from 2.1 and 2.3 (approximately 4-16 tests)
    - Verify cross-book navigation works correctly
    - Verify page index calculations are accurate
    - Do NOT run entire test suite at this stage

**Acceptance Criteria:**
- 4-16 focused tests pass (from 2.1 and 2.3)
- useChapterNavigation hook correctly handles all navigation scenarios
- Page index calculations accurate for all 66 books
- Cross-book boundaries handled seamlessly
- Edge cases (first/last chapter) handled correctly

---

### Task Group 3: PagerView Component
**Dependencies:** Task Group 2
**Assigned to:** mobile-engineer

- [ ] 3.0 Complete PagerView wrapper component
  - [ ] 3.1 Write 2-8 focused tests for ChapterPagerView component
    - Limit to 2-8 highly focused tests maximum
    - Test critical behaviors:
      - Initial page renders with correct bookId/chapter
      - onPageSelected callback fires with correct data
      - Handles boundary cases (Genesis 1, Revelation 22)
      - Preserves tab state across page changes
    - Skip exhaustive testing of all page transitions
    - Location: `__tests__/components/bible/ChapterPagerView.test.tsx`
    - Mock: react-native-pager-view using `@react-native-community/bob`
  - [ ] 3.2 Create ChapterPagerView component
    - Location: `/components/bible/ChapterPagerView.tsx`
    - Props:
      - `initialBookId: number`
      - `initialChapter: number`
      - `activeTab: ContentTabType`
      - `activeView: ViewMode`
      - `onPageChange: (bookId: number, chapterNumber: number) => void`
    - State:
      - Track current page index (controlled by PagerView)
      - Calculate 3-page window (prev, current, next)
    - Use react-native-pager-view's `<PagerView>` component
    - Set `initialPage` based on absolute page index
    - Implement `onPageSelected` callback:
      - Extract page index from event
      - Convert to (bookId, chapterNumber)
      - Call `onPageChange` prop
    - Render 3 pages maximum:
      - Previous page (if exists)
      - Current page (always)
      - Next page (if exists)
    - Each page contains:
      - ScrollView for vertical scrolling
      - ChapterHeader component
      - ChapterContentTabs (if in explanations view)
      - ChapterReader component (or SkeletonLoader)
  - [ ] 3.3 Implement page rendering strategy
    - Render only 3 pages to minimize memory usage
    - Use React Query cache to avoid re-fetching chapters
    - Show SkeletonLoader for pages without loaded data
    - Allow page transition even if content not loaded yet
    - Crossfade transition when content loads (FadeIn/FadeOut)
  - [ ] 3.4 Handle gesture priority correctly
    - Vertical scroll within page's ScrollView should not conflict
    - Horizontal swipe handled natively by PagerView
    - No custom gesture configuration needed (native behavior)
    - Remove old GestureDetector setup entirely
  - [ ] 3.5 Preserve state across page changes
    - Active tab state passed as prop (controlled by parent)
    - View mode (bible/explanations) passed as prop
    - Tab state persists via useActiveTab hook in parent
    - Each page receives same activeTab/activeView props
  - [ ] 3.6 Ensure ChapterPagerView tests pass
    - Run ONLY tests from 3.1 (approximately 2-8 tests)
    - Verify component renders without crashes
    - Verify page transitions trigger callbacks correctly
    - Do NOT run entire test suite at this stage

**Acceptance Criteria:**
- 2-8 focused tests pass (from 3.1)
- ChapterPagerView renders 3-page window correctly
- Page transitions are smooth (60fps native animations)
- Vertical scroll doesn't conflict with horizontal swipe
- State preservation works across page changes
- SkeletonLoader appears for unloaded pages

---

### Task Group 4: Integration with Chapter Screen
**Dependencies:** Task Group 3
**Assigned to:** mobile-engineer

- [ ] 4.0 Complete integration with existing chapter screen
  - [ ] 4.1 Write 2-8 focused tests for updated chapter screen
    - Limit to 2-8 highly focused tests maximum
    - Test critical integration points:
      - Screen renders with PagerView instead of ScrollView
      - URL updates after swipe completes
      - Navigation modal still works
      - Floating action buttons still work
    - Skip exhaustive testing of all screen features
    - Location: Update `__tests__/app/bible/[bookId]/[chapterNumber].test.tsx`
  - [ ] 4.2 Remove old GestureDetector implementation
    - Location: `/app/bible/[bookId]/[chapterNumber].tsx`
    - Remove import: `GestureDetector` and `Gesture` from react-native-gesture-handler (line 25)
    - Remove: `swipeGesture` useMemo (lines 255-275)
    - Remove: `<GestureDetector>` wrapper around ScrollView (lines 355, 400)
    - Keep: All other functionality (header, tabs, buttons, modals)
    - Keep: react-native-gesture-handler dependency (used by other components)
  - [ ] 4.3 Replace with ChapterPagerView component
    - Import ChapterPagerView component
    - Replace ScrollView section (lines 355-400) with ChapterPagerView
    - Pass required props:
      - `initialBookId={validBookId}`
      - `initialChapter={validChapter}`
      - `activeTab={activeTab}`
      - `activeView={activeView}`
      - `onPageChange={handlePageChange}`
    - Keep header, tabs selector, and floating buttons outside PagerView
  - [ ] 4.4 Implement handlePageChange callback
    - Create callback: `handlePageChange(newBookId, newChapter)`
    - Update URL using `router.replace()` (not push)
    - Call saveLastRead mutation with new position
    - Trigger prefetch for new adjacent chapters (1 second delay)
    - Add haptic feedback (medium impact)
  - [ ] 4.5 Update navigation button handlers
    - Modify `handlePrevious` to use navigation from useChapterNavigation
    - Modify `handleNext` to use navigation from useChapterNavigation
    - Update button visibility based on canGoPrevious/canGoNext
    - Remove TODOs about cross-book navigation (now implemented)
    - Keep haptic feedback for button presses
  - [ ] 4.6 Update prefetching logic
    - Adapt prefetch calls to work after page changes
    - Delay prefetch by 1 second after page change completes
    - Use React Query cache to avoid duplicate fetches
    - Prefetch only chapter content (not explanations)
  - [ ] 4.7 Ensure chapter screen integration tests pass
    - Run ONLY tests from 4.1 (approximately 2-8 tests)
    - Verify screen renders without crashes
    - Verify URL updates work correctly
    - Do NOT run entire test suite at this stage

**Acceptance Criteria:**
- 2-8 focused tests pass (from 4.1)
- Old GestureDetector code completely removed
- ChapterPagerView successfully integrated
- URL updates use router.replace() after swipe completes
- Navigation buttons work with cross-book logic
- Prefetching adapted to page-based approach

---

### Task Group 5: Cross-Book Navigation Enhancement
**Dependencies:** Task Group 4
**Assigned to:** mobile-engineer

- [ ] 5.0 Complete cross-book navigation features
  - [ ] 5.1 Write 2-8 focused tests for cross-book transitions
    - Limit to 2-8 highly focused tests maximum
    - Test critical cross-book scenarios:
      - Last chapter of book → First chapter of next book
      - First chapter of book → Last chapter of previous book
      - Old Testament → New Testament (Malachi 4 → Matthew 1)
      - Single-chapter books (Obadiah, Philemon)
    - Skip testing all 66 book boundaries
    - Location: `__tests__/integration/cross-book-navigation.test.tsx`
  - [ ] 5.2 Verify cross-book page index calculations
    - Test Exodus 1 follows Genesis 50 (page index 50)
    - Test Matthew 1 follows Malachi 4 (calculate correct index)
    - Test single-chapter books transition correctly
    - Verify no gaps or overlaps in page indices
  - [ ] 5.3 Handle book metadata loading edge case
    - Show loading state if booksMetadata not yet loaded
    - Default to current book only until metadata loads
    - Expand to 3-page window once metadata available
    - Ensure no crashes during initial load
  - [ ] 5.4 Test boundary behaviors thoroughly
    - Genesis 1: Verify cannot swipe right (no previous page)
    - Revelation 22: Verify cannot swipe left (no next page)
    - Verify haptic feedback for boundary attempts via buttons
    - Ensure PagerView respects page count limits
  - [ ] 5.5 Ensure cross-book navigation tests pass
    - Run ONLY tests from 5.1 (approximately 2-8 tests)
    - Verify seamless transitions across book boundaries
    - Verify no UI glitches during transitions
    - Do NOT run entire test suite at this stage

**Acceptance Criteria:**
- 2-8 focused tests pass (from 5.1)
- Cross-book navigation is seamless (no confirmation dialogs)
- Book boundaries (first/last chapters of Bible) handled correctly
- Single-chapter books navigate correctly
- Testament transitions work smoothly
- No crashes during book metadata loading

---

### Task Group 6: Pre-loading & Performance
**Dependencies:** Task Group 5
**Assigned to:** performance-engineer

- [ ] 6.0 Complete pre-loading and performance optimization
  - [ ] 6.1 Write 2-8 focused tests for prefetching behavior
    - Limit to 2-8 highly focused tests maximum
    - Test critical prefetch scenarios:
      - Adjacent chapters prefetched after page change
      - Prefetch respects 1-second delay
      - React Query cache prevents duplicate fetches
      - Prefetch doesn't block main thread
    - Skip exhaustive performance testing
    - Location: `__tests__/integration/chapter-prefetch.test.tsx`
  - [ ] 6.2 Adapt usePrefetchNextChapter hook
    - Location: Review `/src/api/generated/hooks.ts` (lines 305-330)
    - Ensure hook works with new page-based navigation
    - Trigger from handlePageChange callback (not gesture)
    - Use 1-second delay after page change completes
    - Leverage React Query cache to skip already-loaded chapters
  - [ ] 6.3 Adapt usePrefetchPreviousChapter hook
    - Location: Review `/src/api/generated/hooks.ts` (lines 332-357)
    - Ensure hook works with new page-based navigation
    - Trigger from handlePageChange callback (not gesture)
    - Use 1-second delay after page change completes
    - Leverage React Query cache to skip already-loaded chapters
  - [ ] 6.4 Optimize page rendering performance
    - Use React.memo for page content components
    - Minimize re-renders during page transitions
    - Profile with React DevTools to identify bottlenecks
    - Ensure 60fps during page swipe animations
  - [ ] 6.5 Handle slow network scenarios
    - Allow swipe even if adjacent content not loaded
    - Show SkeletonLoader immediately on new page
    - Content appears when loaded (crossfade transition)
    - User can swipe back/forward while loading
    - Test with network throttling (slow 3G)
  - [ ] 6.6 Verify React Query cache effectiveness
    - Test returning to previously viewed chapter
    - Verify content appears instantly (from cache)
    - Verify no unnecessary API calls
    - Check React Query DevTools for cache hits
  - [ ] 6.7 Ensure prefetching tests pass
    - Run ONLY tests from 6.1 (approximately 2-8 tests)
    - Verify prefetching improves perceived performance
    - Verify cache prevents duplicate fetches
    - Do NOT run entire test suite at this stage

**Acceptance Criteria:**
- 2-8 focused tests pass (from 6.1)
- Adjacent chapters prefetch after 1-second delay
- React Query cache prevents duplicate API calls
- Page transitions maintain 60fps performance
- Slow networks don't block navigation
- Previously viewed chapters load instantly from cache
- SkeletonLoader appears within 100ms for unloaded pages

---

### Task Group 7: Testing & E2E Verification
**Dependencies:** Task Group 6
**Assigned to:** qa-engineer

- [ ] 7.0 Complete comprehensive testing and verification
  - [ ] 7.1 Review existing tests from previous task groups
    - Review tests from Task Group 2 (navigation logic)
    - Review tests from Task Group 3 (PagerView component)
    - Review tests from Task Group 4 (integration)
    - Review tests from Task Group 5 (cross-book)
    - Review tests from Task Group 6 (prefetching)
    - Total existing tests: approximately 10-40 tests
  - [ ] 7.2 Analyze test coverage gaps for this feature
    - Identify critical user workflows not covered by existing tests
    - Focus ONLY on swipe navigation feature gaps
    - Prioritize end-to-end user journeys over unit tests
    - Do NOT assess entire application coverage
  - [ ] 7.3 Write up to 10 additional strategic tests maximum
    - Add maximum of 10 new integration/unit tests if needed
    - Focus on gaps identified in 7.2
    - Target critical workflows:
      - Tab persistence across multiple swipes
      - View mode persistence across swipes
      - Loading states during rapid swipes
      - URL history management (router.replace usage)
    - Skip edge cases, performance tests, accessibility unless critical
    - Location: `__tests__/integration/swipe-navigation.test.tsx`
  - [ ] 7.4 Create Maestro E2E test for basic swipe
    - Location: `.maestro/swipe-navigation-basic.yaml`
    - Test flow:
      - Navigate to Genesis 1
      - Verify chapter content visible
      - Swipe left to Genesis 2
      - Verify Genesis 2 content visible
      - Swipe right back to Genesis 1
      - Verify Genesis 1 content visible
    - Reference: Spec lines 323-332
  - [ ] 7.5 Create Maestro E2E test for cross-book navigation
    - Location: `.maestro/swipe-navigation-cross-book.yaml`
    - Test flow:
      - Navigate to Genesis 50
      - Verify Genesis 50 visible
      - Swipe left to Exodus 1
      - Verify Exodus 1 visible
      - Swipe right back to Genesis 50
      - Verify Genesis 50 visible
    - Reference: Spec lines 334-346
  - [ ] 7.6 Create Maestro E2E test for tab persistence
    - Location: `.maestro/swipe-navigation-tab-persistence.yaml`
    - Test flow:
      - Navigate to Genesis 1
      - Switch to Explanations view
      - Select Detailed tab
      - Swipe left to Genesis 2
      - Verify Detailed tab still selected
      - Verify Explanations view still active
    - Reference: Spec lines 348-357
  - [ ] 7.7 Create Maestro E2E test for boundary behavior
    - Location: `.maestro/swipe-navigation-boundaries.yaml`
    - Test flow:
      - Navigate to Genesis 1
      - Attempt swipe right (should not navigate)
      - Verify still on Genesis 1
      - Navigate to Revelation 22
      - Attempt swipe left (should not navigate)
      - Verify still on Revelation 22
    - Reference: Spec lines 359-374
  - [ ] 7.8 Create Maestro E2E test for gesture priority
    - Location: `.maestro/swipe-navigation-gesture-priority.yaml`
    - Test flow:
      - Navigate to Genesis 1
      - Verify chapter content visible
      - Scroll down vertically
      - Verify still on Genesis 1 (no horizontal navigation)
      - Verify can scroll back up
    - Reference: Spec lines 389-396
  - [ ] 7.9 Run feature-specific unit/integration tests
    - Run ONLY tests related to this feature (from groups 2-6 and 7.3)
    - Expected total: approximately 20-50 tests maximum
    - Command: `npm test -- swipe-navigation`
    - Do NOT run entire application test suite
    - Verify all tests pass
  - [ ] 7.10 Run Maestro E2E tests
    - Command: `maestro test .maestro/swipe-navigation-*.yaml`
    - Run all 5 E2E test flows created in 7.4-7.8
    - Test on iOS simulator
    - Test on Android emulator
    - Verify 100% pass rate

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 20-50 tests total)
- No more than 10 additional tests added when filling gaps
- All 5 Maestro E2E test flows pass on iOS and Android
- Critical user workflows validated end-to-end
- Testing focused exclusively on swipe navigation feature
- Zero native crashes during E2E test execution

---

### Task Group 8: Polish & Verification
**Dependencies:** Task Group 7
**Assigned to:** mobile-engineer

- [ ] 8.0 Complete final polish and verification
  - [ ] 8.1 Manual testing on iOS device/simulator
    - Test basic swipe navigation (forward/backward)
    - Test cross-book boundaries (Genesis → Exodus, etc.)
    - Test Bible boundaries (Genesis 1, Revelation 22)
    - Test tab persistence across swipes
    - Test view mode persistence across swipes
    - Test floating action buttons still work
    - Test navigation modal still works
    - Verify smooth 60fps animations
    - Verify no visual glitches during transitions
  - [ ] 8.2 Manual testing on Android device/emulator
    - Repeat all tests from 8.1 on Android
    - Verify native page animations feel natural
    - Test on different Android versions if possible
    - Verify no platform-specific issues
  - [ ] 8.3 Verify crash issue is resolved
    - Test rapid swipe gestures (previously caused crashes)
    - Test swipe while scrolling vertically
    - Test swipe during content loading
    - Verify ErrorBoundary not triggered
    - Verify no native-level crashes in logs
    - Test for at least 5 minutes of continuous usage
  - [ ] 8.4 Performance verification
    - Profile with React DevTools Profiler
    - Verify page transitions maintain 60fps
    - Verify no memory leaks during extended use
    - Test with slow network (throttled to slow 3G)
    - Verify SkeletonLoader appears within 100ms
    - Verify prefetching reduces visible loading by 90%+
  - [ ] 8.5 Accessibility testing
    - Verify floating action buttons remain accessible
    - Test VoiceOver (iOS) navigation
    - Test TalkBack (Android) navigation
    - Verify screen reader announces page changes
    - Verify haptic feedback works for button presses
  - [ ] 8.6 Review and update documentation
    - Update component documentation in ChapterPagerView
    - Update chapter screen documentation
    - Update CLAUDE.md if needed (architecture changes)
    - Document known limitations or edge cases
  - [ ] 8.7 Clean up and code review
    - Remove any console.log statements
    - Remove commented-out old code
    - Ensure TypeScript types are complete
    - Run `bun run lint:fix` to fix any linting issues
    - Run `bun tsc --noEmit` to verify no type errors
    - Format code with `bun run format`
  - [ ] 8.8 Final validation against success criteria
    - [ ] Zero native crashes during swipe navigation (spec line 399)
    - [ ] Smooth 60fps page transitions on iOS and Android (spec line 400)
    - [ ] Cross-book navigation works seamlessly (spec line 401)
    - [ ] Tab and view mode persist 100% across swipes (spec line 402)
    - [ ] SkeletonLoader appears within 100ms for unloaded pages (spec line 403)
    - [ ] Prefetching reduces visible loading by 90%+ (spec line 404)
    - [ ] Vertical scrolling never triggers horizontal navigation (spec line 405)
    - [ ] E2E tests pass with 100% reliability (spec line 406)

**Acceptance Criteria:**
- All manual tests pass on iOS and Android
- Zero crashes during extended testing
- Performance metrics meet or exceed targets
- Accessibility features work correctly
- Documentation updated and complete
- Code passes all linting and type checks
- All 8 success criteria validated and confirmed

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1** (Setup & Dependencies) - Install react-native-pager-view
2. **Task Group 2** (Core Navigation Logic) - Build navigation utilities and hooks
3. **Task Group 3** (PagerView Component) - Create ChapterPagerView wrapper
4. **Task Group 4** (Integration) - Replace GestureDetector with PagerView in chapter screen
5. **Task Group 5** (Cross-Book Navigation) - Verify and enhance cross-book transitions
6. **Task Group 6** (Pre-loading & Performance) - Optimize prefetching and performance
7. **Task Group 7** (Testing) - Comprehensive unit, integration, and E2E testing
8. **Task Group 8** (Polish & Verification) - Final testing, documentation, validation

---

## Testing Strategy Summary

**Test-Driven Approach:**
- Each development task group (2-6) starts with writing 2-8 focused tests
- Each group ends with running ONLY those newly written tests
- Dedicated testing task group (7) fills critical gaps with maximum 10 additional tests
- Final verification task group (8) validates all success criteria

**Test Distribution:**
- Task Group 2: 4-16 tests (navigation logic + page index calculations)
- Task Group 3: 2-8 tests (PagerView component)
- Task Group 4: 2-8 tests (chapter screen integration)
- Task Group 5: 2-8 tests (cross-book navigation)
- Task Group 6: 2-8 tests (prefetching behavior)
- Task Group 7: Up to 10 additional tests (gap filling)
- **Total Unit/Integration Tests: Approximately 20-50 tests maximum**

**E2E Tests:**
- 5 Maestro test flows covering critical user journeys
- Tests run on both iOS and Android
- 100% pass rate required for success

---

## Key Integration Points

**Files to Create:**
- `/hooks/bible/use-chapter-navigation.ts` - Cross-book navigation hook
- `/utils/bible/chapter-index-utils.ts` - Page index calculation utilities
- `/components/bible/ChapterPagerView.tsx` - PagerView wrapper component
- `__tests__/hooks/use-chapter-navigation.test.ts` - Navigation hook tests
- `__tests__/utils/chapter-index-utils.test.ts` - Utility function tests
- `__tests__/components/bible/ChapterPagerView.test.tsx` - Component tests
- `__tests__/integration/cross-book-navigation.test.tsx` - Integration tests
- `__tests__/integration/chapter-prefetch.test.tsx` - Prefetch tests
- `__tests__/integration/swipe-navigation.test.tsx` - Additional integration tests
- `.maestro/swipe-navigation-basic.yaml` - Basic swipe E2E test
- `.maestro/swipe-navigation-cross-book.yaml` - Cross-book E2E test
- `.maestro/swipe-navigation-tab-persistence.yaml` - Tab persistence E2E test
- `.maestro/swipe-navigation-boundaries.yaml` - Boundary behavior E2E test
- `.maestro/swipe-navigation-gesture-priority.yaml` - Gesture priority E2E test

**Files to Modify:**
- `/app/bible/[bookId]/[chapterNumber].tsx` - Replace GestureDetector with ChapterPagerView
- `/types/bible.ts` - Add ChapterNavigation and ChapterLocation interfaces
- `package.json` - Add react-native-pager-view dependency

**Files to Reference:**
- `/src/api/generated/hooks.ts` - Prefetch hooks to adapt
- `/__tests__/mocks/data/bible-books.data.ts` - Mock data for testing
- `/constants/bible-design-tokens.ts` - Design tokens for consistent styling
- `/components/bible/SkeletonLoader.tsx` - Loading state component
- `/components/bible/ChapterReader.tsx` - Chapter content display
- `/components/bible/FloatingActionButtons.tsx` - Alternative navigation
- `/hooks/bible/use-active-tab.ts` - Tab persistence hook

---

## Notes

- **Package Manager:** Use `bun` for all commands except tests (use `npm` for test commands per CLAUDE.md)
- **Router Usage:** Always use `router.replace()` for URL updates (not `push()`) to avoid history pollution
- **Test Focus:** Each task group writes only 2-8 focused tests covering critical behaviors, not exhaustive coverage
- **Native Behavior:** react-native-pager-view handles gesture priority natively, no custom configuration needed
- **Cross-Book Logic:** Reference spec lines 166-201 for exact navigation logic implementation
- **Performance Target:** 60fps page transitions, 100ms skeleton loader appearance, 90%+ prefetch effectiveness
