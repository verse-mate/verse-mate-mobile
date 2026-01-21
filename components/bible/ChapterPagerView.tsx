/**
 * ChapterPagerView Component
 *
 * Wraps react-native-pager-view with a fixed 5-page sliding window.
 * Uses STABLE POSITIONAL KEYS to prevent "infinite swipe" bug.
 *
 * Architecture:
 * - Render exactly 5 pages with circular navigation at Bible boundaries
 * - Keys: ["page-0", "page-1", "page-2", "page-3", "page-4"] - NEVER CHANGE
 * - Center at index 2
 * - Re-center when reaching edges (index 0 or 4)
 * - Pass chapter data as props that update when window shifts
 *
 * Circular Navigation:
 * - Swiping backward from Genesis 1 shows Revelation 22
 * - Swiping forward from Revelation 22 shows Genesis 1
 * - No boundary pages - continuous reading experience through entire Bible
 *
 * Context Integration:
 * - Updates ChapterNavigationContext synchronously on swipe completion
 * - Extracts bookName from booksMetadata (no API call needed)
 * - Header reads from context for instant updates
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 103-218)
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 * @see Spec: agent-os/specs/2026-01-21-chapter-header-slide-sync/spec.md
 */

import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
 * Constants for 5-page fixed window (reduced from 7 for performance)
 */
const WINDOW_SIZE = 5;
const CENTER_INDEX = 2;

/**
 * Delay in milliseconds before calling onPageChange after swipe
 * This prevents double animation (PagerView + router.replace)
 * Note: Context updates happen synchronously - this delay is ONLY for URL sync.
 */
const ROUTE_UPDATE_DELAY_MS = 75;

/**
 * Imperative handle interface for ChapterPagerView
 * Allows parent components to programmatically trigger page changes
 */
export interface ChapterPagerViewRef {
  /** Programmatically navigate to a page index with animation */
  setPage: (pageIndex: number) => void;
  /** Navigate to the next page */
  goNext: () => void;
  /** Navigate to the previous page */
  goPrevious: () => void;
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
  /** Callback when page changes (after swipe completes) - used for URL sync */
  onPageChange: (bookId: number, chapterNumber: number) => void;
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
}

