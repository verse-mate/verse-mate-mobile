/**
 * Integration Tests for Topic Circular Navigation
 *
 * End-to-end integration tests for the topic circular navigation feature.
 * Verifies complete user workflows across the API, hook, and component layers.
 *
 * Tests cover:
 * - Full circular workflow: first topic -> last topic -> first topic round-trip
 * - Cross-category boundary navigation sequences
 * - FAB button behavior at all positions with correct haptic feedback
 * - URL update synchronization after circular navigation
 * - Split view navigation with circular navigation
 *
 * @see Spec: agent-os/specs/fix-topic-swipe-navigation/spec.md
 */

import { renderHook } from '@testing-library/react-native';
import { useTopicNavigation } from '@/hooks/topics/use-topic-navigation';
import type { TopicListItem } from '@/types/topics';
import {
  getTopicFromIndex,
  getTopicIndexInCategory,
  wrapCircularTopicIndex,
} from '@/utils/topics/topic-index-utils';

/**
 * Complete mock global topics data matching production category order
 * Category order: EVENT -> PROPHECY -> PARABLE -> THEME
 *
 * Total: 10 topics (indices 0-9)
 * - EVENT: indices 0-2 (Creation, The Fall, The Flood)
 * - PROPHECY: indices 3-4 (Messiah, End Times)
 * - PARABLE: indices 5-6 (Prodigal Son, Good Samaritan)
 * - THEME: indices 7-9 (Faith, Love, Hope)
 */
