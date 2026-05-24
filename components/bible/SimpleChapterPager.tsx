/**
 * SimpleChapterPager Component
 *
 * A simplified 3-page pager for Bible chapter navigation (V3 architecture).
 * Replaces the 7-page ChapterPagerView with a cleaner, more reliable approach.
 *
 * Architecture:
 * - 3-page window: [previous, current, next]
 * - Stable positional keys: ["page-prev", "page-current", "page-next"]
 * - Initial page is always index 1 (center/current)
 * - No recentering logic - parent component updates props on navigation
 * - Internal useEffect resets pager position when props change (no remount)
 *
 * Boundary Handling (Linear Navigation - MVP):
 * - Genesis 1: Page 0 is empty, swipe does not trigger navigation (bounces back)
 * - Revelation 22: Page 2 is empty, swipe does not trigger navigation (bounces back)
 * - No circular navigation (Genesis 1 does NOT connect to Revelation 22)
 *
 * Navigation Flow:
 * 1. User swipes to page 0 or page 2
 * 2. onPageSelected fires with new position
 * 3. If not a boundary page, onChapterChange(newBookId, newChapter) is called
 * 4. Parent updates state, which changes props to this component
 * 5. Parent's key prop changes, causing full remount with new center
 *
 * @example
 * ```tsx
 * function ChapterScreen() {
 *   const { bookId, chapterNumber, bookName, navigateToChapter } = useChapterState();
 *   const { data: booksMetadata } = useBibleTestaments();
 *
 *   return (
 *     <SimpleChapterPager
 *       key={`${bookId}-${chapterNumber}`} // Forces remount on navigation
 *       bookId={bookId}
 *       chapterNumber={chapterNumber}
 *       bookName={bookName}
 *       booksMetadata={booksMetadata}
 *       onChapterChange={navigateToChapter}
 *       renderChapterPage={(bid, ch) => <ChapterPage bookId={bid} chapterNumber={ch} />}
 *     />
 *   );
 * }
 * ```
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from '@/components/common/PagerView';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import type { TestamentBook } from '@/src/api';

/**
 * Props for SimpleChapterPager component
 */
export interface SimpleChapterPagerProps {
  /** Current book ID (1-66) */
  bookId: number;
  /** Current chapter number (1-based) */
  chapterNumber: number;
  /** Current book name (for display/accessibility - reserved for future use) */
  bookName: string;
  /** Array of all Bible books with chapter counts */
  booksMetadata: TestamentBook[] | undefined;
  /** Callback when user navigates to a different chapter */
  onChapterChange: (bookId: number, chapterNumber: number) => void;
  /** Render function for chapter content */
  renderChapterPage: (bookId: number, chapterNumber: number) => React.ReactNode;
}

/**
 * Ref type for imperative methods
 */
export interface SimpleChapterPagerRef {
  /** Navigate to a specific page index (0, 1, or 2) */
  setPage: (index: number) => void;
}

/**
 * Page position constants (used when all 3 pages exist)
 */
const PAGE_CURRENT_MIDDLE = 1; // Current page when prev exists

/**
 * SimpleChapterPager Component
 *
 * Renders a 3-page PagerView with previous, current, and next chapters.
 * Handles boundary pages at Genesis 1 and Revelation 22.
 */
