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
 * @see Task Group 4 - Integration with ChapterPagerView (native page-based swipe navigation)
 * @see Task Group 8.4 - Integrate ProgressBar with chapter screen
 * @see Task Group 9.3 - Add deep link validation in chapter screen
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import type { ChapterPagerViewRef } from '@/components/bible/ChapterPagerView';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { ProgressBar } from '@/components/bible/ProgressBar';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { getHeaderSpecs, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useActiveTab, useActiveView, useBookProgress, useLastReadPosition } from '@/hooks/bible';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import { useFABVisibility } from '@/hooks/bible/use-fab-visibility';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import {
  useBibleChapter,
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
 * Center index for 5-page window in ChapterPagerView
 */
const CENTER_INDEX = 2;

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
 * - Chapter navigation via native page-based swipe (Task Group 4)
 * - Progress bar display (Task 8.4)
 * - Hamburger menu (Task 8.5)
 * - Offline indicator (Task 8.6)
 * - View mode switching (Bible vs Explanations)
 */
export default function ChapterScreen() {
  // Extract and validate route params
  const params = useLocalSearchParams<{ bookId: string; chapterNumber: string; verse?: string }>();
  const bookId = Number(params.bookId);
  const chapterNumber = Number(params.chapterNumber);
  const targetVerse = params.verse ? Number(params.verse) : undefined;

  // Theme
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  // Get active tab from persistence
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence
  const { activeView, setActiveView } = useActiveView();

  // Ensure deep-linked verse jumps use Bible view so scroll-to-verse can run
  useEffect(() => {
    if (targetVerse && activeView !== 'bible') {
      setActiveView('bible');
    }
  }, [targetVerse, activeView, setActiveView]);

  // Navigation modal state (Task 7.9)
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state (Task 8.5)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // FAB visibility state - manages auto-hide/show based on user interaction
  const {
    visible: fabVisible,
    handleScroll,
    handleTap,
  } = useFABVisibility({
    initialVisible: true,
  });

  // Ref to ChapterPagerView for programmatic navigation
  const pagerRef = useRef<ChapterPagerViewRef>(null);

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
    // Note: router is stable and doesn't need to be in dependencies
  }, [bookId, chapterNumber, bookMetadata]);

  // Use validated params for API calls
  const validBookId = Math.max(1, Math.min(66, bookId));
  const validChapter = Math.max(1, chapterNumber);

  // Calculate progress percentage (Task 8.4)
  const { progress } = useBookProgress(validBookId, validChapter, totalChapters);

  // Fetch chapter data for loading state check
  const { data: chapter, isLoading } = useBibleChapter(validBookId, validChapter);

  // Save reading position mutation (API)
  const { mutate: saveLastRead } = useSaveLastRead();

  // Save reading position to AsyncStorage for app launch continuity
  const { savePosition } = useLastReadPosition();

  // Track recently viewed books
  const { addRecentBook } = useRecentBooks();

  // Prefetch next/previous chapters in background (Task 5.5, 6.5)
  const prefetchNext = usePrefetchNextChapter(validBookId, validChapter, totalChapters);
  const prefetchPrevious = usePrefetchPreviousChapter(validBookId, validChapter);

  // Get navigation metadata using hook (Task 4.5)
  const { nextChapter, prevChapter, canGoNext, canGoPrevious } = useChapterNavigation(
    validBookId,
    validChapter,
    booksMetadata
  );

  // Save reading position on mount and navigation (API)
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  useEffect(() => {
    saveLastRead({
      user_id: 'guest', // TODO: Replace with actual user ID when auth is added
      book_id: validBookId,
      chapter_number: validChapter,
    });
  }, [validBookId, validChapter]);

  // Save reading position to AsyncStorage for app launch continuity
  // Save whenever bookId, chapter, tab, or view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: savePosition is a stable function
  useEffect(() => {
    savePosition({
      type: 'bible',
      bookId: validBookId,
      chapterNumber: validChapter,
      activeTab,
      activeView,
    });
  }, [validBookId, validChapter, activeTab, activeView]);

  // Track recently viewed book when chapter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: addRecentBook is a stable function
  useEffect(() => {
    // Only add to recent books when bookId changes (not on every chapter change within the same book)
    addRecentBook(validBookId);
  }, [validBookId]);

  // Prefetch adjacent chapters after active content loads (Task 5.5, 6.5, 4.6)
  useEffect(() => {
    if (chapter && !isLoading) {
      // Delay prefetch to avoid blocking main content (Task 4.6: 1 second delay)
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
   * Handle page change from ChapterPagerView (Task 4.4)
   *
   * Updates:
   * - URL with setParams() (no animation, just updates URL)
   * - Save last read position
   * - Trigger prefetch after 1s delay
   * - Haptic feedback (medium impact)
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  const handlePageChange = useCallback(
    (newBookId: number, newChapterNumber: number) => {
      // Use router.replace for swipe navigation
      // Note: Animation comes from URL change, not router.replace itself
      router.replace(`/bible/${newBookId}/${newChapterNumber}` as never);

      // Save reading position
      saveLastRead({
        user_id: 'guest',
        book_id: newBookId,
        chapter_number: newChapterNumber,
      });

      // Haptic feedback for page change
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Prefetch adjacent chapters after 1 second delay (Task 4.6)
      setTimeout(() => {
        prefetchNext();
        prefetchPrevious();
      }, 1000);
    },
    [prefetchNext, prefetchPrevious]
  );

  /**
   * Navigate to previous chapter using PagerView ref
   *
   * Handles:
   * - Triggers PagerView page change (horizontal slide animation)
   * - Boundary checking (don't go before Genesis 1)
   * - Haptic feedback
   */
  const handlePrevious = useCallback(() => {
    if (canGoPrevious && prevChapter) {
      // Haptic feedback for button press
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Trigger PagerView page change (swipe right to previous chapter)
      pagerRef.current?.setPage(CENTER_INDEX - 1);
    } else {
      // Already at Genesis 1, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoPrevious, prevChapter]);

  /**
   * Navigate to next chapter using PagerView ref
   *
   * Handles:
   * - Triggers PagerView page change (horizontal slide animation)
   * - Boundary checking (don't go past Revelation 22)
   * - Haptic feedback
   */
  const handleNext = useCallback(() => {
    if (canGoNext && nextChapter) {
      // Haptic feedback for button press
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Trigger PagerView page change (swipe left to next chapter)
      pagerRef.current?.setPage(CENTER_INDEX + 1);
    } else {
      // Already at Revelation 22, show error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canGoNext, nextChapter]);

  // Update last read position when chapter changes
  useEffect(() => {
    savePosition({
      type: 'bible',
      bookId,
      chapterNumber,
      activeTab,
      activeView,
    });
  }, [bookId, chapterNumber, activeTab, activeView, savePosition]);

  // Show skeleton loader while loading and no data is available
  if (isLoading && !chapter) {
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

      {/* ChapterPagerView with 5-page fixed window (Task 4.3) */}
      <ChapterPagerView
        ref={pagerRef}
        initialBookId={validBookId}
        initialChapter={validChapter}
        activeTab={activeTab}
        activeView={activeView}
        targetVerse={targetVerse}
        onPageChange={handlePageChange}
        onScroll={handleScroll}
        onTap={handleTap}
      />

      {/* Floating Action Buttons (Task 6.2, 6.4, 4.5) */}
      <FloatingActionButtons
        onPrevious={handlePrevious}
        onNext={handleNext}
        showPrevious={canGoPrevious}
        showNext={canGoNext}
        visible={fabVisible}
      />

      {/* Progress Bar (Task 8.4) */}
      <ProgressBar percentage={progress.percentage} />

      {/* Navigation Modal (Task 7.9) - Only render when needed to prevent Android flash */}
      {isNavigationModalOpen && (
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          onClose={() => setIsNavigationModalOpen(false)}
          currentBookId={validBookId}
          currentChapter={validChapter}
          onSelectChapter={(bookId, chapter) => {
            router.replace(`/bible/${bookId}/${chapter}` as never);
          }}
          onSelectTopic={(topicId, category) => {
            router.push({
              pathname: '/topics/[topicId]',
              params: { topicId, category },
            });
          }}
        />
      )}

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
  // Get theme directly inside ChapterHeader (no props drilling)
  const { colors, mode } = useTheme();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createHeaderStyles(headerSpecs, colors), [headerSpecs, colors]);
  const insets = useSafeAreaInsets();

  // Animation for sliding toggle indicator
  const toggleSlideAnim = useRef(new Animated.Value(activeView === 'bible' ? 0 : 1)).current;
  const [buttonWidth, setButtonWidth] = useState(0);

  // Animate toggle indicator when activeView changes
  useEffect(() => {
    Animated.spring(toggleSlideAnim, {
      toValue: activeView === 'bible' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [activeView, toggleSlideAnim]);

  // Measure button container to calculate proper button widths
  const handleToggleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    // Each button width = (containerWidth - padding - gap) / 2
    // containerWidth - 8 (padding) - 4 (gap) = containerWidth - 12
    const singleButtonWidth = (width - 12) / 2;
    setButtonWidth(singleButtonWidth);
  };

  // Calculate translateX for sliding indicator
  const indicatorTranslateX = toggleSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, buttonWidth + 3], // Add gap (4px) + extra left padding (3px) for Insight
  });

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]} testID="chapter-header">
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
          <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
        </View>
      </Pressable>

      {/* Action Icons */}
      <View style={styles.headerActions}>
        {/* Bible/Commentary Toggle (Figma pill-style) */}
        <View style={styles.toggleContainer} onLayout={handleToggleLayout}>
          {/* Sliding indicator background */}
          <Animated.View
            style={[
              styles.toggleIndicator,
              {
                width: buttonWidth,
                transform: [
                  {
                    translateX: indicatorTranslateX,
                  },
                ],
              },
            ]}
          />
          <Pressable
            onPress={() => onViewChange('bible')}
            style={styles.toggleButton}
            accessibilityLabel="Bible reading view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'bible' }}
            testID="bible-view-toggle"
          >
            <Text style={[styles.toggleText, activeView === 'bible' && styles.toggleTextActive]}>
              Bible
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onViewChange('explanations')}
            style={styles.toggleButton}
            accessibilityLabel="Insight view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'explanations' }}
            testID="commentary-view-toggle"
          >
            <Text
              style={[
                styles.toggleText,
                activeView === 'explanations' && styles.toggleTextActive,
                { paddingLeft: 5 },
              ]}
            >
              Insight
            </Text>
          </Pressable>
        </View>

        {/* Offline Indicator (Task 8.6) */}
        <OfflineIndicator />

        {/* Hamburger Menu Icon (Task 8.5) */}
        <Pressable
          onPress={onMenuPress}
          style={styles.iconButton}
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          testID="hamburger-menu-button"
        >
          <Ionicons name="menu" size={headerSpecs.iconSize} color={headerSpecs.iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Creates styles for ChapterHeader component
 */
const createHeaderStyles = (
  headerSpecs: ReturnType<typeof getHeaderSpecs>,
  themeColors: ReturnType<typeof import('@/constants/bible-design-tokens').getColors>
) =>
  StyleSheet.create({
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
    // Figma pill-style toggle
    toggleContainer: {
      backgroundColor: '#323232',
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      position: 'relative',
    },
    toggleIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: themeColors.gold,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    toggleButton: {
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 100,
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    toggleButtonActive: {
      backgroundColor: 'transparent',
    },
    toggleText: {
      fontSize: 14,
      color: headerSpecs.titleColor,
      fontWeight: '400',
    },
    toggleTextActive: {
      color: themeColors.black,
    },
  });

/**
 * Creates styles for ChapterScreen component
 */
const createStyles = (
  colors: ReturnType<typeof import('@/constants/bible-design-tokens').getColors>,
  _mode: 'light' | 'dark'
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background, // Match content background to prevent flash during route updates
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
  });
