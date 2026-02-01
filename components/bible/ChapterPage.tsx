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
 * - Shows SkeletonLoader while loading (query-state-based, no artificial delays)
 * - Renders ChapterReader when loaded
 * - Contains ScrollView for vertical scrolling
 * - Props update when window shifts (key stays stable)
 * - Manages Notes Modals to prevent ScrollView interaction issues
 *
 * Performance Note:
 * - Previously used staggered setTimeout delays (600ms, 1100ms, 1600ms, 2100ms)
 * - Now uses query-state-based rendering for faster initial render
 * - React Compiler handles performance optimization; artificial delays removed
 *
 * @see Spec: agent-os/specs/2025-10-23-native-page-swipe-navigation/spec.md (lines 121-143)
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md (Task Group 5)
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedRef } from 'react-native-reanimated';
import { DeleteConfirmationModal } from '@/components/bible/DeleteConfirmationModal';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { NoteOptionsModal } from '@/components/bible/NoteOptionsModal';
import { NotesModal } from '@/components/bible/NotesModal';
import { NoteViewModal } from '@/components/bible/NoteViewModal';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import { animations, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { TextVisibilityContext, type VisibleYRange } from '@/contexts/TextVisibilityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { BOTTOM_THRESHOLD } from '@/hooks/bible/use-fab-visibility';
import type { Highlight } from '@/hooks/bible/use-highlights';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { useNotes } from '@/hooks/bible/use-notes';
import { useBibleByLine, useBibleChapter, useBibleDetailed, useBibleSummary } from '@/src/api';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import type { Note } from '@/types/notes';
import { groupConsecutiveHighlights } from '@/utils/bible/groupConsecutiveHighlights';
import { BottomLogo } from './BottomLogo';
import { ChapterReader } from './ChapterReader';
import { SkeletonLoader } from './SkeletonLoader';

// Styles for the overall ChapterPage component
const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      // Add bottom padding to account for floating action buttons AND progress bar
      paddingBottom: 60, // FAB height + bottom offset + progress bar + extra spacing
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
 *
 * Pre-rendering behavior:
 * - When data is available, tabs are always pre-rendered (hidden via absolute positioning)
 * - This eliminates freeze when switching between tabs
 * - Uses query loading states to determine when to show skeleton vs content
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
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors); // Use local createStyles for TabContent

  const isHidden = !visible;
  if (isHidden && !shouldRenderHidden) return null;

  // Determine content for the reader
  const explanationContent = content && 'content' in content ? content : undefined;
  const hasContent = explanationContent && explanationContent.content.trim().length > 0;

  // Only show skeleton on initial load, not when transitioning between chapters
  // This prevents flicker when swiping between chapters
  const showSkeleton = isLoading && !chapter && !explanationContent;

  // Keep all tabs mounted for pre-rendering (eliminates freeze on switch)
  // Use absolute positioning + pointerEvents to hide inactive tabs
  return (
    <ScrollView
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
    >
      {error ? (
        <Animated.View
          entering={FadeIn.duration(animations.tabSwitch.duration)}
          exiting={FadeOut.duration(animations.tabSwitch.duration)}
          style={styles.errorContainer}
        >
          <Text style={styles.errorText}>Failed to load {activeTab} explanation.</Text>
        </Animated.View>
      ) : showSkeleton ? (
        // Only show skeleton on initial load when no content exists yet
        <SkeletonLoader />
      ) : !hasContent ? (
        <Animated.View
          entering={FadeIn.duration(animations.tabSwitch.duration)}
          exiting={FadeOut.duration(animations.tabSwitch.duration)}
          style={styles.errorContainer}
        >
          <Text style={styles.errorText}>
            No {activeTab} explanation available for this chapter yet.
          </Text>
        </Animated.View>
      ) : (
        <View>
          {chapter && (
            <ChapterReader
              chapter={chapter}
              activeTab={activeTab}
              explanationsOnly={true}
              explanation={explanationContent}
              filteredHighlights={filteredHighlights}
              filteredAutoHighlights={filteredAutoHighlights}
            />
          )}
        </View>
      )}
      <BottomLogo />
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
 * Query-State-Based Rendering (Task Group 5):
 * - Removed artificial setTimeout delays (600ms, 1100ms, 1600ms, 2100ms)
 * - Now uses query loading states to determine when to render content
 * - Tabs are pre-rendered when data is available (eliminates freeze on switch)
 * - React Compiler handles performance; artificial delays cause sluggishness
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
  shouldResetScroll = true,
  isPreloading = false,
  targetVerse,
  targetEndVerse,
  onScroll,
  onTap,
}: ChapterPageProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors); // Use local createStyles for ChapterPage

  // Use Reanimated ref for the animated ScrollView
  const animatedScrollRef = useAnimatedRef<Animated.ScrollView>();

  const sectionPositionsRef = useRef<Record<number, number>>({});

  // Track if we have scrolled to target verse
  const hasScrolledRef = useRef(false);
  // Track current scroll position manually for distance calc (JS side)
  const currentScrollYRef = useRef(0);

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

  const { isAuthenticated, user } = useAuth();

  // Get current language from user preferences (default to 'en-US')
  // This ensures the query key changes when language changes
  const language = typeof user?.preferred_language === 'string' ? user.preferred_language : 'en-US';
  // Text visibility tracking for hybrid tokenization
  // Use state with debouncing to avoid re-renders on every scroll frame
  const [visibleYRange, setVisibleYRange] = useState<VisibleYRange | null>(null);
  const visibleYRangeRef = useRef<VisibleYRange | null>(null);
  const visibilityUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportHeightRef = useRef<number>(0);

  // Fetch highlights directly for THIS specific chapter
  // This ensures each page has its own highlights pre-loaded independently
  const { chapterHighlights } = useHighlights({
    bookId,
    chapterNumber,
  });

  const { autoHighlights } = useAutoHighlights({
    bookId,
    chapterNumber,
  });

  const { deleteNote, isDeletingNote } = useNotes();

  // Reset scroll state when book/chapter changes (not on view change)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref reset should react to chapter change
  useEffect(() => {
    hasScrolledRef.current = false;
    sectionPositionsRef.current = {};
    currentScrollYRef.current = 0;

    // Reset scroll position to top when chapter changes
    // This prevents "height teleportation" from previous chapter
    // ONLY if shouldResetScroll is true (skipped during seamless pager snaps)
    if (shouldResetScroll) {
      animatedScrollRef.current?.scrollTo({ y: 0, animated: false });
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

  // Mark as scrolled when user switches to explanations view
  // This prevents animation from restarting when returning to Bible
  useEffect(() => {
    if (activeView !== 'bible') {
      hasScrolledRef.current = true;
    }
  }, [activeView]);

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

  // Fetch explanations for each tab
  // All three are ALWAYS enabled and load in parallel to ensure instant tab switching
  // This eliminates the freeze when switching between summary/byline/detailed tabs
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useBibleSummary(bookId, chapterNumber, undefined, { enabled: true, language });

  const {
    data: byLineData,
    isLoading: isByLineLoading,
    error: byLineError,
  } = useBibleByLine(bookId, chapterNumber, undefined, { enabled: true, language });

  const {
    data: detailedData,
    isLoading: isDetailedLoading,
    error: detailedError,
  } = useBibleDetailed(bookId, chapterNumber, undefined, { enabled: true, language });

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

  // Determine if explanation data is available for pre-rendering tabs
  // When data is available, allow pre-rendering of hidden tabs to eliminate freeze on switch
  // When isPreloading is true (pages far from current view), skip heavy content entirely
  const hasSummaryData = summaryData !== null && summaryData !== undefined;
  const hasByLineData = byLineData !== null && byLineData !== undefined;
  const hasDetailedData = detailedData !== null && detailedData !== undefined;

  return (
    <View style={styles.container} collapsable={false}>
      {/* Explanations View - Render if active OR if data is available for pre-rendering (and NOT preloading) */}
      {!isPreloading &&
        (activeView === 'explanations' || hasSummaryData || hasByLineData || hasDetailedData) && (
          <View
            style={[
              styles.container,
              activeView !== 'explanations' && {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0,
                zIndex: -1,
              },
            ]}
            collapsable={false}
            pointerEvents={activeView === 'explanations' ? 'auto' : 'none'}
          >
            <TabContent
              chapter={displayChapter}
              activeTab="summary"
              content={summaryData}
              isLoading={isSummaryLoading}
              error={summaryError}
              visible={activeTab === 'summary'}
              shouldRenderHidden={hasSummaryData}
              testID={`chapter-page-scroll-${bookId}-${chapterNumber}-summary`}
              onScroll={handleScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              filteredHighlights={chapterHighlights}
              filteredAutoHighlights={autoHighlights}
            />
            <TabContent
              chapter={displayChapter}
              activeTab="byline"
              content={byLineData}
              isLoading={isByLineLoading}
              error={byLineError}
              visible={activeTab === 'byline'}
              shouldRenderHidden={hasByLineData}
              testID={`chapter-page-scroll-${bookId}-${chapterNumber}-byline`}
              onScroll={handleScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              filteredHighlights={chapterHighlights}
              filteredAutoHighlights={autoHighlights}
            />
            <TabContent
              chapter={displayChapter}
              activeTab="detailed"
              content={detailedData}
              isLoading={isDetailedLoading}
              error={detailedError}
              visible={activeTab === 'detailed'}
              shouldRenderHidden={hasDetailedData}
              testID={`chapter-page-scroll-${bookId}-${chapterNumber}-detailed`}
              onScroll={handleScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              filteredHighlights={chapterHighlights}
              filteredAutoHighlights={autoHighlights}
            />
          </View>
        )}

      {/* Bible reading view (no explanations) - Always rendered but hidden if inactive */}
      <Animated.ScrollView
        ref={animatedScrollRef}
        style={[
          styles.container,
          activeView !== 'bible' && {
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
            {displayChapter ? (
              <ChapterReader
                chapter={displayChapter}
                activeTab={activeTab}
                explanationsOnly={false}
                onContentLayout={handleContentLayout}
                onOpenNotes={handleOpenNotes}
                filteredHighlights={chapterHighlights}
                filteredAutoHighlights={autoHighlights}
              />
            ) : (
              <SkeletonLoader />
            )}
          </View>
        </TextVisibilityContext.Provider>
        <BottomLogo />
      </Animated.ScrollView>

      {/* Note Modals - Rendered OUTSIDE ScrollView */}
      <NotesModal
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
