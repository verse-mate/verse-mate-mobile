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
  runOnJS,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
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
import { OfflineContentUnavailable } from '@/components/offline/OfflineContentUnavailable';
import { bibleVersions } from '@/constants/bible-versions';
import { useAuth } from '@/contexts/AuthContext';
import { useBibleInteraction } from '@/contexts/BibleInteractionContext';
import { TextVisibilityContext, type VisibleYRange } from '@/contexts/TextVisibilityContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BOTTOM_THRESHOLD,
  SCROLL_VELOCITY_THRESHOLD as FAB_SCROLL_VELOCITY_THRESHOLD,
} from '@/hooks/bible/use-fab-visibility';
import type { Highlight } from '@/hooks/bible/use-highlights';
import { useNativeText } from '@/hooks/bible/use-native-text';
import { useNotes } from '@/hooks/bible/use-notes';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { usePreferredLanguage } from '@/hooks/use-preferred-language';
import { perfAdd, usePerfMountSpan, useWhyRender, watchFrames } from '@/lib/perf';
import { useStableList } from '@/lib/perf/use-stable-list';
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
  onByLineSectionRegister,
  bibleVersion,
  bibleLanguage,
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
  onByLineSectionRegister?: (verseNumber: number, node: View | null) => void;
  /** Threaded through to ChapterReader — see ChapterReaderProps. */
  bibleVersion?: string;
  bibleLanguage?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Memoised for the same reason as ChapterReader's: a fresh StyleSheet each render defeats
  // memoisation in every child that receives one of its entries.
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { isOffline } = useOfflineStatus();

  /**
   * Progressive reveal for byline verse sections, ramped ONE frame at a time.
   *
   * ## What this replaces, and why
   *
   * This was two discrete bumps — 5 sections, then 30 at 200ms, then everything at 500ms — chosen
   * over a `setInterval` because the perpetual timer's re-renders competed with the toggle's React
   * work. The reasoning was right about the timer and wrong about the bumps, and an atrace capture
   * finally showed why (`scripts/perf/capture-atrace.sh`, written up in `docs/perf-next-session.md`).
   *
   * Inside the frame phase `framestats` calls `animation`, three Bible↔Insight toggles spent 119.4ms
   * creating **228 native text views** — and they arrived in exactly **two commits, 120 then 108,
   * 250ms apart**. Two commits, two timers, 200ms and 500ms: the bumps ARE the burst. `30 → ∞` is
   * the worst of them, mounting every remaining section at once — 146 more sections on Psalm 119.
   * The worst single frame in that capture was 46.70ms, about five and a half frames at 120Hz.
   *
   * So the fix is not fewer, larger steps but many small ones, paced to real frames. Each section is
   * its own `<Markdown>`, so a step's cost scales with the sections it adds: at the measured ~0.52ms
   * per view creation, four sections per frame stays inside the 8.34ms budget with room for the
   * traversal and draw that share it.
   *
   * `requestAnimationFrame`, not `setTimeout`: it paces to actual frames, so the step size means
   * what it says. A timer chain runs several times per frame under load and coalesces straight back
   * into the big commit this exists to avoid. The ramp still STOPS — at `POSITIVE_INFINITY` the
   * effect returns early and schedules nothing, which is what the original was protecting.
   *
   * `BYLINE_MAX_SECTIONS` ends the ramp without needing the section count here (it lives in
   * `ChapterReader`, which does the slicing); 200 clears the longest chapter in the Bible, Psalm 119
   * at 176 verses.
   */
  const [bylineMax, setBylineMax] = useState(BYLINE_INITIAL_SECTIONS);

  /**
   * Restart the ramp for a new chapter, not just a new tab.
   *
   * Keyed on the chapter too because `bylineMax` reaching `Infinity` is sticky: without this, the
   * next chapter inherits "reveal everything" and mounts every section in one commit — the storm
   * returns on ordinary navigation, which is the other place the capture found views landing in a
   * single frame.
   */
  useEffect(() => {
    setBylineMax(BYLINE_INITIAL_SECTIONS);
  }, [activeTab, chapter?.bookId, chapter?.chapterNumber]);

  useEffect(() => {
    if (activeTab !== 'byline' || !Number.isFinite(bylineMax)) return;
    const handle = requestAnimationFrame(() => {
      setBylineMax((current) => {
        const next = current + BYLINE_SECTIONS_PER_FRAME;
        return next >= BYLINE_MAX_SECTIONS ? Number.POSITIVE_INFINITY : next;
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [activeTab, bylineMax]);

  // Determine content for the reader
  const rawExplanationContent = content && 'content' in content ? content : undefined;

  /**
   * Identity-stable explanation, so the reader re-renders only when it truly changes.
   *
   * Measured across twelve tab switches: `render.insight.by.explanation` fired 51 times —
   * far more than the switches justify — because the object arrives fresh from the query
   * layer even when nothing about it has changed, and every arrival re-renders the Insight
   * subtree and re-parses its markdown.
   *
   * Same fix as the highlight arrays: hold the previous object while a content signature
   * matches. Pre-warming the tabs was tried first and changed nothing (mean 59ms -> 63ms),
   * which is what ruled mounting out and pointed here — the cost is re-rendering, not
   * creating.
   */
  const explanationSignature = rawExplanationContent
    ? `${rawExplanationContent.explanationId ?? ''}:${rawExplanationContent.languageCode ?? ''}:${
        typeof rawExplanationContent.content === 'string' ? rawExplanationContent.content.length : 0
      }`
    : '';
  const stableExplanationRef = useRef<{ signature: string; value: typeof rawExplanationContent }>({
    signature: explanationSignature,
    value: rawExplanationContent,
  });
  if (stableExplanationRef.current.signature !== explanationSignature) {
    stableExplanationRef.current = {
      signature: explanationSignature,
      value: rawExplanationContent,
    };
  }
  const explanationContent = stableExplanationRef.current.value;

  // Bail out AFTER every hook. This sat above the `useRef` above and was a real crash path,
  // not a lint preference: a page going from visible to hidden ran one fewer hook than its
  // previous render, which is exactly the "rendered fewer hooks than expected" invariant.
  // The pager hides pages constantly, so it was only a matter of which swipe hit it.
  const isHidden = !visible;
  if (isHidden && !shouldRenderHidden) return null;

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
          {chapter && (
            <ChapterReader
              chapter={chapter}
              activeTab={activeTab}
              explanationsOnly={true}
              explanation={explanationContent}
              filteredHighlights={filteredHighlights}
              filteredAutoHighlights={filteredAutoHighlights}
              onByLineSectionRegister={activeTab === 'byline' ? onByLineSectionRegister : undefined}
              maxBylineSections={activeTab === 'byline' ? bylineMax : undefined}
              bibleVersion={bibleVersion}
              bibleLanguage={bibleLanguage}
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
/**
 * How often the scroll worklet pushes the visible Y range to JS, in ms.
 *
 * Matches the debounce the old per-frame JS handler used. Tokenization only needs
 * a coarse window, so this is a throttle rather than a debounce now — the previous
 * version allocated and cancelled a timeout on every scroll frame to achieve the
 * same effect.
 */
const VISIBILITY_PUSH_INTERVAL_MS = 150;

/**
 * How long to record frames after a view switch starts, in ms.
 *
 * Longer than the 180ms toggle animation on purpose: a stall that lands just after
 * the animation finishes is still felt as part of the switch.
 */
/**
 * The pill's animation duration, mirrored from the screen's `withTiming` call, plus the margin
 * the Insight mount waits beyond it.
 */
/** Every Insight tab, in the order they are pre-warmed. */
/**
 * Which tabs are worth mounting BEFORE the reader asks for them.
 *
 * The full set is summary / byline / study / visuals; only the first two are prewarmed.
 *
 * Not all of them, and the exclusions are measured rather than guessed. atrace bucketed every native view
 * creation during a first visit to each tab:
 *
 *     after tab-byline:  57 RCTView  104 VMText   4 RCTText
 *     after tab-study:   51 RCTView    0 VMText  66 RCTText   <- ~117 views, and the 47.39ms frame
 *
 * Study is the heaviest tab in the reader by a wide margin — 36 distinct `<Text>` sites, several inside
 * `.map()`s over cards — and its 47ms mount is about 5.7 dropped frames at 120Hz, i.e. one clearly
 * visible stutter. (Its card BODIES are already lazy; those 117 views are headers and chrome.)
 *
 * Prewarming it is actively harmful to how the app feels. The prewarm fires ~250ms apart after the reader
 * opens Insight, so Study mounts while they are reading Summary or By Line — an UNPROMPTED hitch with no
 * action attached to it, which is the worst kind: a stutter tied to a tap reads as "that was heavy", one
 * that arrives on its own reads as "this app is janky".
 *
 * So the cheap tabs prewarm and the heavy ones mount when actually opened. That does not make Study's
 * mount cheaper — it moves the cost onto a deliberate tap, where it is expected. Reducing it needs fewer
 * views, which is a separate change.
 *
 * `visuals` is excluded for the same reason plus a stronger one: it is gated on `bookHasVisuals` and
 * carries WebViews (`createViewUnsafe(RNCWebView)` showed up at 9.18ms EACH in an earlier capture), so
 * prewarming it spends the most for the least likely visit.
 */
const PREWARMED_TABS: ContentTabType[] = ['summary', 'byline'];

/**
 * Byline reveal ramp. See the effect in `TabContent` for the capture these come from.
 *
 * Sized from measurement: atrace put native text-view creation at ~0.52ms each, and each byline
 * section is its own `<Markdown>`, so four sections per frame stays inside the 120Hz budget of
 * 8.34ms with room for the traversal and draw sharing the frame. The initial 5 is unchanged — it is
 * what makes first paint fast. 200 ends the ramp without the section count, which lives in
 * `ChapterReader`; Psalm 119, the longest chapter, has 176 verses.
 */
const BYLINE_INITIAL_SECTIONS = 5;
const BYLINE_SECTIONS_PER_FRAME = 4;
const BYLINE_MAX_SECTIONS = 200;

/**
 * Same ramp for an offscreen BUFFER page's Bible sections. Only buffers ramp — see the effect.
 *
 * Shares the byline sizing because the unit is the same: sections whose text becomes native views at
 * the measured ~0.52ms each, against a 120Hz budget of 8.34ms.
 */
const BIBLE_SECTIONS_PER_FRAME = 4;
const BIBLE_MAX_SECTIONS = 200;

/**
 * Gap between one prewarmed tab and the next, in ms.
 *
 * The effect below says "one tab per idle window", and it did not achieve that:
 * `runAfterInteractions` fires immediately when nothing is happening, and the effect re-runs on
 * every `visitedTabs` change, so the remaining tabs chained back-to-back. atrace caught the result —
 * 228 native text views created in two consecutive commits, worst `animation` frame 46.70ms.
 *
 * NativeMarkdown now ramps its blocks at 8 per frame, so one tab takes roughly
 * `blocks / 8` frames — ~14 frames, ~117ms at 120Hz for a typical Insight document. A gap
 * comfortably longer than that keeps two tabs' ramps from overlapping and re-coalescing into the
 * big commit both changes exist to avoid.
 */
const PREWARM_TAB_GAP_MS = 250;

const VIEW_SWITCH_ANIM_MS = 180;
const VIEW_SWITCH_MOUNT_MARGIN_MS = 40;

const VIEW_SWITCH_FRAME_WINDOW_MS = 500;

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
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);

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

  // Bible version drives the lexicon source for `ChapterReader`: English
  // versions (NASB1995/KJV) use the bundled `@versemate/lexicon`; non-English
  // fetch Strong's tokens via `?tagged=1` and resolve lemma cards via
  // `/lemma`. The bare ISO language code (es, de, …) is what `/lemma?lang=`
  // expects; pulled off the same picker constant the Settings UI consumes.
  const { bibleVersion } = useBibleVersion();
  const bibleLanguage = useMemo(
    () => bibleVersions.find((v) => v.key === bibleVersion)?.language,
    [bibleVersion]
  );
  // Text visibility tracking for hybrid tokenization
  // Use state with debouncing to avoid re-renders on every scroll frame
  const [visibleYRange, setVisibleYRange] = useState<VisibleYRange | null>(null);
  const visibleYRangeRef = useRef<VisibleYRange | null>(null);
  const visibilityUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportHeightRef = useRef<number>(0);

  // Get highlights from the provider (single source of truth — avoids duplicate queries)
  const bibleInteraction = useBibleInteraction();
  const { chapterHighlights: routeHighlights, autoHighlights: routeAutoHighlights } =
    bibleInteraction;

  /**
   * Highlights belonging to THIS page's chapter, not the route's.
   *
   * The interaction context is keyed to the route, and the route lags a swipe. So every
   * page was handed the previous chapter's highlights: swipe from a chapter with verse 1
   * highlighted and the next chapter showed verse 1 highlighted too, until the route
   * caught up and it vanished. Filtering by the page's own chapter makes the highlight a
   * property of the chapter rather than of whatever the router last committed, so it
   * cannot bleed regardless of how far behind the route runs.
   */
  //
  // Wrapped in useStableList because the filter alone made things WORSE: it produces a new
  // array on every render of every page, and the source arrays churn identity constantly,
  // so consumers re-rendered even when the filtered contents were identical. Measured after
  // adding the filter: reader.render.bible 889 renders and paragraph.compile 999 calls for
  // ~20 chapter changes, with 157 renders attributed to chapterHighlights and 142 to
  // autoHighlights. The signature keeps the correctness and drops the churn.
  const chapterHighlights = useStableList(
    useMemo(
      () =>
        routeHighlights.filter((h) => h.book_id === bookId && h.chapter_number === chapterNumber),
      [routeHighlights, bookId, chapterNumber]
    ),
    (h) =>
      `${h.highlight_id}:${h.color}:${h.start_verse}:${h.end_verse}:${h.start_char}:${h.end_char}`
  );
  const autoHighlights = useStableList(
    useMemo(
      () =>
        routeAutoHighlights.filter(
          (h) => h.book_id === bookId && h.chapter_number === chapterNumber
        ),
      [routeAutoHighlights, bookId, chapterNumber]
    ),
    (h) => `${h.auto_highlight_id}:${h.theme_color}:${h.start_verse}:${h.end_verse}`
  );

  // Pre-warmed flag: once the chapter has settled on Bible view, mount
  // the Insight subtree in the background so the Bible → Insight toggle
  // becomes a style flip (instant) instead of a 500-700ms first-mount
  // hit. The mount is scheduled via InteractionManager.runAfterInteractions
  // so it doesn't run during the chapter-swipe animation.
  //
  // NOT sticky any more. It used to stay true for the ChapterPage's lifetime on
  // the grounds that there is no benefit to unmounting — which is true for the
  // toggle, and false for everything else. A Hermes CPU profile of six swipes
  // put `[Host Function] completeRoot` at 1344ms of self time, the single
  // largest cost in the whole run, reached through `updateHostContainer`. That
  // is Fabric committing the root's child set, and in Fabric's persistent tree
  // model EVERY commit pays a diff against the whole live tree. So the cost of
  // an Insight subtree is not only its mount: it is added to every subsequent
  // commit for as long as it stays mounted.
  //
  // Each page the reader passes through kept its own Insight subtree alive, so
  // swiping accumulated them — matching the report that rapid swiping through
  // many chapters degrades rather than staying flat. Dropping it when the page
  // stops being current bounds the live tree to one.
  /** Latest `isPreloading`, read by effects that must not re-run when it flips. */
  const isPreloadingRef = useRef(isPreloading);
  isPreloadingRef.current = isPreloading;

  /** False until the first render has passed, so the mount run is not measured. */
  const viewSwitchWatchArmedRef = useRef(false);
  /** Same, for the inner-tab frame watch. */
  const tabWatchArmedRef = useRef(false);

  const [insightPrewarmed, setInsightPrewarmed] = useState(false);

  /**
   * Whether a toggle-driven Insight mount is allowed to happen yet.
   *
   * The pill animates on the UI thread, and creating the Insight subtree's views is also UI
   * thread work — so mounting it in the same commit as the toggle put both on the same thread
   * at the same moment. Measured over seven deliberate toggles: 2 dropped frames with a worst
   * frame of 103ms in a 180ms animation, and `reader.mount.explanations` firing six times.
   *
   * There is no reason for the two to be coupled. The mount waits until the animation is over,
   * so the pill gets the thread to itself and the content arrives as it finishes. When the idle
   * prewarm has already run — the common case for a chapter the reader has sat on — this
   * changes nothing, because the subtree is mounted before the tap.
   */
  const [insightMountAllowed, setInsightMountAllowed] = useState(false);

  /**
   * Whether a buffer page may build its real content yet.
   *
   * Rendering buffer chapters is what makes a swipe land on text instead of a
   * skeleton, but doing it in the same commit as the navigation just moves the
   * stall: measurement put `reader.render.bible` at 2.9ms against a
   * `reader.mount.bible` of 352ms, so the cost is not our JS — it is React
   * commit plus native view creation, and it lands squarely on the gesture.
   *
   * So the neighbour is built in idle time instead. After a chapter change there
   * is normally a second or more before the next swipe, which is ample; if the
   * user out-runs that, they see the skeleton they saw before this change and
   * nothing is worse than it was.
   *
   * The active page never waits — it sets this true on the spot.
   */
  const [bufferContentReady, setBufferContentReady] = useState(!isPreloading);
  useEffect(() => {
    if (!isPreloading) {
      setBufferContentReady(true);
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() => {
      setBufferContentReady(true);
    });
    return () => {
      handle.cancel();
    };
    // bookId/chapterNumber are included so a recycled page re-defers for its new
    // chapter rather than inheriting the previous one's ready flag.
  }, [isPreloading, bookId, chapterNumber]);

  const { deleteNote, isDeletingNote } = useNotes();

  // A toggle to Insight mounts only after the pill animation has finished, so the two never
  // share a frame.
  //
  // Deliberately NOT reset when leaving Insight. Resetting it made the subtree unmount on the
  // way back to Bible and remount on the next toggle — measured as reader.mount.explanations
  // firing once per toggle, which is the very cost the deferral exists to keep away from the
  // animation. Staying mounted for as long as the page is current is what the prewarm already
  // intends; the page-level release when it stops being current still bounds the live tree.
  useEffect(() => {
    if (activeView !== 'explanations') return;
    if (insightPrewarmed || insightMountAllowed) return;
    const timer = setTimeout(
      () => setInsightMountAllowed(true),
      VIEW_SWITCH_ANIM_MS + VIEW_SWITCH_MOUNT_MARGIN_MS
    );
    return () => clearTimeout(timer);
  }, [activeView, insightPrewarmed, insightMountAllowed]);

  // Schedule the Insight subtree mount in idle time after the chapter
  // becomes available. Runs only for the active page (not buffer pages).
  useEffect(() => {
    if (isPreloading) {
      // Released as soon as this page is no longer the current one, so at most
      // one Insight subtree is ever in the tree Fabric has to diff. Guarded on
      // the current value so a buffer page that never prewarmed does not
      // schedule a pointless state update on every render.
      setInsightPrewarmed((was) => (was ? false : was));
      return;
    }
    if (insightPrewarmed) return;
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

  // NOTE: the staged-timer mount of inner Insight tabs (summary 1.1s,
  // byline 1.6s, study/visuals 2.1s) was removed in favour of
  // visit-based gating below (visitedTabs Set). The timers were
  // auto-parsing markdown for tabs the user wasn't looking at,
  // blocking the JS thread for 500-700ms post-swipe — the same
  // regression the May 21 swipe-bugs commit (84e8942) had originally
  // fixed by gating the stage on activeView. The visit-based pattern
  // here matches the topics-side fix that resolved the same class of
  // hiccup on Topics.

  // Progressive Bible-section reveal. Long chapters (Psalm 119 has
  // ~22 sections) used to render every section's paragraph view on
  // first mount, blocking the JS thread for several hundred ms after
  // each chapter swipe. Two discrete bumps instead of a continuous
  // setInterval — the perpetual interval was causing a regression
  // where the Bible/Insight toggle felt hitchy (setState every 200ms
  // competed with the toggle's React work). Resets on chapter change.
  /**
   * Whether the native renderer (and therefore paragraph windowing) is active.
   *
   * Read here so the progressive-reveal staging below can stand down: windowing
   * already limits work to the visible paragraphs, and the staging's re-renders land
   * on top of the view-switch animation.
   */
  const { useNativeText: nativeTextOn } = useNativeText();

  const [bibleSectionsMax, setBibleSectionsMax] = useState(3);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on chapter change
  useEffect(() => {
    setBibleSectionsMax(3);
  }, [bookId, chapterNumber]);
  useEffect(() => {
    // The CURRENT page mounts whole and immediately — it is what the reader is looking at, and a
    // chapter that visibly fills in top-down is a worse artifact than one mount.
    //
    // A BUFFER page is offscreen, so its mount can be spread across frames, and that is where the
    // cost actually is. With the gesture pager, moving to the next chapter PROMOTES a buffer that is
    // already built and then builds a new neighbour — so the views created during a navigation mostly
    // belong to a page nobody is looking at. atrace measured 54 native view creations inside a single
    // `animation` frame during exactly that (`reports/perf/atrace/byline-ramp.txt`).
    //
    // Promotion stays safe: this effect re-runs with `isPreloading` false and sets INFINITY, so a page
    // still ramping completes in one commit, exactly as it does today. That is what the original
    // comment here was protecting — "a page left capped at 3 sections would render three and then
    // visibly jump when it became current" — and it still holds, because nothing is left capped.
    if (nativeTextOn) {
      if (!isPreloading) setBibleSectionsMax(Number.POSITIVE_INFINITY);
      return;
    }
    if (isPreloading) return;
    // Legacy path only: progressive reveal, because it has no windowing to limit the
    // work. Its two re-renders land at 200ms and 500ms, straddling the 180ms
    // view-switch animation, which is a plausible cause of the animation stutter the
    // operator reports — one more reason the native path does without it.
    const t1 = setTimeout(() => setBibleSectionsMax(20), 200);
    const t2 = setTimeout(() => setBibleSectionsMax(Number.POSITIVE_INFINITY), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isPreloading, bookId, chapterNumber, nativeTextOn]);

  /**
   * Build an offscreen buffer page's sections a few per frame.
   *
   * Paired with the effect above: that one decides *whether* a page ramps (buffers do, the current
   * page does not), this one does the stepping. Same shape and same reasoning as the byline ramp —
   * `requestAnimationFrame` so the step size is paced to real frames, and the ramp terminates at
   * `POSITIVE_INFINITY` rather than rescheduling forever.
   *
   * Known limitation, measured rather than assumed: React coalesces several rAF-driven `setState`s
   * into ONE commit whenever the JS thread is blocked, and the one-time 18MB lexicon parse blocks it
   * for ~2s. So this reduces the worst commit without guaranteeing `BIBLE_SECTIONS_PER_FRAME` views
   * per frame, and the result has to be read off a capture, not inferred from the constant.
   */
  useEffect(() => {
    if (!nativeTextOn || !isPreloading) return;
    if (!Number.isFinite(bibleSectionsMax)) return;
    const handle = requestAnimationFrame(() => {
      setBibleSectionsMax((current) => {
        const next = current + BIBLE_SECTIONS_PER_FRAME;
        return next >= BIBLE_MAX_SECTIONS ? Number.POSITIVE_INFINITY : next;
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [nativeTextOn, isPreloading, bibleSectionsMax]);

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
    // Every gesture that reaches the reader's own ScrollView. Compared against
    // pager.dragStart this localises a lost swipe: if the reader sees a gesture
    // the pager never registered as a drag, the swipe was lost to gesture
    // arbitration between the two — which is what the operator's observation
    // suggests, since the VERTICAL scroll indicator flashes at the moment of the
    // block.
    perfAdd('reader.touchStart', 1);
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

  const { data: rawChapter } = useBibleChapter(bookId, chapterNumber, bibleVersion);
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure has varying properties not captured by generated types
  const chapter = rawChapter as any;

  // Keep a reference to the last valid chapter data to prevent flickering during prop changes
  // biome-ignore lint/suspicious/noExplicitAny: Hybrid online/offline data structure
  const lastChapterRef = useRef<any>(null);
  if (chapter) {
    lastChapterRef.current = chapter;
  }
  const displayChapter = chapter || lastChapterRef.current;

  // 104 of the reader's ~186 renders were attributed to `nothing-tracked`, meaning
  // no input the reader itself watches had changed — so the trigger is this
  // parent re-rendering and handing down fresh props. Probing here rather than
  // memoising on instinct: `bibleInteraction` is included because a context value
  // object rebuilt each render re-renders every consumer regardless of whether
  // the data inside it moved, and that is indistinguishable from the outside.
  useWhyRender('render.page', {
    bibleInteraction,
    chapterHighlights,
    autoHighlights,
    displayChapter,
    activeView,
    activeTab,
    isPreloading,
    bookId,
    chapterNumber,
  });

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

  /**
   * Pre-visit the remaining Insight tabs in idle time.
   *
   * Measured over twelve tab switches: mean 59ms, but p95 321ms and max 482ms, with
   * `reader.mount.explanations` firing five times. The slow switches are exactly the ones that
   * have to MOUNT a tab; a switch to an already-mounted tab is an opacity flip driven by a
   * shared value and costs nothing.
   *
   * Which is the same reason swiping is smooth: the next chapter is already rendered before
   * the gesture starts. The operator made the point directly — if a chapter change can be
   * smooth while also loading a lexicon, a tab switch has no excuse. So the tabs get the same
   * treatment the buffer chapters got: built during idle, one at a time, so the work lands
   * between interactions instead of inside one.
   *
   * Only for the current page, and only once Insight is mounted at all — a buffer page has no
   * business building four tabs.
   */
  useEffect(() => {
    if (isPreloading) return;
    if (!insightPrewarmed && !insightMountAllowed) return;
    if (PREWARMED_TABS.every((tab) => visitedTabs.has(tab))) return;

    const next = PREWARMED_TABS.find((tab) => !visitedTabs.has(tab));
    if (!next) return;

    // One tab per idle window rather than all of them at once: each is a real subtree, and
    // mounting four in a single commit would recreate the stall this is meant to remove.
    //
    // The explicit gap is load-bearing. `runAfterInteractions` resolves immediately when no
    // interaction is in flight, and this effect re-runs on every `visitedTabs` change, so on its own
    // it chained all remaining tabs into consecutive frames — measured as a single 228-view burst
    // rather than the intended one-at-a-time. See PREWARM_TAB_GAP_MS.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handle = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        setVisitedTabs((prev) => {
          if (prev.has(next)) return prev;
          const updated = new Set(prev);
          updated.add(next);
          return updated;
        });
        perfAdd('insight.tabPrewarmed', 1);
      }, PREWARM_TAB_GAP_MS);
    });
    return () => {
      handle.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [isPreloading, insightPrewarmed, insightMountAllowed, visitedTabs]);

  // Eagerly pre-fetch the byline explanation so the first tap on the By Line tab finds the data
  // already cached (no fetch lag, no skeleton). Summary is fetched on mount because activeTab starts
  // as 'summary'; Study + Visuals are bundled (no fetch). Skipped for buffer pages to avoid prefetching
  // chapters the user may never open.
  //
  // OPENING INSIGHT SHORTENS THE WAIT. The delay used to be a flat 1500ms from chapter load, chosen to
  // let the chapter render before adding an API call to the queue — sound while the reader is on the
  // Bible view. But tapping the Insight toggle is a much stronger signal than a timer: the user is
  // about to browse tabs. Measured, a first tab visit costs `tab.switch` up to 584ms because the tap
  // beat the timer and paid the whole fetch.
  //
  // So the wait is short once Insight is open and unchanged otherwise: the chapter still gets its quiet
  // window when nobody is looking at explanations, and the tab is warm by the time a hand reaches it.
  useEffect(() => {
    if (isPreloading) return;
    const delay = activeView === 'explanations' ? 150 : 1500;
    const t = setTimeout(() => {
      setVisitedTabs((prev) => {
        if (prev.has('byline')) return prev;
        const next = new Set(prev);
        next.add('byline');
        return next;
      });
    }, delay);
    return () => clearTimeout(t);
  }, [isPreloading, bookId, chapterNumber, activeView]);

  // Fetch explanations lazily — only enable for the active tab or previously visited tabs
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useBibleSummary(bookId, chapterNumber, bibleVersion, {
    enabled:
      (!isPreloading || activeView === 'explanations') &&
      (activeTab === 'summary' || visitedTabs.has('summary')),
    language,
  });

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
  } = useBibleByLine(bookId, chapterNumber, bibleVersion, {
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
  /**
   * Latest `onScroll` prop, in a ref, read ONLY from the JS thread.
   *
   * The ref must never be touched inside the worklet. Doing that serialises the ref
   * OBJECT into the worklet, and the next render's `onScrollRef.current = onScroll`
   * then fights it:
   *
   *   [Worklets] Tried to modify key `current` of an object which has been already
   *   passed to a worklet.
   *
   * which logged on every render and left the callback path unreliable. The worklet
   * instead calls `notifyScrollTransition` — a stable function — via runOnJS, and the
   * ref is read there, on the JS thread, where mutating it is fine.
   */
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  /**
   * Stable JS-thread entry point for the scroll worklet.
   *
   * Stable identity matters: `runOnJS` captures whatever it is given, so a function
   * recreated each render would be re-serialised each render.
   */
  const notifyScrollTransition = useCallback((velocity: number, isAtBottom: boolean) => {
    onScrollRef.current?.(velocity, isAtBottom);
  }, []);

  /**
   * Push the visible Y range to JS. Called from the scroll worklet at most every
   * VISIBILITY_PUSH_INTERVAL_MS.
   *
   * Sets the ref synchronously (consumers that read it get the freshest value) and
   * the state for consumers that need to re-render. The old code set state behind a
   * per-frame debounce timer, which meant allocating and cancelling a timeout 60
   * times a second to achieve the same throttle.
   */
  const pushVisibleRange = useCallback(
    (scrollY: number, viewportHeight: number, _contentHeight: number) => {
      viewportHeightRef.current = viewportHeight;
      const range: VisibleYRange = { startY: scrollY, endY: scrollY + viewportHeight };
      visibleYRangeRef.current = range;
      currentScrollYRef.current = scrollY;
      setVisibleYRange(range);
    },
    []
  );

  /**
   * UI-thread scroll handler for the Bible view.
   *
   * ## Why this exists
   *
   * `handleScroll` below is a plain JS callback on `onScroll` with
   * `scrollEventThrottle={16}`, so it ran ~60x/second ON THE JS THREAD for the
   * whole duration of every scroll. Each call allocated a `setTimeout`, and it
   * called into `useFABVisibility`, which calls `setVisible()` — a React state
   * update, i.e. a re-render of the chapter screen, mid-scroll.
   *
   * With the JS thread already busy ~25% of a reading session, those events queue.
   * The device reported "High input latency: 4916" and a p99 frame of 42ms against
   * an 8.3ms budget, while the JS-side numbers looked fine — which is why the
   * JS-thread monitor alone was not enough to find this.
   *
   * This worklet runs on the UI thread and crosses to JS only on a state
   * TRANSITION: when the FAB should change visibility, or at most every 150ms for
   * the text-visibility range. Scrolling itself costs zero JS.
   */
  const lastScrollYSv = useSharedValue(0);
  const lastScrollTimeSv = useSharedValue(0);
  const fabVisibleSv = useSharedValue(true);
  const lastVisibilityPushSv = useSharedValue(0);

  const animatedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const y = event.contentOffset.y;
      const viewportHeight = event.layoutMeasurement.height;
      const scrollableHeight = event.contentSize.height - viewportHeight;
      // `performance.now()` is not available in a worklet; the scroll event's own
      // clock is monotonic and is what velocity should be measured against anyway.
      const now = Date.now();

      const timeDelta = now - lastScrollTimeSv.value;
      const scrollDelta = y - lastScrollYSv.value;
      const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;
      lastScrollYSv.value = y;
      lastScrollTimeSv.value = now;

      const isAtBottom = scrollableHeight - y <= BOTTOM_THRESHOLD;

      // FAB decision, made here so the common case (no change) never touches JS.
      let nextFabVisible = fabVisibleSv.value;
      if (isAtBottom) nextFabVisible = true;
      else if (velocity < -FAB_SCROLL_VELOCITY_THRESHOLD) nextFabVisible = true;
      else if (velocity > FAB_SCROLL_VELOCITY_THRESHOLD) nextFabVisible = false;

      if (nextFabVisible !== fabVisibleSv.value) {
        fabVisibleSv.value = nextFabVisible;
        // Hand over the velocity that caused the transition so the JS side's existing
        // threshold logic reaches the same conclusion.
        runOnJS(notifyScrollTransition)(velocity, isAtBottom);
      } else if (isAtBottom && !fabVisibleSv.value) {
        // Reaching the bottom must always show the FAB, even without a velocity
        // spike — a slow drag to the end would otherwise leave it hidden.
        fabVisibleSv.value = true;
        runOnJS(notifyScrollTransition)(velocity, true);
      }

      // Text-visibility range, throttled. Tokenization only needs a coarse window,
      // and pushing it every frame was the other half of the per-frame JS cost.
      if (now - lastVisibilityPushSv.value >= VISIBILITY_PUSH_INTERVAL_MS) {
        lastVisibilityPushSv.value = now;
        runOnJS(pushVisibleRange)(y, viewportHeight, event.contentSize.height);
      }
    },
  });

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
  // Dev-only. `view.switch` covers the Bible<->Insight toggle: the span opens
  // when `activeView` changes and closes once React has committed the new view,
  // so it measures the reconciliation latency the prewarm hack exists to hide.
  usePerfMountSpan('view.switch', `${bookId}:${chapterNumber}:${activeView}`, {
    to: activeView,
    book: bookId,
    chapter: chapterNumber,
    prewarmed: insightPrewarmed,
  });

  /**
   * Inner Insight tab switches, measured on their own.
   *
   * Never instrumented before, which was a real gap: the operator reports lag when switching
   * Insight tabs, where no lexicon and no chapter change are involved at all. That rules the
   * lexicon out as the sole cause and points at something shared by every switch, and nothing
   * could see it because swipes, the pill, startup and the lexicon were each measured while
   * this was not.
   */
  usePerfMountSpan('tab.switch', `${bookId}:${chapterNumber}:${activeTab}`, {
    to: activeTab,
    book: bookId,
    chapter: chapterNumber,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the tab change itself
  useEffect(() => {
    if (!tabWatchArmedRef.current) {
      tabWatchArmedRef.current = true;
      return;
    }
    if (isPreloadingRef.current) return;
    return watchFrames('anim.tabSwitch', VIEW_SWITCH_FRAME_WINDOW_MS);
  }, [activeTab]);

  const localToggleProgress = useSharedValue(activeView === 'bible' ? 0 : 1);

  /**
   * Dev-only. Record frame cadence across the view-switch animation.
   *
   * The switch itself is instant but the animation is reported as stuttering, and
   * neither existing instrument can see that: the JS heartbeat watches the wrong
   * thread, and gfxinfo averages a 300ms animation into a 60-second session. This
   * scopes a frame recording to exactly this interaction.
   *
   * Window is deliberately longer than the 180ms animation, so a stall that lands
   * just after it still shows up.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the view change itself
  useEffect(() => {
    // Skip the mount run, and skip buffer pages. An effect keyed on [activeView]
    // also fires on mount, and three ChapterPages mount per chapter change — so
    // this was recording 21 windows in a session with no view switches at all,
    // reporting chapter-change cost as pill-animation jank. The operator asked
    // specifically about the pill; the metric has to answer that question and not
    // a different one.
    if (!viewSwitchWatchArmedRef.current) {
      viewSwitchWatchArmedRef.current = true;
      return;
    }
    // Read through a ref rather than a dependency: `isPreloading` flips on every
    // chapter change, so listing it re-ran this effect 23 times in a session with
    // no view switches at all — the exact pollution the mount guard above was
    // meant to remove.
    if (isPreloadingRef.current) return;
    return watchFrames('anim.viewSwitch', VIEW_SWITCH_FRAME_WINDOW_MS);
  }, [activeView]);

  useEffect(() => {
    if (toggleProgress) return;
    localToggleProgress.value = withTiming(activeView === 'bible' ? 0 : 1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeView, localToggleProgress, toggleProgress]);
  const effectiveProgress = toggleProgress ?? localToggleProgress;
  /**
   * Visibility is opacity ONLY — deliberately no animated `zIndex`.
   *
   * `zIndex` was animated alongside opacity on both containers and all four tabs. Opacity is a cheap
   * per-view property, but changing `zIndex` REORDERS the parent's children, which is a structural
   * mutation: Fabric emits it as mount operations applied in the Choreographer callback — the
   * `animation` phase that `framestats` shows dominating every slow frame on this screen. It fired on
   * every view switch and every tab switch, for every pane, to reorder views that are invisible
   * anyway.
   *
   * Static declaration order is sufficient because an inactive pane is already `opacity: 0` and
   * `pointerEvents: 'none'`: draw order only matters between things you can see, and only one pane is
   * ever visible. Insight is declared after Bible, so it naturally composites on top when shown.
   */
  const insightContainerStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: effectiveProgress.value };
  });
  const bibleContainerStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: 1 - effectiveProgress.value };
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
    return { opacity: match ? 1 : 0 };
  });
  const bylineTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'byline';
    return { opacity: match ? 1 : 0 };
  });
  const studyTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'study';
    return { opacity: match ? 1 : 0 };
  });
  const visualsTabStyle = useAnimatedStyle(() => {
    'worklet';
    const match = effectiveTabProgress.value === 'visuals';
    return { opacity: match ? 1 : 0 };
  });

  return (
    <View style={styles.container} collapsable={false}>
      {/* Explanations View — mount when:
           1. User is on Insight view (handles deep links + buffer
              pages so swipes-while-on-Insight have content ready), OR
           2. We've pre-warmed it after chapter settle (insightPrewarmed),
              so the Bible -> Insight toggle is an instant style flip. */}
      {(insightPrewarmed || insightMountAllowed) && (
        <Animated.View
          style={[styles.container, styles.absoluteFill, insightContainerStyle]}
          collapsable={false}
          pointerEvents={activeView === 'explanations' ? 'auto' : 'none'}
        >
          {/* Inner tabs use visit-based lazy mount: only mount tabs the
              user has actually visited. Initial visited = active tab.
              First tap to another tab triggers its mount. Sticky-once-
              visited; resets per chapter. Pairs with the eager-prefetch
              of byline below so the most common second-tab visit
              already has its data cached. */}
          {visitedTabs.has('summary') && (
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
                bibleVersion={bibleVersion}
                bibleLanguage={bibleLanguage}
              />
            </Animated.View>
          )}

          {visitedTabs.has('byline') && (
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
                bibleVersion={bibleVersion}
                bibleLanguage={bibleLanguage}
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
          {visitedTabs.has('study') && (
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
          )}

          {/* Visuals tab — bundled @versemate/visuals. Only rendered for
              books in BOOKS_WITH_VISUALS AND visited by the user. */}
          {visitedTabs.has('visuals') && displayChapter && bookHasVisuals(displayChapter.bookId) ? (
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
        onScroll={animatedScrollHandler}
        // 1 rather than 16: a Reanimated handler runs on the UI thread, so there is
        // no reason to throttle it — throttling only ever existed to reduce JS
        // bridge traffic, and there is none now.
        scrollEventThrottle={1}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        pointerEvents={activeView === 'bible' ? 'auto' : 'none'}
      >
        <TextVisibilityContext.Provider value={textVisibilityContextValue}>
          <View style={styles.readerContainer} collapsable={false}>
            {/* Buffer chapters render REAL CONTENT on the native path.
                 `isPreloading` is true for the pager's prev/next pages, and gating
                 them to a SkeletonLoader is why swiping never felt instant: the
                 pager slides to a skeleton, and only after onPageSelected -> JS ->
                 navigation -> re-render does the chapter actually mount, compile,
                 measure and create its views. That work is also why swipe cost
                 tracked chapter length.
                 MyBible's pager has the adjacent chapter already rendered, so its
                 swipe is pure native motion with nothing to build — measured at 0
                 missed vsyncs and a 9ms p99 on this same phone.
                 The gate existed because mounting a full chapter cost 500-700ms
                 (May 2026). Windowing removes that reason: a buffer chapter renders
                 only its top screenful, since its own visibleYRange is null at
                 scroll 0 and windowing falls back to the window height. */}
            {displayChapter && (!isPreloading || (nativeTextOn && bufferContentReady)) ? (
              <ChapterReader
                chapter={displayChapter}
                activeTab={activeTab}
                explanationsOnly={false}
                hideChapterTitle={hideChapterTitle}
                onContentLayout={handleContentLayout}
                onOpenNotes={handleOpenNotes}
                filteredHighlights={chapterHighlights}
                filteredAutoHighlights={autoHighlights}
                maxBibleSections={bibleSectionsMax}
                bibleVersion={bibleVersion}
                bibleLanguage={bibleLanguage}
              />
            ) : (
              // Buffer pages render this skeleton; the active page shows
              // it briefly while chapter data loads. Removing the
              // `!isPreloading` gate (tried in 2415153) caused regressions
              // — putting it back. Distinct testID from chapter-screen-
              // level skeleton so integration tests waiting for testID=
              // "skeleton-loader" to disappear don't trip on the 2 buffer
              // placeholders that are always visible in the 3-page pager.
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
