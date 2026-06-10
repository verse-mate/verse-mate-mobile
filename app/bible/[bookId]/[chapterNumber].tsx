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
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  type SharedValue,
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
import { bookHasVisuals } from '@/components/bible/VisualsPanel';
import { OfflineContentUnavailable } from '@/components/offline/OfflineContentUnavailable';
import { SplitView } from '@/components/ui/SplitView';
import { useAuth } from '@/contexts/AuthContext';
import { BibleInteractionProvider } from '@/contexts/BibleInteractionContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
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
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { useRecentBooks } from '@/hooks/bible/use-recent-books';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  useBibleChapter,
  usePrefetchNextChapter,
  usePrefetchPreviousChapter,
  useSaveLastRead,
} from '@/src/api';
import { getHeaderSpecs, spacing } from '@/theme/tokens';
import { isContentTabType } from '@/types/bible';

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
  const {
    bookId,
    chapterNumber,
    bookName,
    navigateToChapter,
    booksMetadata,
    totalChapters,
    chapterCount,
  } = useChapterState();

  // Defer the chapter passed to the pager so its expensive remount + ChapterPage layout
  // runs at lower React priority. The header reads the urgent value and updates within
  // one fast commit; the pager catches up in a background render. The user doesn't see
  // the pager lag because the native swipe animation already moved it to the next
  // chapter's content before navFire ever fired.
  const deferredBookId = useDeferredValue(bookId);
  const deferredChapterNumber = useDeferredValue(chapterNumber);

  // Extract verse/tab params (not managed by useChapterState)
  const params = useLocalSearchParams<{
    verse?: string;
    endVerse?: string;
    tab?: string;
    src?: string;
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

  // Offline status for error states
  const { isOffline } = useOfflineStatus();
  const { downloadBibleBook, isInitialized: isOfflineInitialized } = useOfflineContext();
  const { showToast } = useToast();

  const handleDownloadThisBook = async () => {
    try {
      await downloadBibleBook(bibleVersion, bookId);
    } catch (err) {
      const isOfflineErr = (err as { code?: string } | undefined)?.code === 'OFFLINE';
      showToast(
        isOfflineErr ? "You're offline. Connect to the internet to download." : 'Download failed'
      );
    }
  };

  // Get active tab from persistence
  const { activeTab, setActiveTab } = useActiveTab();

  // Get active view from persistence
  const { activeView, setActiveView } = useActiveView();

  // Transitions for view + tab switches. The actual state updates take
  // ~300-500ms of JS-thread reconciliation because the chapter tree is
  // heavy (markdown, highlight ranges, prewarmed insight subtree, etc).
  // Marking them as transitions lets React keep the old content visible
  // while the new tree reconciles in the background.
  const [isViewPending, startViewTransition] = useTransition();
  const [isTabPending, startTabTransition] = useTransition();

  // Visual progress of the Bible → Insight swap, driven on the UI thread
  // via Reanimated. 0 = Bible visible, 1 = Insight visible. Both the
  // toggle pill (in ChapterHeader) AND the content container opacities
  // (in ChapterPage) read this sharedValue via useAnimatedStyle, so a tap
  // flips the entire UI on the UI thread without waiting for React
  // reconciliation. The activeView React state still updates via
  // startViewTransition so non-visual logic (pointerEvents, scroll
  // handlers, deep-link sync) stays consistent — but the user-visible
  // swap doesn't wait for it.
  const toggleProgress = useSharedValue(activeView === 'bible' ? 0 : 1);

  // Shared visual progress for the inner Summary / By Line / Study /
  // Visuals tab switch. Holds the active tab key (string) and is read
  // by ChapterPage's per-tab Animated.View wrappers via useAnimatedStyle.
  // Updated synchronously in handleTabChange so the swap is visible the
  // same frame as the tap (no React reconciliation in the critical path).
  const activeTabProgress = useSharedValue<typeof activeTab>(activeTab);

  // Sync activeTabProgress to activeTab for non-tap paths (deep links,
  // analytics-driven updates). Idempotent with the tap path.
  useEffect(() => {
    activeTabProgress.value = activeTab;
  }, [activeTab, activeTabProgress]);

  // Animated style for the ChapterContentTabs wrapper. The row collapses
  // to height 0 on the Bible side and expands to its natural height on
  // the Insight side, with the wrapper using overflow:hidden to clip the
  // tabs during the transition. Reads toggleProgress on the UI thread so
  // the row appears/disappears the same frame as the tap, matching the
  // content opacity swap.
  const tabsWrapperStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      // Cap is generous (tabs row is ~50-60dp); the inner content sets the
      // actual rendered height, the cap just gates the collapse animation.
      maxHeight: interpolate(toggleProgress.value, [0, 1], [0, 120]),
      opacity: toggleProgress.value,
    };
  });

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

  // Verse-of-the-day widget re-entry: when arriving from the widget on a
  // specific verse, record the dive-deeper event once. The existing
  // targetVerse flow scrolls to and highlights the verse.
  const hasTrackedWidgetOpen = useRef(false);
  useEffect(() => {
    if (params.src === 'widget' && targetVerse && !hasTrackedWidgetOpen.current) {
      hasTrackedWidgetOpen.current = true;
      analytics.track(AnalyticsEvent.WIDGET_OPENED_VERSE_DETAIL, {
        bookId,
        chapterNumber,
        verseNumber: targetVerse,
        source: 'widget',
      });
    }
  }, [params.src, targetVerse, bookId, chapterNumber]);

  // Orientation (MOBILE-1001 #2): the whole reader is landscape-capable, not
  // just the Visuals tab. Unlock once when the reader mounts and re-lock to
  // portrait only when leaving the reader entirely. Previously the Visuals tab
  // owned this and re-locked PORTRAIT_UP on unmount, so rotating to landscape
  // on the Bible/Summary/By Line tabs snapped back to portrait. Owning it at
  // the screen level also removes the per-tab lock/unlock churn that the PDF
  // share-on-resume crash (#5) reproduced from.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});

    // MOBILE-1001 #5: on resume from background the reader could stick in a
    // stale layout (e.g. landscape-sized content rendered in portrait — see the
    // black dead-zone in the reported screenshot), which then crashed. Re-assert
    // the reader's orientation policy whenever the app returns to the foreground
    // so the layout reconciles to the device's current orientation instead of a
    // cached one.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
    });

    return () => {
      sub.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Handle deep-linked insight tab parameter
  // When user opens a shared insight URL, navigate to that specific tab
  const hasSetInitialTab = useRef(false);
  useEffect(() => {
    const deeplinkTab = params.tab;
    if (deeplinkTab && !hasSetInitialTab.current) {
      hasSetInitialTab.current = true;
      // Use the centralized ContentTabType validator so every tab the
      // type union knows about (summary / byline / detailed / study /
      // visuals) is accepted from the URL.
      if (isContentTabType(deeplinkTab)) {
        setActiveTab(deeplinkTab);
        // Force explanations view to show the insight tab
        if (activeView !== 'explanations') {
          setActiveView('explanations');
        }
      }
    }
  }, [params.tab, setActiveTab, activeView, setActiveView]);

  // Sync toggleProgress to activeView for non-tap paths (deep links,
  // modal-close-resets-to-bible, etc). The tap path drives toggleProgress
  // synchronously in handleViewChange and is idempotent here — withTiming
  // to the same target is a no-op.
  useEffect(() => {
    toggleProgress.value = withTiming(activeView === 'bible' ? 0 : 1, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeView, toggleProgress]);

  // Navigation modal state
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);

  // Hamburger menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // FAB visibility state - manages auto-hide/show based on user interaction
  const {
    visible: fabVisible,
    handleScroll,
    handleTap,
    showButtons,
  } = useFABVisibility({
    initialVisible: true,
  });

  // Calculate progress percentage
  const { progress } = useBookProgress(bookId, chapterNumber, totalChapters);

  // Fetch chapter data for loading state check. Reconnect-driven refetches
  // are handled globally — `app/_layout.tsx` bridges React Query's
  // `onlineManager` to NetInfo, and this query opts into
  // `refetchOnReconnect: 'always'` so the UI auto-recovers when the device
  // is back online.
  const {
    data: rawChapter,
    isLoading,
    isFetching,
  } = useBibleChapter(bookId, chapterNumber, bibleVersion);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure has varying properties not captured by generated types
  const chapter = rawChapter as any;

  // Save reading position mutation (API)
  const { mutate: saveLastRead } = useSaveLastRead();

  // Save reading position to AsyncStorage for app launch continuity
  const { savePosition } = useLastReadPosition();

  // Track recently viewed books
  const { addRecentBook } = useRecentBooks();

  // Prefetch next/previous chapters in background (auto-fires via useEffect inside hooks)
  // Pass the real chapterCount (not the 50 fallback) so we don't 404 on the last
  // chapter of short books like Galatians 6 before metadata loads — VER-75.
  usePrefetchNextChapter(bookId, chapterNumber, chapterCount);
  usePrefetchPreviousChapter(bookId, chapterNumber);

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

  // Prefetch is now handled automatically by the hooks' internal useEffect
  // when bookId/chapterNumber change — no manual trigger needed.

  /**
   * Handle view mode change with haptic feedback.
   *
   * Drives the visual swap on the UI thread via `toggleProgress` — both
   * the toggle pill (in ChapterHeader) and the content container
   * opacities (in ChapterPage) read this sharedValue, so the UI flips
   * the same frame as the tap. React state catches up via transition.
   */
  const handleViewChange = useCallback(
    (view: ViewMode) => {
      if (view === activeView) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // UI-thread visual flip — happens this frame, no React work involved.
      toggleProgress.value = withTiming(view === 'bible' ? 0 : 1, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
      // Bridge to React for non-visual state (pointerEvents, scroll
      // handlers, deep-link sync). Wrapped in a transition so the heavy
      // reconciliation doesn't block the tap.
      startViewTransition(() => {
        setActiveView(view);
      });
    },
    [activeView, setActiveView, toggleProgress]
  );

  /**
   * Handle inner-tab change (Summary / By Line / Study / Visuals).
   *
   * Same pattern as handleViewChange: wrap the state update in a
   * transition so the heavy markdown/render reconciliation doesn't block
   * the tap, and use `isTabPending` to overlay a skeleton.
   */
  const handleTabChange = useCallback(
    (tab: typeof activeTab) => {
      if (tab === activeTab) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // UI-thread snap — the per-tab Animated.View wrappers in ChapterPage
      // read this sharedValue and flip opacity the same frame as the tap.
      activeTabProgress.value = tab;
      startTabTransition(() => {
        setActiveTab(tab);
      });
    },
    [activeTab, setActiveTab, activeTabProgress]
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

      // Prefetch is handled automatically by the hooks' internal useEffect
    },
    [navigateToChapter, user?.id]
  );

  /**
   * Navigate to previous chapter
   *
   * V3 Linear mode: At Genesis 1, this does nothing (canGoPrevious is false)
   */
  const handlePrevious = useCallback(() => {
    if (!canGoPrevious || !prevChapter) return;

    // Reset FAB visibility timer so arrows stay visible during rapid navigation
    showButtons();

    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update state via hook (V3: single source of truth)
    navigateToChapter(prevChapter.bookId, prevChapter.chapterNumber);
  }, [canGoPrevious, prevChapter, navigateToChapter, showButtons]);

  /**
   * Navigate to next chapter
   *
   * V3 Linear mode: At Revelation 22, this does nothing (canGoNext is false)
   */
  const handleNext = useCallback(() => {
    if (!canGoNext || !nextChapter) return;

    // Reset FAB visibility timer so arrows stay visible during rapid navigation
    showButtons();

    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update state via hook (V3: single source of truth)
    navigateToChapter(nextChapter.bookId, nextChapter.chapterNumber);
  }, [canGoNext, nextChapter, navigateToChapter, showButtons]);

  // Web keyboard shortcuts: arrow keys for chapter navigation, Escape to close modal
  useKeyboardShortcuts({
    onNextChapter: handleNext,
    onPrevChapter: handlePrevious,
    onEscape: () => setIsNavigationModalOpen(false),
  });

  /**
   * Render chapter page content for SimpleChapterPager
   *
   * This is passed to SimpleChapterPager.renderChapterPage prop
   */
  const renderChapterPage = useCallback(
    (pageBookId: number, pageChapterNumber: number) => {
      const isCurrent = pageBookId === bookId && pageChapterNumber === chapterNumber;
      return (
        <ChapterPage
          bookId={pageBookId}
          chapterNumber={pageChapterNumber}
          activeTab={activeTab}
          activeView={activeView}
          toggleProgress={toggleProgress}
          activeTabProgress={activeTabProgress}
          onScroll={handleScroll}
          onTap={handleTap}
          isPreloading={!isCurrent}
          targetVerse={isCurrent ? targetVerse : undefined}
          targetEndVerse={isCurrent ? targetEndVerse : undefined}
          fabVisible={fabVisible}
          onFABInteraction={showButtons}
        />
      );
    },
    [
      activeTab,
      activeView,
      toggleProgress,
      activeTabProgress,
      handleScroll,
      handleTap,
      bookId,
      chapterNumber,
      targetVerse,
      targetEndVerse,
      fabVisible,
      showButtons,
    ]
  );

  // Show skeleton loader while loading/fetching and no data is available.
  // `isFetching` covers refetches after react-query invalidation (e.g., after
  // coming back online), preventing a brief "Chapter not found" flash.
  if ((isLoading || isFetching || !isOfflineInitialized) && !chapter) {
    return (
      <View style={styles.container}>
        <ChapterHeader
          bookName={bookName}
          chapterNumber={chapterNumber}
          activeView={activeView}
          toggleProgress={toggleProgress}
          onNavigationPress={() => setIsNavigationModalOpen(true)}
          navigationModalVisible={isNavigationModalOpen}
          onViewChange={handleViewChange}
          onMenuPress={() => setIsMenuOpen(true)}
          bibleVersion={bibleVersion}
        />
        <SkeletonLoader />
        <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          onClose={() => setIsNavigationModalOpen(false)}
          currentBookId={bookId}
          currentChapter={chapterNumber}
          onSelectChapter={(selectedBookId, chapterNum) => {
            setIsNavigationModalOpen(false);
            setActiveView('bible');
            navigateToChapter(selectedBookId, chapterNum);
          }}
          onSelectTopic={(topicId, category) => {
            setIsNavigationModalOpen(false);
            setActiveView('bible');
            router.push({ pathname: '/topics/[topicId]', params: { topicId, category } });
          }}
        />
      </View>
    );
  }

  // Show error state with offline-aware messaging
  if (!chapter) {
    return (
      <View style={styles.container}>
        <ChapterHeader
          bookName={bookName}
          chapterNumber={chapterNumber}
          activeView={activeView}
          toggleProgress={toggleProgress}
          onNavigationPress={() => setIsNavigationModalOpen(true)}
          navigationModalVisible={isNavigationModalOpen}
          onViewChange={handleViewChange}
          onMenuPress={() => setIsMenuOpen(true)}
          bibleVersion={bibleVersion}
        />
        {isOffline ? (
          <OfflineContentUnavailable
            contentType="chapter"
            onDownload={handleDownloadThisBook}
            downloadLabel={`Download ${bookName}`}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Chapter not found</Text>
          </View>
        )}
        <HamburgerMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        <BibleNavigationModal
          visible={isNavigationModalOpen}
          onClose={() => setIsNavigationModalOpen(false)}
          currentBookId={bookId}
          currentChapter={chapterNumber}
          onSelectChapter={(selectedBookId, chapterNum) => {
            setIsNavigationModalOpen(false);
            setActiveView('bible');
            navigateToChapter(selectedBookId, chapterNum);
          }}
          onSelectTopic={(topicId, category) => {
            setIsNavigationModalOpen(false);
            setActiveView('bible');
            router.push({ pathname: '/topics/[topicId]', params: { topicId, category } });
          }}
        />
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
                  onTabChange={handleTabChange}
                  isTabPending={isTabPending}
                  onMenuPress={() => setIsMenuOpen(true)}
                  onScroll={handleScroll}
                  onTap={handleTap}
                  fabVisible={fabVisible}
                  onFABInteraction={showButtons}
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
              toggleProgress={toggleProgress}
              onNavigationPress={() => {
                setIsNavigationModalOpen(true);
              }}
              navigationModalVisible={isNavigationModalOpen}
              onViewChange={handleViewChange}
              onMenuPress={() => {
                setIsMenuOpen(true);
              }}
              bibleVersion={bibleVersion}
            />

            {/* Content Tabs - Only visible in Explanations view. The
                Visuals tab is gated on the book having curated visuals
                (most books do — see @versemate/visuals registry). The
                wrapper's height + opacity are driven by toggleProgress
                on the UI thread so the row appears/disappears the same
                frame as the Bible/Insight tap — no waiting for React. */}
            <Animated.View
              testID="content-tabs-wrapper"
              style={[styles.tabsWrapper, tabsWrapperStyle]}
              pointerEvents={activeView === 'explanations' ? 'auto' : 'none'}
            >
              <ChapterContentTabs
                activeTab={activeTab}
                activeTabProgress={activeTabProgress}
                onTabChange={handleTabChange}
                showStudy
                showVisuals={bookHasVisuals(bookId)}
              />
            </Animated.View>

            {/* SimpleChapterPager - V3 3-page window with linear navigation.
                Uses deferred chapter so the heavy pager re-render (pages-array swap +
                ChapterPage commits) doesn't block the urgent header update commit.
                The wrapper exists so the transition skeleton overlay below can be
                absolutely positioned against the content area only — the toggle
                header + content tabs above stay visible and interactive. */}
            <View style={styles.pagerWrapper}>
              <SimpleChapterPager
                bookId={deferredBookId}
                chapterNumber={deferredChapterNumber}
                bookName={bookName}
                booksMetadata={booksMetadata}
                onChapterChange={handlePageChange}
                renderChapterPage={renderChapterPage}
              />
              {/* Both view and inner-tab switches are now driven by
                  sharedValues on the UI thread (toggleProgress +
                  activeTabProgress in ChapterPage), so no skeleton
                  overlay is needed during transitions. */}
            </View>

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

        {/* Navigation Modal - Always mounted, visibility controlled by `visible` prop */}
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
  /**
   * Shared visual progress (0 = Bible, 1 = Insight). Owned by ChapterScreen
   * and shared with ChapterPage so the toggle pill and content opacity flip
   * on the UI thread in the same frame as the tap.
   */
  toggleProgress: SharedValue<number>;
  onNavigationPress: () => void;
  onViewChange: (view: ViewMode) => void;
  onMenuPress: () => void;
  navigationModalVisible?: boolean;
  /**
   * Active Bible version key (e.g. "NASB1995", "VDC"). Shown as a small
   * subtitle below the book/chapter title so the user always sees which
   * translation they're reading without opening the settings dropdown.
   */
  bibleVersion?: string;
}

function ChapterHeader({
  bookName,
  chapterNumber,
  activeView,
  toggleProgress,
  onNavigationPress,
  onViewChange,
  onMenuPress,
  navigationModalVisible,
  bibleVersion,
}: ChapterHeaderProps) {
  // Get theme directly inside ChapterHeader (no props drilling)
  const { colors, mode } = useTheme();
  const headerSpecs = getHeaderSpecs(mode);
  const styles = useMemo(() => createHeaderStyles(headerSpecs, colors), [headerSpecs, colors]);
  const insets = useSafeAreaInsets();

  const [bibleButtonWidth, setBibleButtonWidth] = useState(0);
  const [insightButtonWidth, setInsightButtonWidth] = useState(0);

  // Animated text colors — driven by toggleProgress, independent of
  // activeView prop reconciliation. Each button text interpolates
  // between inactive and active color based on the indicator position.
  const inactiveColor = headerSpecs.titleColor;
  const activeColor = colors.black;
  const bibleTextStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      color: interpolateColor(toggleProgress.value, [0, 1], [activeColor, inactiveColor]),
    };
  });
  const insightTextStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      color: interpolateColor(toggleProgress.value, [0, 1], [inactiveColor, activeColor]),
    };
  });

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
        <View style={styles.chapterButtonColumn}>
          <View style={styles.chapterButtonContent}>
            <Text style={styles.headerTitle} testID="chapter-header-text">
              {bookName} {chapterNumber}
            </Text>
            <Ionicons name="chevron-down" size={16} color={headerSpecs.iconColor} />
          </View>
          {bibleVersion ? (
            <Text style={styles.versionSubtitle} testID="chapter-header-version">
              {bibleVersion}
            </Text>
          ) : null}
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
            <Animated.Text style={[styles.toggleText, bibleTextStyle]}>Bible</Animated.Text>
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
            <Animated.Text style={[styles.toggleText, insightTextStyle]}>Insight</Animated.Text>
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
  themeColors: ReturnType<typeof import('@/theme/tokens').getColors>
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
    chapterButtonColumn: {
      flexDirection: 'column',
      alignItems: 'flex-start',
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
    versionSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: headerSpecs.titleColor,
      opacity: 0.55,
      marginTop: 1,
      letterSpacing: 0.3,
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
  colors: ReturnType<typeof import('@/theme/tokens').getColors>,
  _mode: 'light' | 'dark'
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background, // Match content background to prevent flash during route updates
    },
    pagerWrapper: {
      flex: 1,
      position: 'relative',
    },
    // overflow:hidden so the maxHeight animation clips the tabs row
    // when collapsing/expanding.
    tabsWrapper: {
      overflow: 'hidden',
    },
    // Opaque skeleton overlay used during view/tab transitions. Covers the
    // pager only (chrome stays visible). Background matches the screen so
    // the previous content is fully masked while reconciliation runs.
    transitionSkeleton: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
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
