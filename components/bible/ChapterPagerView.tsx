/**
 * ChapterPagerView Component
 *
 * Wraps react-native-pager-view with a fixed 5-page sliding window.
 * Uses STABLE POSITIONAL KEYS to prevent "infinite swipe" bug.
 *
 * Architecture:
 * - Render exactly 5 pages: [prev-1, prev, current, next, next+1]
 * - Keys: ["page-0", "page-1", "page-2", "page-3", "page-4"] - NEVER CHANGE
 * - Center at index 2
 * - Re-center only when reaching edges (index 0 or 4)
 * - Pass chapter data as props that update when window shifts
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 103-218)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { OnPageSelectedEventData } from 'react-native-pager-view/lib/typescript/PagerViewNativeComponent';
import { useBibleTestaments } from '@/src/api/generated/hooks';
import type { ContentTabType } from '@/types/bible';
import { getAbsolutePageIndex, getChapterFromPageIndex } from '@/utils/bible/chapter-index-utils';
import { ChapterPage } from './ChapterPage';

/**
 * Constants for 5-page fixed window
 */
const WINDOW_SIZE = 5;
const CENTER_INDEX = 2;

/**
 * Props for ChapterPagerView component
 */
export interface ChapterPagerViewProps {
  /** Initial book ID to display (1-66) */
  initialBookId: number;
  /** Initial chapter number to display (1-based) */
  initialChapter: number;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
  /** Callback when page changes (after swipe completes) */
  onPageChange: (bookId: number, chapterNumber: number) => void;
}

/**
 * ChapterPagerView Component
 *
 * Implements 5-page fixed window with stable positional keys.
 * Prevents "infinite swipe restarting at Genesis 1" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing bookId/chapterNumber as PROPS that update
 * - Re-centering only at edges using setPageWithoutAnimation
 *
 * @example
 * ```tsx
 * <ChapterPagerView
 *   initialBookId={1}
 *   initialChapter={5}
 *   activeTab="summary"
 *   activeView="bible"
 *   onPageChange={(bookId, chapter) => {
 *     router.replace(`/bible/${bookId}/${chapter}`);
 *   }}
 * />
 * ```
 */
export function ChapterPagerView({
  initialBookId,
  initialChapter,
  activeTab,
  activeView,
  onPageChange,
}: ChapterPagerViewProps) {
  const pagerRef = useRef<PagerView>(null);

  // Fetch books metadata for navigation calculations
  const { data: booksMetadata } = useBibleTestaments();

  // Track current absolute index (which chapter is at center)
  const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
    getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata)
  );

  // Update absolute index if initialBookId/initialChapter changes externally
  useEffect(() => {
    const newIndex = getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata);
    if (newIndex !== -1 && newIndex !== currentAbsoluteIndex) {
      setCurrentAbsoluteIndex(newIndex);
      // Also update pager position for external navigation (e.g., from modal)
      pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
    }
  }, [initialBookId, initialChapter, booksMetadata, currentAbsoluteIndex]);

  /**
   * Calculate which chapter should display at a given window position
   */
  const getChapterForPosition = useCallback(
    (windowPosition: number) => {
      const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);
      const result = getChapterFromPageIndex(absoluteIndex, booksMetadata);

      // Return a valid chapter or fallback to Genesis 1 for out-of-bounds
      if (result) {
        return result;
      }

      // Fallback for out-of-bounds (before Genesis 1 or after Revelation 22)
      if (absoluteIndex < 0) {
        return { bookId: 1, chapterNumber: 1 }; // Genesis 1
      }

      // After Revelation 22, return Revelation 22
      return { bookId: 66, chapterNumber: 22 };
    },
    [currentAbsoluteIndex, booksMetadata]
  );

  /**
   * Generate exactly 5 pages with STABLE POSITIONAL KEYS
   *
   * Keys never change - they're based on window position (0-4), not content.
   * Chapter data is passed as props that update when window shifts.
   */
  const pages = useMemo(() => {
    // Handle case when books metadata not loaded yet
    if (!booksMetadata || booksMetadata.length === 0) {
      // Return placeholder pages with Genesis 1
      return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => (
        <ChapterPage
          key={`page-${windowPosition}`}
          bookId={1}
          chapterNumber={1}
          activeTab={activeTab}
          activeView={activeView}
        />
      ));
    }

    return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => {
      const { bookId, chapterNumber } = getChapterForPosition(windowPosition);

      return (
        <ChapterPage
          key={`page-${windowPosition}`} // STABLE KEY: never changes
          bookId={bookId} // DYNAMIC PROP: updates when window shifts
          chapterNumber={chapterNumber} // DYNAMIC PROP: updates when window shifts
          activeTab={activeTab}
          activeView={activeView}
        />
      );
    });
  }, [currentAbsoluteIndex, activeTab, activeView, booksMetadata, getChapterForPosition]);

  /**
   * Handle page selection events
   *
   * Re-centering strategy (spec lines 212-218):
   * 1. Initial: Genesis 1 at index 2: [none, none, Gen 1, Gen 2, Gen 3]
   * 2. Swipe right once: Position 3 (Genesis 2) - NO re-center, just update absolute index
   * 3. Swipe right again: Position 4 (Genesis 3 - EDGE!) - Re-center to index 2
   * 4. Result: [Gen 1, Gen 2, Gen 3, Gen 4, Gen 5] - User can continue swiping
   *
   * User can swipe once without jarring re-center. Re-center only at edges.
   */
  const handlePageSelected = useCallback(
    (event: { nativeEvent: OnPageSelectedEventData }) => {
      const selectedPosition = Math.floor(event.nativeEvent.position);

      // Check if user reached edge positions (0 or 4)
      const isAtEdge = selectedPosition === 0 || selectedPosition === WINDOW_SIZE - 1;

      if (isAtEdge) {
        // Calculate new absolute index based on edge position
        const newAbsoluteIndex = currentAbsoluteIndex + (selectedPosition - CENTER_INDEX);
        setCurrentAbsoluteIndex(newAbsoluteIndex);

        // Re-center to middle page without animation
        requestAnimationFrame(() => {
          pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        });

        // Notify parent of page change
        const { bookId, chapterNumber } = getChapterFromPageIndex(
          newAbsoluteIndex,
          booksMetadata
        ) || { bookId: initialBookId, chapterNumber: initialChapter };
        onPageChange(bookId, chapterNumber);
      } else if (selectedPosition !== CENTER_INDEX) {
        // User swiped one position away from center (to index 1 or 3)
        // Update absolute index but DON'T re-center yet
        const offset = selectedPosition - CENTER_INDEX;
        const newAbsoluteIndex = currentAbsoluteIndex + offset;
        setCurrentAbsoluteIndex(newAbsoluteIndex);

        // Notify parent of page change
        const { bookId, chapterNumber } = getChapterFromPageIndex(
          newAbsoluteIndex,
          booksMetadata
        ) || { bookId: initialBookId, chapterNumber: initialChapter };
        onPageChange(bookId, chapterNumber);
      }
    },
    [currentAbsoluteIndex, booksMetadata, initialBookId, initialChapter, onPageChange]
  );

  return (
    <PagerView
      ref={pagerRef}
      style={styles.pagerView}
      initialPage={CENTER_INDEX}
      onPageSelected={handlePageSelected}
      testID="chapter-pager-view"
    >
      {pages}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
