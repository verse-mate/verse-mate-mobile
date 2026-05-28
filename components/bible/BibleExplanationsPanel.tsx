/**
 * BibleExplanationsPanel Component
 *
 * Right panel for split view that displays AI-generated explanations
 * for Bible chapters. Includes tab selector and scrollable content.
 *
 * Features:
 * - Dark header bar with menu icon
 * - Tab selector for Summary/By Line/Study/Visuals modes
 * - Scrollable explanation content area
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  Animated,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';
import { AvailableOfflineBadge } from '@/components/offline/AvailableOfflineBadge';
import { OfflineContentUnavailable } from '@/components/offline/OfflineContentUnavailable';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useBibleByLine, useBibleSummary } from '@/src/api';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getSplitViewSpecs,
  lineHeights,
  spacing,
} from '@/theme/tokens';
import type { ContentTabType } from '@/types/bible';
import { computeByLineJumpY } from '@/utils/bible/byLineJump';
import { parseByLineSections } from '@/utils/bible/parseByLineExplanation';
import { AudioInlineEntry } from './AudioInlineEntry';
import { ShareButton } from './ShareButton';
import { StudyPanel } from './StudyPanel';
import { VerseJumpButton } from './VerseJumpButton';
import { bookHasVisuals, VisualsPanel } from './VisualsPanel';

/**
 * Tab configuration for explanation types. The Visuals tab is appended
 * at render time for books with curated visuals (see `bookHasVisuals`);
 * keeping it out of the base list lets the indicator math below match
 * tab count.
 */
type TabDef = { id: ContentTabType; label: string };
const BASE_TABS: readonly TabDef[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'byline', label: 'By Line' },
  { id: 'study', label: 'Study' },
];
const VISUALS_TAB: TabDef = { id: 'visuals', label: 'Visuals' };

/**
 * Props for BibleExplanationsPanel
 */
export interface BibleExplanationsPanelProps {
  /** Book ID for fetching explanations */
  bookId: number;

  /** Chapter number for fetching explanations */
  chapterNumber: number;

  /** Book name for display */
  bookName: string;

  /** Currently active tab */
  activeTab: ContentTabType;

  /** Callback when tab changes */
  onTabChange: (tab: ContentTabType) => void;

  /**
   * True while a tab switch transition is pending in the parent. Drives a
   * skeleton overlay so the user sees immediate visual feedback that the
   * content is changing, even though React keeps the old tab visible while
   * the new tree reconciles in the background.
   */
  isTabPending?: boolean;

  /** Callback when menu button is pressed */
  onMenuPress?: () => void;

  /** Callback for scroll events (for FAB visibility control) */
  onScroll?: (velocity: number, isAtBottom: boolean) => void;

  /** Callback for tap events (for FAB visibility control) */
  onTap?: () => void;

  /**
   * Drives the verse-jump pill fade. Pass the same `fabVisible` state used
   * by the chapter-nav scroll arrows so the pill auto-hides on the same
   * trigger (VERA-39 / VERA-36). Defaults to `true` for callers that don't
   * track FAB visibility.
   */
  fabVisible?: boolean;

  /**
   * Called when the user taps the verse-jump pill. Wire to `showButtons`
   * from `useFABVisibility` so the arrows and the pill re-show together.
   */
  onFABInteraction?: () => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * BibleExplanationsPanel Component
 *
 * Displays AI-generated explanations in the right panel of split view.
 */
export function BibleExplanationsPanel({
  bookId,
  chapterNumber,
  bookName,
  activeTab,
  onTabChange,
  isTabPending = false,
  onMenuPress,
  onScroll,
  onTap,
  fabVisible = true,
  onFABInteraction,
  testID = 'bible-explanations-panel',
}: BibleExplanationsPanelProps) {
  const { mode, colors } = useTheme();
  const { user } = useAuth();
  const { isOffline } = useOfflineStatus();
  const insets = useSafeAreaInsets();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const { styles, markdownStyles } = useMemo(
    () => createStyles(specs, colors, insets),
    [specs, colors, insets]
  );
  // Get current language from user preferences (default to 'en-US')
  // This ensures the query key changes when language changes
  const language = typeof user?.preferred_language === 'string' ? user.preferred_language : 'en-US';

  // Visuals tab is gated per-book; check once per render. Computed
  // here (not deferred to the JSX) because the tab list, indicator
  // math, and slide animation all depend on the final tab count.
  const hasVisuals = bookHasVisuals(bookId);
  const tabs: readonly TabDef[] = hasVisuals ? [...BASE_TABS, VISUALS_TAB] : BASE_TABS;

  // Animation for sliding tab indicator
  const getTabIndex = (tab: ContentTabType) => tabs.findIndex((t) => t.id === tab);
  const slideAnim = useRef(new Animated.Value(getTabIndex(activeTab))).current;
  const [tabWidth, setTabWidth] = useState(0);

  // Track last scroll position and timestamp for velocity calculation
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());

