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

import React from 'react';
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

  return (
    <View style={styles.container}>
      {activeView === 'explanations' ? (
        <View style={styles.container}>
          <TabContent
            chapter={chapter}
            activeTab="summary"
            content={summaryData}
            isLoading={isSummaryLoading}
            error={summaryError}
            visible={activeTab === 'summary'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-summary`}
          />
          <TabContent
            chapter={chapter}
            activeTab="byline"
            content={byLineData}
            isLoading={isByLineLoading}
            error={byLineError}
            visible={activeTab === 'byline'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-byline`}
          />
          <TabContent
            chapter={chapter}
            activeTab="detailed"
            content={detailedData}
            isLoading={isDetailedLoading}
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
            {chapter && (
              <ChapterReader chapter={chapter} activeTab={activeTab} explanationsOnly={false} />
            )}
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
  isLoading,
  error,
  visible,
  testID,
}: {
  chapter: ChapterContent | null | undefined;
  activeTab: ContentTabType;
  content: ExplanationContent | null | undefined;
  isLoading: boolean;
  error: Error | null;
  visible: boolean;
  testID: string;
}) {
  if (!visible) return null;

  // Determine content for the reader
  const explanationContent = content && 'content' in content ? content : undefined;
  const hasContent = explanationContent && explanationContent.content.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
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
          <Text style={styles.errorText}>Failed to load {activeTab} explanation.</Text>
        </Animated.View>
      ) : isLoading ? (
        // Use a fragment of the skeleton loader for a better feel
        <SkeletonLoader />
      ) : !hasContent ? (
        <Animated.View
          entering={FadeIn.duration(animations.tabSwitch.duration)}
          exiting={FadeOut.duration(animations.tabSwitch.duration)}
          style={styles.errorContainer}
        >
          <Text style={styles.errorText}>
            No {activeTab} explanation available for this chapter yet.
          </Text>
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
              explanation={explanationContent}
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
