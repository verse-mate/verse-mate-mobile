/**
 * TopicPagerView Component
 *
 * Wraps react-native-pager-view with a fixed 5-page sliding window.
 * Uses STABLE POSITIONAL KEYS to prevent "infinite swipe" bug.
 *
 * Architecture:
 * - Render exactly 5 pages: [prev-1, prev, current, next, next+1]
 * - Keys: ["page-0", "page-1", "page-2", "page-3", "page-4"] - NEVER CHANGE
 * - Center at index 2
 * - Re-center only when reaching edges (index 0 or 4)
 * - Pass topic data as props that update when window shifts
 *
 * Unlike Bible chapters which use cumulative indices across all books,
 * topics are scoped to a single category and use simple array positions.
 *
 * @see Spec: agent-os/specs/2025-12-08-topic-swipe-navigation/spec.md
 * @see components/bible/ChapterPagerView.tsx - Reference implementation
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
import type { VersePress } from '@/components/topics/TopicText';
import { SwipeBoundaryPage } from '@/components/ui/SwipeBoundaryPage';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';
import { getTopicFromIndex, getTopicIndexInCategory } from '@/utils/topics/topic-index-utils';
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
}

/**
 * Props for TopicPagerView component
 */
export interface TopicPagerViewProps {
  /** Initial topic ID (UUID) to display */
  initialTopicId: string;
  /** Topic category (navigation is scoped to single category) */
  category: TopicCategory;
  /** Sorted array of topics in the category */
  sortedTopics: TopicListItem[];
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
  /** Callback when page changes (after swipe completes) */
  onPageChange: (topicId: string, category: TopicCategory) => void;
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
 * Implements 5-page fixed window with stable positional keys.
 * Prevents "infinite swipe restarting at first topic" bug by:
 * - Using stable keys based on window POSITION, not content
 * - Passing topicId as PROPS that update
 * - Re-centering only at edges using setPageWithoutAnimation
 *
 * @example
 * ```tsx
 * const pagerRef = useRef<TopicPagerViewRef>(null);
 *
 * <TopicPagerView
 *   ref={pagerRef}
 *   initialTopicId="topic-uuid-003"
 *   category="EVENT"
 *   sortedTopics={sortedTopics}
 *   activeTab="summary"
 *   activeView="bible"
 *   onPageChange={(topicId, category) => {
 *     router.replace(`/topics/${topicId}?category=${category}`);
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
      category,
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

    // Update absolute index if initialTopicId changes externally (modal, back button, etc.)
    useEffect(() => {
      if (routeUpdateTimeoutRef.current !== null) return;

      if (lastProcessedRef.current.topicId === initialTopicId) {
        return;
      }
      lastProcessedRef.current = { topicId: initialTopicId };

      const newIndex = getTopicIndexInCategory(initialTopicId, sortedTopics);
      if (newIndex === -1) return;

      const currentlyVisibleIndex = absIndexRef.current + (posRef.current - CENTER_INDEX);

      // JUMP DETECTED (e.g. from Modal)
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
     */
    const getTopicForPosition = useCallback(
      (windowPosition: number): TopicListItem | null => {
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        if (absoluteIndex < 0 || absoluteIndex >= sortedTopics.length) {
          return null;
        }

        return getTopicFromIndex(absoluteIndex, sortedTopics);
      },
      [currentAbsoluteIndex, sortedTopics]
    );

    /**
     * Generate exactly 7 pages with STABLE POSITIONAL KEYS
     */
    const pages = useMemo(() => {
      if (!sortedTopics || sortedTopics.length === 0) {
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
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        if (!topic) {
          const direction = absoluteIndex < 0 ? 'start' : 'end';
          return (
            <SwipeBoundaryPage
              // biome-ignore lint/suspicious/noArrayIndexKey: Stable positional keys are required for fixed-window pager
              key={`page-${windowPosition}`}
              direction={direction}
              contentType="topic"
              testID={`topic-page-boundary-${windowPosition}`}
            />
          );
        }

        const isPreloading = windowPosition !== selectedPosition;

        return (
          <TopicPage
            // biome-ignore lint/suspicious/noArrayIndexKey: Stable positional keys are required for fixed-window pager
            key={`page-${windowPosition}`}
            topicId={topic.topic_id}
            activeTab={activeTab}
            activeView={activeView}
            shouldResetScroll={forceJump} // ONLY reset scroll if this is a forced jump
            isPreloading={isPreloading} // Optimize off-screen pages
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
      currentAbsoluteIndex,
      getTopicForPosition,
      initialTopicId,
      onScroll,
      onTap,
      sortedTopics,
      onShare,
      onVersePress,
      forceJump,
      selectedPosition, // Added dependency
    ]);

    /**
     * Handle page selection events
     *
     * Re-centering strategy:
     * 1. Initial: Topic 3 at index 2: [1, 2, 3, 4, 5]
     * 2. Swipe right once: Position 3 (Topic 4) - NO re-center, just update absolute index
     * 3. Swipe right again: Position 4 (Topic 5 - EDGE!) - Re-center to index 2
     * 4. Result: [3, 4, 5, 6, 7] - User can continue swiping
     *
     * User can swipe once without jarring re-center. Re-center only at edges.
     *
     * IMPORTANT: Adds 75ms delay before calling onPageChange to prevent double animation.
     * PagerView handles the visual animation, router.replace() should only update URL silently.
     *
     * BOUNDARY HANDLING: When user swipes to an out-of-bounds page (empty placeholder),
     * snap back to center immediately. This prevents navigation past category boundaries.
     */
    const handlePageSelected = useCallback(
      (event: { nativeEvent: OnPageSelectedEventData }) => {
        const newPosition = Math.floor(event.nativeEvent.position);
        if (newPosition === posRef.current) return;

        // SYNC REFS IMMEDIATELY
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
        const isOutOfBounds = newAbsoluteIndex < 0 || newAbsoluteIndex >= sortedTopics.length;

        if (isOutOfBounds) {
          requestAnimationFrame(() => {
            pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
            setSelectedPosition(CENTER_INDEX);
            posRef.current = CENTER_INDEX;
          });
          return;
        }

        // Fire Haptics INSTANTLY
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Check if user reached edge positions (0 or 6) - EDGE RESET
        const isAtEdge = newPosition === 0 || newPosition === WINDOW_SIZE - 1;

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

          const topic = getTopicFromIndex(newAbsoluteIndex, sortedTopics);
          if (topic) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(topic.topic_id, category);
              routeUpdateTimeoutRef.current = null;
            }, ROUTE_UPDATE_DELAY_MS);
          }
        } else {
          // Normal swipe (1, 2, 4, 5) - Stay there, update parent
          const topic = getTopicFromIndex(newAbsoluteIndex, sortedTopics);
          if (topic) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(topic.topic_id, category);
              routeUpdateTimeoutRef.current = null;
            }, ROUTE_UPDATE_DELAY_MS);
          }
        }
      },
      [currentAbsoluteIndex, sortedTopics, category, onPageChange]
    );

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
 */
export const TopicPagerView = memo(TopicPagerViewComponent);

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
