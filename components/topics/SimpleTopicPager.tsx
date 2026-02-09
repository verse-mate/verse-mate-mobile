/**
 * SimpleTopicPager Component
 *
 * A simplified 3-page pager for topic navigation (V3 architecture).
 * Replaces the 7-page TopicPagerView with a cleaner, more reliable approach.
 *
 * Architecture:
 * - 3-page window: [previous, current, next]
 * - Stable positional keys: ["page-prev", "page-current", "page-next"]
 * - Initial page is always index 1 (center/current)
 * - No recentering logic - parent component updates props on navigation
 * - Parent uses `key` prop to force remount when center topic changes
 *
 * Circular Navigation (Topics):
 * - First topic: Page 0 shows the last topic (wraps around)
 * - Last topic: Page 2 shows the first topic (wraps around)
 * - All 3 pages always render content (no boundary pages for topics)
 *
 * Navigation Flow:
 * 1. User swipes to page 0 or page 2
 * 2. onPageSelected fires with new position
 * 3. onTopicChange(newTopicId) is called
 * 4. Parent updates state, which changes props to this component
 * 5. Parent's key prop changes, causing full remount with new center
 *
 * @example
 * ```tsx
 * function TopicScreen() {
 *   const [activeTopicId, setActiveTopicId] = useState(topicId);
 *   const { data: allTopics } = useAllTopics();
 *
 *   return (
 *     <SimpleTopicPager
 *       key={activeTopicId} // Forces remount on navigation
 *       topicId={activeTopicId}
 *       sortedTopics={allTopics}
 *       onTopicChange={setActiveTopicId}
 *       renderTopicPage={(tid) => <TopicPage topicId={tid} />}
 *     />
 *   );
 * }
 * ```
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 * @see components/bible/SimpleChapterPager.tsx - Reference implementation (linear navigation)
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { TopicListItem } from '@/types/topics';
import {
  getTopicFromIndex,
  getTopicIndexInCategory,
  wrapCircularTopicIndex,
} from '@/utils/topics/topic-index-utils';

/**
 * Props for SimpleTopicPager component
 */
export interface SimpleTopicPagerProps {
  /** Current topic ID (UUID) */
  topicId: string;
  /** Sorted array of ALL topics globally (category order, then sort_order within category) */
  sortedTopics: TopicListItem[] | undefined | null;
  /** Callback when user navigates to a different topic */
  onTopicChange: (topicId: string) => void;
  /** Render function for topic content */
  renderTopicPage: (topicId: string) => React.ReactNode;
}

/**
 * Page position constants
 * Topics always have 3 pages (circular navigation, no boundaries)
 */
const PAGE_PREV = 0;
const PAGE_CURRENT = 1;
const PAGE_NEXT = 2;

/**
 * SimpleTopicPager Component
 *
 * Renders a 3-page PagerView with previous, current, and next topics.
 * Uses circular navigation: all 3 pages always render content.
 */
export function SimpleTopicPager({
  topicId,
  sortedTopics,
  onTopicChange,
  renderTopicPage,
}: SimpleTopicPagerProps) {
  // Find current topic index in the sorted array
  const currentIndex = useMemo(
    () => getTopicIndexInCategory(topicId, sortedTopics),
    [topicId, sortedTopics]
  );

  // Calculate previous and next topic IDs using circular wrapping
  const { prevTopicId, nextTopicId } = useMemo(() => {
    if (!sortedTopics || sortedTopics.length === 0 || currentIndex === -1) {
      return { prevTopicId: null, nextTopicId: null };
    }

    const prevIndex = wrapCircularTopicIndex(currentIndex - 1, sortedTopics);
    const nextIndex = wrapCircularTopicIndex(currentIndex + 1, sortedTopics);

    const prevTopic = getTopicFromIndex(prevIndex, sortedTopics);
    const nextTopic = getTopicFromIndex(nextIndex, sortedTopics);

    return {
      prevTopicId: prevTopic?.topic_id ?? null,
      nextTopicId: nextTopic?.topic_id ?? null,
    };
  }, [currentIndex, sortedTopics]);

  /**
   * Handle page selection
   *
   * Called when user finishes swiping to a new page.
   * With circular navigation, both prev and next always exist.
   */
  const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
    const newPosition = event.nativeEvent.position;

    if (newPosition === PAGE_PREV && prevTopicId) {
      onTopicChange(prevTopicId);
    } else if (newPosition === PAGE_NEXT && nextTopicId) {
      onTopicChange(nextTopicId);
    }
    // PAGE_CURRENT (1) - no navigation needed, user is on current page
  };

  /**
   * Build 3 pages: [previous, current, next]
   *
   * With circular navigation, all 3 pages always render topic content.
   * No boundary pages needed for topics.
   */
  const pages = useMemo(() => {
    // Handle case when topics not loaded or current topic not found
    if (!sortedTopics || sortedTopics.length === 0 || currentIndex === -1) {
      return [
        <View key="page-current" style={styles.page}>
          {renderTopicPage(topicId)}
        </View>,
      ];
    }

    // For a single topic, only render the current page
    if (sortedTopics.length === 1) {
      return [
        <View key="page-current" style={styles.page}>
          {renderTopicPage(topicId)}
        </View>,
      ];
    }

    const result: React.ReactNode[] = [];

    // Previous page (circular: always exists when >1 topics)
    if (prevTopicId) {
      result.push(
        <View key="page-prev" style={styles.page}>
          {renderTopicPage(prevTopicId)}
        </View>
      );
    }

    // Current page (always exists)
    result.push(
      <View key="page-current" style={styles.page}>
        {renderTopicPage(topicId)}
      </View>
    );

    // Next page (circular: always exists when >1 topics)
    if (nextTopicId) {
      result.push(
        <View key="page-next" style={styles.page}>
          {renderTopicPage(nextTopicId)}
        </View>
      );
    }

    return result;
  }, [topicId, currentIndex, prevTopicId, nextTopicId, sortedTopics, renderTopicPage]);

  /**
   * Calculate initial page index
   * - Single topic or loading: 0 (only one page)
   * - Multiple topics: 1 (center of [prev, current, next])
   */
  const initialPageIndex =
    !sortedTopics || sortedTopics.length <= 1 || currentIndex === -1 ? 0 : PAGE_CURRENT;

  return (
    <PagerView
      style={styles.pagerView}
      initialPage={initialPageIndex}
      onPageSelected={handlePageSelected}
      testID="simple-topic-pager"
      offscreenPageLimit={1}
    >
      {pages}
    </PagerView>
  );
}

/**
 * Styles for SimpleTopicPager
 */
const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
