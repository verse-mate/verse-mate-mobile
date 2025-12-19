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

import * as Haptics from 'expo-haptics';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { OnPageSelectedEventData } from 'react-native-pager-view/lib/typescript/PagerViewNativeComponent';
import { SwipeBoundaryPage } from '@/components/ui/SwipeBoundaryPage';
import { useBibleTestaments } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import {
  getAbsolutePageIndex,
  getChapterFromPageIndex,
  getMaxPageIndex,
} from '@/utils/bible/chapter-index-utils';
import { ChapterPage } from './ChapterPage';

/**
 * Constants for 7-page fixed window
 */
const WINDOW_SIZE = 7;
const CENTER_INDEX = 3;

/**
 * Delay in milliseconds before calling onPageChange after swipe
 * This prevents double animation (PagerView + router.replace)
 * Kept short (75ms) to ensure snappy UI updates (Header/Fab), while
 * parent component handles URL debouncing to prevent global re-renders.
 */
const ROUTE_UPDATE_DELAY_MS = 75;

/**
 * Imperative handle interface for ChapterPagerView
 * Allows parent components to programmatically trigger page changes
 */
export interface ChapterPagerViewRef {
  /** Programmatically navigate to a page index with animation */
  setPage: (pageIndex: number) => void;
}

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
  /** Target verse to scroll to (optional) */
  targetVerse?: number;
  /** Target end verse for multi-verse highlights (optional) */
  targetEndVerse?: number;
  /** Callback when page changes (after swipe completes) */
  onPageChange: (bookId: number, chapterNumber: number) => void;
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
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
 * const pagerRef = useRef<ChapterPagerViewRef>(null);
 *
 * <ChapterPagerView
 *   ref={pagerRef}
 *   initialBookId={1}
 *   initialChapter={5}
 *   activeTab="summary"
 *   activeView="bible"
 *   onPageChange={(bookId, chapter) => {
 *     router.replace(`/bible/${bookId}/${chapter}`);
 *   }}
 * />
 *
 * // Programmatically navigate
 * pagerRef.current?.setPage(3);
 * ```
 */
const ChapterPagerViewComponent = forwardRef<ChapterPagerViewRef, ChapterPagerViewProps>(
  function ChapterPagerView(
    {
      initialBookId,
      initialChapter,
      activeTab,
      activeView,
      targetVerse,
      targetEndVerse,
      onPageChange,
      onScroll,
      onTap,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);
    const routeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch books metadata for navigation calculations
    const { data: booksMetadata } = useBibleTestaments();

    // Track current absolute index (which chapter is at center)
    const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
      getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata)
    );

    // Track the currently selected position in the 5-page window (0-4)
    const [selectedPosition, setSelectedPosition] = useState(CENTER_INDEX);

    // Flag to tell pages NOT to reset scroll during a seamless snap
    const [forceJump, setForceJump] = useState(false);

    // Refs to track state for the useEffect without causing it to re-run on every swipe
    const absIndexRef = useRef(currentAbsoluteIndex);
    const posRef = useRef(selectedPosition);
    const lastProcessedRef = useRef({ bookId: initialBookId, chapter: initialChapter });

    // Keep refs in sync with state
    useEffect(() => {
      absIndexRef.current = currentAbsoluteIndex;
    }, [currentAbsoluteIndex]);

    useEffect(() => {
      posRef.current = selectedPosition;
    }, [selectedPosition]);

    // Expose imperative methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        setPage: (pageIndex: number) => {
          pagerRef.current?.setPage(pageIndex);
        },
      }),
      []
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (routeUpdateTimeoutRef.current) {
          clearTimeout(routeUpdateTimeoutRef.current);
        }
      };
    }, []);

    // Update absolute index if initialBookId/initialChapter changes externally (modal, back button, etc.)
    useEffect(() => {
      // If we have a pending route update, it means WE initiated a change that hasn't propagated yet.
      // Ignoring prop updates during this window prevents "Snap Back" where the parent
      // forces us back to the old chapter before processing our request.
      if (routeUpdateTimeoutRef.current !== null) {
        return;
      }

      // Only act if the props actually changed from what we last processed
      if (
        lastProcessedRef.current.bookId === initialBookId &&
        lastProcessedRef.current.chapter === initialChapter
      ) {
        return;
      }
      lastProcessedRef.current = { bookId: initialBookId, chapter: initialChapter };

      const newIndex = getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata);
      if (newIndex === -1) return;

      // Calculate what absolute index is currently visible at the current pager position
      const currentlyVisibleIndex = absIndexRef.current + (posRef.current - CENTER_INDEX);

      // Only re-center if the new index is DIFFERENT from what the user is already looking at.
      if (newIndex !== currentlyVisibleIndex) {
        setForceJump(true); // Tell pages to reset scroll for a true jump
        setCurrentAbsoluteIndex(newIndex);
        absIndexRef.current = newIndex;
        setSelectedPosition(CENTER_INDEX);
        posRef.current = CENTER_INDEX;
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        // Reset jump flag after a frame
        requestAnimationFrame(() => setForceJump(false));
      }
    }, [initialBookId, initialChapter, booksMetadata]); // Removed currentAbsoluteIndex and selectedPosition from deps

    /**
     * Calculate which chapter should display at a given window position
     *
     * Returns null for out-of-bounds positions instead of clamping.
     * This allows us to render boundary indicators at Genesis 1 (start)
     * and Revelation 22 (end).
     */
    const getChapterForPosition = useCallback(
      (windowPosition: number): { bookId: number; chapterNumber: number } | null => {
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        // Return null for out-of-bounds - don't clamp to boundaries
        // This prevents showing duplicate content at Bible boundaries
        if (absoluteIndex < 0) {
          return null;
        }

        const maxIndex = getMaxPageIndex(booksMetadata);
        if (absoluteIndex > maxIndex) {
          return null;
        }

        return getChapterFromPageIndex(absoluteIndex, booksMetadata);
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
            onScroll={onScroll}
            onTap={onTap}
          />
        ));
      }

      return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => {
        const chapter = getChapterForPosition(windowPosition);
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        // Render boundary indicator for out-of-bounds pages
        // This shows a helpful message instead of duplicate content at Bible boundaries
        if (!chapter) {
          const direction = absoluteIndex < 0 ? 'start' : 'end';
          return (
            <SwipeBoundaryPage
              key={`page-${windowPosition}`}
              direction={direction}
              contentType="chapter"
              testID={`chapter-page-boundary-${windowPosition}`}
            />
          );
        }

        const { bookId, chapterNumber } = chapter;
        const isTargetChapter = bookId === initialBookId && chapterNumber === initialChapter;
        // isPreloading should be true for any page that is NOT currently selected by the user
        const isPreloading = windowPosition !== selectedPosition;

        return (
          <ChapterPage
            key={`page-${windowPosition}`} // STABLE KEY: never changes
            bookId={bookId} // DYNAMIC PROP: updates when window shifts
            chapterNumber={chapterNumber} // DYNAMIC PROP: updates when window shifts
            activeTab={activeTab}
            activeView={activeView}
            shouldResetScroll={forceJump} // ONLY reset scroll if this is a forced jump
            isPreloading={isPreloading} // Optimize off-screen pages
            targetVerse={isTargetChapter ? targetVerse : undefined}
            targetEndVerse={isTargetChapter ? targetEndVerse : undefined}
            onScroll={onScroll}
            onTap={onTap}
          />
        );
      });
    }, [
      activeTab,
      activeView,
      booksMetadata,
      currentAbsoluteIndex,
      getChapterForPosition,
      onScroll,
      onTap,
      initialBookId,
      initialChapter,
      targetVerse,
      targetEndVerse,
      forceJump,
      selectedPosition, // Added dependency
    ]);

    /**
     * Handle page selection events
     *
     * SEAMLESS RESET STRATEGY:
     * To prevent the "every other swipe is laggy" bug, we re-center the pager
     * to the middle index (2) after EVERY swipe.
     *
     * Because we update currentAbsoluteIndex BEFORE calling setPageWithoutAnimation,
     * the content at the "new" index 2 is IDENTICAL to the content at the
     * "old" index 1 or 3. This makes the snap visually invisible.
     */
    const handlePageSelected = useCallback(
      (event: { nativeEvent: OnPageSelectedEventData }) => {
        const newPosition = Math.floor(event.nativeEvent.position);
        if (newPosition === CENTER_INDEX) return; // Already centered

        // SYNC REFS IMMEDIATELY to prevent race conditions in useEffect
        posRef.current = newPosition;
        setSelectedPosition(newPosition);

        // Clear any pending route update timeout
        if (routeUpdateTimeoutRef.current) {
          clearTimeout(routeUpdateTimeoutRef.current);
          routeUpdateTimeoutRef.current = null;
        }

        // Calculate would-be absolute index for this page
        const offset = newPosition - CENTER_INDEX;
        const newAbsoluteIndex = currentAbsoluteIndex + offset;

        // Check if swipe would go out of bounds
        const maxIndex = getMaxPageIndex(booksMetadata);
        const isOutOfBounds = newAbsoluteIndex < 0 || newAbsoluteIndex > maxIndex;

        if (isOutOfBounds) {
          requestAnimationFrame(() => {
            pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
            setSelectedPosition(CENTER_INDEX);
            posRef.current = CENTER_INDEX;
          });
          return;
        }

        // Check if user reached edge positions (0 or 6) - EDGE RESET
        const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

        // Fire Haptics INSTANTLY on the native UI thread
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isAtEdge) {
          // SEAMLESS EDGE SNAP
          setForceJump(false); // ENSURE we don't reset scroll during this snap
          setCurrentAbsoluteIndex(newAbsoluteIndex);
          absIndexRef.current = newAbsoluteIndex;

          requestAnimationFrame(() => {
            pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
            setSelectedPosition(CENTER_INDEX);
            posRef.current = CENTER_INDEX;
          });

          const chapter = getChapterFromPageIndex(newAbsoluteIndex, booksMetadata);
          if (chapter) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(chapter.bookId, chapter.chapterNumber);
              routeUpdateTimeoutRef.current = null;
            }, ROUTE_UPDATE_DELAY_MS);
          }
        } else {
          // Proactive re-center logic:
          // If we are at position 1 or 5, we are getting close to the wall.
          // We can silently re-center when the user is idle, but for now
          // we'll just let them swipe until 0 or 6 to minimize snaps.
          const chapter = getChapterFromPageIndex(newAbsoluteIndex, booksMetadata);
          if (chapter) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(chapter.bookId, chapter.chapterNumber);
              routeUpdateTimeoutRef.current = null;
            }, ROUTE_UPDATE_DELAY_MS);
          }
        }
      },
      [currentAbsoluteIndex, booksMetadata, onPageChange]
    );

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={CENTER_INDEX}
        onPageSelected={handlePageSelected}
        testID="chapter-pager-view"
        removeClippedSubviews={false}
        offscreenPageLimit={4}
        overScrollMode="never"
      >
        {pages}
      </PagerView>
    );
  }
);

/**
 * Memoized PagerView to prevent unnecessary global re-renders
 * during URL synchronization.
 */
export const ChapterPagerView = memo(ChapterPagerViewComponent);

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
