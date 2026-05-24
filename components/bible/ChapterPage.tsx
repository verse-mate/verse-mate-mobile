/**
 * ChapterPage Component
 *
 * Lightweight wrapper for a single Bible chapter with stable positional key.
 * Receives bookId and chapterNumber as PROPS (not derived from key).
 * The parent (ChapterPagerView) sets stable positional keys that NEVER change.
 *
 * Features:
 * - Fetches chapter content using useBibleChapter hook
 * - Fetches explanation content based on active tab and view mode
 * - Shows SkeletonLoader while loading
 * - Renders ChapterReader when loaded
 * - Contains ScrollView for vertical scrolling
 * - Props update when window shifts (key stays stable)
 * - Manages Notes Modals to prevent ScrollView interaction issues
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 121-143)
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  findNodeHandle,
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioInlineEntry } from '@/components/bible/AudioInlineEntry';
import { DeleteConfirmationModal } from '@/components/bible/DeleteConfirmationModal';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { NoteOptionsModal } from '@/components/bible/NoteOptionsModal';
import { NotesModal } from '@/components/bible/NotesModal';
import { NoteViewModal } from '@/components/bible/NoteViewModal';
import { StudyPanel } from '@/components/bible/StudyPanel';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import { bookHasVisuals, VisualsPanel } from '@/components/bible/VisualsPanel';
import { AvailableOfflineBadge } from '@/components/offline/AvailableOfflineBadge';
import { OfflineContentUnavailable } from '@/components/offline/OfflineContentUnavailable';
import { useAuth } from '@/contexts/AuthContext';
import { useBibleInteraction } from '@/contexts/BibleInteractionContext';
import { TextVisibilityContext, type VisibleYRange } from '@/contexts/TextVisibilityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import type { Highlight } from '@/hooks/bible/use-highlights';
import { useNotes } from '@/hooks/bible/use-notes';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { usePreferredLanguage } from '@/hooks/use-preferred-language';
import { useBibleByLine, useBibleChapter, useBibleSummary } from '@/src/api';
import { animations, type getColors, spacing } from '@/theme/tokens';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import type { Note } from '@/types/notes';
import { computeByLineJumpY } from '@/utils/bible/byLineJump';
import { groupConsecutiveHighlights } from '@/utils/bible/groupConsecutiveHighlights';
import { parseByLineSections } from '@/utils/bible/parseByLineExplanation';
import { BottomLogo } from './BottomLogo';
import { ChapterReader } from './ChapterReader';
import { SkeletonLoader } from './SkeletonLoader';
import { VerseJumpButton } from './VerseJumpButton';

// Styles for the overall ChapterPage component
const createStyles = (colors: ReturnType<typeof getColors>, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    absoluteFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      // FAB height + bottom offset + progress bar + extra spacing, plus the
      // device's bottom safe-area inset so the last verse clears the home
      // indicator on notched iPhones (VER-70).
      paddingBottom: 60 + bottomInset,
    },
    readerContainer: {
      flex: 1,
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
    hidden: {
      display: 'none',
    },
  });

/**
 * TabContent Component
 *
 * Renders the content for a single explanation tab within its own ScrollView.
 * This ensures each tab maintains its own independent scroll position.
 */
