/**
 * TopicPagerView Component
 *
 * Wraps react-native-pager-view with a fixed 7-page sliding window.
 * Uses STABLE POSITIONAL KEYS to prevent "infinite swipe" bug.
 *
 * Architecture:
 * - Render exactly 7 pages with circular navigation at global topic boundaries
 * - Keys: ["page-0", "page-1", "page-2", ..., "page-6"] - NEVER CHANGE
 * - Center at index 3
 * - Re-center when reaching edges (index 0 or 6)
 * - Pass topic data as props that update when window shifts
 *
 * Global Circular Navigation:
 * - Topics from ALL categories (EVENT, PROPHECY, PARABLE, THEME) are combined into one sorted array
 * - Swiping backward from first topic globally shows last topic globally
 * - Swiping forward from last topic globally shows first topic globally
 * - No boundary pages - continuous reading experience through all topics
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 * @see components/bible/ChapterPagerView.tsx - Reference implementation for circular navigation
 */

import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { OnPageSelectedEventData } from 'react-native-pager-view/lib/typescript/PagerViewNativeComponent';
import type { VersePress } from '@/components/topics/TopicText';
import type { ContentTabType } from '@/types/bible';
import type { TopicListItem } from '@/types/topics';
import {
  getTopicFromIndex,
  getTopicIndexInCategory,
  wrapCircularTopicIndex,
} from '@/utils/topics/topic-index-utils';
import { TopicPage } from './TopicPage';

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
 * Imperative handle interface for TopicPagerView
 * Allows parent components to programmatically trigger page changes
 */
export interface TopicPagerViewRef {
  /** Programmatically navigate to a page index with animation */
  setPage: (pageIndex: number) => void;
  /** Navigate to the next page (relative to current position) */
  goNext: () => void;
  /** Navigate to the previous page (relative to current position) */
  goPrevious: () => void;
}

/**
 * Props for TopicPagerView component
 */
export interface TopicPagerViewProps {
  /** Initial topic ID (UUID) to display */
  initialTopicId: string;
  /** Sorted array of ALL topics globally (category order, then sort_order within category) */
  sortedTopics: TopicListItem[];
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
  /** Callback when page changes (after swipe completes) - receives topicId only (global navigation) */
  onPageChange: (topicId: string) => void;
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
  /** Callback when user wants to share current topic */
  onShare?: () => void;
  /** Callback when a verse is pressed */
  onVersePress?: (verseData: VersePress) => void;
}

/**
 * TopicPagerView Component
 *
 * Implements 7-page fixed window with stable positional keys and circular navigation.
 * Prevents "infinite swipe restarting at first topic" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing topicId as PROPS that update
 * - Re-centering at edges using setPageWithoutAnimation
 *
 * Circular navigation enables seamless reading through all topics globally:
 * - First topic backward -> Last topic globally
 * - Last topic forward -> First topic globally
 *
 * @example
 * ```tsx
 * const pagerRef = useRef<TopicPagerViewRef>(null);
 *
 * <TopicPagerView
 *   ref={pagerRef}
 *   initialTopicId="topic-uuid-003"
 *   sortedTopics={allSortedTopics}
 *   activeTab="summary"
 *   activeView="bible"
 *   onPageChange={(topicId) => {
 *     router.setParams({ topicId });
 *   }}
 * />
 *
 * // Programmatically navigate
 * pagerRef.current?.setPage(3);
 * ```
 */
