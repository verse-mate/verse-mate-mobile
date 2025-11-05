/**
 * ChapterPage Component
 *
 * Lightweight wrapper for a single Bible chapter with stable positional key.
 * Receives bookId and chapterNumber as PROPS (not derived from key).
 * The parent (ChapterPagerView) sets stable positional keys that NEVER change.
 *
 * Features:
 * - Fetches chapter content using useBibleChapter hook
 * - Fetches explanation content based on active tab and view mode
 * - Shows SkeletonLoader while loading
 * - Renders ChapterReader when loaded
 * - Contains ScrollView for vertical scrolling
 * - Props update when window shifts (key stays stable)
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 121-143)
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { animations, colors, spacing } from '@/constants/bible-design-tokens';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
} from '@/src/api/generated/hooks';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import { ChapterReader } from './ChapterReader';
import { SkeletonLoader } from './SkeletonLoader';

/**
 * Props for ChapterPage component
 *
 * All props are DYNAMIC - they update when the sliding window shifts.
 * The key is set by the parent based on window position, not content.
 */
export interface ChapterPageProps {
  /** Book ID (1-66) - DYNAMIC prop, updates on window shift */
  bookId: number;
  /** Chapter number (1-based) - DYNAMIC prop, updates on window shift */
  chapterNumber: number;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
}

/**
 * ChapterPage Component
 *
 * Renders a single Bible chapter within a PagerView page.
 * Component instance stays stable, props update when window shifts.
 *
 * Performance Optimizations (Task 6.4):
 * - Wrapped with React.memo to prevent unnecessary re-renders
 * - Memoized active content calculation with useMemo
 * - Only re-renders when bookId, chapterNumber, activeTab, or activeView changes
 *
 * @example
 * ```tsx
 * // Parent sets stable key based on position
 * <ChapterPage
 *   key="page-2"              // STABLE: never changes
 *   bookId={1}                // DYNAMIC: updates on window shift
 *   chapterNumber={5}         // DYNAMIC: updates on window shift
 *   activeTab="summary"
 *   activeView="bible"
 * />
 * ```
 */
