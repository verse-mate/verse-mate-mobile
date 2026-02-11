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
 * Architecture (V3 Rewrite):
 * - UI Layer: SimpleChapterPager renders pages, ChapterHeader displays text from props
 * - State Layer: useChapterState hook holds single source of truth
 * - Logic Layer: useChapterNavigation calculates next/prev chapters
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BibleContentPanel } from '@/components/bible/BibleContentPanel';
import { BibleExplanationsPanel } from '@/components/bible/BibleExplanationsPanel';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { ChapterPage } from '@/components/bible/ChapterPage';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { ProgressBar } from '@/components/bible/ProgressBar';
import { SimpleChapterPager } from '@/components/bible/SimpleChapterPager';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { SplitView } from '@/components/ui/SplitView';
import { getHeaderSpecs, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { BibleInteractionProvider } from '@/contexts/BibleInteractionContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useActiveTab,
  useActiveView,
  useBookProgress,
  useChapterReadingDuration,
  useChapterState,
  useLastReadPosition,
  useViewModeDuration,
} from '@/hooks/bible';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import { useFABVisibility } from '@/hooks/bible/use-fab-visibility';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  useBibleChapter,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api';

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
 * - Redirecting invalid bookId/chapter to Genesis 1
 * - Tab content loading with crossfade transitions
 * - Background prefetching for inactive tabs
 * - Chapter navigation via floating buttons
 * - Chapter navigation via swipe (SimpleChapterPager - V3)
 * - Linear navigation at Bible boundaries (no circular wrap in MVP)
 * - Progress bar display
 * - Hamburger menu
 * - Offline indicator
 * - View mode switching (Bible vs Explanations)
 * - Analytics tracking for CHAPTER_VIEWED
 * - Chapter reading duration tracking
 */
