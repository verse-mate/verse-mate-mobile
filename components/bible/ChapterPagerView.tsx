/**
 * ChapterPagerView Component
 *
 * Wraps react-native-pager-view with a fixed 7-page sliding window.
 * Uses STABLE POSITIONAL KEYS to prevent "infinite swipe" bug.
 *
 * Architecture:
 * - Render exactly 7 pages with circular navigation at Bible boundaries
 * - Keys: ["page-0", "page-1", "page-2", ..., "page-6"] - NEVER CHANGE
 * - Center at index 3
 * - Re-center when reaching edges (index 0 or 6)
 * - Pass chapter data as props that update when window shifts
 *
 * Single Writer Pattern:
 * - This component is the SINGLE WRITER to ChapterNavigationContext
 * - `onPageSelected` callback is the ONLY place that updates navigation state
 * - Calls `setCurrentChapter()` from context instead of callback props
 * - Context replaces callback-based communication
 *
 * Circular Navigation:
 * - Swiping backward from Genesis 1 shows Revelation 22
 * - Swiping forward from Revelation 22 shows Genesis 1
 * - No boundary pages - continuous reading experience through entire Bible
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 103-218)
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
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
import { useChapterNavigation } from '@/contexts/ChapterNavigationContext';
import { useBibleTestaments } from '@/src/api';
import type { ContentTabType } from '@/types/bible';
import {
  getAbsolutePageIndex,
  getChapterFromPageIndex,
  wrapCircularIndex,
} from '@/utils/bible/chapter-index-utils';
import { ChapterPage } from './ChapterPage';

/**
 * Constants for 7-page fixed window
 */
const WINDOW_SIZE = 7;
const CENTER_INDEX = 3;

/**
 * Delay in milliseconds before updating context after swipe settles
 * Only used as fallback if onPageScroll early update didn't fire
 */
const CONTEXT_UPDATE_DELAY_MS = 75;

/**
 * Threshold for early header update during scroll (0.5 = halfway between pages)
 * When user scrolls past this threshold, we update the header immediately
 * for a more responsive feel, rather than waiting for animation to complete.
 */
const EARLY_UPDATE_THRESHOLD = 0.5;

/**
 * Imperative handle interface for ChapterPagerView
 * Allows parent components to programmatically trigger page changes
 */
export interface ChapterPagerViewRef {
  /** Programmatically navigate to a page index with animation */
  setPage: (pageIndex: number) => void;
  /** Programmatically navigate to a page index without animation (for external navigation) */
  setPageWithoutAnimation: (pageIndex: number) => void;
  /** Navigate to the next page */
  goNext: () => void;
  /** Navigate to the previous page */
  goPrevious: () => void;
  /**
   * Jump to a specific chapter (for modal/external navigation)
   * Updates both the internal absolute index AND snaps pager to center
   */
  jumpToChapter: (bookId: number, chapterNumber: number) => void;
}

/**
 * Props for ChapterPagerView component
 *
 * Note: `onPageChange` prop has been removed. Navigation state updates
 * now go through ChapterNavigationContext via `setCurrentChapter()`.
 */
export interface ChapterPagerViewProps {
  /** Initial book ID to display (1-66) - read ONCE on mount */
  initialBookId: number;
  /** Initial chapter number to display (1-based) - read ONCE on mount */
  initialChapter: number;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
  /** Target verse to scroll to (optional) */
  targetVerse?: number;
  /** Target end verse for multi-verse highlights (optional) */
  targetEndVerse?: number;
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
}

