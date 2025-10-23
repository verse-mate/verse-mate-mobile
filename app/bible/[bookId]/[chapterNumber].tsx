/**
 * Bible Chapter Screen
 *
 * Main reading interface for a Bible chapter. Displays chapter content with
 * multiple reading modes (Summary, By Line, Detailed), saves reading position,
 * and provides navigation controls.
 *
 * Route: /bible/[bookId]/[chapterNumber]
 * Example: /bible/1/1 (Genesis 1)
 *
 * @see Spec lines 517-607 (ChapterScreen implementation)
 * @see Task Group 5.3 - Integrate tabs with chapter screen
 * @see Task Group 5.4 - Implement tab content loading
 * @see Task Group 6.3 - Implement swipe gesture for chapter navigation
 * @see Task Group 6.4 - Integrate navigation with chapter screen
 * @see Task Group 8.4 - Integrate ProgressBar with chapter screen
 * @see Task Group 9.3 - Add deep link validation in chapter screen
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { ProgressBar } from '@/components/bible/ProgressBar';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { animations, colors, headerSpecs, spacing } from '@/constants/bible-design-tokens';
import { useActiveTab, useBookProgress } from '@/hooks/bible';
import {
  useBibleByLine,
  useBibleChapter,
  useBibleDetailed,
  useBibleSummary,
  useBibleTestaments,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api/generated';

/**
 * View mode type for Bible reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Chapter Screen Component
 *
 * Handles:
 * - Loading chapter content from API
 * - Displaying chapter with active reading mode
 * - Saving reading position on mount
 * - Redirecting invalid bookId/chapter to Genesis 1 (Task 9.3)
 * - Tab content loading with crossfade transitions
 * - Background prefetching for inactive tabs
 * - Chapter navigation via floating buttons (Task 6.4)
 * - Chapter navigation via swipe gestures (Task 6.3)
 * - Progress bar display (Task 8.4)
 * - Hamburger menu (Task 8.5)
 * - Offline indicator (Task 8.6)
 * - View mode switching (Bible vs Explanations)
 */
