/**
 * BibleContentPanel Component
 *
 * Left panel for split view that displays Bible chapter content.
 * Wraps the ChapterPagerView for use in landscape/tablet layout.
 *
 * Features:
 * - Dark header bar with book/chapter dropdown
 * - ChapterPagerView for swipe navigation
 * - Progress bar showing reading position
 * - Floating navigation buttons for prev/next chapter
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReadingProgressBar } from '@/components/ui/ReadingProgressBar';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getSplitViewSpecs,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useBookProgress } from '@/hooks/bible';
import type { ChapterPagerViewRef } from './ChapterPagerView';
import { ChapterPagerView } from './ChapterPagerView';

/**
 * Props for BibleContentPanel
 */
export interface BibleContentPanelProps {
  /** Book ID (1-66) */
  bookId: number;

  /** Chapter number */
  chapterNumber: number;

  /** Book name for display in header */
  bookName: string;

  /** Total chapters in the book */
  totalChapters: number;

  /** Whether navigation to previous chapter is possible */
  canGoPrevious: boolean;

  /** Whether navigation to next chapter is possible */
  canGoNext: boolean;

  /** Callback when header dropdown is pressed (for navigation modal) */
  onHeaderPress?: () => void;

  /** Callback when page changes from swipe */
  onPageChange: (bookId: number, chapterNumber: number) => void;

  /** Callback when navigating to previous chapter */
  onNavigatePrev?: () => void;

  /** Callback when navigating to next chapter */
  onNavigateNext?: () => void;

  /** Callback when user scrolls */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;

  /** Callback when user taps */
  onTap?: () => void;

  /** Target verse to scroll to */
  targetVerse?: number;

  /** Target end verse for multi-verse highlights */
  targetEndVerse?: number;

  /** Test ID for testing */
  testID?: string;
}

/**
 * BibleContentPanel Component
 *
 * Displays Bible chapter content in the left panel of split view.
 * This is the "Bible reading" side in landscape/tablet mode.
 */
export function BibleContentPanel({
  bookId,
  chapterNumber,
  bookName,
  totalChapters,
  canGoPrevious,
  canGoNext,
  onHeaderPress,
  onPageChange,
  onNavigatePrev,
  onNavigateNext,
  onScroll,
  onTap,
  targetVerse,
  targetEndVerse,
  testID = 'bible-content-panel',
}: BibleContentPanelProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const styles = useMemo(() => createStyles(specs, colors), [specs, colors]);
  const insets = useSafeAreaInsets();

  // Ref for ChapterPagerView imperative control
  const pagerRef = useRef<ChapterPagerViewRef>(null);

  // Calculate progress percentage
  const { progress } = useBookProgress(bookId, chapterNumber, totalChapters);

  // Handle previous navigation
  const handlePrevious = useCallback(() => {
    if (canGoPrevious) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pagerRef.current?.setPage(1); // Previous page in 5-page window
      onNavigatePrev?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoPrevious, onNavigatePrev]);

  // Handle next navigation
  const handleNext = useCallback(() => {
    if (canGoNext) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pagerRef.current?.setPage(3); // Next page in 5-page window
      onNavigateNext?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoNext, onNavigateNext]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      {/* Header Bar */}
      <Pressable style={styles.header} onPress={onHeaderPress} testID={`${testID}-header`}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {bookName} {chapterNumber}
          </Text>
          <Ionicons name="chevron-down" size={20} color={specs.headerTextColor} />
        </View>
      </Pressable>

      {/* Chapter Pager View */}
      <View style={styles.pagerContainer}>
        <ChapterPagerView
          ref={pagerRef}
          initialBookId={bookId}
          initialChapter={chapterNumber}
          activeTab="summary"
          activeView="bible"
          targetVerse={targetVerse}
          targetEndVerse={targetEndVerse}
          onPageChange={onPageChange}
          onScroll={onScroll}
          onTap={onTap}
        />
      </View>

      {/* Progress Bar */}
      <ReadingProgressBar progress={progress.percentage} />

      {/* Floating Navigation Buttons */}
      <View style={styles.navButtonsContainer} pointerEvents="box-none">
        {/* Previous Button */}
        <Pressable
          style={[styles.navButton, !canGoPrevious && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={!canGoPrevious}
          accessibilityLabel="Previous chapter"
          accessibilityRole="button"
          testID={`${testID}-prev-button`}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={canGoPrevious ? specs.navButtonIconColor : 'rgba(255,255,255,0.3)'}
          />
        </Pressable>

        {/* Next Button */}
        <Pressable
          style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          onPress={handleNext}
          disabled={!canGoNext}
          accessibilityLabel="Next chapter"
          accessibilityRole="button"
          testID={`${testID}-next-button`}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={canGoNext ? specs.navButtonIconColor : 'rgba(255,255,255,0.3)'}
          />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Create styles for BibleContentPanel
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof getColors>
) {
  return StyleSheet.create({
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
    pagerContainer: {
      flex: 1,
    },
    navButtonsContainer: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
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
}

export default BibleContentPanel;
