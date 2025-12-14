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

import {
  forwardRef,
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
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory, TopicListItem } from '@/types/topics';
import { getTopicFromIndex, getTopicIndexInCategory } from '@/utils/topics/topic-index-utils';
import { TopicPage } from './TopicPage';

/**
 * Constants for 5-page fixed window
 */
const WINDOW_SIZE = 5;
const CENTER_INDEX = 2;

/**
 * Delay in milliseconds before calling onPageChange after swipe
 * This prevents double animation (PagerView + router.replace)
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
export const TopicPagerView = forwardRef<TopicPagerViewRef, TopicPagerViewProps>(
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
    },
    ref
  ) {
    const pagerRef = useRef<PagerView>(null);
    const routeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track current absolute index (which topic is at center)
    const [currentAbsoluteIndex, setCurrentAbsoluteIndex] = useState(() =>
      getTopicIndexInCategory(initialTopicId, sortedTopics)
    );

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

    // Update absolute index if initialTopicId changes externally
    // Note: Intentionally excludes currentAbsoluteIndex from deps to prevent race condition
    // when swipe updates state before route updates (75ms delay)
    useEffect(() => {
      const newIndex = getTopicIndexInCategory(initialTopicId, sortedTopics);
      if (newIndex !== -1 && newIndex !== currentAbsoluteIndex) {
        setCurrentAbsoluteIndex(newIndex);
        // Also update pager position for external navigation (e.g., from modal)
        pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
      }
    }, [initialTopicId, sortedTopics, currentAbsoluteIndex]);

    /**
     * Calculate which topic should display at a given window position
     *
     * Returns null for out-of-bounds positions instead of clamping.
     * This allows us to render empty placeholders at boundaries and
     * detect when user swipes past the edge.
     */
    const getTopicForPosition = useCallback(
      (windowPosition: number): TopicListItem | null => {
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        // Return null for out-of-bounds - don't clamp to boundaries
        // This prevents showing duplicate content when at first/last topic
        if (absoluteIndex < 0 || absoluteIndex >= sortedTopics.length) {
          return null;
        }

        return getTopicFromIndex(absoluteIndex, sortedTopics);
      },
      [currentAbsoluteIndex, sortedTopics]
    );

    /**
     * Generate exactly 5 pages with STABLE POSITIONAL KEYS
     *
     * Keys never change - they're based on window position (0-4), not content.
     * Topic data is passed as props that update when window shifts.
     */
    const pages = useMemo(() => {
      // Handle case when topics not loaded yet
      if (!sortedTopics || sortedTopics.length === 0) {
        // Return placeholder pages with first topic (or fallback)
        return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => (
          <TopicPage
            key={`page-${windowPosition}`}
            topicId={initialTopicId}
            category={category}
            activeTab={activeTab}
            activeView={activeView}
            onScroll={onScroll}
            onTap={onTap}
            onShare={onShare}
          />
        ));
      }

      return Array.from({ length: WINDOW_SIZE }, (_, windowPosition) => {
        const topic = getTopicForPosition(windowPosition);
        const absoluteIndex = currentAbsoluteIndex + (windowPosition - CENTER_INDEX);

        // Render boundary indicator for out-of-bounds pages
        // This shows a helpful message instead of duplicate content at category boundaries
        if (!topic) {
          const direction = absoluteIndex < 0 ? 'start' : 'end';
          return (
            <SwipeBoundaryPage
              key={`page-${windowPosition}`}
              direction={direction}
              contentType="topic"
              testID={`topic-page-boundary-${windowPosition}`}
            />
          );
        }

        return (
          <TopicPage
            key={`page-${windowPosition}`} // STABLE KEY: never changes
            topicId={topic.topic_id} // DYNAMIC PROP: updates when window shifts
            category={(topic.category as TopicCategory) || category} // DYNAMIC PROP: updates when window shifts
            activeTab={activeTab}
            activeView={activeView}
            onScroll={onScroll}
            onTap={onTap}
            onShare={onShare}
          />
        );
      });
    }, [
      activeTab,
      activeView,
      category,
      currentAbsoluteIndex,
      getTopicForPosition,
      initialTopicId,
      onScroll,
      onTap,
      sortedTopics,
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
        const selectedPosition = Math.floor(event.nativeEvent.position);

        // Clear any pending route update timeout
        if (routeUpdateTimeoutRef.current) {
          clearTimeout(routeUpdateTimeoutRef.current);
        }

        // Calculate would-be absolute index for this page
        const offset = selectedPosition - CENTER_INDEX;
        const newAbsoluteIndex = currentAbsoluteIndex + offset;

        // Check if swipe would go out of bounds (to an empty placeholder page)
        const isOutOfBounds = newAbsoluteIndex < 0 || newAbsoluteIndex >= sortedTopics.length;

        if (isOutOfBounds) {
          // Snap back to center - user tried to swipe past category boundary
          requestAnimationFrame(() => {
            pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
          });
          // Don't update route or state - stay on current topic
          return;
        }

        // Check if user reached edge positions (0 or 4)
        const isAtEdge = selectedPosition === 0 || selectedPosition === WINDOW_SIZE - 1;

        if (isAtEdge) {
          // Update state to new absolute index
          setCurrentAbsoluteIndex(newAbsoluteIndex);

          // Re-center to middle page without animation
          requestAnimationFrame(() => {
            pagerRef.current?.setPageWithoutAnimation(CENTER_INDEX);
          });

          // Delay route update by 75ms to prevent double animation
          const topic = getTopicFromIndex(newAbsoluteIndex, sortedTopics);

          if (topic) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(topic.topic_id, category);
            }, ROUTE_UPDATE_DELAY_MS);
          }
        } else if (selectedPosition !== CENTER_INDEX) {
          // User swiped one position away from center (to index 1 or 3)
          // DON'T update currentAbsoluteIndex yet to avoid flickering
          // Let the route update trigger useEffect which will re-center properly

          // Delay route update by 75ms to prevent double animation
          const topic = getTopicFromIndex(newAbsoluteIndex, sortedTopics);

          if (topic) {
            routeUpdateTimeoutRef.current = setTimeout(() => {
              onPageChange(topic.topic_id, category);
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

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
