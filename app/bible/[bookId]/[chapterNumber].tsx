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
 * @see Time-Based Analytics - Chapter reading duration tracking
 * @see Circular Bible Navigation - Seamless wrap-around at Bible boundaries
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
import type { ChapterPagerViewRef } from '@/components/bible/ChapterPagerView';
import { ChapterPagerView } from '@/components/bible/ChapterPagerView';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { OfflineIndicator } from '@/components/bible/OfflineIndicator';
import { ProgressBar } from '@/components/bible/ProgressBar';
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
  useBibleTestaments,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api';

/**
 * View mode type for Bible reading interface
 */
type ViewMode = 'bible' | 'explanations';

/**
 * Center index for 7-page window in ChapterPagerView
 */

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
 * - Circular navigation at Bible boundaries (Genesis 1 <-> Revelation 22)
 * - Progress bar display (Task 8.4)
 * - Hamburger menu (Task 8.5)
 * - Offline indicator (Task 8.6)
 * - View mode switching (Bible vs Explanations)
 * - Analytics tracking for CHAPTER_VIEWED (Task 4.2)
 * - Chapter reading duration tracking (Time-Based Analytics)
 */
export default function ChapterScreen() {
  // Extract and validate route params
  const params = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
    verse?: string;
    endVerse?: string;
    tab?: string;
  }>();
  const targetVerse = params.verse ? Number(params.verse) : undefined;
  const targetEndVerse = params.endVerse ? Number(params.endVerse) : undefined;

  // Local state for immediate UI updates (Source of Truth for UI)
  // Initialized from params, but can diverge during swiping
  const [activeBookId, setActiveBookId] = useState(Number(params.bookId));
  const [activeChapter, setActiveChapter] = useState(Number(params.chapterNumber));

  // Sync local state from params ONLY when params change significantly (e.g. deep link, menu nav)
  // avoiding loops with our own debounced updates
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeBookId and activeChapter are intentionally omitted to prevent snap-back during swiping
  useEffect(() => {
    const paramBookId = Number(params.bookId);
    const paramChapter = Number(params.chapterNumber);
    if (
      !Number.isNaN(paramBookId) &&
      !Number.isNaN(paramChapter) &&
      (paramBookId !== activeBookId || paramChapter !== activeChapter)
    ) {
      setActiveBookId(paramBookId);
      setActiveChapter(paramChapter);
    }
  }, [params.bookId, params.chapterNumber]); // Sync correctly without loops

  // Debounced URL sync (The "Follower")
  // Updates the URL silently after user stops swiping to prevent global re-renders during animation
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only update if URL is different from current state
      if (
        Number(params.bookId) !== activeBookId ||
        Number(params.chapterNumber) !== activeChapter
      ) {
        router.setParams({
          bookId: activeBookId.toString(),
          chapterNumber: activeChapter.toString(),
          // Clear verse params when chapter changes to prevent "sticky" highlighting
          verse: undefined,
          endVerse: undefined,
        });
      }
    }, 1000); // Increased to 1000ms for stability

    return () => clearTimeout(timer);
  }, [activeBookId, activeChapter, params.bookId, params.chapterNumber]);

  // Auth - get current user for saving reading progress
  const { user } = useAuth();

  // Theme
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  // Device info for split view detection
  const { useSplitView, splitRatio, setSplitRatio, splitViewMode, setSplitViewMode } =
    useDeviceInfo();

  // Bible version for analytics
  const { bibleVersion } = useBibleVersion();

  // Get active tab from persistence
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence
  const { activeView, setActiveView } = useActiveView();

  // Use local state for API calls (defined early for hooks)
  const validBookId = Math.max(1, Math.min(66, activeBookId));
  const validChapter = Math.max(1, activeChapter);

  // Track chapter reading duration (Time-Based Analytics)
  // Hook fires CHAPTER_READING_DURATION event on unmount with AppState awareness
  useChapterReadingDuration(validBookId, validChapter, bibleVersion);

  // Track view mode duration (Time-Based Analytics)
  // Hook fires VIEW_MODE_DURATION event when view mode changes or on unmount
  useViewModeDuration(activeView, validBookId, validChapter, bibleVersion);

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
    () => booksMetadata?.find((book) => book.id === activeBookId),
    [booksMetadata, activeBookId]
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
    if (activeBookId < 1 || activeBookId > 66) {
      // Invalid bookId, redirect to Genesis 1
      setActiveBookId(1);
      setActiveChapter(1);
      return;
    }

    // Validate chapter number (must be positive and within book's range)
    if (activeChapter < 1) {
      // Invalid chapter, redirect to book's first chapter
      setActiveChapter(1);
      return;
    }

    // If we have book metadata, validate against actual chapter count
    if (bookMetadata && activeChapter > bookMetadata.chapterCount) {
      // Chapter exceeds book's chapter count, redirect to first chapter
      setActiveChapter(1);
    }
  }, [activeBookId, activeChapter, bookMetadata]);

  // Calculate progress percentage (Task 8.4)
  const { progress } = useBookProgress(validBookId, validChapter, totalChapters);

  // Fetch chapter data for loading state check
  const { data: rawChapter, isLoading } = useBibleChapter(validBookId, validChapter);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure has varying properties not captured by generated types
  const chapter = rawChapter as any;

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
  // With circular navigation, canGoNext and canGoPrevious are always true
  const { canGoNext, canGoPrevious } = useChapterNavigation(
    validBookId,
    validChapter,
    booksMetadata
  );

  // Save reading position on mount and navigation (API) - only for authenticated users
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  useEffect(() => {
    if (user?.id) {
      saveLastRead({
        user_id: user.id,
        book_id: validBookId,
        chapter_number: validChapter,
      });
    }
  }, [validBookId, validChapter, user?.id]);

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

  // Track CHAPTER_VIEWED analytics event (Task 4.2)
  // Fires once per chapter navigation, not on re-renders
  useEffect(() => {
    // Only track when we have valid params
    if (validBookId >= 1 && validBookId <= 66 && validChapter >= 1) {
      analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: validBookId,
        chapterNumber: validChapter,
        bibleVersion,
      });
    }
  }, [validBookId, validChapter, bibleVersion]);

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
   * Handle page change from ChapterPagerView (Task 4.4)
   *
   * Updates:
   * - Local state immediately (instant UI update)
   * - URL via debounced effect (silent background sync)
   * - Save last read position
   * - Trigger prefetch after 1s delay
   * - Haptic feedback (INSTANTLY handled by PagerView natively)
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveLastRead is a stable mutation function
  const handlePageChange = useCallback(
    (newBookId: number, newChapterNumber: number) => {
      // Update local state IMMEDIATELY to prevent flash
      setActiveBookId(newBookId);
      setActiveChapter(newChapterNumber);

      // Save reading position - only for authenticated users
      if (user?.id) {
        saveLastRead({
          user_id: user.id,
          book_id: newBookId,
          chapter_number: newChapterNumber,
        });
      }

      // Prefetch adjacent chapters after 1 second delay (Task 4.6)
      setTimeout(() => {
        prefetchNext();
        prefetchPrevious();
      }, 1000);
    },
    [prefetchNext, prefetchPrevious, user?.id]
  );

  /**
   * Navigate to previous chapter using PagerView ref
   *
   * With circular navigation enabled, this always triggers navigation:
   * - At Genesis 1: navigates to Revelation 22 (wraps around)
   * - At any other chapter: navigates to previous chapter
   *
   * Uses medium impact haptic feedback for all navigation.
   */
  const handlePrevious = useCallback(() => {
    // With circular navigation, canGoPrevious is always true when metadata is loaded
    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Trigger PagerView page change (swipe right to previous chapter)
    pagerRef.current?.goPrevious();
  }, []);

  /**
   * Navigate to next chapter using PagerView ref
   *
   * With circular navigation enabled, this always triggers navigation:
   * - At Revelation 22: navigates to Genesis 1 (wraps around)
   * - At any other chapter: navigates to next chapter
   *
   * Uses medium impact haptic feedback for all navigation.
   */
  const handleNext = useCallback(() => {
    // With circular navigation, canGoNext is always true when metadata is loaded
    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Trigger PagerView page change (swipe left to next chapter)
    pagerRef.current?.goNext();
  }, []);

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
    <BibleInteractionProvider
      bookId={validBookId}
      chapterNumber={validChapter}
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
                  bookId={validBookId}
                  chapterNumber={validChapter}
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
                  bookId={validBookId}
                  chapterNumber={validChapter}
                  bookName={chapter.bookName}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onMenuPress={() => setIsMenuOpen(true)}
                  onScroll={handleScroll}
                  onTap={handleTap}
                />
              }
            />

            {/* Hamburger Menu (Task 8.5) */}
            <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
          </>
        ) : (
          <>
            {/* Fixed Header (Task 8.6 - includes OfflineIndicator) */}
            <ChapterHeader
              bookName={chapter.bookName}
              chapterNumber={chapter.chapterNumber}
              activeView={activeView}
              onNavigationPress={() => {
                setIsNavigationModalOpen(true); // Task 7.9
              }}
              navigationModalVisible={isNavigationModalOpen}
              onViewChange={handleViewChange}
              onMenuPress={() => {
                setIsMenuOpen(true); // Task 8.5
              }}
            />

            {/* Content Tabs (Task 5.3) - Only visible in Explanations view */}
            <View style={activeView !== 'explanations' && { height: 0, overflow: 'hidden' }}>
              <ChapterContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </View>

            {/* ChapterPagerView with 5-page fixed window (Task 4.3) */}
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={validBookId}
              initialChapter={validChapter}
              activeTab={activeTab}
              activeView={activeView}
              targetVerse={targetVerse}
              targetEndVerse={targetEndVerse}
              onPageChange={handlePageChange}
              onScroll={handleScroll}
              onTap={handleTap}
            />

            {/* Floating Action Buttons - Always visible with circular navigation */}
            <FloatingActionButtons
              onPrevious={handlePrevious}
              onNext={handleNext}
              showPrevious={true}
              showNext={true}
              visible={fabVisible}
            />

            {/* Progress Bar (Task 8.4) */}
            <ProgressBar percentage={progress.percentage} />

            {/* Hamburger Menu (Task 8.5) */}
            <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
          </>
        )}

        {/* Navigation Modal (Task 7.9) - Consolidated outside conditional blocks */}
        {isNavigationModalOpen && (
          <BibleNavigationModal
            visible={isNavigationModalOpen}
            onClose={() => setIsNavigationModalOpen(false)}
            currentBookId={validBookId}
            currentChapter={validChapter}
            onSelectChapter={(bookId, chapter) => {
              setIsNavigationModalOpen(false);
              // Always default to Bible text view when switching books via modal
              setActiveView('bible');
              router.setParams({
                bookId: bookId.toString(),
                chapterNumber: chapter.toString(),
                verse: undefined,
                endVerse: undefined,
              });
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
          <Text style={styles.headerTitle}>
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
