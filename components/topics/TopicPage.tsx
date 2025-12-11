/**
 * TopicPage Component
 *
 * Lightweight wrapper for a single topic with stable positional key.
 * Receives topicId and category as PROPS (not derived from key).
 * The parent (TopicPagerView) sets stable positional keys that NEVER change.
 *
 * Features:
 * - Fetches topic content using useTopicById and useTopicReferences hooks
 * - Shows SkeletonLoader while loading
 * - Renders topic content when loaded (Bible references or Explanations)
 * - Contains ScrollView for vertical scrolling
 * - Props update when window shifts (key stays stable)
 * - Handles scroll velocity calculation for FAB visibility
 * - Handles tap detection for FAB toggle
 *
 * @see Spec: agent-os/specs/2025-12-08-topic-swipe-navigation/spec.md
 */

import React, { useCallback, useMemo, useRef } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';
import Markdown from 'react-native-markdown-display';
import { BottomLogo } from '@/components/bible/BottomLogo';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { TopicText } from '@/components/topics/TopicText';
import {
  fontSizes,
  fontWeights,
  type getColors,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import { useTopicById, useTopicReferences } from '@/src/api/generated';
import type { ContentTabType } from '@/types/bible';
import type { TopicCategory } from '@/types/topics';

/**
 * Convert a number to Unicode superscript characters
 * Maps each digit to its Unicode superscript equivalent
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '\u2070',
    '1': '\u00b9',
    '2': '\u00b2',
    '3': '\u00b3',
    '4': '\u2074',
    '5': '\u2075',
    '6': '\u2076',
    '7': '\u2077',
    '8': '\u2078',
    '9': '\u2079',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

/**
 * Preprocess Bible references text to format verse numbers as Unicode superscripts
 */
function formatVerseNumbers(text: string): string {
  if (!text) return text;

  // Match pattern: standalone number on its own line, followed by verse text
  const versePattern = /^(\d+)\n([^\n])/gm;

  return text.replace(versePattern, (_match, verseNum, firstChar) => {
    return `**${toSuperscript(Number.parseInt(verseNum, 10))}**${firstChar}`;
  });
}

/**
 * Custom markdown renderers for special formatting
 */
const markdownRules: RenderRules = {};

/**
 * Props for TopicPage component
 *
 * All props are DYNAMIC - they update when the sliding window shifts.
 * The key is set by the parent based on window position, not content.
 */
export interface TopicPageProps {
  /** Topic UUID - DYNAMIC prop, updates on window shift */
  topicId: string;
  /** Topic category - DYNAMIC prop, updates on window shift */
  category: TopicCategory;
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
 * TopicPage Component
 *
 * Renders a single topic within a PagerView page.
 * Component instance stays stable, props update when window shifts.
 *
 * Performance Optimizations:
 * - Wrapped with React.memo to prevent unnecessary re-renders
 * - Only re-renders when topicId, category, activeTab, or activeView changes
 *
 * @example
 * ```tsx
 * // Parent sets stable key based on position
 * <TopicPage
 *   key="page-2"              // STABLE: never changes
 *   topicId="topic-uuid-003"  // DYNAMIC: updates on window shift
 *   category="EVENT"          // DYNAMIC: updates on window shift
 *   activeTab="summary"
 *   activeView="bible"
 * />
 * ```
 */
export const TopicPage = React.memo(function TopicPage({
  topicId,
  category,
  activeTab,
  activeView,
  onScroll,
  onTap,
}: TopicPageProps) {
  const { colors } = useTheme();
  const { styles, markdownStyles } = useMemo(() => createStyles(colors), [colors]);

  // TODO: Implement Bible version selection in Settings page
  // For now, hardcoded to NASB1995 (backend default)
  const bibleVersion = 'NASB1995';

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  // Fetch topic data with verse replacement
  const { data: topicData, isLoading: isTopicLoading } = useTopicById(topicId, bibleVersion);
  const { data: references } = useTopicReferences(topicId);

  // Extract the specific explanation type from the full topic response
  const explanation = topicData?.explanation?.[activeTab];

  /**
   * Handle touch start - record time and position
   */
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartTime.current = Date.now();
    touchStartY.current = event.nativeEvent.pageY;
  }, []);

  /**
   * Handle touch end - detect if it was a tap (not a scroll)
   * A tap is defined as:
   * - Touch duration < 200ms
   * - Movement < 10 pixels
   */
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (!onTap) return;

      const touchDuration = Date.now() - touchStartTime.current;
      const touchMovement = Math.abs(event.nativeEvent.pageY - touchStartY.current);

      // Only trigger tap if it was quick and didn't move much
      if (touchDuration < 200 && touchMovement < 10) {
        onTap();
      }
    },
    [onTap]
  );

  /**
   * Handle scroll events - calculate velocity and detect bottom
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onScroll) return;

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const currentTime = Date.now();

      // Calculate scroll velocity (pixels per second)
      const timeDelta = currentTime - lastScrollTime.current;
      const scrollDelta = currentScrollY - lastScrollY.current; // Signed value to track direction
      const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

      // Check if at bottom
      const scrollHeight = contentSize.height - layoutMeasurement.height;
      const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

      // Update refs
      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;

      // Call parent callback
      onScroll(velocity, isAtBottom);
    },
    [onScroll]
  );

  // Type guard for topic
  const topic =
    topicData?.topic && typeof topicData.topic === 'object' && 'name' in topicData.topic
      ? (topicData.topic as {
          name: string;
          description?: string;
          topic_id: string;
          category: string;
        })
      : null;

  // Safely extract description as string
  const topicDescription: string | null =
    topic && typeof topic.description === 'string' && topic.description.trim()
      ? topic.description
      : null;

  // Loading state - show skeleton
  if (isTopicLoading && !topicData) {
    return (
      <View style={styles.container} testID={`topic-page-${topicId}`}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          testID={`topic-page-scroll-${topicId}`}
        >
          <SkeletonLoader />
        </ScrollView>
      </View>
    );
  }

  // Error or no data state
  if (!topic) {
    return (
      <View style={styles.container} testID={`topic-page-${topicId}`}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          testID={`topic-page-scroll-${topicId}`}
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Topic not available</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={`topic-page-${topicId}`}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        testID={`topic-page-scroll-${topicId}`}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Bible References View */}
        {activeView === 'bible' &&
          (references &&
          typeof references === 'object' &&
          'content' in references &&
          typeof references.content === 'string' ? (
            // Use TopicText if content has structured format (## subtitles)
            // Otherwise fall back to existing Markdown renderer
            references.content.includes('## ') ? (
              <TopicText topicName={topic.name} markdownContent={references.content} />
            ) : (
              <>
                {/* Topic Title (only shown for non-structured content) */}
                <Text style={styles.topicTitle} accessibilityRole="header">
                  {topic.name}
                </Text>

                {/* Topic Description */}
                {topicDescription ? (
                  <Text style={styles.topicDescription}>{topicDescription}</Text>
                ) : null}

                <View style={styles.referencesContainer}>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {
                      // First format verse numbers, THEN process newlines
                      formatVerseNumbers(references.content)
                        .replace(/\n\n/g, '___PARAGRAPH___')
                        .replace(/\n/g, ' ')
                        .replace(/___PARAGRAPH___/g, '\n\n')
                    }
                  </Markdown>
                </View>
              </>
            )
          ) : (
            <>
              {/* Topic Title (shown in empty state) */}
              <Text style={styles.topicTitle} accessibilityRole="header">
                {topic.name}
              </Text>

              {/* Topic Description */}
              {topicDescription ? (
                <Text style={styles.topicDescription}>{topicDescription}</Text>
              ) : null}

              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No Bible references available for this topic.</Text>
              </View>
            </>
          ))}

        {/* Explanations View */}
        {activeView === 'explanations' && (
          <>
            {/* Topic Title */}
            <Text style={styles.topicTitle} accessibilityRole="header">
              {topic.name}
            </Text>

            {/* Topic Description */}
            {topicDescription ? (
              <Text style={styles.topicDescription}>{topicDescription}</Text>
            ) : null}

            {explanation && typeof explanation === 'string' ? (
              <View style={styles.explanationContainer}>
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {explanation.replace(/#{1,6}\s*Summary\s*\n/gi, '\n')}
                </Markdown>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {activeTab} explanation available for this topic yet.
                </Text>
              </View>
            )}
          </>
        )}
        <BottomLogo />
      </ScrollView>
    </View>
  );
});

