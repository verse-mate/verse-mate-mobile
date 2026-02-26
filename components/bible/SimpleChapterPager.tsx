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

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
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

    // When props change (parent navigated), reset pager to the current page index
    // without remounting the entire component
    useEffect(() => {
      const currentKey = `${bookId}-${chapterNumber}`;
      if (prevChapterKey.current === currentKey) return;
      prevChapterKey.current = currentKey;
      const targetIndex = canGoPrevious ? PAGE_CURRENT_MIDDLE : 0;
      pagerRef.current?.setPageWithoutAnimation(targetIndex);
    });

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
    const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
      const newPosition = event.nativeEvent.position;

      if (canGoPrevious && canGoNext) {
        // 3 pages: [prev, current, next]
        if (newPosition === 0 && prevChapter) {
          onChapterChange(prevChapter.bookId, prevChapter.chapterNumber);
        } else if (newPosition === 2 && nextChapter) {
          onChapterChange(nextChapter.bookId, nextChapter.chapterNumber);
        }
      } else if (!canGoPrevious && canGoNext) {
        // 2 pages at start: [current, next]
        if (newPosition === 1 && nextChapter) {
          onChapterChange(nextChapter.bookId, nextChapter.chapterNumber);
        }
      } else if (canGoPrevious && !canGoNext) {
        // 2 pages at end: [prev, current]
        if (newPosition === 0 && prevChapter) {
          onChapterChange(prevChapter.bookId, prevChapter.chapterNumber);
        }
      }
      // Single page (both boundaries - shouldn't happen with Bible) - do nothing
    };

    /**
     * Build pages array dynamically based on boundary conditions
     * - At Genesis 1: [current, next] (no prev page)
     * - At Revelation 22: [prev, current] (no next page)
     * - Middle: [prev, current, next]
     */
    const pages = useMemo(() => {
      const result: React.ReactNode[] = [];

      // Add previous page if available
      if (canGoPrevious && prevChapter) {
        result.push(
          <View key="page-prev" style={styles.page}>
            {renderChapterPage(prevChapter.bookId, prevChapter.chapterNumber)}
          </View>
        );
      }

      // Always add current page
      result.push(
        <View key="page-current" style={styles.page}>
          {renderChapterPage(bookId, chapterNumber)}
        </View>
      );

      // Add next page if available
      if (canGoNext && nextChapter) {
        result.push(
          <View key="page-next" style={styles.page}>
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
