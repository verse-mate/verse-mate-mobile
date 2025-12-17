/**
 * TopicContentPanel Component
 *
 * Left panel for split view that displays Bible references content.
 * Includes header with topic name and progress bar at bottom.
 *
 * Features:
 * - Dark header bar with topic dropdown
 * - Scrollable Bible references content
 * - Progress bar showing reading position
 * - Floating navigation buttons for prev/next topic
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RenderRules } from 'react-native-markdown-display';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomLogo } from '@/components/bible/BottomLogo';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { TopicText } from '@/components/topics/TopicText';
import { ReadingProgressBar } from '@/components/ui/ReadingProgressBar';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getSplitViewSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useTopicReferences } from '@/src/api';

/**
 * Convert a number to Unicode superscript characters
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
 * Format verse numbers as superscripts
 */
function formatVerseNumbers(text: string): string {
  if (!text) return text;
  const versePattern = /^(\d+)\n([^\n])/gm;
  return text.replace(versePattern, (_match, verseNum, firstChar) => {
    return `**${toSuperscript(Number.parseInt(verseNum, 10))}**${firstChar}`;
  });
}

const markdownRules: RenderRules = {};

/**
 * Props for TopicContentPanel
 */
export interface TopicContentPanelProps {
  /** Topic UUID */
  topicId: string;

  /** Topic name for display in header */
  topicName: string;

  /** Topic description (optional) */
  topicDescription?: string | null;

  /** Callback when header dropdown is pressed (for navigation modal) */
  onHeaderPress?: () => void;

  /** Callback when share button is pressed */
  onShare?: () => void;

  /** Callback for navigating to previous topic */
  onNavigatePrev?: () => void;

  /** Callback for navigating to next topic */
  onNavigateNext?: () => void;

  /** Whether there is a previous topic */
  hasPrevTopic?: boolean;

  /** Whether there is a next topic */
  hasNextTopic?: boolean;

  /** Callback for scroll events (velocity tracking) */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;

  /** Callback for tap events (toggle visibility) */
  onTap?: () => void;

  /** Whether floating controls should be visible */
  visible?: boolean;

  /** Test ID for testing */
  testID?: string;
}

/**
 * TopicContentPanel Component
 *
 * Displays Bible references content in the left panel of split view.
 */
