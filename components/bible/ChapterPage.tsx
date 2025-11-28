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

import React, { useMemo, useRef } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { animations, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
} from '@/src/api/generated/hooks';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import { BottomLogo } from './BottomLogo';
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
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
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
  onScroll,
  onTap,
}: ChapterPageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  /**
   * Handle touch start - record time and position
   */
  const handleTouchStart = (event: GestureResponderEvent) => {
    touchStartTime.current = Date.now();
    touchStartY.current = event.nativeEvent.pageY;
  };

  /**
   * Handle touch end - detect if it was a tap (not a scroll)
   * A tap is defined as:
   * - Touch duration < 200ms
   * - Movement < 10 pixels
   */
  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!onTap) return;

    const touchDuration = Date.now() - touchStartTime.current;
    const touchMovement = Math.abs(event.nativeEvent.pageY - touchStartY.current);

    // Only trigger tap if it was quick and didn't move much
    if (touchDuration < 200 && touchMovement < 10) {
      onTap();
    }
  };

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

  /**
   * Handle scroll events - calculate velocity and detect bottom
   */
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onScroll) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollY = contentOffset.y;
    const currentTime = Date.now();

    // Calculate scroll velocity (pixels per second)
    const timeDelta = currentTime - lastScrollTime.current;
    const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
    const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

    // Check if at bottom
    const scrollHeight = contentSize.height - layoutMeasurement.height;
    const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

    // Update refs
    lastScrollY.current = currentScrollY;
    lastScrollTime.current = currentTime;

    // Call parent callback
    onScroll(velocity, isAtBottom);
  };

  return (
    <View style={styles.container} collapsable={false}>
      {activeView === 'explanations' ? (
        <View style={styles.container} collapsable={false}>
          <TabContent
            chapter={chapter}
            activeTab="summary"
            content={summaryData}
            isLoading={isSummaryLoading}
            error={summaryError}
            visible={activeTab === 'summary'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-summary`}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
          <TabContent
            chapter={chapter}
            activeTab="byline"
            content={byLineData}
            isLoading={isByLineLoading}
            error={byLineError}
            visible={activeTab === 'byline'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-byline`}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
          <TabContent
            chapter={chapter}
            activeTab="detailed"
            content={detailedData}
            isLoading={isDetailedLoading}
            error={detailedError}
            visible={activeTab === 'detailed'}
            testID={`chapter-page-scroll-${bookId}-${chapterNumber}-detailed`}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        </View>
      ) : (
        // Bible reading view (no explanations)
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          testID={`chapter-page-scroll-${bookId}-${chapterNumber}-bible`}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <View style={styles.readerContainer} collapsable={false}>
            {chapter ? (
              <ChapterReader chapter={chapter} activeTab={activeTab} explanationsOnly={false} />
            ) : (
              <SkeletonLoader />
            )}
          </View>
          <BottomLogo />
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
  onScroll,
  onTouchStart,
  onTouchEnd,
}: {
  chapter: ChapterContent | null | undefined;
  activeTab: ContentTabType;
  content: ExplanationContent | null | undefined;
  isLoading: boolean;
  error: Error | null;
  visible: boolean;
  testID: string;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      onScroll={onScroll}
      scrollEventThrottle={16}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
      <BottomLogo />
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      // Add bottom padding to account for floating action buttons AND progress bar
      paddingBottom: 60, // FAB height + bottom offset + progress bar + extra spacing
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
      color: colors.textSecondary,
      textAlign: 'center',
    },
    hidden: {
      display: 'none',
    },
  });
