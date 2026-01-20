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
 * Note: ChapterPagerView now uses ChapterNavigationContext for navigation state.
 * The onPageChange callback has been removed - context handles navigation updates.
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 * @see Spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
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

  /** Whether navigation buttons should be visible (fades in/out based on user interaction) */
  visible?: boolean;

  /** Test ID for testing */
  testID?: string;
}

/**
 * BibleContentPanel Component
 *
 * Displays Bible chapter content in the left panel of split view.
 * This is the "Bible reading" side in landscape/tablet mode.
 *
 * Note: Navigation state updates are handled by ChapterNavigationContext.
 * ChapterPagerView is the single writer to the context.
 */
export function BibleContentPanel({
  bookId,
  chapterNumber,
  bookName,
  totalChapters,
  canGoPrevious,
  canGoNext,
  onHeaderPress,
  onNavigatePrev,
  onNavigateNext,
  onScroll,
  onTap,
  targetVerse,
  targetEndVerse,
  visible = true,
  testID = 'bible-content-panel',
}: BibleContentPanelProps) {
  const { mode, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const styles = useMemo(() => createStyles(specs, colors, insets), [specs, colors, insets]);

  // Ref for ChapterPagerView imperative control
  const pagerRef = useRef<ChapterPagerViewRef>(null);

  // Calculate progress percentage
  const { progress } = useBookProgress(bookId, chapterNumber, totalChapters);

  // Handle previous navigation
  const handlePrevious = useCallback(() => {
    if (canGoPrevious) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pagerRef.current?.goPrevious();
      onNavigatePrev?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoPrevious, onNavigatePrev]);

  // Handle next navigation
  const handleNext = useCallback(() => {
    if (canGoNext) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pagerRef.current?.goNext();
      onNavigateNext?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoNext, onNavigateNext]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Header Bar */}
      <Pressable style={styles.header} onPress={onHeaderPress} testID={`${testID}-header`}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {bookName} {chapterNumber}
          </Text>
          <Ionicons name="chevron-down" size={20} color={specs.headerTextColor} />
        </View>
      </Pressable>

      {/* Chapter Pager View - Uses ChapterNavigationContext for state updates */}
      <View style={styles.pagerContainer}>
        <ChapterPagerView
          ref={pagerRef}
          initialBookId={bookId}
          initialChapter={chapterNumber}
          activeTab="summary"
          activeView="bible"
          targetVerse={targetVerse}
          targetEndVerse={targetEndVerse}
          onScroll={onScroll}
          onTap={onTap}
        />
      </View>

      {/* Progress Bar */}
      <ReadingProgressBar progress={progress.percentage} />

      {/* Floating Navigation Buttons - Now aligned with Topic and Portrait pages */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={canGoPrevious}
        showNext={canGoNext}
        visible={visible}
      />
    </View>
  );
}

/**
 * Create styles for BibleContentPanel
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof getColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      minHeight: specs.headerHeight + insets.top,
      paddingTop: insets.top,
      paddingBottom: spacing.sm,
      backgroundColor: specs.headerBackground,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: specs.headerHeight,
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
    // navButtonsContainer style removed
  });
}

export default BibleContentPanel;