/**
 * ChapterPagerView Component
 *
 * Implements 5-page fixed window with stable positional keys and circular navigation.
 * Prevents "infinite swipe restarting at Genesis 1" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing bookId/chapterNumber as PROPS that update
 * - Re-centering at edges using setPageWithoutAnimation
 *
 * Circular navigation enables seamless reading through the entire Bible:
 * - Genesis 1 backward -> Revelation 22
 * - Revelation 22 forward -> Genesis 1
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
      onPageChange,
      onScroll,
      onTap,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);
    const routeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get context setter for synchronous navigation state updates
    const { setCurrentChapter } = useChapterNavigation();

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
        goNext: () => {
          const nextPos = posRef.current + 1;
          if (nextPos < WINDOW_SIZE) {
            pagerRef.current?.setPage(nextPos);
          }
        },
        goPrevious: () => {
          const prevPos = posRef.current - 1;
          if (prevPos >= 0) {
            pagerRef.current?.setPage(prevPos);
          }
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
      // Use circular wrapping to handle negative indices (e.g., -1 wraps to 1188)
      const rawVisibleIndex = absIndexRef.current + (posRef.current - CENTER_INDEX);
      const currentlyVisibleIndex = wrapCircularIndex(rawVisibleIndex, booksMetadata);

      // Only re-center if the new index is DIFFERENT from what the user is already looking at.
      // With circular wrapping, -1 and 1188 are the same chapter, so this comparison now works correctly.
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
     * Uses circular wrapping at Bible boundaries:
     * - Negative indices wrap to end of Bible (Revelation)
     * - Indices beyond max wrap to start of Bible (Genesis)
     * This enables seamless circular navigation through the entire Bible.
     */
    const getChapterForPosition = (
      windowPosition: number
    ): { bookId: number; chapterNumber: number } | null => {
      const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

      // Use circular wrapping for out-of-bounds indices
      const wrappedIndex = wrapCircularIndex(absoluteIndex, booksMetadata);

      // Return null if booksMetadata is invalid (wrapCircularIndex returns -1)
      if (wrappedIndex === -1) {
        return null;
      }

      return getChapterFromPageIndex(wrappedIndex, booksMetadata);
    };

    /**
     * Generate exactly 5 pages with STABLE POSITIONAL KEYS
     *
     * Keys never change - they're based on window position (0-4), not content.
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
      // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of getChapterForPosition
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
     * Handle page selection events
     *
     * SEAMLESS RESET STRATEGY:
     * To prevent the "every other swipe is laggy" bug, we re-center the pager
     * to the middle index (2) after reaching edge positions.
     *
     * With circular navigation, there are no out-of-bounds positions - all
     * indices wrap to valid chapters. The edge reset logic re-centers the
     * window while maintaining seamless content continuity.
     *
     * CONTEXT UPDATE:
     * Updates ChapterNavigationContext SYNCHRONOUSLY (no setTimeout) so the
     * header displays the correct chapter instantly. The onPageChange callback
     * still has a 75ms delay for URL sync to prevent double animations.
     */
    const handlePageSelected = (event: { nativeEvent: OnPageSelectedEventData }) => {
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

      // Use circular wrapping for the new index
      const wrappedIndex = wrapCircularIndex(newAbsoluteIndex, booksMetadata);

      // Get chapter info for context and route updates
      const chapter = getChapterFromPageIndex(wrappedIndex, booksMetadata);

      // Fire Haptics INSTANTLY on the native UI thread
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // UPDATE CONTEXT SYNCHRONOUSLY - this makes the header update instantly
      // Extract bookName from booksMetadata (no API call needed)
      if (chapter) {
        const bookName = booksMetadata?.find((b) => b.id === chapter.bookId)?.name || '';
        setCurrentChapter(chapter.bookId, chapter.chapterNumber, bookName);
      }

      // Check if user reached edge positions (0 or 4) - EDGE RESET
      const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

      if (isAtEdge) {
        // SEAMLESS EDGE SNAP with circular index
        // IMPORTANT: Re-center the pager BEFORE updating state to prevent flicker.
        // If we update currentAbsoluteIndex first, the pages useMemo will recalculate
        // with the new center (e.g., 1188 for Rev 22) but pager is still at position 0,
        // causing wrong content to flash (e.g., Rev 19 instead of Rev 22).
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        setSelectedPosition(CENTER_INDEX);
        posRef.current = CENTER_INDEX;

        // Now update the absolute index - pages will recalculate correctly since
        // pager is already centered at position 2
        setForceJump(false); // ENSURE we don't reset scroll during this snap
        setCurrentAbsoluteIndex(wrappedIndex);
        absIndexRef.current = wrappedIndex;

        // Delayed URL sync (75ms) - context already updated synchronously above
        if (chapter) {
          routeUpdateTimeoutRef.current = setTimeout(() => {
            onPageChange(chapter.bookId, chapter.chapterNumber);
            routeUpdateTimeoutRef.current = null;
          }, ROUTE_UPDATE_DELAY_MS);
        }
      } else {
        // Non-edge position - use wrapped index for navigation
        // Delayed URL sync (75ms) - context already updated synchronously above
        if (chapter) {
          routeUpdateTimeoutRef.current = setTimeout(() => {
            onPageChange(chapter.bookId, chapter.chapterNumber);
            routeUpdateTimeoutRef.current = null;
          }, ROUTE_UPDATE_DELAY_MS);
        }
      }
    };

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={CENTER_INDEX}
        onPageSelected={handlePageSelected}
        testID="chapter-pager-view"
        removeClippedSubviews={false}
        offscreenPageLimit={2}
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
export const ChapterPagerView = ChapterPagerViewComponent;

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