/**
 * ChapterPagerView Component
 *
 * Implements 7-page fixed window with stable positional keys and circular navigation.
 * Prevents "infinite swipe restarting at Genesis 1" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing bookId/chapterNumber as PROPS that update
 * - Re-centering at edges using setPageWithoutAnimation
 *
 * Single Writer Pattern:
 * - This component is the SINGLE WRITER to ChapterNavigationContext
 * - The `onPageSelected` callback calls `setCurrentChapter()` from context
 * - No `onPageChange` prop - context replaces callback-based communication
 *
 * Circular navigation enables seamless reading through the entire Bible:
 * - Genesis 1 backward -> Revelation 22
 * - Revelation 22 forward -> Genesis 1
 *
 * @example
 * ```tsx
 * const pagerRef = useRef<ChapterPagerViewRef>(null);
 *
 * <ChapterNavigationProvider
 *   initialBookId={1}
 *   initialChapter={5}
 *   initialBookName="Genesis"
 * >
 *   <ChapterPagerView
 *     ref={pagerRef}
 *     initialBookId={1}
 *     initialChapter={5}
 *     activeTab="summary"
 *     activeView="bible"
 *   />
 * </ChapterNavigationProvider>
 *
 * // Programmatically navigate
 * pagerRef.current?.goNext();
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
      onScroll,
      onTap,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);
    const routeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track whether we've already updated context for the current swipe
    // This prevents duplicate updates from both onPageScroll and onPageSelected
    const earlyUpdateFiredRef = useRef(false);
    // Track the last page we updated to, to prevent redundant updates
    const lastUpdatedPageRef = useRef<number>(CENTER_INDEX);

    // Access context for single writer pattern
    const { setCurrentChapter } = useChapterNavigation();

    // Fetch books metadata for navigation calculations
    const { data: booksMetadata } = useBibleTestaments();

    // Track current absolute index (which chapter is at center)
    // Initialize to -1, then sync when booksMetadata loads
    const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
      getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata)
    );

    // Track if we've done the initial sync (to avoid re-syncing on every booksMetadata change)
    const hasInitializedRef = useRef(false);

    // Sync currentAbsoluteIndex when booksMetadata first becomes available
    // This handles the case where booksMetadata is undefined on first render
    useEffect(() => {
      if (booksMetadata && booksMetadata.length > 0 && !hasInitializedRef.current) {
        const newIndex = getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata);
        if (newIndex !== -1 && newIndex !== currentAbsoluteIndex) {
          setCurrentAbsoluteIndex(newIndex);
        }
        hasInitializedRef.current = true;
      }
    }, [booksMetadata, initialBookId, initialChapter, currentAbsoluteIndex]);

    // Track the currently selected position in the 7-page window (0-6)
    const [selectedPosition, setSelectedPosition] = useState(CENTER_INDEX);

    // Flag to tell pages NOT to reset scroll during a seamless snap
    const [forceJump, setForceJump] = useState(false);

    // Expose imperative methods to parent component
    // Note: Using selectedPosition state directly instead of posRef (simplicity over optimization)
    useImperativeHandle(
      ref,
      () => ({
        setPage: (pageIndex: number) => {
          pagerRef.current?.setPage(pageIndex);
        },
        setPageWithoutAnimation: (pageIndex: number) => {
          pagerRef.current?.setPageWithoutAnimation(pageIndex);
        },
        goNext: () => {
          const nextPos = selectedPosition + 1;
          if (nextPos < WINDOW_SIZE) {
            pagerRef.current?.setPage(nextPos);
          }
        },
        goPrevious: () => {
          const prevPos = selectedPosition - 1;
          if (prevPos >= 0) {
            pagerRef.current?.setPage(prevPos);
          }
        },
        jumpToChapter: (bookId: number, chapterNumber: number) => {
          // Calculate the absolute index for this chapter
          const newAbsoluteIndex = getAbsolutePageIndex(bookId, chapterNumber, booksMetadata);

          // Update internal state to render correct content
          setCurrentAbsoluteIndex(newAbsoluteIndex);
          setSelectedPosition(CENTER_INDEX);
          lastUpdatedPageRef.current = CENTER_INDEX;
          earlyUpdateFiredRef.current = false;
          hasInitializedRef.current = true; // Mark as initialized

          // Snap pager to center without animation
          pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        },
      }),
      [selectedPosition, booksMetadata]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (routeUpdateTimeoutRef.current) {
          clearTimeout(routeUpdateTimeoutRef.current);
        }
      };
    }, []);

    /**
     * Calculate which chapter should display at a given window position
     *
     * Uses circular wrapping at Bible boundaries:
     * - Negative indices wrap to end of Bible (Revelation)
     * - Indices beyond max wrap to start of Bible (Genesis)
     * This enables seamless circular navigation through the entire Bible.
     */
    const getChapterForPosition = useCallback(
      (windowPosition: number): { bookId: number; chapterNumber: number } | null => {
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        // Use circular wrapping for out-of-bounds indices
        const wrappedIndex = wrapCircularIndex(absoluteIndex, booksMetadata);

        // Return null if booksMetadata is invalid (wrapCircularIndex returns -1)
        if (wrappedIndex === -1) {
          return null;
        }

        return getChapterFromPageIndex(wrappedIndex, booksMetadata);
      },
      [currentAbsoluteIndex, booksMetadata]
    );

    /**
     * Generate exactly 7 pages with STABLE POSITIONAL KEYS
     *
     * Keys never change - they're based on window position (0-6), not content.
     * Chapter data is passed as props that update when window shifts.
     * All pages render actual chapter content - no boundary pages for chapter navigation.
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

        // With circular navigation, chapter should always be valid when booksMetadata exists
        // This fallback is just for safety in case of unexpected state
        if (!chapter) {
          return (
            <ChapterPage
              key={`page-${windowPosition}`}
              bookId={1}
              chapterNumber={1}
              activeTab={activeTab}
              activeView={activeView}
              onScroll={onScroll}
              onTap={onTap}
            />
          );
        }

        const { bookId, chapterNumber } = chapter;
        const isTargetChapter = bookId === initialBookId && chapterNumber === initialChapter;

        // isPreloading should only be true for pages that are far away from the user's view.
        // We allow the current page AND its immediate neighbors (distance <= 1) to render
        // their content so that swiping between them is visually seamless.
        const isPreloading = Math.abs(windowPosition - selectedPosition) > 1;

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
      getChapterForPosition,
      onScroll,
      onTap,
      initialBookId,
      initialChapter,
      targetVerse,
      targetEndVerse,
      forceJump,
      selectedPosition,
    ]);

    /**
     * Get the book name for a given book ID
     */
    const getBookName = useCallback(
      (bookId: number): string => {
        if (!booksMetadata) return '';
        const book = booksMetadata.find((b) => b.id === bookId);
        return book?.name ?? '';
      },
      [booksMetadata]
    );

    /**
     * Handle page scroll events for early header update
     *
     * Updates the header (context) immediately when user crosses the 50% threshold
     * during a swipe, rather than waiting for the animation to complete.
     * This makes the UI feel more responsive.
     */
    const handlePageScroll = useCallback(
      (event: { nativeEvent: { position: number; offset: number } }) => {
        const { position, offset } = event.nativeEvent;

        // Determine which page the user is scrolling toward
        // offset > 0 means scrolling toward position + 1
        // offset < 0 would mean scrolling backward (but offset is always 0-1)
        const targetPage = offset > EARLY_UPDATE_THRESHOLD ? position + 1 : position;

        // Skip if we already updated to this page or if it's the same as current
        if (targetPage === lastUpdatedPageRef.current) {
          return;
        }

        // Only fire early update if user has crossed the threshold
        if (offset > EARLY_UPDATE_THRESHOLD || offset < 1 - EARLY_UPDATE_THRESHOLD) {
          // Calculate the chapter for this target page
          const offsetFromCenter = targetPage - CENTER_INDEX;
          const newAbsoluteIndex = currentAbsoluteIndex + offsetFromCenter;
          const wrappedIndex = wrapCircularIndex(newAbsoluteIndex, booksMetadata);

          const chapter = getChapterFromPageIndex(wrappedIndex, booksMetadata);
          if (chapter) {
            const bookName = getBookName(chapter.bookId);

            // Update context immediately (no delay)
            setCurrentChapter(chapter.bookId, chapter.chapterNumber, bookName);

            // Mark that we've done an early update
            earlyUpdateFiredRef.current = true;
            lastUpdatedPageRef.current = targetPage;
          }
        }
      },
      [currentAbsoluteIndex, booksMetadata, setCurrentChapter, getBookName]
    );

    /**
     * Handle page selection events
     *
     * SINGLE WRITER PATTERN:
     * This is the ONLY place that updates navigation state via context.
     * Calls `setCurrentChapter()` from ChapterNavigationContext.
     *
     * SEAMLESS RESET STRATEGY:
     * To prevent the "every other swipe is laggy" bug, we re-center the pager
     * to the middle index (3) after reaching edge positions.
     *
     * With circular navigation, there are no out-of-bounds positions - all
     * indices wrap to valid chapters. The edge reset logic re-centers the
     * window while maintaining seamless content continuity.
     */
    const handlePageSelected = useCallback(
      (event: { nativeEvent: OnPageSelectedEventData }) => {
        const newPosition = Math.floor(event.nativeEvent.position);

        // Reset early update tracking for next swipe
        const didEarlyUpdate = earlyUpdateFiredRef.current;
        earlyUpdateFiredRef.current = false;
        lastUpdatedPageRef.current = newPosition;

        if (newPosition === CENTER_INDEX) return; // Already centered

        // Update selected position state
        setSelectedPosition(newPosition);

        // Clear any pending context update timeout
        if (routeUpdateTimeoutRef.current) {
          clearTimeout(routeUpdateTimeoutRef.current);
          routeUpdateTimeoutRef.current = null;
        }

        // Calculate would-be absolute index for this page
        const offset = newPosition - CENTER_INDEX;
        const newAbsoluteIndex = currentAbsoluteIndex + offset;

        // Use circular wrapping for the new index
        const wrappedIndex = wrapCircularIndex(newAbsoluteIndex, booksMetadata);

        // Check if user reached edge positions (0 or 6) - EDGE RESET
        const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

        // Fire Haptics INSTANTLY on the native UI thread
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isAtEdge) {
          // SEAMLESS EDGE SNAP with circular index
          // IMPORTANT: Re-center the pager BEFORE updating state to prevent flicker.
          // If we update currentAbsoluteIndex first, the pages useMemo will recalculate
          // with the new center (e.g., 1188 for Rev 22) but pager is still at position 0,
          // causing wrong content to flash (e.g., Rev 19 instead of Rev 22).
          pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
          setSelectedPosition(CENTER_INDEX);
          lastUpdatedPageRef.current = CENTER_INDEX;

          // Now update the absolute index - pages will recalculate correctly since
          // pager is already centered at position 3
          setForceJump(false); // ENSURE we don't reset scroll during this snap
          setCurrentAbsoluteIndex(wrappedIndex);

          // Skip context update if early update already fired
          if (!didEarlyUpdate) {
            const chapter = getChapterFromPageIndex(wrappedIndex, booksMetadata);
            if (chapter) {
              const bookName = getBookName(chapter.bookId);
              routeUpdateTimeoutRef.current = setTimeout(() => {
                // SINGLE WRITER: Update context via setCurrentChapter
                setCurrentChapter(chapter.bookId, chapter.chapterNumber, bookName);
                routeUpdateTimeoutRef.current = null;
              }, CONTEXT_UPDATE_DELAY_MS);
            }
          }
        } else {
          // Skip context update if early update already fired
          if (!didEarlyUpdate) {
            // Non-edge position - use wrapped index for navigation
            const chapter = getChapterFromPageIndex(wrappedIndex, booksMetadata);
            if (chapter) {
              const bookName = getBookName(chapter.bookId);
              routeUpdateTimeoutRef.current = setTimeout(() => {
                // SINGLE WRITER: Update context via setCurrentChapter
                setCurrentChapter(chapter.bookId, chapter.chapterNumber, bookName);
                routeUpdateTimeoutRef.current = null;
              }, CONTEXT_UPDATE_DELAY_MS);
            }
          }
        }
      },
      [currentAbsoluteIndex, booksMetadata, setCurrentChapter, getBookName]
    );

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={CENTER_INDEX}
        onPageScroll={handlePageScroll}
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
 *
 * Supports circular navigation - swiping past Bible boundaries
 * wraps around seamlessly to the other end.
 */
export const ChapterPagerView = memo(ChapterPagerViewComponent);

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