export default function ChapterScreen() {
  // V3 State Layer: Single source of truth for chapter navigation
  const { bookId, chapterNumber, bookName, navigateToChapter, booksMetadata, totalChapters } =
    useChapterState();

  // Extract verse/tab params (not managed by useChapterState)
  const params = useLocalSearchParams<{
    verse?: string;
    endVerse?: string;
    tab?: string;
  }>();
  const targetVerse = params.verse ? Number(params.verse) : undefined;
  const targetEndVerse = params.endVerse ? Number(params.endVerse) : undefined;

  // Auth - get current user for saving reading progress
  const { user } = useAuth();

  // Theme
  const { colors, mode } = useTheme();
  const styles = createStyles(colors, mode);

  // Device info for split view detection
  const { useSplitView, splitRatio, setSplitRatio, splitViewMode, setSplitViewMode } =
    useDeviceInfo();

  // Bible version for analytics
  const { bibleVersion } = useBibleVersion();

  // Get active tab from persistence
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence
  const { activeView, setActiveView } = useActiveView();

  // Track chapter reading duration (Time-Based Analytics)
  // Hook fires CHAPTER_READING_DURATION event on unmount with AppState awareness
  useChapterReadingDuration(bookId, chapterNumber, bibleVersion);

  // Track view mode duration (Time-Based Analytics)
  // Hook fires VIEW_MODE_DURATION event when view mode changes or on unmount
  useViewModeDuration(activeView, bookId, chapterNumber, bibleVersion);

  // Ensure deep-linked verse jumps use Bible view so scroll-to-verse can run
  // Only force on initial mount, not when user switches tabs manually
  const hasSetInitialView = useRef(false);
  useEffect(() => {
    if (targetVerse && !hasSetInitialView.current) {
      hasSetInitialView.current = true;
      if (activeView !== 'bible') {
        setActiveView('bible');
      }
    }
  }, [targetVerse, activeView, setActiveView]);

  // Handle deep-linked insight tab parameter
  // When user opens a shared insight URL, navigate to that specific tab
  const hasSetInitialTab = useRef(false);
  useEffect(() => {
    const deeplinkTab = params.tab;
    if (deeplinkTab && !hasSetInitialTab.current) {
      hasSetInitialTab.current = true;
      // Validate that the tab parameter is a valid ContentTabType
      if (deeplinkTab === 'summary' || deeplinkTab === 'byline' || deeplinkTab === 'detailed') {
        setActiveTab(deeplinkTab);
        // Force explanations view to show the insight tab
        if (activeView !== 'explanations') {
          setActiveView('explanations');
        }
      }
    }
  }, [params.tab, setActiveTab, activeView, setActiveView]);

  // Navigation modal state
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // FAB visibility state - manages auto-hide/show based on user interaction
  const {
    visible: fabVisible,
    handleScroll,
    handleTap,
  } = useFABVisibility({
    initialVisible: true,
  });

  // Calculate progress percentage
  const { progress } = useBookProgress(bookId, chapterNumber, totalChapters);

  // Fetch chapter data for loading state check
  const { data: rawChapter, isLoading } = useBibleChapter(bookId, chapterNumber);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure has varying properties not captured by generated types
  const chapter = rawChapter as any;

  // Save reading position mutation (API)
  const { mutate: saveLastRead } = useSaveLastRead();

  // Save reading position to AsyncStorage for app launch continuity
  const { savePosition } = useLastReadPosition();

  // Track recently viewed books
  const { addRecentBook } = useRecentBooks();

  // Prefetch next/previous chapters in background
  const prefetchNext = usePrefetchNextChapter(bookId, chapterNumber, totalChapters);
  const prefetchPrevious = usePrefetchPreviousChapter(bookId, chapterNumber);

  // Get navigation metadata using hook
  // V3: Linear navigation mode (no circular wrap)
  const { canGoNext, canGoPrevious, nextChapter, prevChapter } = useChapterNavigation(
    bookId,
    chapterNumber,
    booksMetadata
  );

  // Save reading position on mount and navigation (API) - only for authenticated users
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  useEffect(() => {
    if (user?.id) {
      saveLastRead({
        user_id: user.id,
        book_id: bookId,
        chapter_number: chapterNumber,
      });
    }
  }, [bookId, chapterNumber, user?.id]);

  // Save reading position to AsyncStorage for app launch continuity
  // Save whenever bookId, chapter, tab, or view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: savePosition is a stable function
  useEffect(() => {
    savePosition({
      type: 'bible',
      bookId: bookId,
      chapterNumber: chapterNumber,
      activeTab,
      activeView,
    });
  }, [bookId, chapterNumber, activeTab, activeView]);

  // Track recently viewed book when chapter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: addRecentBook is a stable function
  useEffect(() => {
    // Only add to recent books when bookId changes (not on every chapter change within the same book)
    addRecentBook(bookId);
  }, [bookId]);

  // Track CHAPTER_VIEWED analytics event
  // Fires once per chapter navigation, not on re-renders
  useEffect(() => {
    // Only track when we have valid params
    if (bookId >= 1 && bookId <= 66 && chapterNumber >= 1) {
      analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: bookId,
        chapterNumber: chapterNumber,
        bibleVersion,
      });
    }
  }, [bookId, chapterNumber, bibleVersion]);

  // Prefetch adjacent chapters after active content loads
  useEffect(() => {
    if (chapter && !isLoading) {
      // Delay prefetch to avoid blocking main content (1 second delay)
      const timeoutId = setTimeout(() => {
        prefetchNext();
        prefetchPrevious();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [chapter, isLoading, prefetchNext, prefetchPrevious]);

  /**
   * Handle view mode change with haptic feedback
   */
  const handleViewChange = useCallback(
    (view: ViewMode) => {
      // Skip if already on this view
      if (view === activeView) return;

      // Trigger haptic feedback (non-blocking)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Update view immediately
      setActiveView(view);
    },
    [activeView, setActiveView]
  );

  /**
   * Handle page change from SimpleChapterPager (V3)
   *
   * Updates:
   * - Local state immediately (instant UI update)
   * - URL via debounced effect (silent background sync)
   * - Save last read position
   * - Trigger prefetch after 1s delay
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  const handlePageChange = useCallback(
    (newBookId: number, newChapterNumber: number) => {
      // Update state via hook (V3: single source of truth)
      navigateToChapter(newBookId, newChapterNumber);

      // Haptic feedback for chapter change
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Save reading position - only for authenticated users
      if (user?.id) {
        saveLastRead({
          user_id: user.id,
          book_id: newBookId,
          chapter_number: newChapterNumber,
        });
      }

      // Prefetch adjacent chapters after 1 second delay
      setTimeout(() => {
        prefetchNext();
        prefetchPrevious();
      }, 1000);
    },
    [navigateToChapter, prefetchNext, prefetchPrevious, user?.id]
  );

  /**
   * Navigate to previous chapter
   *
   * V3 Linear mode: At Genesis 1, this does nothing (canGoPrevious is false)
   */
  const handlePrevious = useCallback(() => {
    if (!canGoPrevious || !prevChapter) return;

    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update state via hook (V3: single source of truth)
    navigateToChapter(prevChapter.bookId, prevChapter.chapterNumber);
  }, [canGoPrevious, prevChapter, navigateToChapter]);

  /**
   * Navigate to next chapter
   *
   * V3 Linear mode: At Revelation 22, this does nothing (canGoNext is false)
   */
  const handleNext = useCallback(() => {
    if (!canGoNext || !nextChapter) return;

    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update state via hook (V3: single source of truth)
    navigateToChapter(nextChapter.bookId, nextChapter.chapterNumber);
  }, [canGoNext, nextChapter, navigateToChapter]);

  /**
   * Render chapter page content for SimpleChapterPager
   *
   * This is passed to SimpleChapterPager.renderChapterPage prop
   */
  const renderChapterPage = useCallback(
    (pageBookId: number, pageChapterNumber: number) => {
      return (
        <ChapterPage
          bookId={pageBookId}
          chapterNumber={pageChapterNumber}
          activeTab={activeTab}
          activeView={activeView}
          onScroll={handleScroll}
          onTap={handleTap}
          // Only pass target verse to the current page
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
    [
      activeTab,
      activeView,
      handleScroll,
      handleTap,
      bookId,
      chapterNumber,
      targetVerse,
      targetEndVerse,
    ]
  );

  // Show skeleton loader while loading and no data is available
  if (isLoading && !chapter) {
    return (
      <View style={styles.container}>
        <ChapterHeader
          bookName={bookName}
          chapterNumber={chapterNumber}
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
          chapterNumber={chapterNumber}
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
    <BibleInteractionProvider
      bookId={bookId}
      chapterNumber={chapterNumber}
      bookName={chapter.bookName}
    >
      <View style={styles.container}>
        {/* Split View Layout for Landscape/Tablet */}
        {useSplitView ? (
          <>
            <SplitView
              splitRatio={splitRatio}
              onSplitRatioChange={setSplitRatio}
              viewMode={splitViewMode}
              onViewModeChange={setSplitViewMode}
              edgeTabsVisible={fabVisible}
              leftContent={
                <BibleContentPanel
                  bookId={bookId}
                  chapterNumber={chapterNumber}
                  bookName={chapter.bookName}
                  totalChapters={totalChapters}
                  canGoPrevious={canGoPrevious}
                  canGoNext={canGoNext}
                  onHeaderPress={() => setIsNavigationModalOpen(true)}
                  onPageChange={handlePageChange}
                  onNavigatePrev={handlePrevious}
                  onNavigateNext={handleNext}
                  onScroll={handleScroll}
                  onTap={handleTap}
                  targetVerse={targetVerse}
                  targetEndVerse={targetEndVerse}
                  visible={fabVisible}
                />
              }
              rightContent={
                <BibleExplanationsPanel
                  bookId={bookId}
                  chapterNumber={chapterNumber}
                  bookName={chapter.bookName}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onMenuPress={() => setIsMenuOpen(true)}
                  onScroll={handleScroll}
                  onTap={handleTap}
                />
              }
            />

            {/* Hamburger Menu */}
            <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
          </>
        ) : (
          <>
            {/* Fixed Header - V3: Receives bookName and chapterNumber from state */}
            <ChapterHeader
              bookName={bookName}
              chapterNumber={chapterNumber}
              activeView={activeView}
              onNavigationPress={() => {
                setIsNavigationModalOpen(true);
              }}
              navigationModalVisible={isNavigationModalOpen}
              onViewChange={handleViewChange}
              onMenuPress={() => {
                setIsMenuOpen(true);
              }}
            />

            {/* Content Tabs - Only visible in Explanations view */}
            <View style={activeView !== 'explanations' && { height: 0, overflow: 'hidden' }}>
              <ChapterContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </View>

            {/* SimpleChapterPager - V3 3-page window with linear navigation */}
            <SimpleChapterPager
              key={`pager-${bookId}-${chapterNumber}`}
              bookId={bookId}
              chapterNumber={chapterNumber}
              bookName={bookName}
              booksMetadata={booksMetadata}
              onChapterChange={handlePageChange}
              renderChapterPage={renderChapterPage}
            />

            {/* Floating Action Buttons - V3: Disabled at boundaries */}
            <FloatingActionButtons
              onPrevious={handlePrevious}
              onNext={handleNext}
              showPrevious={canGoPrevious}
              showNext={canGoNext}
              visible={fabVisible}
            />

            {/* Progress Bar */}
            <ProgressBar percentage={progress.percentage} />

            {/* Hamburger Menu */}
            <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
          </>
        )}

        {/* Navigation Modal - Consolidated outside conditional blocks */}
        {isNavigationModalOpen && (
          <BibleNavigationModal
            visible={isNavigationModalOpen}
            onClose={() => setIsNavigationModalOpen(false)}
            currentBookId={bookId}
            currentChapter={chapterNumber}
            onSelectChapter={(selectedBookId, chapterNum) => {
              setIsNavigationModalOpen(false);
              // Always default to Bible text view when switching books via modal
              setActiveView('bible');
              // V3: Update state via hook (single source of truth)
              navigateToChapter(selectedBookId, chapterNum);
            }}
            onSelectTopic={(topicId, category) => {
              setIsNavigationModalOpen(false);
              // Always default to Bible text view when navigating to topics
              setActiveView('bible');
              router.push({
                pathname: '/topics/[topicId]',
                params: { topicId, category },
              });
            }}
          />
        )}
      </View>
    </BibleInteractionProvider>
  );
}

/**
 * Chapter Header Component
 *
 * Fixed header with book/chapter title and action icons
 * - Chapter text (clickable to open chapter selector)
 * - Bible view icon (shows Bible reading mode)
 * - Explanations view icon (shows AI explanations mode)
 * - Offline indicator (shows when offline)
 * - Hamburger menu icon (opens menu)
 *
 * V3: Receives bookName and chapterNumber as props from state layer.
 * No hooks or context used inside for navigation state.
 */
interface ChapterHeaderProps {
  bookName: string;
  chapterNumber: number;
  activeView: ViewMode;
  onNavigationPress: () => void;
  onViewChange: (view: ViewMode) => void;
  onMenuPress: () => void;
  navigationModalVisible?: boolean;
}

function ChapterHeader({
  bookName,
  chapterNumber,
  activeView,
  onNavigationPress,
  onViewChange,
  onMenuPress,
  navigationModalVisible,
}: ChapterHeaderProps) {
  // Get theme directly inside ChapterHeader (no props drilling)
  const { colors, mode } = useTheme();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createHeaderStyles(headerSpecs, colors), [headerSpecs, colors]);
  const insets = useSafeAreaInsets();

  // Animation for sliding toggle indicator (using Reanimated for native thread performance)
  const toggleProgress = useSharedValue(activeView === 'bible' ? 0 : 1);
  const [bibleButtonWidth, setBibleButtonWidth] = useState(0);
  const [insightButtonWidth, setInsightButtonWidth] = useState(0);

  // Animate toggle indicator when activeView changes
  useEffect(() => {
    toggleProgress.value = withTiming(activeView === 'bible' ? 0 : 1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeView, toggleProgress]);

  // Measure individual button widths
  const handleBibleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBibleButtonWidth(width);
  };

  const handleInsightLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setInsightButtonWidth(width);
  };

  // Animated style for the indicator (runs on native thread)
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const translateX = toggleProgress.value * Math.max(0, bibleButtonWidth + 4);
    const width = bibleButtonWidth + toggleProgress.value * (insightButtonWidth - bibleButtonWidth);

    return {
      transform: [{ translateX }],
      width: Math.max(0, width),
    };
  }, [bibleButtonWidth, insightButtonWidth]);

  /**
   * Safe navigation press handler to prevent double-triggering
   */
  const handleNavigationPress = () => {
    if (!navigationModalVisible) {
      onNavigationPress();
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]} testID="chapter-header">
      {/* Chapter Title Button (clickable to open navigation) */}
      <Pressable
        onPress={handleNavigationPress}
        style={styles.chapterButton}
        accessibilityLabel={`Select chapter, currently ${bookName} ${chapterNumber}`}
        accessibilityRole="button"
        accessibilityHint="Opens chapter selection menu"
        testID="chapter-selector-button"
      >
        <View style={styles.chapterButtonContent}>
          <Text style={styles.headerTitle} testID="chapter-header-text">
            {bookName} {chapterNumber}
          </Text>
          <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
        </View>
      </Pressable>

      {/* Action Icons */}
      <View style={styles.headerActions}>
        {/* Bible/Commentary Toggle (Figma pill-style) */}
        <View style={styles.toggleContainer}>
          {/* Sliding indicator background */}
          <Animated.View style={[styles.toggleIndicator, indicatorAnimatedStyle]} />
          <Pressable
            onPress={() => onViewChange('bible')}
            style={({ pressed }) => [styles.toggleButton, pressed && styles.toggleButtonPressed]}
            onLayout={handleBibleLayout}
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
            style={({ pressed }) => [styles.toggleButton, pressed && styles.toggleButtonPressed]}
            onLayout={handleInsightLayout}
            accessibilityLabel="Insight view"
            accessibilityRole="button"
            accessibilityState={{ selected: activeView === 'explanations' }}
            testID="commentary-view-toggle"
          >
            <Text
              style={[styles.toggleText, activeView === 'explanations' && styles.toggleTextActive]}
            >
              Insight
            </Text>
          </Pressable>
        </View>

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Hamburger Menu Icon */}
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
    toggleButtonPressed: {
      opacity: 0.7,
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
