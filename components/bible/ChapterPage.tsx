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

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { animations, colors, spacing } from '@/constants/bible-design-tokens';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
} from '@/src/api/generated/hooks';
import type { ContentTabType } from '@/types/bible';
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
  const { data: chapter, isLoading } = useBibleChapter(bookId, chapterNumber);

  // Fetch explanations for each tab
  // Active tab loads immediately, inactive tabs load in background
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useBibleSummary(bookId, chapterNumber, undefined, {
    enabled: activeView === 'explanations' && activeTab === 'summary', // Only load in Explanations view
  });

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
  } = useBibleByLine(bookId, chapterNumber, undefined, {
    enabled: activeView === 'explanations' && activeTab === 'byline', // Only load in Explanations view
  });

  const {
    data: detailedData,
    isLoading: isDetailedLoading,
    error: detailedError,
  } = useBibleDetailed(bookId, chapterNumber, undefined, {
    enabled: activeView === 'explanations' && activeTab === 'detailed', // Only load in Explanations view
  });

  // Get active explanation content based on selected tab (memoized for performance)
  const activeContent = useMemo(() => {
    switch (activeTab) {
      case 'summary':
        return { data: summaryData, isLoading: isSummaryLoading, error: summaryError };
      case 'byline':
        return { data: byLineData, isLoading: isByLineLoading, error: byLineError };
      case 'detailed':
        return { data: detailedData, isLoading: isDetailedLoading, error: detailedError };
      default:
        return { data: undefined, isLoading: false, error: null };
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      testID={`chapter-page-scroll-${bookId}-${chapterNumber}`}
    >
      {isLoading || !chapter ? (
        <SkeletonLoader />
      ) : activeView === 'explanations' ? (
        // Explanations view with tab content
        activeContent.isLoading ? (
          // Show skeleton loader for tab content
          <Animated.View
            entering={FadeIn.duration(animations.tabSwitch.duration)}
            exiting={FadeOut.duration(animations.tabSwitch.duration)}
          >
            <SkeletonLoader />
          </Animated.View>
        ) : activeContent.error ? (
          // Show error state for tab content
          <Animated.View
            entering={FadeIn.duration(animations.tabSwitch.duration)}
            exiting={FadeOut.duration(animations.tabSwitch.duration)}
            style={styles.errorContainer}
          >
            <Text style={styles.errorText}>Failed to load {activeTab} explanation</Text>
          </Animated.View>
        ) : (
          // Show chapter content with explanation (crossfade transition)
          <Animated.View
            key={activeTab} // Key ensures re-render on tab change
            entering={FadeIn.duration(animations.tabSwitch.duration)}
            exiting={FadeOut.duration(animations.tabSwitch.duration)}
          >
            <ChapterReader
              chapter={chapter}
              activeTab={activeTab}
              explanationsOnly={true}
              explanation={
                activeContent.data && 'content' in activeContent.data
                  ? activeContent.data
                  : undefined
              }
            />
          </Animated.View>
        )
      ) : (
        // Bible reading view (no explanations)
        <View style={styles.readerContainer}>
          <ChapterReader chapter={chapter} activeTab={activeTab} explanationsOnly={false} />
        </View>
      )}
    </ScrollView>
  );
});

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
});