export const SimpleChapterPager = forwardRef<SimpleChapterPagerRef, SimpleChapterPagerProps>(
  function SimpleChapterPager(
    {
      bookId,
      chapterNumber,
      bookName: _bookName,
      booksMetadata,
      onChapterChange,
      renderChapterPage,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);

    // Get navigation metadata (linear mode - no circular wrap)
    const { prevChapter, nextChapter, canGoPrevious, canGoNext } = useChapterNavigation(
      bookId,
      chapterNumber,
      booksMetadata,
      false // Linear mode
    );

    // Track the previous chapter key to detect navigation
    const prevChapterKey = useRef(`${bookId}-${chapterNumber}`);

    // Pending navigation target — set by onPageSelected, processed when pager reaches idle
    const pendingNavRef = useRef<{ bookId: number; chapterNumber: number } | null>(null);

    // Fallback timer for cases where onPageScrollStateChanged never fires `idle` after a
    // pageSelected (observed after setPageWithoutAnimation repositions — the native event queue
    // swallows the trailing idle). Without this, pendingNavRef stays stale and gets consumed by
    // the next swipe's idle event, producing the chapter-skip bug.
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearPendingTimer = () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };

    // Stable refs for the latest props so the fallback timer (created inside handlePageSelected)
    // doesn't capture stale `bookId`/`chapterNumber`/`onChapterChange` closures.
    const onChapterChangeRef = useRef(onChapterChange);
    onChapterChangeRef.current = onChapterChange;
    const currentKeyRef = useRef(`${bookId}-${chapterNumber}`);
    currentKeyRef.current = `${bookId}-${chapterNumber}`;

    useEffect(() => clearPendingTimer, []);

    // While a programmatic setPageWithoutAnimation is settling, the native
    // ViewPager fires `onPageSelected` for intermediate positions. Without
    // this guard, the very first reposition lands on position=0 (the prev
    // slot) and gets mistaken for a swipe — kicks navigateToChapter back
    // to the previous chapter.
    //
    // 2026-05-24 follow-up: clearing the guard on the FIRST event that
    // matches the target index isn't enough. The native ViewPager keeps
    // firing trailing `onPageSelected` events for ~50-200ms AFTER it
    // settles on the target (often emitting position=0 or back-and-forth
    // between adjacent positions). Those late events arrive with the
    // guard already cleared and are treated as real swipes — the bug
    // reproes as "every other dropdown navigation silently rewinds by
    // one chapter". Fix: hold the guard open via a timer instead of
    // clearing on first match.
    const programmaticTargetRef = useRef<number | null>(null);
    const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const armProgrammaticGuard = (targetIndex: number) => {
      programmaticTargetRef.current = targetIndex;
      if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
      // 400ms covers the worst-case trailing-event window observed in
      // logs (~5 spurious events over ~250ms). Errs generous because
      // a too-short window reproduces the rewind bug, while a too-long
      // window only delays the user's next intentional swipe (no
      // correctness impact — the dropdown navigation is already in
      // flight by then).
      programmaticTimerRef.current = setTimeout(() => {
        programmaticTargetRef.current = null;
        programmaticTimerRef.current = null;
      }, 400);
    };
    useEffect(
      () => () => {
        if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
      },
      []
    );

    // Reset pager position to center after props change (parent navigated). Runs in
    // useLayoutEffect so the setPageWithoutAnimation lands in the same paint frame as
    // the children-array swap. With useDeferredValue on the parent, the heavy commit
    // happens in the background priority — by the time this effect fires here, the
    // commit is done and the next paint reflects the new children at the recentered
    // index, so the user never sees the overshoot.
    useLayoutEffect(() => {
      const currentKey = `${bookId}-${chapterNumber}`;
      if (prevChapterKey.current === currentKey) return;
      prevChapterKey.current = currentKey;
      const targetIndex = canGoPrevious ? PAGE_CURRENT_MIDDLE : 0;
      // Suppress pageSelected handling for the full reposition window —
      // see armProgrammaticGuard. The guard auto-clears on a timer so
      // the trailing onPageSelected events ViewPager emits after the
      // seek finishes don't get treated as user swipes.
      armProgrammaticGuard(targetIndex);
      pagerRef.current?.setPageWithoutAnimation(targetIndex);
    }, [bookId, chapterNumber, canGoPrevious]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        pagerRef.current?.setPage(index);
      },
    }));

    /**
     * Calculate the initial page index based on boundary conditions
     * - At Genesis 1 (no prev): pages = [current, next], initialPage = 0
     * - At Revelation 22 (no next): pages = [prev, current], initialPage = 1
     * - Middle chapters: pages = [prev, current, next], initialPage = 1
     */
    const initialPageIndex = canGoPrevious ? PAGE_CURRENT_MIDDLE : 0;

    /**
     * Handle page selection
     *
     * Called when user finishes swiping to a new page.
     * Page indices depend on which pages are rendered.
     */
    /**
     * Handle page selection — store pending navigation target.
     * Navigation is deferred until the pager reaches idle state via onPageScrollStateChanged.
     * This prevents rapid-swipe race conditions where a second swipe fires before reposition.
     */
    const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
      const newPosition = event.nativeEvent.position;

      // Swallow ALL page-selected events while a programmatic reposition
      // is in flight (guard cleared by timer in armProgrammaticGuard).
      // ViewPager fires both intermediate AND trailing events during
      // the seek; clearing on first-match wasn't enough (caused phantom
      // rewind to prev chapter). The user-swipe path doesn't arm the
      // guard, so its events flow through normally.
      if (programmaticTargetRef.current !== null) {
        return;
      }

      if (canGoPrevious && canGoNext) {
        // 3 pages: [prev, current, next]
        if (newPosition === 0 && prevChapter) {
          pendingNavRef.current = {
            bookId: prevChapter.bookId,
            chapterNumber: prevChapter.chapterNumber,
          };
        } else if (newPosition === 2 && nextChapter) {
          pendingNavRef.current = {
            bookId: nextChapter.bookId,
            chapterNumber: nextChapter.chapterNumber,
          };
        }
      } else if (!canGoPrevious && canGoNext) {
        // 2 pages at start: [current, next]
        if (newPosition === 1 && nextChapter) {
          pendingNavRef.current = {
            bookId: nextChapter.bookId,
            chapterNumber: nextChapter.chapterNumber,
          };
        }
      } else if (canGoPrevious && !canGoNext) {
        // 2 pages at end: [prev, current]
        if (newPosition === 0 && prevChapter) {
          pendingNavRef.current = {
            bookId: prevChapter.bookId,
            chapterNumber: prevChapter.chapterNumber,
          };
        }
      }

      // Arm fallback: if `idle` never fires within 500ms, force-fire navigation from pending and
      // clear it so the next swipe starts clean. The natural idle path cancels this timer.
      clearPendingTimer();
      if (pendingNavRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (!pendingNavRef.current) return;
          const { bookId: navBookId, chapterNumber: navChapter } = pendingNavRef.current;
          pendingNavRef.current = null;
          onChapterChangeRef.current(navBookId, navChapter);
        }, 500);
      }
    };

    /**
     * Process navigation only when the pager reaches idle state.
     * This ensures the swipe gesture + settling animation are fully complete before
     * we trigger the state update and reposition.
     */
    const handlePageScrollStateChanged = (event: { nativeEvent: { pageScrollState: string } }) => {
      const state = event.nativeEvent.pageScrollState;
      if (state === 'idle' && pendingNavRef.current) {
        clearPendingTimer();
        const { bookId: navBookId, chapterNumber: navChapter } = pendingNavRef.current;
        pendingNavRef.current = null;
        onChapterChange(navBookId, navChapter);
      }
    };

    /**
     * Build pages array dynamically based on boundary conditions
     * - At Genesis 1: [current, next] (no prev page)
     * - At Revelation 22: [prev, current] (no next page)
     * - Middle: [prev, current, next]
     */
    const pages = useMemo(() => {
      const result: React.ReactNode[] = [];

      // Keys are chapter-based, NOT slot-based ("page-prev/current/next").
      // Why: after a swipe, React's pages-array shifts so the chapter the user just
      // swiped to ends up in a different slot (was at the right edge, now in the
      // center). Slot-based keys would have React reuse the right-edge instance and
      // mutate it to a different chapter, then setPageWithoutAnimation moves the pager
      // to a different instance with scroll=0 — that's the "teleport back to top" bug.
      // Chapter-based keys make React migrate the user's actual chapter instance
      // between slots, preserving its ScrollView position.
      if (canGoPrevious && prevChapter) {
        result.push(
          <View
            key={`chapter-${prevChapter.bookId}-${prevChapter.chapterNumber}`}
            style={styles.page}
          >
            {renderChapterPage(prevChapter.bookId, prevChapter.chapterNumber)}
          </View>
        );
      }

      result.push(
        <View key={`chapter-${bookId}-${chapterNumber}`} style={styles.page}>
          {renderChapterPage(bookId, chapterNumber)}
        </View>
      );

      if (canGoNext && nextChapter) {
        result.push(
          <View
            key={`chapter-${nextChapter.bookId}-${nextChapter.chapterNumber}`}
            style={styles.page}
          >
            {renderChapterPage(nextChapter.bookId, nextChapter.chapterNumber)}
          </View>
        );
      }

      return result;
    }, [
      bookId,
      chapterNumber,
      prevChapter,
      nextChapter,
      canGoPrevious,
      canGoNext,
      renderChapterPage,
    ]);

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={initialPageIndex}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        testID="simple-chapter-pager"
        offscreenPageLimit={1}
      >
        {pages}
      </PagerView>
    );
  }
);

/**
 * Styles for SimpleChapterPager
 */
const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
