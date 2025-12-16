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
  testID = 'topic-content-panel',
}: TopicContentPanelProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(() => createStyles(specs, colors), [specs, colors]);
  const insets = useSafeAreaInsets();

  // Reading progress state
  const [progress, setProgress] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch references for this topic
  const { data: references } = useTopicReferences(topicId);

  // Handle scroll to calculate reading progress
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 0) {
      const scrollProgress = Math.min(100, Math.max(0, (contentOffset.y / scrollableHeight) * 100));
      setProgress(Math.round(scrollProgress));
    }
  }, []);

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
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID={`${testID}-scroll`}
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
              {topicDescription && <Text style={styles.topicDescription}>{topicDescription}</Text>}

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
      </ScrollView>

      {/* Progress Bar */}
      <ReadingProgressBar progress={progress} />

      {/* Floating Navigation Buttons */}
      {(hasPrevTopic || hasNextTopic) && (
        <View style={styles.navButtonsContainer}>
          {/* Previous Button */}
          <Pressable
            style={[styles.navButton, !hasPrevTopic && styles.navButtonDisabled]}
            onPress={onNavigatePrev}
            disabled={!hasPrevTopic}
            accessibilityLabel="Previous topic"
            accessibilityRole="button"
            testID={`${testID}-prev-button`}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={hasPrevTopic ? specs.navButtonIconColor : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>

          {/* Next Button */}
          <Pressable
            style={[styles.navButton, !hasNextTopic && styles.navButtonDisabled]}
            onPress={onNavigateNext}
            disabled={!hasNextTopic}
            accessibilityLabel="Next topic"
            accessibilityRole="button"
            testID={`${testID}-next-button`}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={hasNextTopic ? specs.navButtonIconColor : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>
        </View>
      )}
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
    navButtonsContainer: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      pointerEvents: 'box-none',
    },
    navButton: {
      width: specs.navButtonSize,
      height: specs.navButtonSize,
      borderRadius: specs.navButtonSize / 2,
      backgroundColor: specs.navButtonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navButtonDisabled: {
      opacity: 0.5,
    },
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
