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
 * @see Chapter View State Refactor - Single Source of Truth pattern (Task Group 4)
 * @see Task Group 5 - Consolidated Cascading Effects with debouncing
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
import {
  ChapterNavigationProvider,
  useChapterNavigation as useChapterNavigationContext,
} from '@/contexts/ChapterNavigationContext';
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
 * Debounce timing constants for consolidated effects (Task Group 5)
 * These prevent excessive calls during rapid navigation (swiping)
 */
const DEBOUNCE_ANALYTICS_MS = 1000; // Analytics tracking fires after user stops swiping
const DEBOUNCE_SAVE_MS = 1500; // API/AsyncStorage saves combined into single debounced effect

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
 *
 * Task Group 4 (Chapter View State Refactor):
 * - Wraps children with ChapterNavigationProvider
 * - Does NOT own navigation state (context is authoritative)
 * - Reads URL params ONCE on mount to initialize context
 * - Updates URL from context via debounced effect (passive follower pattern)
 * - Modal navigation calls context jumpToChapter
 *
 * Task Group 5 (Consolidated Cascading Effects):
 * - Analytics tracking debounced at 1000ms
 * - API + AsyncStorage saves consolidated and debounced at 1500ms
 * - URL sync debounced at 1000ms (existing)
 * - Prevents excessive effect chains during rapid swiping
 */