const TopicPagerViewComponent = forwardRef<TopicPagerViewRef, TopicPagerViewProps>(
  function TopicPagerView(
    {
      initialTopicId,
      sortedTopics,
      activeTab,
      activeView,
      onPageChange,
      onScroll,
      onTap,
      onShare,
      onVersePress,
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);
    const routeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track current absolute index (which topic is at center)
    const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
      getTopicIndexInCategory(initialTopicId, sortedTopics)
    );

    // Track the currently selected position in the 7-page window (0-6)
    const [selectedPosition, setSelectedPosition] = useState(CENTER_INDEX);

    // Flag to tell pages NOT to reset scroll during a seamless snap
    const [forceJump, setForceJump] = useState(false);

    // Refs to track state for the useEffect without causing it to re-run on every swipe
    const absIndexRef = useRef(currentAbsoluteIndex);
    const posRef = useRef(selectedPosition);
    const lastProcessedRef = useRef({ topicId: initialTopicId });

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
          // Navigate relative to current position (not hardcoded)
          // This ensures FAB buttons work correctly after manual swipes
          const nextPos = posRef.current + 1;
          if (nextPos < WINDOW_SIZE) {
            pagerRef.current?.setPage(nextPos);
          }
        },
        goPrevious: () => {
          // Navigate relative to current position (not hardcoded)
          // This ensures FAB buttons work correctly after manual swipes
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

    // Update absolute index if initialTopicId changes externally (modal, back button, etc.)
    useEffect(() => {
      // If we have a pending route update, it means WE initiated a change that hasn't propagated yet.
      // Ignoring prop updates during this window prevents "Snap Back" where the parent
      // forces us back to the old topic before processing our request.
      if (routeUpdateTimeoutRef.current !== null) {
        return;
      }

      // Only act if the props actually changed from what we last processed
      if (lastProcessedRef.current.topicId === initialTopicId) {
        return;
      }
      lastProcessedRef.current = { topicId: initialTopicId };

      const newIndex = getTopicIndexInCategory(initialTopicId, sortedTopics);
      if (newIndex === -1) return;

      // Calculate what absolute index is currently visible at the current pager position
      // Use circular wrapping to handle negative indices
      const rawVisibleIndex = absIndexRef.current + (posRef.current - CENTER_INDEX);
      const currentlyVisibleIndex = wrapCircularTopicIndex(rawVisibleIndex, sortedTopics);

      // Only re-center if the new index is DIFFERENT from what the user is already looking at.
      // With circular wrapping, this comparison now works correctly for wrapped indices.
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
    }, [initialTopicId, sortedTopics]);

    /**
     * Calculate which topic should display at a given window position
     *
     * Uses circular wrapping at topic boundaries:
     * - Negative indices wrap to end of topics (last THEME topics)
     * - Indices beyond max wrap to start of topics (first EVENT topics)
     * This enables seamless circular navigation through all topics globally.
     */
    const getTopicForPosition = (windowPosition: number): TopicListItem | null => {
      const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

      // Use circular wrapping for out-of-bounds indices
      const wrappedIndex = wrapCircularTopicIndex(absoluteIndex, sortedTopics);

      // Return null if sortedTopics is invalid (wrapCircularTopicIndex returns -1)
      if (wrappedIndex === -1) {
        return null;
      }

      return getTopicFromIndex(wrappedIndex, sortedTopics);
    };

    /**
     * Generate exactly 7 pages with STABLE POSITIONAL KEYS
     *
     * Keys never change - they're based on window position (0-6), not content.
     * Topic data is passed as props that update when window shifts.
     * All pages render actual topic content - no boundary pages for topic navigation.
     */
    const pages = useMemo(() => {
      // Handle case when topics not loaded yet
      if (!sortedTopics || sortedTopics.length === 0) {
        // Return placeholder pages with initial topic
        return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => (
          <TopicPage
            // biome-ignore lint/suspicious/noArrayIndexKey: Stable positional keys are required for fixed-window pager
            key={`page-${windowPosition}`}
            topicId={initialTopicId}
            activeTab={activeTab}
            activeView={activeView}
            onScroll={onScroll}
            onTap={onTap}
            onShare={onShare}
            onVersePress={onVersePress}
          />
        ));
      }

      return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => {
        const topic = getTopicForPosition(windowPosition);

        // With circular navigation, topic should always be valid when sortedTopics exists
        // This fallback is just for safety in case of unexpected state
        if (!topic) {
          return (
            <TopicPage
              // biome-ignore lint/suspicious/noArrayIndexKey: Stable positional keys are required for fixed-window pager
              key={`page-${windowPosition}`}
              topicId={initialTopicId}
              activeTab={activeTab}
              activeView={activeView}
              onScroll={onScroll}
              onTap={onTap}
              onShare={onShare}
              onVersePress={onVersePress}
            />
          );
        }

        // isPreloading should only be true for pages that are far away from the user's view.
        // We allow the current page AND its immediate neighbors (distance <= 1) to render
        // their content so that swiping between them is visually seamless.
        const isPreloading = Math.abs(windowPosition - selectedPosition) > 1;

        return (
          <TopicPage
            // biome-ignore lint/suspicious/noArrayIndexKey: Stable positional keys are required for fixed-window pager
            key={`page-${windowPosition}`}
            topicId={topic.topic_id}
            activeTab={activeTab}
            activeView={activeView}
            shouldResetScroll={forceJump}
            isPreloading={isPreloading}
            onScroll={onScroll}
            onTap={onTap}
            onShare={onShare}
            onVersePress={onVersePress}
          />
        );
      });
    }, [
      activeTab,
      activeView,
      sortedTopics,
      // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
      getTopicForPosition,
      initialTopicId,
      onScroll,
      onTap,
      onShare,
      onVersePress,
      forceJump,
      selectedPosition,
    ]);

    /**
     * Handle page selection events
     *
     * SEAMLESS RESET STRATEGY:
     * To prevent the "every other swipe is laggy" bug, we re-center the pager
     * to the middle index (3) after reaching edge positions.
     *
     * With circular navigation, there are no out-of-bounds positions - all
     * indices wrap to valid topics. The edge reset logic re-centers the
     * window while maintaining seamless content continuity.
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
      const wrappedIndex = wrapCircularTopicIndex(newAbsoluteIndex, sortedTopics);

      // Check if user reached edge positions (0 or 6) - EDGE RESET
      const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

      // Fire Haptics INSTANTLY on the native UI thread
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isAtEdge) {
        // SEAMLESS EDGE SNAP with circular index
        // IMPORTANT: Re-center the pager BEFORE updating state to prevent flicker.
        // If we update currentAbsoluteIndex first, the pages useMemo will recalculate
        // with the new center but pager is still at position 0,
        // causing wrong content to flash.
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
        setSelectedPosition(CENTER_INDEX);
        posRef.current = CENTER_INDEX;

        // Now update the absolute index - pages will recalculate correctly since
        // pager is already centered at position 3
        setForceJump(false); // ENSURE we don't reset scroll during this snap
        setCurrentAbsoluteIndex(wrappedIndex);
        absIndexRef.current = wrappedIndex;

        const topic = getTopicFromIndex(wrappedIndex, sortedTopics);
        if (topic) {
          routeUpdateTimeoutRef.current = setTimeout(() => {
            onPageChange(topic.topic_id);
            routeUpdateTimeoutRef.current = null;
          }, ROUTE_UPDATE_DELAY_MS);
        }
      } else {
        // Non-edge position - use wrapped index for navigation
        const topic = getTopicFromIndex(wrappedIndex, sortedTopics);
        if (topic) {
          routeUpdateTimeoutRef.current = setTimeout(() => {
            onPageChange(topic.topic_id);
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
        testID="topic-pager-view"
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
 * Supports global circular navigation - swiping past topic boundaries
 * wraps around seamlessly to the other end across all categories.
 */
export const TopicPagerView = TopicPagerViewComponent;

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