  // Track touch start time and position to differentiate tap from scroll
  const touchStartTime = useRef(0);
  const touchStartY = useRef(0);

  // Separate scroll refs per tab to maintain independent scroll positions
  const summaryScrollRef = useRef<ScrollView>(null);
  const byLineScrollRef = useRef<ScrollView>(null);
  const studyScrollRef = useRef<ScrollView>(null);
  const visualsScrollRef = useRef<ScrollView>(null);

  // Quick-verse-jump: refs to each rendered By Line verse-section View.
  // Populated when byline content is split into per-verse sections below.
  // Reset on chapter swap so stale nodes can't be reached.
  const byLineSectionRefs = useRef<Record<number, View | null>>({});

  // Reset all scroll positions only when chapter changes (not on tab switch)
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers for scroll reset
  useEffect(() => {
    summaryScrollRef.current?.scrollTo({ y: 0, animated: false });
    byLineScrollRef.current?.scrollTo({ y: 0, animated: false });
    studyScrollRef.current?.scrollTo({ y: 0, animated: false });
    visualsScrollRef.current?.scrollTo({ y: 0, animated: false });
    byLineSectionRefs.current = {};
  }, [bookId, chapterNumber]);

  // Animate indicator when active tab changes
  useEffect(() => {
    const targetIndex = getTabIndex(activeTab);
    Animated.spring(slideAnim, {
      toValue: targetIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization of getTabIndex
  }, [activeTab, slideAnim, getTabIndex]);

  // Active Bible version drives the verse-injection inside the AI
  // explanations — without it the backend defaults to NASB1995, so a
  // Romanian/German/etc. user would see English verse quotes inside
  // their otherwise-localized commentary.
  const { bibleVersion } = useBibleVersion();

  // Fetch explanations based on active tab.
  //
  // Note: we destructure BOTH `isLoading` and `isPending`. `isLoading` is
  // `isPending && isFetching` — it stays false during the synchronous
  // render that flips `enabled` from false→true (the fetch is scheduled
  // in an effect that runs AFTER render). That leaves a one-frame window
  // where `data` is undefined AND `isLoading` is false, which used to
  // render nothing → user sees a blank Insight tab on first switch from
  // Bible (Andy 2026-05-24 repro: "typically on app startup"). Using
  // `isPending` for the skeleton gate covers the gap — it's true the
  // moment the query exists without data, regardless of fetch state.
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isPending: summaryPending,
    isLocalData: summaryIsLocal,
  } = useBibleSummary(bookId, chapterNumber, bibleVersion, {
    enabled: activeTab === 'summary',
    language,
  });

  const {
    data: byLineData,
    isLoading: byLineLoading,
    isPending: byLinePending,
    isLocalData: byLineIsLocal,
  } = useBibleByLine(bookId, chapterNumber, bibleVersion, {
    enabled: activeTab === 'byline',
    language,
  });

  // Handle tab change with haptic feedback. The parent's onTabChange is
  // expected to wrap setActiveTab in a useTransition so React doesn't block
  // on the heavy markdown reconciliation; `isTabPending` then drives the
  // skeleton overlay below.
  const handleTabChange = (tab: ContentTabType) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tab);
  };

  // Per-tab content extraction
  const extractContent = (data: unknown): string | null => {
    if (!data) return null;
    if (typeof data === 'object' && data !== null && 'content' in data) {
      return (data as { content: string }).content;
    }
    return null;
  };

  const summaryContent = extractContent(summaryData);
  const byLineContent = extractContent(byLineData);

  // Quick-verse-jump for the By Line tab (VERA-36): desktop / split-view path.
  // ChapterPage handles the phone-portrait path; this panel covers
  // landscape-tablet and web desktop (width >= 900dp, see
  // utils/device-detection.ts -> shouldUseSplitView).
  const byLineSections = useMemo(() => {
    if (!byLineContent) return [] as ReturnType<typeof parseByLineSections>;
    return parseByLineSections(byLineContent, chapterNumber);
  }, [byLineContent, chapterNumber]);

  const byLineVerses = useMemo(
    () => byLineSections.map((section) => section.verseNumber).filter((v) => v > 0),
    [byLineSections]
  );

  const handleByLineVerseJump = useCallback((verseNumber: number) => {
    const node = byLineSectionRefs.current[verseNumber];
    const scrollView = byLineScrollRef.current;
    if (!node || !scrollView) return;

    // react-native-web's `View.measureLayout` is a no-op stub, so the native
    // path silently fails on web. On web, read positions from the DOM via
    // getBoundingClientRect + the ScrollView's scrollTop. Mirrors the logic
    // in ChapterPage.tsx.
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
        scrollView.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
      },
      () => {}
    );
  }, []);

  /**
   * Handle touch start - record time and position
   * Used to differentiate tap from scroll gestures
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
   * Matches logic from ChapterPage.tsx for consistent behavior
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

  /**
   * Handle scroll events - calculate velocity and check if at bottom
   * Matches logic from ChapterPage.tsx for consistent FAB behavior
   */
  const handleInternalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onScroll) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollY = contentOffset.y;
    const currentTime = Date.now();

    // Calculate scroll velocity (pixels per second)
    const timeDelta = currentTime - lastScrollTime.current;
    const scrollDelta = currentScrollY - lastScrollY.current;
    const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

    // Check if at bottom
    const scrollHeight = contentSize.height - layoutMeasurement.height;
    const isAtBottom = scrollHeight - currentScrollY <= BOTTOM_THRESHOLD;

    // Update refs
    lastScrollY.current = currentScrollY;
    lastScrollTime.current = currentTime;

    // Call parent callback
    onScroll(velocity, isAtBottom);
  };

  return (
    <View
      style={styles.container}
      testID={testID}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ShareButton
            bookId={bookId}
            chapterNumber={chapterNumber}
            bookName={bookName}
            insightType={activeTab}
            size={20}
            color={specs.headerTextColor}
            testID={`${testID}-share-button`}
          />
          <View style={{ flex: 1 }} />
          {onMenuPress && (
            <Pressable
              style={styles.menuButton}
              onPress={onMenuPress}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
              testID={`${testID}-menu-button`}
            >
              <Ionicons name="menu" size={24} color={specs.headerTextColor} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tab Selector */}

      <View style={styles.tabContainer}>
        <View
          style={styles.tabsRow}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            // Container has 4px padding each side + 4px gap between
            // tabs, so usable width = W - 8 - (N-1)*4 for N tabs.
            const n = tabs.length;
            const usableWidth = width - 8 - (n - 1) * 4;
            setTabWidth(usableWidth / n);
          }}
        >
          {/* Sliding active indicator. Animation indices match `tabs` order. */}
          <Animated.View
            style={[
              styles.slidingIndicator,
              {
                width: tabWidth,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      // inputRange must be monotonically increasing
                      // with length === outputRange.length; both built
                      // from `tabs.length` so this scales with the
                      // optional Visuals tab.
                      inputRange: tabs.length < 2 ? [0, 1] : tabs.map((_, i) => i),
                      outputRange:
                        tabs.length < 2
                          ? [0, tabWidth + 4]
                          : tabs.map((_, i) => i * (tabWidth + 4)),
                    }),
                  },
                ],
              },
            ]}
          />

          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tab}
                onPress={() => handleTabChange(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                testID={`${testID}-tab-${tab.id}`}
              >
                <Text
                  style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content Area — one ScrollView per tab for independent scroll
          positions. Wrapped in a relative-positioned flex-1 View so the
          transition skeleton at the bottom can be absolutely positioned
          over the tab content only (not the header/tabs above). */}
      <View style={styles.contentArea}>
        {(
          [
            {
              key: 'summary' as const,
              type: 'summary',
              ref: summaryScrollRef,
              data: summaryContent,
              explanationId:
                summaryData && 'explanationId' in summaryData ? summaryData.explanationId : null,
              // OR with isPending so the skeleton covers the one-frame
              // window where the query has just been enabled but the
              // fetch hasn't kicked off yet. See destructure comment.
              loading: summaryLoading || (activeTab === 'summary' && summaryPending),
              isLocal: summaryIsLocal,
            },
            {
              key: 'byline' as const,
              type: 'byline',
              ref: byLineScrollRef,
              data: byLineContent,
              explanationId:
                byLineData && 'explanationId' in byLineData ? byLineData.explanationId : null,
              loading: byLineLoading || (activeTab === 'byline' && byLinePending),
              isLocal: byLineIsLocal,
            },
          ] as const
        ).map((tab) => (
          <ScrollView
            key={tab.key}
            ref={tab.ref}
            style={[styles.scrollView, activeTab !== tab.key && { display: 'none' }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            onScroll={activeTab === tab.key ? handleInternalScroll : undefined}
            scrollEventThrottle={16}
            testID={`${testID}-scroll-${tab.key}`}
          >
            {tab.loading ? (
              <SkeletonLoader />
            ) : tab.data ? (
              <>
                {tab.explanationId !== null ? (
                  <AudioInlineEntry
                    explanationId={tab.explanationId}
                    explanationType={tab.type}
                    bookId={bookId}
                    chapterNumber={chapterNumber}
                    language={language}
                    sourceHref={`/bible/${bookId}/${chapterNumber}`}
                  />
                ) : null}
                {tab.isLocal && <AvailableOfflineBadge />}
                {tab.key === 'byline' && byLineSections.length > 0 ? (
                  byLineSections.map((section, index) => (
                    <View
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable within a single parsed render
                      key={`byline-section-${section.verseNumber}-${index}`}
                      ref={(node) => {
                        if (node === null) {
                          delete byLineSectionRefs.current[section.verseNumber];
                        } else {
                          byLineSectionRefs.current[section.verseNumber] = node;
                        }
                      }}
                      testID={`byline-verse-section-${section.verseNumber}`}
                      collapsable={false}
                    >
                      <Markdown style={markdownStyles}>{section.markdown}</Markdown>
                    </View>
                  ))
                ) : (
                  <Markdown style={markdownStyles}>{tab.data}</Markdown>
                )}
              </>
            ) : isOffline ? (
              <OfflineContentUnavailable contentType="explanation" />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No explanations available for this chapter.</Text>
              </View>
            )}
          </ScrollView>
        ))}

        {/* Study tab — bundled content from @versemate/studies (no API fetch,
          no loading state, no offline concerns). Always mounted, hidden
          when not active so its scroll position persists across tab
          switches like the other 3 tabs. */}
        <ScrollView
          ref={studyScrollRef}
          style={[styles.scrollView, activeTab !== 'study' && { display: 'none' }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          onScroll={activeTab === 'study' ? handleInternalScroll : undefined}
          scrollEventThrottle={16}
          testID={`${testID}-scroll-study`}
        >
          <StudyPanel bookId={bookId} chapter={chapterNumber} testID={`${testID}-study`} />
        </ScrollView>

        {/* Visuals tab — bundled content from @versemate/visuals. Only
          mounted for books in BOOKS_WITH_VISUALS (most are), gated by
          `hasVisuals`. Same hidden-not-unmounted pattern as Study so the
          lightbox state and scroll position survive tab switches. */}
        {hasVisuals ? (
          <ScrollView
            ref={visualsScrollRef}
            style={[styles.scrollView, activeTab !== 'visuals' && { display: 'none' }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            onScroll={activeTab === 'visuals' ? handleInternalScroll : undefined}
            scrollEventThrottle={16}
            testID={`${testID}-scroll-visuals`}
          >
            <VisualsPanel
              bookId={bookId}
              chapter={chapterNumber}
              bookName={bookName}
              testID={`${testID}-visuals`}
            />
          </ScrollView>
        ) : null}

        {/* Quick-verse-jump FAB (VERA-36): byline-only. No chapter-nav row
          beneath this ScrollView in split / desktop right panel, so use a
          tighter bottom offset than the phone-portrait default.
          Fades with the scroll-arrow auto-hide (VERA-39 / VERA-36 parity). */}
        {activeTab === 'byline' && (
          <VerseJumpButton
            verses={byLineVerses}
            onSelect={handleByLineVerseJump}
            visible={fabVisible}
            onInteraction={onFABInteraction}
            bottomOffset={spacing.lg}
            testID={`${testID}-verse-jump`}
          />
        )}

        {/* Transition skeleton overlay — shown while the parent's tab-switch
          transition is reconciling. Covers the tab content area only; the
          tabs row above stays interactive. */}
        {isTabPending && (
          <View
            style={styles.transitionSkeleton}
            pointerEvents="none"
            testID={`${testID}-tab-transition-skeleton`}
          >
            <SkeletonLoader />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Create styles for BibleExplanationsPanel
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof getColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  const styles = StyleSheet.create({
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
      justifyContent: 'space-between',
      height: specs.headerHeight,
      width: '100%',
    },
    headerTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: specs.headerTextColor,
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: spacing.sm,
    },
    menuButton: {
      padding: spacing.xs,
    },
    tabContainer: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    tabsRow: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 100,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      position: 'relative',
      minHeight: 36,
      alignSelf: 'center',
    },
    slidingIndicator: {
      position: 'absolute',
      height: 28,
      backgroundColor: specs.activeTabBackground,
      borderRadius: 100,
      top: 4,
      left: 4,
    },
    tab: {
      width: 100,
      borderRadius: 100,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 28,
      backgroundColor: 'transparent',
      zIndex: 1,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '400',
    },
    tabTextActive: {
      color: specs.activeTabTextColor,
    },
    tabTextInactive: {
      color: specs.inactiveTabTextColor,
    },
    scrollView: {
      flex: 1,
    },
    contentArea: {
      flex: 1,
      position: 'relative',
    },
    transitionSkeleton: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xxl,
      paddingBottom: 60,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xxl,
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  const markdownStyles = StyleSheet.create({
    body: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    blockquote_text: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textPrimary,
    },
  });

  return { styles, markdownStyles };
}

export default BibleExplanationsPanel;
