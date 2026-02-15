/**
 * BibleContentPanel Component
 *
 * Left panel for split view that displays Bible chapter content.
 * Wraps the SimpleChapterPager for swipe navigation in landscape/tablet layout.
 *
 * Features:
 * - Dark header bar with book/chapter dropdown
 * - SimpleChapterPager for swipe navigation (V3)
 * - Progress bar showing reading position
 * - Floating navigation buttons for prev/next chapter
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChapterPage } from '@/components/bible/ChapterPage';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { SimpleChapterPager } from '@/components/bible/SimpleChapterPager';
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
import { useBibleTestaments } from '@/src/api';

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
  visible = true,
  testID = 'bible-content-panel',
}: BibleContentPanelProps) {
  const { mode, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const styles = createStyles(specs, colors, insets);

  // Fetch book metadata for SimpleChapterPager
  const { data: booksMetadata } = useBibleTestaments();

  // Calculate progress percentage
  const { progress } = useBookProgress(bookId, chapterNumber, totalChapters);

  // Handle previous navigation
  const handlePrevious = () => {
    if (canGoPrevious) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onNavigatePrev?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Handle next navigation
  const handleNext = () => {
    if (canGoNext) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onNavigateNext?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Render chapter page content for SimpleChapterPager
  // In split view, the left panel always shows 'bible' view (explanations are on the right)
  const renderChapterPage = useCallback(
    (pageBookId: number, pageChapterNumber: number) => {
      return (
        <ChapterPage
          bookId={pageBookId}
          chapterNumber={pageChapterNumber}
          activeTab="summary"
          activeView="bible"
          onScroll={onScroll}
          onTap={onTap}
          targetVerse={
            pageBookId === bookId && pageChapterNumber === chapterNumber ? targetVerse : undefined
          }
          targetEndVerse={
            pageBookId === bookId && pageChapterNumber === chapterNumber
              ? targetEndVerse
              : undefined
          }
        />
      );
    },
    [onScroll, onTap, bookId, chapterNumber, targetVerse, targetEndVerse]
  );

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

      {/* SimpleChapterPager - V3 3-page window with linear navigation */}
      <View style={styles.pagerContainer}>
        <SimpleChapterPager
          key={`split-pager-${bookId}-${chapterNumber}`}
          bookId={bookId}
          chapterNumber={chapterNumber}
          bookName={bookName}
          booksMetadata={booksMetadata}
          onChapterChange={onPageChange}
          renderChapterPage={renderChapterPage}
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
  });
}

export default BibleContentPanel;