export default function ChapterScreen() {
  // Extract and validate route params (read ONCE for initialization)
  const params = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
    verse?: string;
    endVerse?: string;
    tab?: string;
  }>();
  const targetVerse = params.verse ? Number(params.verse) : undefined;
  const targetEndVerse = params.endVerse ? Number(params.endVerse) : undefined;

  // Initial values from URL params (read ONCE on mount)
  // These are used to initialize the context provider and are not updated after mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentional - read params only on mount
  const initialBookId = useMemo(() => {
    const bookId = Number(params.bookId);
    return Number.isNaN(bookId) ? 1 : Math.max(1, Math.min(66, bookId));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentional - read params only on mount
  const initialChapter = useMemo(() => {
    const chapter = Number(params.chapterNumber);
    return Number.isNaN(chapter) ? 1 : Math.max(1, chapter);
  }, []);

  // Ref to ChapterPagerView for programmatic navigation
  const pagerRef = useRef<ChapterPagerViewRef>(null);

  // Fetch book metadata to get initial book name and total chapters
  const { data: booksMetadata } = useBibleTestaments();
  const initialBookMetadata = useMemo(
    () => booksMetadata?.find((book) => book.id === initialBookId),
    [booksMetadata, initialBookId]
  );
  const initialBookName = initialBookMetadata?.name || 'Genesis';

  /**
   * Handle jump to chapter from external navigation (modal, deep link)
   * This callback is passed to ChapterNavigationProvider and called when
   * jumpToChapter is invoked. It updates pager internal state and snaps to center.
   *
   * @see spec: jumpToChapter pager integration pattern
   */
  const handleJumpToChapter = useCallback((bookId: number, chapter: number) => {
    // Use jumpToChapter to update BOTH the pager's internal state AND snap to center
    // This ensures the pager renders the correct chapter content after modal navigation
    pagerRef.current?.jumpToChapter?.(bookId, chapter);
  }, []);

  // Wrap the main content with ChapterNavigationProvider
  // Provider is initialized with URL params and handles all navigation state
  return (
    <ChapterNavigationProvider
      initialBookId={initialBookId}
      initialChapter={initialChapter}
      initialBookName={initialBookName}
      onJumpToChapter={handleJumpToChapter}
    >
      <ChapterScreenContent
        pagerRef={pagerRef}
        targetVerse={targetVerse}
        targetEndVerse={targetEndVerse}
        initialBookId={initialBookId}
        initialChapter={initialChapter}
        initialTab={params.tab}
      />
    </ChapterNavigationProvider>
  );
}

/**
 * Inner content component wrapped by ChapterNavigationProvider
 * This component can use useChapterNavigationContext() because it's inside the provider
 */
interface ChapterScreenContentProps {
  pagerRef: React.RefObject<ChapterPagerViewRef | null>;
  targetVerse?: number;
  targetEndVerse?: number;
  initialBookId: number;
  initialChapter: number;
  initialTab?: string;
}

function ChapterScreenContent({
  pagerRef,
  targetVerse,
  targetEndVerse,
  initialBookId,
  initialChapter,
  initialTab,
}: ChapterScreenContentProps) {
  // Get navigation state from context (Single Source of Truth)
  // ChapterPagerView updates context via setCurrentChapter
  const { currentBookId, currentChapter, jumpToChapter } = useChapterNavigationContext();

  // Get URL params for comparison in URL sync effect
  const params = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
  }>();

  // Fetch book metadata to get book name for external navigation
  const { data: booksMetadata } = useBibleTestaments();

  // Track if we're currently doing an internal URL sync (context → URL)
  // This prevents the external sync effect from triggering on our own updates
  const isInternalSyncRef = useRef(false);

  // Track context values that were set via internal navigation (modal, etc.)
  // When jumpToChapter is called internally, we store the target context values here.
  // The external sync effect skips if context already matches these values, since
  // we don't need to re-sync what was just set internally.
  const internalJumpTargetRef = useRef<{ bookId: number; chapter: number } | null>(null);

  // Track previous context values to detect internal vs external changes
  // External sync should only fire when URL changes WITHOUT a corresponding context change
  const prevContextRef = useRef<{ bookId: number; chapter: number } | null>(null);

  // Debounced URL sync (The "Follower")
  // Updates the URL silently after user stops swiping to prevent global re-renders during animation
  // Reads from CONTEXT state, not local state (Task Group 4.4)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only update if URL is different from current context state
      if (
        Number(params.bookId) !== currentBookId ||
        Number(params.chapterNumber) !== currentChapter
      ) {
        // Mark that we're doing an internal sync
        isInternalSyncRef.current = true;
        router.setParams({
          bookId: currentBookId.toString(),
          chapterNumber: currentChapter.toString(),
          // Clear verse params when chapter changes to prevent "sticky" highlighting
          verse: undefined,
          endVerse: undefined,
        });
        // Reset after a short delay to allow the params to update
        setTimeout(() => {
          isInternalSyncRef.current = false;
        }, 100);
      }
    }, 1000); // 1000ms debounce for stability

    return () => clearTimeout(timer);
  }, [currentBookId, currentChapter, params.bookId, params.chapterNumber]);

  /**
   * External URL Navigation Sync (warm-start deep links)
   *
   * Detects when URL params change from external navigation (bookmarks, topics,
   * external deep links) and syncs them to context via jumpToChapter.
   *
   * This handles the case where the app is already running (warm-start) and
   * receives a deep link to a different chapter. Without this, the context
   * would remain at the old chapter while the URL shows the new one.
   *
   * Important: This effect ONLY fires for TRUE external navigation, not when:
   * 1. Context was just updated internally (modal, swipe) and URL is catching up
   * 2. We just did an internal URL sync
   *
   * @see Task Group 10: Handle External Navigation
   */
  useEffect(() => {
    // Skip if this is an internal sync (we just updated the URL from context)
    if (isInternalSyncRef.current) {
      return;
    }

    const urlBookId = Number(params.bookId);
    const urlChapter = Number(params.chapterNumber);

    // Skip if URL params are invalid
    if (Number.isNaN(urlBookId) || Number.isNaN(urlChapter)) {
      return;
    }

    // Skip if context matches what was set by internal navigation (modal selection, etc.)
    const internalTarget = internalJumpTargetRef.current;
    if (
      internalTarget &&
      currentBookId === internalTarget.bookId &&
      currentChapter === internalTarget.chapter
    ) {
      // Context already has the internal target values - no external sync needed
      // Clear the ref if URL has caught up with context (internal navigation complete)
      if (urlBookId === currentBookId && urlChapter === currentChapter) {
        internalJumpTargetRef.current = null;
      }
      return;
    }

    // Check if this is the initial mount or if context changed since last render
    // On initial mount (prevContext is null), skip external sync because context is
    // already correctly initialized with validated/clamped values from URL params
    const prevContext = prevContextRef.current;
    const isInitialMount = prevContext === null;

    // Check if context changed since last render (internal navigation via swipe/FAB)
    // If context changed, URL just needs to catch up - this is NOT external navigation
    const contextJustChanged =
      !isInitialMount &&
      (prevContext.bookId !== currentBookId || prevContext.chapter !== currentChapter);

    // Update the previous context ref for next render
    prevContextRef.current = { bookId: currentBookId, chapter: currentChapter };

    // Skip external sync on initial mount (context is correctly initialized)
    // or if context just changed internally (URL will catch up via debounce)
    if (isInitialMount || contextJustChanged) {
      return;
    }

    // Check if URL differs from context (external navigation detected)
    // At this point, we know context DIDN'T just change, so if URL differs, it's external
    if (urlBookId !== currentBookId || urlChapter !== currentChapter) {
      // Get book name from metadata for context update
      const book = booksMetadata?.find((b) => b.id === urlBookId);
      const bookName = book?.name || 'Genesis';

      // Sync context to match the external URL via jumpToChapter
      // This also triggers pager snap via the onJumpToChapter callback
      jumpToChapter(urlBookId, urlChapter, bookName);
    }
  }, [
    params.bookId,
    params.chapterNumber,
    currentBookId,
    currentChapter,
    booksMetadata,
    jumpToChapter,
  ]);

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

  // Use context state for API calls and calculations
  const validBookId = Math.max(1, Math.min(66, currentBookId));
  const validChapter = Math.max(1, currentChapter);

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
    if (initialTab && !hasSetInitialTab.current) {
      hasSetInitialTab.current = true;
      // Validate that the tab parameter is a valid ContentTabType
      if (initialTab === 'summary' || initialTab === 'byline' || initialTab === 'detailed') {
        setActiveTab(initialTab);
        // Force explanations view to show the insight tab
        if (activeView !== 'explanations') {
          setActiveView('explanations');
        }
      }
    }
  }, [initialTab, setActiveTab, activeView, setActiveView]);

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

  // Get book metadata for total chapters validation
  // Note: booksMetadata is already fetched above for external navigation sync
  const bookMetadata = useMemo(
    () => booksMetadata?.find((book) => book.id === currentBookId),
    [booksMetadata, currentBookId]
  );
  const totalChapters = bookMetadata?.chapterCount || 50; // Default to 50 if not loaded

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

  // ============================================================================
  // Task Group 5: Consolidated Debounced Effects
  // ============================================================================

  // Refs for debounce timers to ensure proper cleanup
  const analyticsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Consolidated debounced save effect (Task Group 5.5)
   *
   * Combines API save (saveLastRead) and AsyncStorage save (savePosition) into
   * a single debounced effect. This prevents excessive writes during rapid
   * swiping navigation.
   *
   * Debounce: 1500ms - fires once after user stops navigating
   */
  useEffect(() => {
    // Clear any pending save timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set up debounced save
    saveTimerRef.current = setTimeout(() => {
      // Save to API (for authenticated users)
      if (user?.id) {
        saveLastRead({
          user_id: user.id,
          book_id: validBookId,
          chapter_number: validChapter,
        });
      }

      // Save to AsyncStorage (for app launch continuity)
      savePosition({
        type: 'bible',
        bookId: validBookId,
        chapterNumber: validChapter,
        activeTab,
        activeView,
      });
    }, DEBOUNCE_SAVE_MS);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [validBookId, validChapter, activeTab, activeView, user?.id, saveLastRead, savePosition]);

  // Track recently viewed book when chapter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: addRecentBook is a stable function
  useEffect(() => {
    // Only add to recent books when bookId changes (not on every chapter change within the same book)
    addRecentBook(validBookId);
  }, [validBookId]);

  /**
   * Debounced analytics tracking effect (Task Group 5.4)
   *
   * Tracks CHAPTER_VIEWED analytics event with debouncing to prevent
   * high-frequency calls during rapid swiping.
   *
   * Debounce: 1000ms - fires once after user settles on a chapter
   */
  useEffect(() => {
    // Clear any pending analytics timer
    if (analyticsTimerRef.current) {
      clearTimeout(analyticsTimerRef.current);
    }

    // Set up debounced analytics
    analyticsTimerRef.current = setTimeout(() => {
      // Only track when we have valid params
      if (validBookId >= 1 && validBookId <= 66 && validChapter >= 1) {
        analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
          bookId: validBookId,
          chapterNumber: validChapter,
          bibleVersion,
        });
      }
    }, DEBOUNCE_ANALYTICS_MS);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (analyticsTimerRef.current) {
        clearTimeout(analyticsTimerRef.current);
      }
    };
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
  }, [pagerRef]);

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
  }, [pagerRef]);

  /**
   * Handle chapter selection from BibleNavigationModal
   * Uses context's jumpToChapter which:
   * 1. Updates context state
   * 2. Calls onJumpToChapter callback (which snaps pager to center)
   *
   * @see Task Group 4.5: Modal calls context jumpToChapter
   */
  const handleModalSelectChapter = useCallback(
    (selectedBookId: number, selectedChapter: number) => {
      setIsNavigationModalOpen(false);
      // Always default to Bible text view when switching books via modal
      setActiveView('bible');

      // Get book name from metadata for context update
      const selectedBook = booksMetadata?.find((b) => b.id === selectedBookId);
      const selectedBookName = selectedBook?.name || 'Genesis';

      // Track this as an internal navigation to prevent external sync effect from firing
      internalJumpTargetRef.current = { bookId: selectedBookId, chapter: selectedChapter };

      // Update context via jumpToChapter (also triggers pager snap via callback)
      jumpToChapter(selectedBookId, selectedChapter, selectedBookName);

      // Update URL immediately for modal navigation (doesn't wait for debounce)
      router.setParams({
        bookId: selectedBookId.toString(),
        chapterNumber: selectedChapter.toString(),
        verse: undefined,
        endVerse: undefined,
      });
    },
    [booksMetadata, jumpToChapter, setActiveView]
  );

  // Show skeleton loader while loading and no data is available
  if (isLoading && !chapter) {
    return (
      <View style={styles.container}>
        <ChapterHeader
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

            {/* ChapterPagerView with 7-page fixed window
                Uses ChapterNavigationContext for state updates (single writer pattern)
                initialBookId/initialChapter read from URL params once on mount (Task Group 4.6) */}
            <ChapterPagerView
              ref={pagerRef}
              initialBookId={initialBookId}
              initialChapter={initialChapter}
              activeTab={activeTab}
              activeView={activeView}
              targetVerse={targetVerse}
              targetEndVerse={targetEndVerse}
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

        {/* Navigation Modal (Task 7.9) - Consolidated outside conditional blocks
            onSelectChapter uses context jumpToChapter (Task Group 4.5) */}
        {isNavigationModalOpen && (
          <BibleNavigationModal
            visible={isNavigationModalOpen}
            onClose={() => setIsNavigationModalOpen(false)}
            currentBookId={validBookId}
            currentChapter={validChapter}
            onSelectChapter={handleModalSelectChapter}
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
 * - Chapter text (clickable to open chapter selector) - reads from ChapterNavigationContext
 * - Bible view icon (shows Bible reading mode)
 * - Explanations view icon (shows AI explanations mode)
 * - Offline indicator (shows when offline) - Task 8.6
 * - Hamburger menu icon (opens menu)
 *
 * @see Spec lines 226-237 (Header specs)
 * @see Task Group 3: ChapterHeader reads from ChapterNavigationContext
 */
interface ChapterHeaderProps {
  activeView: ViewMode;
  onNavigationPress: () => void;
  onViewChange: (view: ViewMode) => void;
  onMenuPress: () => void;
  navigationModalVisible?: boolean;
}

function ChapterHeader({
  activeView,
  onNavigationPress,
  onViewChange,
  onMenuPress,
  navigationModalVisible,
}: ChapterHeaderProps) {
  // Read navigation state from context (Task Group 3)
  // This ensures header always shows what context says, never a stale prop value
  const { currentChapter, bookName } = useChapterNavigationContext();

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
        accessibilityLabel={`Select chapter, currently ${bookName} ${currentChapter}`}
        accessibilityRole="button"
        accessibilityHint="Opens chapter selection menu"
        testID="chapter-selector-button"
      >
        <View style={styles.chapterButtonContent}>
          <Text style={styles.headerTitle} testID="chapter-header-title">
            {bookName} {currentChapter}
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