/**
 * Creates all styles for TopicPage component
 * Returns both component styles and markdown styles in a single factory
 */
const createStyles = (colors: ReturnType<typeof getColors>) => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      // Add bottom padding to account for floating action buttons
      paddingBottom: 60,
    },
    topicTitle: {
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.displayMedium * lineHeights.display,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    topicDescription: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * lineHeights.body,
      color: colors.textSecondary,
      marginBottom: spacing.xxl,
    },
    referencesContainer: {
      marginBottom: spacing.xxxl,
    },
    explanationContainer: {
      marginTop: spacing.xxl,
      paddingTop: spacing.xxl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    emptyContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  /**
   * Markdown Styles
   * Reused from ChapterReader for consistency
   */
  const verseNumberSuperscriptStyle = {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    color: colors.textTertiary,
    marginRight: spacing.xs / 2,
  };

  const markdownStyles = StyleSheet.create({
    body: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading3 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    list_item: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    bullet_list: {
      marginBottom: spacing.md,
    },
    ordered_list: {
      marginBottom: spacing.md,
    },
    strong: {
      // Used for verse numbers
      ...verseNumberSuperscriptStyle,
    },
    em: {
      fontStyle: 'italic',
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.md,
    },
    verseNumberSuperscript: verseNumberSuperscriptStyle,
  });

  return { styles, markdownStyles };
};