export const ChapterPage = React.memo(function ChapterPage({
  bookId,
  chapterNumber,
  activeTab,
  activeView,
}: ChapterPageProps) {
  // Fetch chapter content
  const { data: chapter } = useBibleChapter(bookId, chapterNumber, undefined);

  // Fetch explanations for each tab
  // Queries are ALWAYS enabled to maintain cache during route transitions
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useBibleSummary(bookId, chapterNumber, undefined);

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
  } = useBibleByLine(bookId, chapterNumber, undefined);

  const {
    data: detailedData,
    isLoading: isDetailedLoading,
    error: detailedError,
  } = useBibleDetailed(bookId, chapterNumber, undefined);

  // Track previous props to detect changes immediately (before queries update)
  // This prevents Bible content flash when swiping in Explanations view
  // Also track activeView to detect if it's flickering between bible/explanations
  const prevPropsRef = useRef({ bookId, chapterNumber, activeView });

  const activeViewChanged = prevPropsRef.current.activeView !== activeView;

  // Update ref after render to track for next change
  useEffect(() => {
    prevPropsRef.current = { bookId, chapterNumber, activeView };
  }, [bookId, chapterNumber, activeView]);

  // Get active explanation content based on selected tab (memoized for performance)
  const activeContent = useMemo(() => {
    switch (activeTab) {
      case 'summary':
        return {
          data: summaryData,
          isLoading: isSummaryLoading,
          error: summaryError,
        };
      case 'byline':
        return {
          data: byLineData,
          isLoading: isByLineLoading,
          error: byLineError,
        };
      case 'detailed':
        return {
          data: detailedData,
          isLoading: isDetailedLoading,
          error: detailedError,
        };
      default:
        return {
          data: undefined,
          isLoading: false,
          error: null,
        };
    }
  }, [
    activeTab,
    summaryData,
    isSummaryLoading,
    summaryError,
    byLineData,
    isByLineLoading,
    byLineError,
    detailedData,
    isDetailedLoading,
    detailedError,
  ]);

  // Check if we should show skeleton
  // Show skeleton when:
  // 1. Bible chapter is missing (null or undefined) AND:
  //    - We're loading for the first time (no placeholder data)
  //    - OR we're loading without placeholder data
  // 2. In explanations view AND:
  //    - View just changed (prevents Bible flash)
  //    - Explanation is loading for first time (no data yet, not even placeholder)
  //    - No explanation data at all
  //    - AND we're not showing placeholder data for the explanation
  // NOTE: We do NOT show skeleton when showing placeholder data (old chapter while fetching new)
  // because that would defeat the purpose of placeholderData - smooth transitions!
  // Calculate skeleton conditions
  // SIMPLIFIED LOGIC: Only show skeleton when we truly have NO data to display
  // If we have ANY data (even old/placeholder), show it instead of skeleton
  const condition1_noChapter = !chapter;
  const condition2_explanationsView = activeView === 'explanations';
  const condition2_noExplanationData = !activeContent.data;
  const condition2_viewChanged = activeViewChanged;

  const shouldShowSkeleton =
    condition1_noChapter ||
    (condition2_explanationsView && condition2_viewChanged) ||
    (condition2_explanationsView && condition2_noExplanationData);

  return (
    <View style={styles.container}>
      {shouldShowSkeleton ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          <SkeletonLoader />
        </ScrollView>
      ) : activeView === 'explanations' ? (
        <View style={styles.container}>
          <TabContent
            chapter={chapter}
            activeTab="summary"
            content={summaryData}
            error={summaryError}
            visible={activeTab === 'summary'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-summary`}
          />
          <TabContent
            chapter={chapter}
            activeTab="byline"
            content={byLineData}
            error={byLineError}
            visible={activeTab === 'byline'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-byline`}
          />
          <TabContent
            chapter={chapter}
            activeTab="detailed"
            content={detailedData}
            error={detailedError}
            visible={activeTab === 'detailed'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-detailed`}
          />
        </View>
      ) : (
        // Bible reading view (no explanations)
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          testID={`chapter-page-scroll-${bookId}-${chapterNumber}-bible`}
        >
          <View style={styles.readerContainer}>
            <ChapterReader chapter={chapter} activeTab={activeTab} explanationsOnly={false} />
          </View>
        </ScrollView>
      )}
    </View>
  );
});

/**
 * TabContent Component
 *
 * Renders the content for a single explanation tab within its own ScrollView.
 * This ensures each tab maintains its own independent scroll position.
 */
function TabContent({
  chapter,
  activeTab,
  content,
  error,
  visible,
  testID,
}: {
  chapter: ChapterContent | null | undefined;
  activeTab: ContentTabType;
  content: ExplanationContent | null | undefined;
  error: Error | null;
  visible: boolean;
  testID: string;
}) {
  const containerStyle = [styles.container, !visible && styles.hidden];
  return (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      testID={testID}
    >
      {error ? (
        <Animated.View
          entering={FadeIn.duration(animations.tabSwitch.duration)}
          exiting={FadeOut.duration(animations.tabSwitch.duration)}
          style={styles.errorContainer}
        >
          <Text style={styles.errorText}>Failed to load {activeTab} explanation</Text>
        </Animated.View>
      ) : (
        <Animated.View
          key={activeTab}
          entering={FadeIn.duration(animations.tabSwitch.duration)}
          exiting={FadeOut.duration(animations.tabSwitch.duration)}
        >
          {chapter && (
            <ChapterReader
              chapter={chapter}
              activeTab={activeTab}
              explanationsOnly={true}
              explanation={content && 'content' in content ? content : undefined}
            />
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    // Add bottom padding to account for floating action buttons AND progress bar
    paddingBottom: 130, // FAB height + bottom offset + progress bar + extra spacing
  },
  readerContainer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    fontSize: 16,
    color: colors.gray700,
    textAlign: 'center',
  },
  hidden: {
    display: 'none',
  },
});