export default function ChapterScreen() {
  // Extract and validate route params
  const params = useLocalSearchParams<{ bookId: string; chapterNumber: string }>();
  const bookId = Number(params.bookId);
  const chapterNumber = Number(params.chapterNumber);

  // Get active tab from persistence
  const { activeTab, setActiveTab } = useActiveTab();

  // View mode state (Bible reading vs Explanations view)
  const [activeView, setActiveView] = useState<ViewMode>('bible');

  // Navigation modal state (Task 7.9)
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state (Task 8.5)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fetch book metadata to get total chapters for validation
  const { data: booksMetadata } = useBibleTestaments();
  const bookMetadata = useMemo(
    () => booksMetadata?.find((book) => book.id === bookId),
    [booksMetadata, bookId]
  );
  const totalChapters = bookMetadata?.chapterCount || 50; // Default to 50 if not loaded

  /**
   * Validate bookId and chapter parameters (Task 9.3)
   *
   * - bookId must be between 1-66
   * - chapterNumber must be between 1-maxChapters for the book
   * - Invalid bookId redirects to Genesis 1
   * - Invalid chapter redirects to book's first chapter
   */
  useEffect(() => {
    // Validate bookId (1-66)
    if (bookId < 1 || bookId > 66) {
      // Invalid bookId, redirect to Genesis 1
      router.replace('/bible/1/1' as never);
      return;
    }

    // Validate chapter number (must be positive and within book's range)
    if (chapterNumber < 1) {
      // Invalid chapter, redirect to book's first chapter
      router.replace(`/bible/${bookId}/1` as never);
      return;
    }

    // If we have book metadata, validate against actual chapter count
    if (bookMetadata && chapterNumber > bookMetadata.chapterCount) {
      // Chapter exceeds book's chapter count, redirect to first chapter
      router.replace(`/bible/${bookId}/1` as never);
    }
  }, [bookId, chapterNumber, bookMetadata]);

  // Use validated params for API calls
  const validBookId = Math.max(1, Math.min(66, bookId));
  const validChapter = Math.max(1, chapterNumber);

  // Calculate progress percentage (Task 8.4)
  const { progress } = useBookProgress(validBookId, validChapter, totalChapters);

  // Fetch chapter data
  const { data: chapter, isLoading } = useBibleChapter(validBookId, validChapter);

  // Fetch explanations for each tab
  // Active tab loads immediately, inactive tabs load in background
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useBibleSummary(validBookId, validChapter, undefined, {
    enabled: activeTab === 'summary', // Only load when active
  });

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
  } = useBibleByLine(validBookId, validChapter, undefined, {
    enabled: activeTab === 'byline', // Only load when active
  });

  const {
    data: detailedData,
    isLoading: isDetailedLoading,
    error: detailedError,
  } = useBibleDetailed(validBookId, validChapter, undefined, {
    enabled: activeTab === 'detailed', // Only load when active
  });

  // Save reading position mutation
  const { mutate: saveLastRead } = useSaveLastRead();

  // Prefetch next/previous chapters in background (Task 5.5, 6.5)
  const prefetchNext = usePrefetchNextChapter(validBookId, validChapter, totalChapters);
  const prefetchPrevious = usePrefetchPreviousChapter(validBookId, validChapter);

  // Save reading position on mount
  useEffect(() => {
    saveLastRead({
      user_id: 'guest', // TODO: Replace with actual user ID when auth is added
      book_id: validBookId,
      chapter_number: validChapter,
    });
  }, [validBookId, validChapter, saveLastRead]);

  // Prefetch adjacent chapters after active content loads (Task 5.5, 6.5)
  useEffect(() => {
    if (chapter && !isLoading) {
      // Delay prefetch to avoid blocking main content
      const timeoutId = setTimeout(() => {
        prefetchNext();
        prefetchPrevious();
      }, 1000); // 1 second delay

      return () => clearTimeout(timeoutId);
    }
  }, [chapter, isLoading, prefetchNext, prefetchPrevious]);

  /**
   * Handle view mode change with haptic feedback
   */
  const handleViewChange = (view: ViewMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveView(view);
  };

  /**
   * Navigate to previous chapter (Task 6.4)
   *
   * Handles:
   * - Same book navigation
   * - Cross-book navigation (TODO: implement in future)
   * - Boundary checking (don't go before Genesis 1)
   */
  const handlePrevious = () => {
    if (validChapter > 1) {
      // Navigate to previous chapter in same book
      router.push(`/bible/${validBookId}/${validChapter - 1}` as never);
    } else if (validBookId > 1) {
      // TODO: Cross-book navigation - navigate to last chapter of previous book
      // For now, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      // Already at Genesis 1, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  /**
   * Navigate to next chapter (Task 6.4)
   *
   * Handles:
   * - Same book navigation
   * - Cross-book navigation (TODO: implement in future)
   * - Boundary checking (don't go past Revelation 22)
   */
  const handleNext = () => {
    if (validChapter < totalChapters) {
      // Navigate to next chapter in same book
      router.push(`/bible/${validBookId}/${validChapter + 1}` as never);
    } else if (validBookId < 66) {
      // TODO: Cross-book navigation - navigate to first chapter of next book
      // For now, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      // Already at Revelation 22, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  /**
   * Swipe Gesture for Chapter Navigation (Task 6.3)
   *
   * Swipe left → next chapter
   * Swipe right → previous chapter
   *
   * @see Spec lines 823-847 (Swipe gesture implementation)
   */
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30]) // Threshold to prevent accidental triggers during scroll
    .onEnd((event) => {
      if (event.translationX < -100) {
        // Swipe left = next chapter
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleNext();
      } else if (event.translationX > 100) {
        // Swipe right = previous chapter
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handlePrevious();
      }
    });

  // Show skeleton loader while loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ChapterHeader
          bookName="Loading..."
          chapterNumber={validChapter}
          activeView={activeView}
          onNavigationPress={() => {}}
          onViewChange={handleViewChange}
          onMenuPress={() => {}}
        />
        <SkeletonLoader />
      </View>
    );
  }

  // Show error state (shouldn't happen due to redirect, but handle gracefully)
  if (!chapter) {
    return (
      <View style={styles.container}>
        <ChapterHeader
          bookName="Error"
          chapterNumber={validChapter}
          activeView={activeView}
          onNavigationPress={() => {}}
          onViewChange={handleViewChange}
          onMenuPress={() => {}}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Chapter not found</Text>
        </View>
      </View>
    );
  }

  // Get active explanation content based on selected tab
  const getActiveContent = () => {
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
  };

  const activeContent = getActiveContent();

  // Determine if navigation buttons should be shown (Task 6.4)
  const showPrevious = validChapter > 1 || validBookId > 1;
  const showNext = validChapter < totalChapters || validBookId < 66;

  return (
    <View style={styles.container}>
      {/* Fixed Header (Task 8.6 - includes OfflineIndicator) */}
      <ChapterHeader
        bookName={chapter.bookName}
        chapterNumber={chapter.chapterNumber}
        activeView={activeView}
        onNavigationPress={() => {
          setIsNavigationModalOpen(true); // Task 7.9
        }}
        onViewChange={handleViewChange}
        onMenuPress={() => {
          setIsMenuOpen(true); // Task 8.5
        }}
      />

      {/* Content Tabs (Task 5.3) - Only visible in Explanations view */}
      {activeView === 'explanations' && (
        <ChapterContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Scrollable Content with Swipe Gesture (Task 6.3) */}
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          testID="chapter-scroll-view"
        >
          {activeContent.isLoading ? (
            // Show skeleton loader for tab content (Task 5.4)
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
                explanationsOnly={activeView === 'explanations'}
                explanation={
                  activeView === 'explanations' &&
                  activeTab !== 'byline' &&
                  activeContent.data &&
                  'content' in activeContent.data
                    ? activeContent.data
                    : undefined
                }
              />
            </Animated.View>
          )}
        </ScrollView>
      </GestureDetector>

      {/* Floating Action Buttons (Task 6.2, 6.4) */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={showPrevious}
        showNext={showNext}
      />

      {/* Progress Bar (Task 8.4) */}
      <ProgressBar percentage={progress.percentage} />

      {/* Navigation Modal (Task 7.9) */}
      <BibleNavigationModal
        visible={isNavigationModalOpen}
        onClose={() => setIsNavigationModalOpen(false)}
        currentBookId={validBookId}
        currentChapter={validChapter}
        onSelectChapter={(bookId, chapter) => {
          router.push(`/bible/${bookId}/${chapter}` as never);
        }}
      />

      {/* Hamburger Menu (Task 8.5) */}
      <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </View>
  );
}

/**
 * Chapter Header Component
 *
 * Fixed header with book/chapter title and action icons
 * - Chapter text (clickable to open chapter selector)
 * - Bible view icon (shows Bible reading mode)
 * - Explanations view icon (shows AI explanations mode)
 * - Offline indicator (shows when offline) - Task 8.6
 * - Hamburger menu icon (opens menu)
 *
 * @see Spec lines 226-237 (Header specs)
 */
interface ChapterHeaderProps {
  bookName: string;
  chapterNumber: number;
  activeView: ViewMode;
  onNavigationPress: () => void;
  onViewChange: (view: ViewMode) => void;
  onMenuPress: () => void;
}

function ChapterHeader({
  bookName,
  chapterNumber,
  activeView,
  onNavigationPress,
  onViewChange,
  onMenuPress,
}: ChapterHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]} testID="chapter-header">
      {/* Chapter Title Button (clickable to open navigation) */}
      <Pressable
        onPress={onNavigationPress}
        style={styles.chapterButton}
        accessibilityLabel={`Select chapter, currently ${bookName} ${chapterNumber}`}
        accessibilityRole="button"
        accessibilityHint="Opens chapter selection menu"
        testID="chapter-selector-button"
      >
        <View style={styles.chapterButtonContent}>
          <Text style={styles.headerTitle}>
            {bookName} {chapterNumber}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.white} />
        </View>
      </Pressable>

      {/* Action Icons */}
      <View style={styles.headerActions}>
        {/* Bible View Icon */}
        <Pressable
          onPress={() => onViewChange('bible')}
          style={styles.iconButton}
          accessibilityLabel="Bible reading view"
          accessibilityRole="button"
          accessibilityState={{ selected: activeView === 'bible' }}
          testID="bible-view-icon"
        >
          <Ionicons
            name="book-outline"
            size={headerSpecs.iconSize}
            color={activeView === 'bible' ? colors.gold : colors.white}
          />
        </Pressable>

        {/* Explanations View Icon */}
        <Pressable
          onPress={() => onViewChange('explanations')}
          style={styles.iconButton}
          accessibilityLabel="Explanations view"
          accessibilityRole="button"
          accessibilityState={{ selected: activeView === 'explanations' }}
          testID="explanations-view-icon"
        >
          <Ionicons
            name="reader-outline"
            size={headerSpecs.iconSize}
            color={activeView === 'explanations' ? colors.gold : colors.white}
          />
        </Pressable>

        {/* Offline Indicator (Task 8.6) */}
        <OfflineIndicator />

        {/* Hamburger Menu Icon (Task 8.5) */}
        <Pressable
          onPress={onMenuPress}
          style={styles.iconButton}
          accessibilityLabel="Open menu"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={headerSpecs.iconSize} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    minHeight: headerSpecs.height,
    backgroundColor: headerSpecs.backgroundColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: headerSpecs.padding,
    paddingBottom: spacing.sm,
  },
  chapterButton: {
    padding: spacing.xs,
  },
  chapterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: headerSpecs.titleFontSize,
    fontWeight: headerSpecs.titleFontWeight,
    color: headerSpecs.titleColor,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    // Add bottom padding to account for floating action buttons AND progress bar
    paddingBottom: 130, // FAB height + bottom offset + progress bar + extra spacing
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