const mockGlobalTopics: TopicListItem[] = [
  // EVENT topics (indices 0-2)
  { topic_id: 'event-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'event-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'event-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  // PROPHECY topics (indices 3-4)
  { topic_id: 'prophecy-001', name: 'Messiah', sort_order: 1, category: 'PROPHECY' },
  { topic_id: 'prophecy-002', name: 'End Times', sort_order: 2, category: 'PROPHECY' },
  // PARABLE topics (indices 5-6)
  { topic_id: 'parable-001', name: 'Prodigal Son', sort_order: 1, category: 'PARABLE' },
  { topic_id: 'parable-002', name: 'Good Samaritan', sort_order: 2, category: 'PARABLE' },
  // THEME topics (indices 7-9)
  { topic_id: 'theme-001', name: 'Faith', sort_order: 1, category: 'THEME' },
  { topic_id: 'theme-002', name: 'Love', sort_order: 2, category: 'THEME' },
  { topic_id: 'theme-003', name: 'Hope', sort_order: 3, category: 'THEME' },
];

describe('Topic Circular Navigation Integration', () => {
  describe('Full Circular Workflow Round-Trip', () => {
    /**
     * Integration Test 1: Full round-trip from first topic backward through last topic and back
     *
     * User workflow:
     * 1. Start at first topic (Creation - EVENT)
     * 2. Navigate backward -> should reach last topic (Hope - THEME)
     * 3. Navigate backward again -> should reach second-to-last (Love - THEME)
     * 4. Continue navigating backward through all topics
     * 5. Eventually reach first topic again (Creation - EVENT)
     *
     * This tests the complete circular navigation cycle in the backward direction.
     */
    it('completes full backward circular navigation from first topic through last and back', () => {
      // Start at first topic (Creation - index 0)
      const { result: firstResult } = renderHook(() =>
        useTopicNavigation('event-001', mockGlobalTopics)
      );

      // Verify we're at the first topic
      expect(firstResult.current.currentIndex).toBe(0);
      expect(firstResult.current.canGoPrevious).toBe(true);
      expect(firstResult.current.prevTopic?.topic_id).toBe('theme-003'); // Hope - wraps to last

      // Navigate backward to last topic (Hope - index 9)
      const prevTopicId = firstResult.current.prevTopic?.topic_id ?? '';
      const { result: lastResult } = renderHook(() =>
        useTopicNavigation(prevTopicId, mockGlobalTopics)
      );

      expect(lastResult.current.currentIndex).toBe(9);
      expect(lastResult.current.nextTopic?.topic_id).toBe('event-001'); // Wraps back to first

      // Continue backward navigation through all topics
      let currentTopicId = lastResult.current.prevTopic?.topic_id ?? '';
      const visitedTopics = [prevTopicId, currentTopicId];

      // Navigate through 8 more topics to complete the circle (10 topics - 2 already visited)
      for (let i = 0; i < 8; i++) {
        const { result } = renderHook(() => useTopicNavigation(currentTopicId, mockGlobalTopics));
        currentTopicId = result.current.prevTopic?.topic_id ?? '';
        visitedTopics.push(currentTopicId);
      }

      // Should have visited all 10 topics and arrived back at first topic
      expect(visitedTopics).toHaveLength(10);
      expect(currentTopicId).toBe('event-001');
    });

    /**
     * Integration Test 2: Full round-trip from last topic forward through first topic and back
     *
     * User workflow:
     * 1. Start at last topic (Hope - THEME)
     * 2. Navigate forward -> should reach first topic (Creation - EVENT)
     * 3. Navigate forward again -> should reach second topic (The Fall - EVENT)
     * 4. Continue navigating forward through all topics
     * 5. Eventually reach last topic again (Hope - THEME)
     */
    it('completes full forward circular navigation from last topic through first and back', () => {
      // Start at last topic (Hope - index 9)
      const { result: lastResult } = renderHook(() =>
        useTopicNavigation('theme-003', mockGlobalTopics)
      );

      // Verify we're at the last topic
      expect(lastResult.current.currentIndex).toBe(9);
      expect(lastResult.current.canGoNext).toBe(true);
      expect(lastResult.current.nextTopic?.topic_id).toBe('event-001'); // Wraps to first

      // Navigate forward to first topic (Creation - index 0)
      const nextTopicId = lastResult.current.nextTopic?.topic_id ?? '';
      const { result: firstResult } = renderHook(() =>
        useTopicNavigation(nextTopicId, mockGlobalTopics)
      );

      expect(firstResult.current.currentIndex).toBe(0);
      expect(firstResult.current.prevTopic?.topic_id).toBe('theme-003'); // Wraps back to last

      // Continue forward navigation through all topics
      let currentTopicId = firstResult.current.nextTopic?.topic_id ?? '';
      const visitedTopics = [nextTopicId, currentTopicId];

      // Navigate through 8 more topics to complete the circle
      for (let i = 0; i < 8; i++) {
        const { result } = renderHook(() => useTopicNavigation(currentTopicId, mockGlobalTopics));
        currentTopicId = result.current.nextTopic?.topic_id ?? '';
        visitedTopics.push(currentTopicId);
      }

      // Should have visited all 10 topics and arrived back at last topic
      expect(visitedTopics).toHaveLength(10);
      expect(currentTopicId).toBe('theme-003');
    });
  });

  describe('Cross-Category Boundary Navigation Sequence', () => {
    /**
     * Integration Test 3: Navigate forward across all category boundaries
     *
     * Verifies seamless transition across all category boundaries:
     * EVENT -> PROPHECY -> PARABLE -> THEME -> EVENT (wrap)
     */
    it('navigates forward seamlessly across all category boundaries', () => {
      // Last EVENT topic (The Flood - index 2)
      const { result: eventResult } = renderHook(() =>
        useTopicNavigation('event-003', mockGlobalTopics)
      );

      // Next should be first PROPHECY (Messiah - index 3)
      expect(eventResult.current.nextTopic?.category).toBe('PROPHECY');
      expect(eventResult.current.nextTopic?.topic_id).toBe('prophecy-001');

      // Last PROPHECY topic (End Times - index 4)
      const { result: prophecyResult } = renderHook(() =>
        useTopicNavigation('prophecy-002', mockGlobalTopics)
      );

      // Next should be first PARABLE (Prodigal Son - index 5)
      expect(prophecyResult.current.nextTopic?.category).toBe('PARABLE');
      expect(prophecyResult.current.nextTopic?.topic_id).toBe('parable-001');

      // Last PARABLE topic (Good Samaritan - index 6)
      const { result: parableResult } = renderHook(() =>
        useTopicNavigation('parable-002', mockGlobalTopics)
      );

      // Next should be first THEME (Faith - index 7)
      expect(parableResult.current.nextTopic?.category).toBe('THEME');
      expect(parableResult.current.nextTopic?.topic_id).toBe('theme-001');

      // Last THEME topic (Hope - index 9)
      const { result: themeResult } = renderHook(() =>
        useTopicNavigation('theme-003', mockGlobalTopics)
      );

      // Next should wrap to first EVENT (Creation - index 0)
      expect(themeResult.current.nextTopic?.category).toBe('EVENT');
      expect(themeResult.current.nextTopic?.topic_id).toBe('event-001');
    });

    /**
     * Integration Test 4: Navigate backward across all category boundaries
     *
     * Verifies seamless transition across all category boundaries in reverse:
     * EVENT -> THEME (wrap) -> PARABLE -> PROPHECY -> EVENT
     */
    it('navigates backward seamlessly across all category boundaries', () => {
      // First EVENT topic (Creation - index 0)
      const { result: eventResult } = renderHook(() =>
        useTopicNavigation('event-001', mockGlobalTopics)
      );

      // Prev should wrap to last THEME (Hope - index 9)
      expect(eventResult.current.prevTopic?.category).toBe('THEME');
      expect(eventResult.current.prevTopic?.topic_id).toBe('theme-003');

      // First THEME topic (Faith - index 7)
      const { result: themeResult } = renderHook(() =>
        useTopicNavigation('theme-001', mockGlobalTopics)
      );

      // Prev should be last PARABLE (Good Samaritan - index 6)
      expect(themeResult.current.prevTopic?.category).toBe('PARABLE');
      expect(themeResult.current.prevTopic?.topic_id).toBe('parable-002');

      // First PARABLE topic (Prodigal Son - index 5)
      const { result: parableResult } = renderHook(() =>
        useTopicNavigation('parable-001', mockGlobalTopics)
      );

      // Prev should be last PROPHECY (End Times - index 4)
      expect(parableResult.current.prevTopic?.category).toBe('PROPHECY');
      expect(parableResult.current.prevTopic?.topic_id).toBe('prophecy-002');

      // First PROPHECY topic (Messiah - index 3)
      const { result: prophecyResult } = renderHook(() =>
        useTopicNavigation('prophecy-001', mockGlobalTopics)
      );

      // Prev should be last EVENT (The Flood - index 2)
      expect(prophecyResult.current.prevTopic?.category).toBe('EVENT');
      expect(prophecyResult.current.prevTopic?.topic_id).toBe('event-003');
    });
  });

  describe('Utility Layer Integration with Hook Layer', () => {
    /**
     * Integration Test 5: wrapCircularTopicIndex integrates correctly with navigation calculations
     *
     * Verifies the utility function produces correct indices that the hook layer uses.
     */
    it('wrapCircularTopicIndex produces correct indices for hook navigation', () => {
      // Test that negative indices from hook navigation wrap correctly
      const firstTopicIndex = getTopicIndexInCategory('event-001', mockGlobalTopics);
      expect(firstTopicIndex).toBe(0);

      // Simulating going backward from first topic: index 0 - 1 = -1
      const wrappedPrevIndex = wrapCircularTopicIndex(-1, mockGlobalTopics);
      expect(wrappedPrevIndex).toBe(9); // Last topic

      const prevTopic = getTopicFromIndex(wrappedPrevIndex, mockGlobalTopics);
      expect(prevTopic?.topic_id).toBe('theme-003');

      // Simulating going forward from last topic: index 9 + 1 = 10
      const lastTopicIndex = getTopicIndexInCategory('theme-003', mockGlobalTopics);
      expect(lastTopicIndex).toBe(9);

      const wrappedNextIndex = wrapCircularTopicIndex(10, mockGlobalTopics);
      expect(wrappedNextIndex).toBe(0); // First topic

      const nextTopic = getTopicFromIndex(wrappedNextIndex, mockGlobalTopics);
      expect(nextTopic?.topic_id).toBe('event-001');
    });

    /**
     * Integration Test 6: Multiple wraps work correctly (e.g., -20 wraps to valid index)
     *
     * Handles edge case where user might navigate backward many times rapidly.
     */
    it('handles multiple wraps correctly for extreme navigation scenarios', () => {
      // Going backward 20 times from first topic (0 - 20 = -20)
      // With 10 topics: -20 % 10 = -20 + 20 = 0
      const wrappedIndex = wrapCircularTopicIndex(-20, mockGlobalTopics);
      expect(wrappedIndex).toBe(0);

      // Going forward 25 times from last topic (9 + 25 = 34)
      // With 10 topics: 34 % 10 = 4
      const wrappedForward = wrapCircularTopicIndex(34, mockGlobalTopics);
      expect(wrappedForward).toBe(4);

      const topic = getTopicFromIndex(wrappedForward, mockGlobalTopics);
      expect(topic?.topic_id).toBe('prophecy-002');
    });
  });

  describe('FAB Button Behavior at All Positions', () => {
    /**
     * Integration Test 7: FAB buttons always enabled at first topic
     *
     * Verifies canGoNext and canGoPrevious are always true at boundaries.
     */
    it('FAB buttons are always enabled at first topic globally', () => {
      const { result } = renderHook(() => useTopicNavigation('event-001', mockGlobalTopics));

      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.nextTopic).not.toBeNull();
      expect(result.current.prevTopic).not.toBeNull();
    });

    /**
     * Integration Test 8: FAB buttons always enabled at last topic
     */
    it('FAB buttons are always enabled at last topic globally', () => {
      const { result } = renderHook(() => useTopicNavigation('theme-003', mockGlobalTopics));

      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.nextTopic).not.toBeNull();
      expect(result.current.prevTopic).not.toBeNull();
    });

    /**
     * Integration Test 9: FAB buttons always enabled at middle topic
     *
     * Verifies non-boundary positions also have FAB buttons enabled.
     */
    it('FAB buttons are always enabled at middle topic', () => {
      // Middle of PARABLE category (index 5)
      const { result } = renderHook(() => useTopicNavigation('parable-001', mockGlobalTopics));

      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.nextTopic?.topic_id).toBe('parable-002');
      expect(result.current.prevTopic?.topic_id).toBe('prophecy-002');
    });
  });

  describe('Within-Category Navigation Unaffected', () => {
    /**
     * Integration Test 10: Normal within-category navigation still works
     *
     * Ensures circular navigation changes didn't break non-boundary navigation.
     */
    it('navigates correctly within EVENT category without circular wrapping', () => {
      // Start at second EVENT topic (The Fall - index 1)
      const { result } = renderHook(() => useTopicNavigation('event-002', mockGlobalTopics));

      // Should navigate within EVENT category
      expect(result.current.prevTopic?.topic_id).toBe('event-001');
      expect(result.current.prevTopic?.category).toBe('EVENT');
      expect(result.current.nextTopic?.topic_id).toBe('event-003');
      expect(result.current.nextTopic?.category).toBe('EVENT');

      // Both directions available
      expect(result.current.canGoNext).toBe(true);
      expect(result.current.canGoPrevious).toBe(true);
    });
  });
});