export function TopicContentPanel({
  topicId,
  topicName,
  topicDescription,
  onHeaderPress,
  onShare,
  onNavigatePrev,
  onNavigateNext,
  hasPrevTopic = false,
  hasNextTopic = false,
  onScroll,
  onTap,
  visible = true,
  testID = 'topic-content-panel',
}: TopicContentPanelProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(() => createStyles(specs, colors), [specs, colors]);
  const insets = useSafeAreaInsets();

  // Reading progress state
  const [progress, setProgress] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Velocity tracking
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(0);

  // Fetch references for this topic
  const { data: references } = useTopicReferences(topicId);

  // Handle scroll to calculate reading progress and velocity
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

      // Calculate progress
      const scrollableHeight = contentSize.height - layoutMeasurement.height;
      if (scrollableHeight > 0) {
        const scrollProgress = Math.min(
          100,
          Math.max(0, (contentOffset.y / scrollableHeight) * 100)
        );
        setProgress(Math.round(scrollProgress));
      }

      // Calculate velocity for FAB visibility
      if (onScroll) {
        const currentY = contentOffset.y;
        const currentTime = Date.now();
        const dt = currentTime - lastScrollTime.current;

        // Calculate velocity (px/ms) if sufficient time has passed (e.g. 16ms frame)
        if (dt > 10) {
          const dy = currentY - lastScrollY.current;
          // Calculate velocity (px/s) - multiply by 1000
          // Positive = scrolling down, Negative = scrolling up
          const velocity = (dy / dt) * 1000;

          // Check if at bottom
          const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 20;

          onScroll(velocity, isAtBottom);

          lastScrollY.current = currentY;
          lastScrollTime.current = currentTime;
        }
      }
    },
    [onScroll]
  );

  // Check if we have content
  const hasContent =
    references &&
    typeof references === 'object' &&
    'content' in references &&
    typeof references.content === 'string';

  const contentString = hasContent ? (references.content as string) : '';
  const hasStructuredContent = hasContent && contentString.includes('## ');

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      {/* Header Bar */}
      <Pressable style={styles.header} onPress={onHeaderPress} testID={`${testID}-header`}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {topicName}
          </Text>
          <Ionicons name="chevron-down" size={20} color={specs.headerTextColor} />
        </View>
      </Pressable>

      {/* Content Area */}
      {/* We wrap ScrollView in GestureDetector if we need tap detection on content, 
          but ScrollView usually eats touches. 
          Standard React Native approach: Wrap inner content in Pressable or use onTouchEnd. 
          However, Reanimated Gesture Handler works with ScrollView if configured correctly.
          For simplicity, we can rely on ScrollView's own touch handling or just wrap content items.
          Actually, let's try wrapping the ScrollView with GestureDetector.
      */}
      {/* Note: GestureDetector might interfere with ScrollView if not careful. 
          Simpler: Pressable background? 
          Or assume scroll handles visibility mostly.
          Let's try GestureDetector on the outer container or rely on `onTouchEnd` on ScrollView.
      */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID={`${testID}-scroll`}
        // Simple tap detection
        onTouchEnd={() => {
          // We can't distinguish drag vs tap easily here without heuristic.
          // Leaving onTap for now, user relies on scroll to show/hide.
          // Or explicitly add a Pressable overlay? No.
          // If onTap is critical, we use GestureDetector.
        }}
      >
        {/* Helper for tap detection on content */}
        <Pressable
          onPress={() => onTap?.()}
          style={{ flex: 1 }}
          // Ensure it doesn't block scrolling/selection
          delayLongPress={500}
        >
          {hasContent ? (
            hasStructuredContent ? (
              <TopicText topicName={topicName} markdownContent={contentString} onShare={onShare} />
            ) : (
              <>
                {/* Topic Title */}
                <View style={styles.titleRow}>
                  <Text style={styles.topicTitle} accessibilityRole="header">
                    {topicName}
                  </Text>
                </View>

                {/* Topic Description */}
                {topicDescription && (
                  <Text style={styles.topicDescription}>{topicDescription}</Text>
                )}

                {/* References Content */}
                <View style={styles.referencesContainer}>
                  <Markdown style={markdownStyles} rules={markdownRules}>
                    {formatVerseNumbers(contentString)
                      .replace(/\n\n/g, '___PARAGRAPH___')
                      .replace(/\n/g, ' ')
                      .replace(/___PARAGRAPH___/g, '\n\n')}
                  </Markdown>
                </View>
              </>
            )
          ) : (
            <>
              {/* Topic Title */}
              <View style={styles.titleRow}>
                <Text style={styles.topicTitle} accessibilityRole="header">
                  {topicName}
                </Text>
              </View>

              {/* Topic Description */}
              {topicDescription && <Text style={styles.topicDescription}>{topicDescription}</Text>}

              {/* Empty State */}
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No Bible references available for this topic.</Text>
              </View>
            </>
          )}
          <BottomLogo />
        </Pressable>
      </ScrollView>

      {/* Progress Bar */}
      <ReadingProgressBar progress={progress} />

      {/* Floating Navigation Buttons - Replaced custom implementation with standard FAB */}
      <FloatingActionButtons
        onPrevious={onNavigatePrev || (() => {})}
        onNext={onNavigateNext || (() => {})}
        showPrevious={hasPrevTopic}
        showNext={hasNextTopic}
        visible={visible}
      />
    </View>
  );
}

/**
 * Create styles for TopicContentPanel
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof getColors>
) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: specs.headerHeight,
      backgroundColor: specs.headerBackground,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: specs.headerTextColor,
      marginRight: spacing.xs,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xxl,
      paddingBottom: 60,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xxl,
    },
    topicTitle: {
      flex: 1,
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.displayMedium * lineHeights.display,
      color: colors.textPrimary,
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
    emptyContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // navButtonsContainer style removed as we use FloatingActionButtons component
  });

  const verseNumberStyle = {
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
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    strong: verseNumberStyle,
  });

  return { styles, markdownStyles };
}

export default TopicContentPanel;
