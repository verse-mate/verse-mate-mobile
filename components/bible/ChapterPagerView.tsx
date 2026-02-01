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
 * Circular Navigation:
 * - Swiping backward from Genesis 1 shows Revelation 22
 * - Swiping forward from Revelation 22 shows Genesis 1
 * - No boundary pages - continuous reading experience through entire Bible
 *
 * Header Sync (V2):
 * - Uses Reanimated shared values via useChapterDisplay hook
 * - Shared values update synchronously in onPageSelected (no setTimeout)
 * - Header updates on UI thread without React re-renders
 * - Guard flag prevents updates during edge recentering
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 103-218)
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 */

import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { OnPageSelectedEventData } from 'react-native-pager-view/lib/typescript/PagerViewNativeComponent';
import { useChapterDisplay } from '@/hooks/bible/use-chapter-display';
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
 * Delay in milliseconds before calling onPageChange after swipe.
 * This prevents double animation (PagerView + router.replace).
 *
 * Note: This delay is ONLY for the onPageChange callback (URL sync).
 * Shared values update SYNCHRONOUSLY in handlePageSelected for instant header updates.
 * The parent component handles URL debouncing (1000ms) to prevent global re-renders.
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
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
 * Implements 7-page fixed window with stable positional keys and circular navigation.
 * Prevents "infinite swipe restarting at Genesis 1" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing bookId/chapterNumber as PROPS that update
 * - Re-centering at edges using setPageWithoutAnimation
 *
 * Circular navigation enables seamless reading through the entire Bible:
 * - Genesis 1 backward -> Revelation 22
 * - Revelation 22 forward -> Genesis 1
 *
 * Header sync is achieved via Reanimated shared values:
 * - useChapterDisplay hook provides setChapter() for synchronous updates
 * - Header reads from shared values without React re-renders
 * - Guard flag prevents updates during edge recentering
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

    /**
     * Guards against processing intermediate callbacks during edge recentering.
     *
     * When the pager reaches an edge (position 0 or 6) and we call setPageWithoutAnimation(CENTER_INDEX),
     * react-native-pager-view may fire onPageSelected for intermediate pages (e.g., 2, 3 when jumping to 3).
     * This bug (documented in react-native-pager-view issue #454) causes the "backwards swipe glitch"
     * where the header briefly shows wrong chapters during rapid swiping.
     *
     * This flag is set to true BEFORE calling setPageWithoutAnimation and reset to false
     * after requestAnimationFrame, ensuring all intermediate callbacks are ignored.
     *
     * CRITICAL: The guard check must happen BEFORE any shared value updates in handlePageSelected.
     *
     * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
     */
    const isRecenteringRef = useRef(false);

    // Fetch books metadata for navigation calculations
    const { data: booksMetadata } = useBibleTestaments();

    /**
     * Chapter display hook provides shared values for header sync.
     * - setChapter: Updates shared values synchronously (no delay)
     * - setBooksMetadata: Sets metadata for book name derivation
     * - currentBookIdValue, currentChapterValue: Shared values for header
     *
     * @see hooks/bible/use-chapter-display.ts
     */
    const { setChapter, setBooksMetadata } = useChapterDisplay({
      initialBookId,
      initialChapter,
    });

    // Update books metadata in the hook when it becomes available
    useEffect(() => {
      if (booksMetadata && booksMetadata.length > 0) {
        setBooksMetadata(booksMetadata);
      }
    }, [booksMetadata, setBooksMetadata]);

    // Track current absolute index (which chapter is at center)
    const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
      getAbsolutePageIndex(initialBookId, initialChapter, booksMetadata)
    );

    // Track the currently selected position in the 7-page window (0-6)
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

        // Update shared values synchronously for external navigation (modal, back button, etc.)
        setChapter(initialBookId, initialChapter);

        setCurrentAbsoluteIndex(newIndex);
        absIndexRef.current = newIndex;
        setSelectedPosition(CENTER_INDEX);
        posRef.current = CENTER_INDEX;
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        // Reset jump flag after a frame
        requestAnimationFrame(() => setForceJump(false));
      }
    }, [initialBookId, initialChapter, booksMetadata, setChapter]); // Added setChapter to deps

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
     * CRITICAL: Guard flag check must be the VERY FIRST LINE to prevent processing
     * intermediate callbacks during edge recentering operations.
     *
     * Flow:
     * 1. Guard check (FIRST): if (isRecenteringRef.current) return;
     * 2. Calculate chapter: wrappedIndex, chapter = getChapterFromPageIndex(...)
     * 3. Update shared values: setChapter(chapter.bookId, chapter.chapterNumber) - SYNCHRONOUS
     * 4. Fire haptic feedback - INSTANT
     * 5. Edge handling (recentering if at edge position)
     * 6. Schedule URL sync with delay (debounced)
     *
     * SEAMLESS RESET STRATEGY:
     * To prevent the "every other swipe is laggy" bug, we re-center the pager
     * to the middle index (3) after reaching edge positions.
     *
     * With circular navigation, there are no out-of-bounds positions - all
     * indices wrap to valid chapters. The edge reset logic re-centers the
     * window while maintaining seamless content continuity.
     *
     * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
     */
    const handlePageSelected = (event: { nativeEvent: OnPageSelectedEventData }) => {
      // 1. CRITICAL: Guard check MUST be the VERY FIRST LINE
      // This prevents processing intermediate callbacks during edge recentering
      // If we update shared values first, the header briefly shows wrong data
      if (isRecenteringRef.current) return;

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

      // 2. Calculate would-be absolute index for this page
      // CRITICAL: Use absIndexRef.current (synchronously updated) instead of currentAbsoluteIndex
      // (React state, updated asynchronously). During rapid swiping, currentAbsoluteIndex may be
      // stale from the previous frame, causing the header to show the wrong chapter.
      const offset = newPosition - CENTER_INDEX;
      const newAbsoluteIndex = absIndexRef.current + offset;

      // Use circular wrapping for the new index
      const wrappedIndex = wrapCircularIndex(newAbsoluteIndex, booksMetadata);

      // Get chapter info for shared value update
      const chapter = getChapterFromPageIndex(wrappedIndex, booksMetadata);

      // 3. Update shared values SYNCHRONOUSLY (no setTimeout)
      // This happens AFTER the guard check, so it won't execute during recentering
      if (chapter) {
        setChapter(chapter.bookId, chapter.chapterNumber);
      }

      // 4. Fire Haptics INSTANTLY on the native UI thread
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 5. Check if user reached edge positions (0 or 6) - EDGE RESET
      const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

      if (isAtEdge) {
        // SEAMLESS EDGE SNAP with circular index
        // IMPORTANT: Set guard flag BEFORE calling setPageWithoutAnimation
        // This prevents intermediate callbacks from being processed
        isRecenteringRef.current = true;

        // Re-center the pager BEFORE updating state to prevent flicker.
        // If we update currentAbsoluteIndex first, the pages useMemo will recalculate
        // with the new center (e.g., 1188 for Rev 22) but pager is still at position 0,
        // causing wrong content to flash (e.g., Rev 19 instead of Rev 22).
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        setSelectedPosition(CENTER_INDEX);
        posRef.current = CENTER_INDEX;

        // Now update the absolute index - pages will recalculate correctly since
        // pager is already centered at position 3
        setForceJump(false); // ENSURE we don't reset scroll during this snap
        setCurrentAbsoluteIndex(wrappedIndex);
        absIndexRef.current = wrappedIndex;

        // Reset guard flag after recentering completes
        // Using requestAnimationFrame ensures the native animation is complete
        requestAnimationFrame(() => {
          isRecenteringRef.current = false;
        });
      }

      // 6. Schedule URL sync with delay (only affects deep-linking, not header)
      // This is the same for both edge and non-edge positions
      if (chapter) {
        routeUpdateTimeoutRef.current = setTimeout(() => {
          onPageChange(chapter.bookId, chapter.chapterNumber);
          routeUpdateTimeoutRef.current = null;
        }, ROUTE_UPDATE_DELAY_MS);
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
export const ChapterPagerView = ChapterPagerViewComponent;

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