function TabContent({
  chapter,
  activeTab,
  content,
  isLoading,
  error,
  visible,
  shouldRenderHidden,
  testID,
  onScroll,
  onTouchStart,
  onTouchEnd,
  filteredHighlights,
  filteredAutoHighlights,
  scrollRef,
  onTabContentSizeChange,
  isAvailableOffline,
  onByLineSectionRegister,
}: {
  chapter: ChapterContent | null | undefined;
  activeTab: ContentTabType;
  content: ExplanationContent | null | undefined;
  isLoading: boolean;
  error: Error | null;
  visible: boolean;
  shouldRenderHidden?: boolean;
  testID: string;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
  filteredHighlights?: Highlight[];
  filteredAutoHighlights?: AutoHighlight[];
  scrollRef?: React.RefObject<ScrollView | null>;
  onTabContentSizeChange?: (contentWidth: number, contentHeight: number) => void;
  isAvailableOffline?: boolean;
  onByLineSectionRegister?: (verseNumber: number, node: View | null) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.bottom); // Use local createStyles for TabContent
  const { isOffline } = useOfflineStatus();

  const isHidden = !visible;
  if (isHidden && !shouldRenderHidden) return null;

  // Determine content for the reader
  const explanationContent = content && 'content' in content ? content : undefined;
  // Defend against `content.content` being undefined/null at render time —
  // happens when the explanations API hasn't returned a body yet (loading
  // state) or the field is genuinely missing on a chapter. Without the guard,
  // calling .trim() on undefined crashes TabContent and takes down the whole
  // reader.
  const hasContent =
    typeof explanationContent?.content === 'string' && explanationContent.content.trim().length > 0;

  // Show skeleton whenever we're loading and have no content yet — covers
  // both the initial chapter load (no chapter, no content) AND the case
  // where the chapter is already loaded but this specific tab's
  // explanation fetch just started (e.g. first tap on a tab whose fetch
  // was lazily enabled). The previous `!chapter` guard caused tabs that
  // were fetched on-demand to render "No X explanation available yet"
  // during the fetch instead of a skeleton.
  const showSkeleton = isLoading && !explanationContent;

  // Keep all tabs mounted for pre-rendering (eliminates freeze on switch)
  // Use absolute positioning + pointerEvents to hide inactive tabs
  return (
    <ScrollView
      ref={scrollRef}
      style={[
        styles.container,
        isHidden && {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
          zIndex: -1,
        },
      ]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={visible}
      testID={testID}
      onScroll={visible ? onScroll : undefined}
      scrollEventThrottle={16}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      pointerEvents={visible ? 'auto' : 'none'}
      onContentSizeChange={onTabContentSizeChange}
    >
      {error ? (
        isOffline ? (
          <OfflineContentUnavailable contentType="explanation" />
        ) : (
          <Animated.View
            entering={FadeIn.duration(animations.tabSwitch.duration)}
            exiting={FadeOut.duration(animations.tabSwitch.duration)}
            style={styles.errorContainer}
          >
            <Text style={styles.errorText}>Failed to load {activeTab} explanation.</Text>
          </Animated.View>
        )
      ) : showSkeleton ? (
        // Only show skeleton on initial load when no content exists yet
        <SkeletonLoader />
      ) : !hasContent ? (
        // VER-39: When offline and the explanation isn't cached locally, the
        // remote fetch fails (or never resolves) and we'd otherwise lie that
        // the content doesn't exist. Match BibleExplanationsPanel and surface
        // the proper "You're offline / Manage Downloads" placeholder instead.
        isOffline ? (
          <OfflineContentUnavailable contentType="explanation" />
        ) : (
          <Animated.View
            entering={FadeIn.duration(animations.tabSwitch.duration)}
            exiting={FadeOut.duration(animations.tabSwitch.duration)}
            style={styles.errorContainer}
          >
            <Text style={styles.errorText}>
              No {activeTab} explanation available for this chapter yet.
            </Text>
          </Animated.View>
        )
      ) : (
        <View>
          {/* TASK-017: audio entry is also mounted in BibleExplanationsPanel
              (tablet / split-view) — this branch is the phone-portrait
              primary reading view. Both paths render the chip the same way. */}
          {chapter && explanationContent?.explanationId ? (
            <AudioInlineEntry
              explanationId={explanationContent.explanationId}
              explanationType={activeTab}
              bookId={chapter.bookId}
              chapterNumber={chapter.chapterNumber}
              language={explanationContent.languageCode}
              sourceHref={`/bible/${chapter.bookId}/${chapter.chapterNumber}`}
            />
          ) : null}
          {isAvailableOffline && <AvailableOfflineBadge />}
          {chapter && (
            <ChapterReader
              chapter={chapter}
              activeTab={activeTab}
              explanationsOnly={true}
              explanation={explanationContent}
              filteredHighlights={filteredHighlights}
              filteredAutoHighlights={filteredAutoHighlights}
              onByLineSectionRegister={activeTab === 'byline' ? onByLineSectionRegister : undefined}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Props for ChapterPage component
 *
 * All props are DYNAMIC - they update when the sliding window shifts.
 * The key is set by the parent based on window position, not content.
 */
export interface ChapterPageProps {
  /** Book ID (1-66) - DYNAMIC prop, updates on window shift */
  bookId: number;
  /** Chapter number (1-based) - DYNAMIC prop, updates on window shift */
  chapterNumber: number;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Current view mode (bible or explanations) */
  activeView: 'bible' | 'explanations';
  /**
   * Shared visual progress (0 = Bible, 1 = Insight) driven by ChapterScreen.
   * Used via useAnimatedStyle to flip container opacity on the UI thread
   * so the swap is visible the same frame as the tap — independent of the
   * activeView prop reconciliation (which can take ~300ms). Optional so
   * isolated callers (tests, the split-view BibleContentPanel which only
   * renders the Bible side) can omit it; visibility then falls back to
   * `activeView` via a local sharedValue.
   */
  toggleProgress?: SharedValue<number>;
  /**
   * Shared visual key (active tab name) for the inner Summary / By Line /
   * Study / Visuals tab switch. Drives per-tab Animated.View opacity on
   * the UI thread so the inner-tab swap is also instant. Optional with
   * activeTab-mirroring fallback for isolated callers.
   */
  activeTabProgress?: SharedValue<ContentTabType>;
  /** Whether to reset scroll to top on chapter change (default: true) */
  shouldResetScroll?: boolean;
  /** Whether this page is being preloaded (skips heavy AI content) */
  isPreloading?: boolean;
  /** Target verse to scroll to (optional) */
  targetVerse?: number;
  /** Target end verse for multi-verse highlights (optional) */
  targetEndVerse?: number;
  /** Callback when user scrolls - receives velocity (px/s) and isAtBottom flag */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;
  /** Callback when user taps the screen */
  onTap?: () => void;
  /** Hide the chapter title text (used in split view where parent has a header) */
  hideChapterTitle?: boolean;
  /**
   * Drives the verse-jump pill fade. Pass the same `fabVisible` state used by
   * the chapter-nav scroll arrows so the pill auto-hides on the same trigger
   * (VERA-39). Defaults to `true` for callers that don't track FAB visibility.
   */
  fabVisible?: boolean;
  /**
   * Called when the user taps the verse-jump pill. Wire to `showButtons` from
   * `useFABVisibility` so the arrows and the pill re-show together.
   */
  onFABInteraction?: () => void;
}

/**
 * ChapterPage Component
 *
 * Renders a single Bible chapter within a PagerView page.
 * Component instance stays stable, props update when window shifts.
 *
 * Performance Optimizations (Task 6.4):
 * - Wrapped with React.memo to prevent unnecessary re-renders
 * - Memoized active content calculation with useMemo
 * - Only re-renders when bookId, chapterNumber, activeTab, or activeView changes
 *
 * @example
 * ```tsx
 * // Parent sets stable key based on position
 * <ChapterPage
 *   key="page-2"              // STABLE: never changes
 *   bookId={1}                // DYNAMIC: updates on window shift
 *   chapterNumber={5}         // DYNAMIC: updates on window-shift
 *   activeTab="summary"
 *   activeView="bible"
 * />
 * ```
 */
export function ChapterPage({
  bookId,
  chapterNumber,
  activeTab,
  activeView,
  toggleProgress,
  activeTabProgress,
  shouldResetScroll = true,
  isPreloading = false,
  targetVerse,
  targetEndVerse,
  onScroll,
  onTap,
  hideChapterTitle = false,
  fabVisible = true,
  onFABInteraction,
}: ChapterPageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.bottom); // Use local createStyles for ChapterPage

  // Use Reanimated ref for the animated ScrollView
  const animatedScrollRef = useAnimatedRef<Animated.ScrollView>();

  const sectionPositionsRef = useRef<Record<number, number>>({});

  // Track if we have scrolled to target verse
  const hasScrolledRef = useRef(false);
  // Track current scroll position manually for distance calc (JS side)
  const currentScrollYRef = useRef(0);
  // Track Bible view scroll fraction (0-1) for syncing to explanation tabs
  const bibleScrollFractionRef = useRef(0);
  // Refs for explanation tab ScrollViews to sync scroll position
  const byLineScrollRef = useRef<ScrollView>(null);
  const summaryScrollRef = useRef<ScrollView>(null);
  const studyScrollRef = useRef<ScrollView>(null);

  // Quick-verse-jump: refs to the rendered View for each By Line verse section.
  // Used with measureLayout(byLineScrollRef) to compute the scroll-to Y on tap.
  const byLineSectionRefs = useRef<Record<number, View | null>>({});

  // Note Modals State
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Verse tooltip state - shown after scroll animation completes
  const [verseTooltipVisible, setVerseTooltipVisible] = useState(false);
  const verseTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isAuthenticated } = useAuth();

  // Get current language from user preferences, with offline support
  // usePreferredLanguage reads from AsyncStorage when the user changes language offline
  const language = usePreferredLanguage();
  // Text visibility tracking for hybrid tokenization
  // Use state with debouncing to avoid re-renders on every scroll frame
  const [visibleYRange, setVisibleYRange] = useState<VisibleYRange | null>(null);
  const visibleYRangeRef = useRef<VisibleYRange | null>(null);
  const visibilityUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportHeightRef = useRef<number>(0);

  // Get highlights from the provider (single source of truth — avoids duplicate queries)
  const { chapterHighlights, autoHighlights } = useBibleInteraction();

  // Staggered rendering state to prevent UI freeze (waterfall loading)
  // 0: Initial (only active view)
  // 1: Mount Explanations container (active tab renders)
  // 2: Mount Summary tab (if hidden)
  // 3: Mount Byline tab (if hidden)
  const [delayedRenderStage, setDelayedRenderStage] = useState(0);

  // Pre-warmed flag: once the chapter has settled on Bible view, mount
  // the Insight subtree in the background so the Bible → Insight toggle
  // becomes a style flip (instant) instead of a 500-700ms first-mount
  // hit. The mount is scheduled via InteractionManager.runAfterInteractions
  // so it doesn't run during the chapter-swipe animation. Sticky once true
  // for the lifetime of this ChapterPage — there's no benefit to
  // unmounting after a toggle back to Bible.
  const [insightPrewarmed, setInsightPrewarmed] = useState(false);

  const { deleteNote, isDeletingNote } = useNotes();

  // Schedule the Insight subtree mount in idle time after the chapter
  // becomes available. Runs only for the active page (not buffer pages)
  // and only once per ChapterPage lifetime.
  useEffect(() => {
    if (isPreloading || insightPrewarmed) return;
    // Fire as soon as the chapter-swipe interaction finishes — no extra
    // delay. The toggleProgress-driven visibility flip below only works
    // when the Insight subtree is mounted, so we want this to flip as
    // early as possible.
    const handle = InteractionManager.runAfterInteractions(() => {
      setInsightPrewarmed(true);
    });
    return () => {
      handle.cancel();
    };
  }, [isPreloading, insightPrewarmed, bookId, chapterNumber]);

  // Trigger staggered delayed render — only for the active page, not buffer pages,
  // and only while the user is actually in Explanations view.
  //
  // This still runs after a real activeView -> 'explanations' switch so
  // the OTHER tab (byline if summary is active, or vice versa) gets
  // pre-warmed in the background. The Insight container itself is now
  // mounted via insightPrewarmed before the user ever switches, so the
  // initial switch isn't blocked.
  useEffect(() => {
    if (isPreloading) {
      setDelayedRenderStage(0);
      return;
    }
    // Stagger no longer gated on `activeView === 'explanations'`. The
    // inner tabs (byline, study, visuals) pre-mount in the background
    // even while the user is on Bible view, so the first tap to any tab
    // finds it already mounted and the sharedValue-driven opacity flip
    // is instant. Trade-off: a small chunk of markdown parse work runs
    // during background idle on every chapter load — acceptable because
    // the alternative is a 1-2s lag the first time the user taps a tab
    // they haven't visited yet.
    const t1 = setTimeout(() => setDelayedRenderStage(1), 600);
    const t2 = setTimeout(() => setDelayedRenderStage(2), 1100);
    const t3 = setTimeout(() => setDelayedRenderStage(3), 1600);
    const t4 = setTimeout(() => setDelayedRenderStage(4), 2100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isPreloading]);

  // Track explanation tab content heights for scroll syncing
  const tabContentHeightsRef = useRef<
    Record<string, { contentHeight: number; viewHeight: number }>
  >({});

  // VER-74: Pending scroll fractions awaiting a tab's first measurement.
  // The previous one-shot 100ms timeout raced against staggered tab mounting
  // (byline mounts at stage 3 / 1600ms when inactive) and against in-flight
  // explanation fetches. We now stash the fraction here on view switch and let
  // handleTabContentSizeChange apply it as soon as dims arrive.
  const pendingScrollFractionRef = useRef<Record<string, number>>({});

  // Reset scroll state when book/chapter changes (not on view change)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref reset should react to chapter change
  useEffect(() => {
    hasScrolledRef.current = false;
    sectionPositionsRef.current = {};
    currentScrollYRef.current = 0;
    // VER-74: clear cross-view scroll state so a fraction or pending scroll
    // from the previous chapter can't fire on the new one's first tab switch.
    bibleScrollFractionRef.current = 0;
    pendingScrollFractionRef.current = {};

    // Reset scroll position to top when chapter changes
    // This prevents "height teleportation" from previous chapter
    // ONLY if shouldResetScroll is true (skipped during seamless pager snaps)
    if (shouldResetScroll) {
      animatedScrollRef.current?.scrollTo({ y: 0, animated: false });
      // VER-100: explanation tab ScrollViews preserve their own scrollTop
      // across chapter changes (most visibly on web, where the ScrollView's
      // DOM node persists). Reset all of them so users land at verse 1 of the
      // new chapter on By Line / Summary — matches the split-view path in
      // BibleExplanationsPanel.tsx.
      summaryScrollRef.current?.scrollTo({ y: 0, animated: false });
      byLineScrollRef.current?.scrollTo({ y: 0, animated: false });
    }

    // Close tooltip and clear timers when changing book/chapter
    setVerseTooltipVisible(false);
    if (verseTooltipTimerRef.current) {
      clearTimeout(verseTooltipTimerRef.current);
      verseTooltipTimerRef.current = null;
    }
    if (visibilityUpdateTimerRef.current) {
      clearTimeout(visibilityUpdateTimerRef.current);
      visibilityUpdateTimerRef.current = null;
    }
    // Reset visible range on chapter change
    setVisibleYRange(null);
    visibleYRangeRef.current = null;
  }, [bookId, chapterNumber]);

  // Stable across renders: only reads refs, never state. Wrapping in useCallback
  // with [] keeps the effect-dep list quiet without spurious re-runs.
  const applyPendingScroll = useCallback((tab: string) => {
    const fraction = pendingScrollFractionRef.current[tab];
    if (fraction == null) return;
    const dims = tabContentHeightsRef.current[tab];
    if (!dims || dims.contentHeight <= dims.viewHeight) return;

    const targetRef =
      tab === 'summary' ? summaryScrollRef : tab === 'byline' ? byLineScrollRef : null;
    if (!targetRef) return;

    const scrollableHeight = dims.contentHeight - dims.viewHeight;
    const targetY = Math.round(fraction * scrollableHeight);
    targetRef.current?.scrollTo({ y: targetY, animated: false });
    delete pendingScrollFractionRef.current[tab];
  }, []);

  const handleTabContentSizeChange = (tab: string, contentHeight: number, viewHeight: number) => {
    tabContentHeightsRef.current[tab] = {
      contentHeight,
      viewHeight: viewHeight || viewportHeightRef.current,
    };
    applyPendingScroll(tab);
  };

  // Sync scroll position when switching from Bible to explanations view
  useEffect(() => {
    if (activeView !== 'bible') {
      hasScrolledRef.current = true;

      const fraction = bibleScrollFractionRef.current;
      if (fraction > 0.01) {
        // Record the desired fraction for the active tab. If dims are already
        // measured we can scroll immediately; otherwise applyPendingScroll
        // fires from handleTabContentSizeChange when the tab finishes mounting
        // and its content lays out.
        pendingScrollFractionRef.current[activeTab] = fraction;
        applyPendingScroll(activeTab);
      }
    }
  }, [activeView, activeTab, applyPendingScroll]);

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  /**
   * Handle touch start - record time and position
   */
  const handleTouchStart = (event: GestureResponderEvent) => {
    touchStartTime.current = Date.now();
    touchStartY.current = event.nativeEvent.pageY;
  };

  /**
   * Handle touch end - detect if it was a tap (not a scroll)
   * A tap is defined as:
   * - Touch duration < 200ms
   * - Movement < 10 pixels
   */
  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!onTap) return;

    const touchDuration = Date.now() - touchStartTime.current;
    const touchMovement = Math.abs(event.nativeEvent.pageY - touchStartY.current);

    // Only trigger tap if it was quick and didn't move much
    if (touchDuration < 200 && touchMovement < 10) {
      onTap();
    }
  };

  // Fetch chapter content

  const { data: rawChapter } = useBibleChapter(bookId, chapterNumber, undefined);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure has varying properties not captured by generated types
  const chapter = rawChapter as any;

  // Keep a reference to the last valid chapter data to prevent flickering during prop changes
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure
  const lastChapterRef = useRef<any>(null);
  if (chapter) {
    lastChapterRef.current = chapter;
  }
  const displayChapter = chapter || lastChapterRef.current;

  // Track which explanation tabs have been visited so we only fetch on demand
  const [visitedTabs, setVisitedTabs] = useState<Set<ContentTabType>>(() => new Set([activeTab]));

  // Reset visitedTabs when navigating to a new chapter to avoid fetching
  // explanations from the previous chapter's visited tabs
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on chapter change only
  useEffect(() => {
    setVisitedTabs(new Set([activeTab]));
  }, [bookId, chapterNumber]);

  // When the user switches tabs, mark the new tab as visited
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Eagerly pre-fetch the byline explanation a moment after the chapter
  // settles so the first tap on the By Line tab finds the data already
  // cached (no fetch lag, no skeleton). Summary is fetched on mount
  // because activeTab starts as 'summary'; Study + Visuals are bundled
  // (no fetch). The 1500ms delay lets the chapter render / scroll into
  // place before we add another API call to the queue. Skipped for
  // buffer pages to avoid prefetching for chapters the user may never
  // actually open.
  useEffect(() => {
    if (isPreloading) return;
    const t = setTimeout(() => {
      setVisitedTabs((prev) => {
        if (prev.has('byline')) return prev;
        const next = new Set(prev);
        next.add('byline');
        return next;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [isPreloading, bookId, chapterNumber]);

  // Fetch explanations lazily — only enable for the active tab or previously visited tabs
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    isLocalData: summaryIsLocal,
  } = useBibleSummary(bookId, chapterNumber, undefined, {
    enabled:
      (!isPreloading || activeView === 'explanations') &&
      (activeTab === 'summary' || visitedTabs.has('summary')),
    language,
  });

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
    isLocalData: byLineIsLocal,
  } = useBibleByLine(bookId, chapterNumber, undefined, {
    enabled:
      (!isPreloading || activeView === 'explanations') &&
      (activeTab === 'byline' || visitedTabs.has('byline')),
    language,
  });

  /**
   * Attempt to scroll to target verse using Reanimated for smoothness
   */
  const attemptScrollToVerse = () => {
    if (activeView !== 'bible') return;
    if (!targetVerse || hasScrolledRef.current) return;

    // Find the section that contains the target verse
    const startVerses = Object.keys(sectionPositionsRef.current)
      .map(Number)
      .sort((a, b) => a - b);

    let targetSectionStartVerse = -1;
    for (const startVerse of startVerses) {
      if (startVerse <= targetVerse) {
        targetSectionStartVerse = startVerse;
      } else {
        break;
      }
    }

    if (targetSectionStartVerse !== -1) {
      const targetY = sectionPositionsRef.current[targetSectionStartVerse];
      if (targetY !== undefined) {
        // Adjust for top padding so target verse appears near the top
        const topPadding = spacing.xxl;
        const targetYAdjusted = Math.max(0, targetY - topPadding);

        // Use native animated scroll - runs on native thread, smooth and reliable
        // This is simpler and more reliable than Reanimated's scrollTo worklet
        animatedScrollRef.current?.scrollTo({
          y: targetYAdjusted,
          animated: true,
        });

        // Show verse tooltip after animation completes
        // Clear any existing timer first
        if (verseTooltipTimerRef.current) {
          clearTimeout(verseTooltipTimerRef.current);
        }
        // Show tooltip much sooner - don't wait the full scroll duration
        // Actual animation typically completes in ~1s, so show tooltip after ~600ms
        // This feels immediate while letting the scroll settle
        verseTooltipTimerRef.current = setTimeout(() => {
          setVerseTooltipVisible(true);
        }, 600);

        hasScrolledRef.current = true;
      }
    }
  };

  /**
   * Handle content layout report from ChapterReader
   */
  const handleContentLayout = (positions: Record<number, number>) => {
    sectionPositionsRef.current = positions;
    attemptScrollToVerse();
  };

  // Attempt scroll when targetVerse changes (if layouts are ready)
  useEffect(() => {
    if (targetVerse) {
      attemptScrollToVerse();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of attemptScrollToVerse
  }, [targetVerse, attemptScrollToVerse]);

  // Fallback: if initial layout was late, retry after mount
  useEffect(() => {
    // Quick one-shot retry
    const timeout = setTimeout(() => {
      attemptScrollToVerse();
    }, 300);

    // Short polling until positions available or 2s elapsed
    const start = Date.now();
    const interval = setInterval(() => {
      const havePositions = Object.keys(sectionPositionsRef.current).length > 0;
      if (havePositions) {
        attemptScrollToVerse();
        clearInterval(interval);
      } else if (Date.now() - start > 2000) {
        clearInterval(interval);
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of attemptScrollToVerse
  }, [attemptScrollToVerse]);

  /**
   * Handle scroll events - calculate velocity, detect bottom, and update visible range
   */
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Update current scroll ref for distance calculation
    currentScrollYRef.current = event.nativeEvent.contentOffset.y;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollY = contentOffset.y;
    const currentTime = Date.now();

    // Store viewport height for visibility calculations
    viewportHeightRef.current = layoutMeasurement.height;

    // Update visible Y range ref immediately (no re-render)
    const newRange: VisibleYRange = {
      startY: currentScrollY,
      endY: currentScrollY + layoutMeasurement.height,
    };
    visibleYRangeRef.current = newRange;

    // Debounce state update to avoid re-renders on every scroll frame
    // Update every 150ms for smooth-enough tokenization transitions
    if (visibilityUpdateTimerRef.current) {
      clearTimeout(visibilityUpdateTimerRef.current);
    }
    visibilityUpdateTimerRef.current = setTimeout(() => {
      setVisibleYRange(newRange);
    }, 150);

    if (!onScroll) return;

    // Calculate scroll velocity (pixels per second)
    const timeDelta = currentTime - lastScrollTime.current;
    const scrollDelta = currentScrollY - lastScrollY.current; // Signed value to track direction
    const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

    // Check if at bottom
    const scrollHeight = contentSize.height - layoutMeasurement.height;
    const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

    // Track scroll fraction for cross-view sync
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 0) {
      bibleScrollFractionRef.current = currentScrollY / scrollableHeight;
    }

    // Update refs
    lastScrollY.current = currentScrollY;
    lastScrollTime.current = currentTime;

    // Call parent callback
    onScroll(velocity, isAtBottom);
  };

  /**
   * Note Handlers
   */
  const handleOpenNotes = () => {
    // Check if user is authenticated before opening notes modal
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      router.push('/auth/login');
      return;
    }

    setNotesModalVisible(true);
  };

  const _handleNotePress = (note: Note) => {
    setSelectedNote(note);
    setNotesModalVisible(false);
    setTimeout(() => setViewModalVisible(true), 100);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setNotesModalVisible(false); // Close notes list
    setViewModalVisible(false); // Close view modal if open
    setOptionsModalVisible(false); // Close options modal if open
    setTimeout(() => setEditModalVisible(true), 100);
  };

  // Handler for closing the options modal
  const handleOptionsModalClose = () => {
    setOptionsModalVisible(false);
  };

  // Called when delete is confirmed via options modal
  const _handleDeleteNote = (note: Note) => {
    setNoteToDelete(note);
    setOptionsModalVisible(false);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.note_id);
      setDeleteConfirmVisible(false);
      setViewModalVisible(false);
      setNoteToDelete(null);
      setSelectedNote(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setNoteToDelete(null);
  };

  const handleNoteSave = () => {
    setEditModalVisible(false);
    setSelectedNote(null);
  };

  // Memoize context value to avoid unnecessary re-renders
  const textVisibilityContextValue = useMemo(() => ({ visibleYRange }), [visibleYRange]);

  // Quick-verse-jump for the By Line tab (issue verse-mate-mobile#77).
  // Parse the byline markdown once per content change to know which verse
  // numbers are jumpable. Skip the parse when the tab is hidden.
  const byLineVerses = useMemo(() => {
    const content = byLineData && 'content' in byLineData ? byLineData.content : undefined;
    if (!content) return [] as number[];
    return parseByLineSections(content, chapterNumber)
      .map((section) => section.verseNumber)
      .filter((verseNumber) => verseNumber > 0);
  }, [byLineData, chapterNumber]);

  // Reset section refs when chapter changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs reset on chapter swap
  useEffect(() => {
    byLineSectionRefs.current = {};
  }, [bookId, chapterNumber]);

  const handleByLineSectionRegister = useCallback((verseNumber: number, node: View | null) => {
    if (node === null) {
      delete byLineSectionRefs.current[verseNumber];
      return;
    }
    byLineSectionRefs.current[verseNumber] = node;
  }, []);

  const handleByLineVerseJump = useCallback((verseNumber: number) => {
    const node = byLineSectionRefs.current[verseNumber];
    const scrollView = byLineScrollRef.current;
    if (!node || !scrollView) return;

    // react-native-web ships `View.measureLayout` as a stub that never invokes
    // either callback, so the native path silently no-ops on web. On web, read
    // positions from the DOM via getBoundingClientRect + the ScrollView's
    // current scrollTop.
    if (Platform.OS === 'web') {
      const scrollNode = (
        scrollView as unknown as { getScrollableNode?: () => HTMLElement | null }
      ).getScrollableNode?.();
      const sectionEl = node as unknown as HTMLElement;
      if (scrollNode && typeof sectionEl.getBoundingClientRect === 'function') {
        const sRect = scrollNode.getBoundingClientRect();
        const nRect = sectionEl.getBoundingClientRect();
        const y = computeByLineJumpY(
          { top: sRect.top, scrollTop: scrollNode.scrollTop },
          { top: nRect.top },
          spacing.md
        );
        scrollView.scrollTo({ y, animated: true });
      }
      return;
    }

    const scrollHandle = findNodeHandle(scrollView);
    if (scrollHandle == null) return;
    // measureLayout reports the section's offset relative to the ScrollView
    // content, which is exactly what scrollTo expects on the y-axis.
    (
      node as unknown as {
        measureLayout: (
          node: number,
          onSuccess: (x: number, y: number, w: number, h: number) => void,
          onFail: () => void
        ) => void;
      }
    ).measureLayout(
      scrollHandle,
      (_x, y) => {
        // Bias by a small offset so the verse heading isn't flush with the
        // viewport top.
        scrollView.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
      },
      () => {}
    );
  }, []);

  // UI-thread driven opacities — flip the visible content the same frame
  // as the tap, without waiting for the activeView prop reconciliation
  // (which can take ~300ms while React walks the chapter tree). Both
  // containers stay position:absolute so neither holds layout space,
  // overlapping at the same bounds. Opacity decides which is visible.
  // Falls back to a local sharedValue mirroring activeView when no parent
  // sharedValue is provided (tests, BibleContentPanel split-view path).
  const localToggleProgress = useSharedValue(activeView === 'bible' ? 0 : 1);
  useEffect(() => {
    if (toggleProgress) return;
    localToggleProgress.value = withTiming(activeView === 'bible' ? 0 : 1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeView, localToggleProgress, toggleProgress]);
  const effectiveProgress = toggleProgress ?? localToggleProgress;
  const insightContainerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: effectiveProgress.value,
      zIndex: effectiveProgress.value > 0.5 ? 1 : 0,
    };
  });
  const bibleContainerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: 1 - effectiveProgress.value,
      zIndex: effectiveProgress.value > 0.5 ? 0 : 1,
    };
  });

  // Inner-tab visibility — driven by activeTabProgress (string sharedValue
  // holding the active tab key). Snap, not fade: each tab is fully visible
  // when the value matches its key, fully hidden otherwise. Falls back to
  // a local sharedValue mirroring activeTab when no parent value is
  // provided.
  const localActiveTabProgress = useSharedValue<ContentTabType>(activeTab);
  useEffect(() => {
    if (activeTabProgress) return;
    localActiveTabProgress.value = activeTab;
  }, [activeTab, localActiveTabProgress, activeTabProgress]);
  const effectiveTabProgress = activeTabProgress ?? localActiveTabProgress;
  const summaryTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'summary';
    return { opacity: match ? 1 : 0, zIndex: match ? 1 : 0 };
  });
  const bylineTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'byline';
    return { opacity: match ? 1 : 0, zIndex: match ? 1 : 0 };
  });
  const studyTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'study';
    return { opacity: match ? 1 : 0, zIndex: match ? 1 : 0 };
  });
  const visualsTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'visuals';
    return { opacity: match ? 1 : 0, zIndex: match ? 1 : 0 };
  });

  return (
    <View style={styles.container} collapsable={false}>
      {/* Explanations View — mount when:
           1. User is on Insight view (always), OR
           2. We've pre-warmed it after chapter settle (insightPrewarmed),
              so the Bible -> Insight toggle is an instant style flip
              with no JS-thread first-mount blocking, OR
           3. Legacy staggered pre-render path for buffer pages. */}
      {(activeView === 'explanations' ||
        insightPrewarmed ||
        (!isPreloading && delayedRenderStage >= 1)) && (
        <Animated.View
          style={[styles.container, styles.absoluteFill, insightContainerStyle]}
          collapsable={false}
          pointerEvents={activeView === 'explanations' ? 'auto' : 'none'}
        >
          {/* Summary tab — always rendered (default tab). The wrapper
              Animated.View overlays the Insight container; opacity comes
              from activeTabProgress on the UI thread so the swap is
              instant. visible={true} keeps TabContent's inner ScrollView
              in flex:1 layout (it fills the absolute wrapper). */}
          <Animated.View
            style={[styles.absoluteFill, summaryTabStyle]}
            pointerEvents={activeTab === 'summary' ? 'auto' : 'none'}
          >
            <TabContent
              chapter={displayChapter}
              activeTab="summary"
              content={summaryData}
              isLoading={isSummaryLoading}
              error={summaryError}
              isAvailableOffline={summaryIsLocal}
              visible={true}
              shouldRenderHidden={true}
              testID={`chapter-page-scroll-${bookId}-${chapterNumber}-summary`}
              onScroll={handleScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              filteredHighlights={chapterHighlights}
              filteredAutoHighlights={autoHighlights}
              scrollRef={summaryScrollRef}
              onTabContentSizeChange={(_w, h) =>
                handleTabContentSizeChange('summary', h, viewportHeightRef.current)
              }
            />
          </Animated.View>

          {/* Byline tab — gated by the existing stagger logic (don't mount
              the heavy markdown until activated or stage 3). Once mounted,
              opacity is driven by activeTabProgress. */}
          {(activeTab === 'byline' || delayedRenderStage >= 3) && (
            <Animated.View
              style={[styles.absoluteFill, bylineTabStyle]}
              pointerEvents={activeTab === 'byline' ? 'auto' : 'none'}
            >
              <TabContent
                chapter={displayChapter}
                activeTab="byline"
                content={byLineData}
                isLoading={isByLineLoading}
                error={byLineError}
                isAvailableOffline={byLineIsLocal}
                visible={true}
                shouldRenderHidden={true}
                testID={`chapter-page-scroll-${bookId}-${chapterNumber}-byline`}
                onScroll={handleScroll}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                filteredHighlights={chapterHighlights}
                filteredAutoHighlights={autoHighlights}
                scrollRef={byLineScrollRef}
                onTabContentSizeChange={(_w, h) =>
                  handleTabContentSizeChange('byline', h, viewportHeightRef.current)
                }
                onByLineSectionRegister={handleByLineSectionRegister}
              />
            </Animated.View>
          )}

          {/* Quick-verse-jump overlay - byline tab only (issue verse-mate-mobile#77).
              Mount on the byline tab; fade with the scroll-arrow auto-hide (VERA-39). */}
          {activeView === 'explanations' && activeTab === 'byline' && (
            <VerseJumpButton
              verses={byLineVerses}
              onSelect={handleByLineVerseJump}
              visible={fabVisible}
              onInteraction={onFABInteraction}
              testID={`chapter-page-${bookId}-${chapterNumber}-verse-jump`}
            />
          )}

          {/* Study tab — bundled content, no API fetch. */}
          <Animated.View
            style={[styles.absoluteFill, studyTabStyle]}
            pointerEvents={activeTab === 'study' ? 'auto' : 'none'}
          >
            <ScrollView
              ref={studyScrollRef}
              style={styles.container}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={activeTab === 'study'}
              testID={`chapter-page-scroll-${bookId}-${chapterNumber}-study`}
              onScroll={activeTab === 'study' ? handleScroll : undefined}
              scrollEventThrottle={16}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <StudyPanel bookId={bookId} chapter={chapterNumber} />
            </ScrollView>
          </Animated.View>

          {/* Visuals tab — bundled @versemate/visuals. Only rendered for
              books in BOOKS_WITH_VISUALS. */}
          {displayChapter && bookHasVisuals(displayChapter.bookId) ? (
            <Animated.View
              style={[styles.absoluteFill, visualsTabStyle]}
              pointerEvents={activeTab === 'visuals' ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={true}
                testID={`chapter-page-scroll-${bookId}-${chapterNumber}-visuals`}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <VisualsPanel
                  bookId={displayChapter.bookId}
                  chapter={displayChapter.chapterNumber}
                  bookName={displayChapter.bookName}
                  testID={`visuals-panel-${bookId}-${chapterNumber}`}
                />
              </ScrollView>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}

      {/* Bible reading view (no explanations) — always rendered, opacity
          flipped by toggleProgress on the UI thread. Always absolute-fill
          so it overlaps the Insight container at the same bounds. */}
      <Animated.ScrollView
        ref={animatedScrollRef}
        style={[styles.container, styles.absoluteFill, bibleContainerStyle]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        testID={`chapter-page-scroll-${bookId}-${chapterNumber}-bible`}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        pointerEvents={activeView === 'bible' ? 'auto' : 'none'}
      >
        <TextVisibilityContext.Provider value={textVisibilityContextValue}>
          <View style={styles.readerContainer} collapsable={false}>
            {displayChapter && !isPreloading ? (
              <ChapterReader
                chapter={displayChapter}
                activeTab={activeTab}
                explanationsOnly={false}
                hideChapterTitle={hideChapterTitle}
                onContentLayout={handleContentLayout}
                onOpenNotes={handleOpenNotes}
                filteredHighlights={chapterHighlights}
                filteredAutoHighlights={autoHighlights}
              />
            ) : (
              // Distinct testID from the chapter-screen-level skeleton so integration
              // tests that wait for testID="skeleton-loader" to disappear don't trip on
              // these buffer-page placeholders (3-page pager always renders 2 buffer
              // pages with isPreloading=true → 2 of these visible at any time).
              <SkeletonLoader testID="chapter-page-skeleton-buffer" />
            )}
          </View>
        </TextVisibilityContext.Provider>
        <BottomLogo />
      </Animated.ScrollView>

      {/* Note Modals - Rendered OUTSIDE ScrollView */}
      {/*
        NOTES-1: Force a fresh NotesModal instance per chapter.
        This route reuses the same ChapterPage component when the
        bookId/chapterNumber params change (Expo Router behavior),
        so the modal's local `recentNotes` state would otherwise leak
        across chapters and surface notes from the previously visited
        chapter on the current one.
      */}
      <NotesModal
        key={`notes-${bookId}-${chapterNumber}`}
        visible={notesModalVisible}
        bookId={bookId}
        chapterNumber={chapterNumber}
        bookName={displayChapter?.bookName || ''}
        onClose={() => setNotesModalVisible(false)}
      />

      {selectedNote && (
        <NoteViewModal
          visible={viewModalVisible}
          note={selectedNote}
          bookName={displayChapter?.title.split(' ')[0] || ''}
          chapterNumber={chapterNumber}
          onClose={() => {
            setViewModalVisible(false);
            setSelectedNote(null);
          }}
        />
      )}

      {selectedNote && (
        <NoteOptionsModal
          visible={optionsModalVisible}
          note={selectedNote}
          onClose={handleOptionsModalClose}
          deleteNote={async (noteId) => {
            await deleteNote(noteId);
            setOptionsModalVisible(false);
            setViewModalVisible(false);
            setSelectedNote(null);
          }}
          onEdit={() => handleEditNote(selectedNote)}
        />
      )}

      {selectedNote && (
        <NoteEditModal
          visible={editModalVisible}
          note={selectedNote}
          bookName={displayChapter?.title.split(' ')[0] || ''}
          chapterNumber={chapterNumber}
          onClose={() => {
            setEditModalVisible(false);
            setSelectedNote(null);
          }}
          onSave={handleNoteSave}
        />
      )}

      <DeleteConfirmationModal
        visible={deleteConfirmVisible}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingNote}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
      />

      {/* Verse Tooltip - shown after scroll animation completes */}
      {targetVerse &&
        (() => {
          // Determine the verse range to check for highlights
          const endVerse = targetEndVerse || targetVerse;

          // Group consecutive highlights and find if target verse(s) are highlighted
          const highlightGroups = groupConsecutiveHighlights(chapterHighlights);
          // Match exact range to ensure we show the correct highlight group
          const matchingGroup = highlightGroups.find(
            (group) => group.startVerse === targetVerse && group.endVerse === endVerse
          );

          // Get verse text from chapter data
          let verseText = '';
          if (displayChapter) {
            // biome-ignore lint/suspicious/noExplicitAny: Hybrid structure
            const verses = displayChapter.sections.flatMap((s: any) => s.verses);
            if (endVerse > targetVerse) {
              // Multi-verse: concatenate all verses in range
              const verseRange = verses.filter(
                // biome-ignore lint/suspicious/noExplicitAny: Hybrid structure
                (v: any) => v.verseNumber >= targetVerse && v.verseNumber <= endVerse
              );
              // biome-ignore lint/suspicious/noExplicitAny: Hybrid structure
              verseText = verseRange.map((v: any) => v.text).join(' ');
            } else {
              // Single verse
              // biome-ignore lint/suspicious/noExplicitAny: Hybrid structure
              const verse = verses.find((v: any) => v.verseNumber === targetVerse);
              verseText = verse?.text || '';
            }
          }

          // If we found a matching highlight group, use it
          // Otherwise, treat as plain verse
          return (
            <VerseMateTooltip
              verseNumber={matchingGroup ? null : targetVerse}
              highlightGroup={matchingGroup || null}
              bookId={bookId}
              chapterNumber={chapterNumber}
              bookName={displayChapter?.title.split(' ')[0] || ''}
              visible={verseTooltipVisible}
              onClose={() => setVerseTooltipVisible(false)}
              verseText={verseText}
              isLoggedIn={isAuthenticated}
            />
          );
        })()}
    </View>
  );
}
