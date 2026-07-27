/**
 * ChapterReader Component
 *
 * Renders Bible chapter content with sections, subtitles, verses, and explanations.
 * Supports three reading modes via activeTab prop: summary, byline, detailed.
 *
 * Features:
 * - Chapter title (displayMedium: 32px, bold) with bookmark, notes, and share buttons on the right
 * - Section subtitles (heading2: 20px, semibold)
 * - Verse range captions (caption: 12px, gray500)
 * - Bible text with superscript verse numbers
 * - Markdown rendering for explanation content
 * - Text highlighting with character-level precision
 * - Notes management via modals
 * - Share functionality for chapter links
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 * @see Task Group 5: Chapter View Highlight Integration
 * @see Task Group 6: Screen Integration - NotesButton and Modals
 * @see Task Group 3: Share Button and UI Integration
 */

import type { AlignedToken, LexEntry } from '@versemate/lexicon';
import { getRedLetterVerses } from '@versemate/red-letter';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { LexiconPopover } from '@/components/bible/LexiconPopover';
import { NotesButton } from '@/components/bible/NotesButton';
import { ShareButton } from '@/components/bible/ShareButton';
import type { HighlightColor } from '@/constants/highlight-colors';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useBibleInteraction } from '@/contexts/BibleInteractionContext';
import { isElementVisible, useTextVisibility } from '@/contexts/TextVisibilityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/hooks/bible/use-font-size';
import type { Highlight } from '@/hooks/bible/use-highlights';
import { useLexiconUnderlines } from '@/hooks/bible/use-lexicon-underlines';
import { useNativeText } from '@/hooks/bible/use-native-text';
import { useRedLetterEnabled } from '@/hooks/bible/use-red-letter-enabled';
import { isEnglishVersion, useChapterAlignment } from '@/hooks/use-chapter-alignment';
import { usePerfMountSpan } from '@/lib/perf';
import { ParagraphText } from '@/lib/text/ParagraphText';
import type { CompileTheme } from '@/lib/text/types';
import { isParagraphVisible, useParagraphLayout } from '@/lib/text/use-paragraph-layout';
import type { TextLineLayout } from '@/modules/versemate-text';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  lineHeights,
  spacing,
} from '@/theme/tokens';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import {
  findGroupByHighlightId,
  groupConsecutiveHighlights,
} from '@/utils/bible/groupConsecutiveHighlights';
import { parseByLineSections } from '@/utils/bible/parseByLineExplanation';

// TODO: This will be replaced by a user setting
const PARAGRAPH_VIEW_ENABLED = true;

/**
 * Lexicon underline appearance, shared with the legacy renderer's constants in
 * HighlightedText. Fractional thickness is meaningful here because the native
 * path DRAWS the line rather than asking for a system underline.
 */
/**
 * How far beyond the viewport a paragraph group still renders for real, in px.
 *
 * About one screen. Generous on purpose: an exact-height placeholder makes being
 * early almost free, whereas being late means the user scrolls into blank space.
 */
const GROUP_WINDOW_BUFFER_PX = 600;

const LEX_UNDERLINE_COLOR = 'rgba(176,154,109,0.55)';
const LEX_UNDERLINE_THEME_COLOR = 'rgba(199,176,116,0.75)';
const LEX_UNDERLINE_THICKNESS = 1;

/** Tap/selection wash, matching HighlightedText's selectionStyles. */
const SELECTION_COLOR = '#3390FF40';

/**
 * Convert a number to Unicode superscript characters
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

/**
 * Check if a verse text starts with a Biblical transition word
 */
function startsWithTransitionWord(text: string): boolean {
  const transitions = [
    'Then',
    'After',
    'Meanwhile',
    'Now',
    'When',
    'While',
    'But',
    'Yet',
    'However',
    'Nevertheless',
    'Therefore',
    'Thus',
    'So',
    'Accordingly',
    'Moreover',
    'Furthermore',
    'Also',
    'And',
  ];

  const firstWord = text.trim().split(/\s+/)[0];
  const cleanWord = firstWord.replace(/[.,;:!?"']/g, '');
  return transitions.includes(cleanWord);
}

/**
 * Calculate intelligent paragraph break points for a section
 */
function calculateBreakPoints(verses: { verseNumber: number; text: string }[]): number[] {
  const breakAfter: number[] = [];

  if (verses.length <= 3) return [];

  let versesSinceLastBreak = 0;

  for (let i = 0; i < verses.length - 1; i++) {
    const currentVerse = verses[i];
    const nextVerse = verses[i + 1];
    versesSinceLastBreak++;

    if (versesSinceLastBreak >= 5) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
      continue;
    }

    const endsWithPeriod = currentVerse.text.trim().endsWith('.');
    const nextStartsWithTransition = startsWithTransitionWord(nextVerse.text);

    if (endsWithPeriod && nextStartsWithTransition && versesSinceLastBreak >= 2) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
    }
  }

  return breakAfter;
}

/**
 * Stable key for a section, used to look up its memoised paragraph groups.
 *
 * Matches the Fragment key in the render path so the two cannot drift apart.
 */
function sectionKeyOf(section: { startVerse?: number; subtitle?: string | null }): string {
  // `startVerse` is optional on ChapterSection, and the render path's Fragment key
  // interpolates it the same way — so an undefined must stringify identically here
  // or the memo lookup misses and every paragraph recompiles.
  return `section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`;
}

interface ChapterReaderProps {
  /** Chapter content with verses and sections */
  chapter: ChapterContent;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Optional explanation content (summary/byline/detailed) */
  explanation?: ExplanationContent;
  /** Show only explanations, hide Bible verses (for Explanations view) */
  explanationsOnly?: boolean;
  /** Hide the chapter title text (used when parent already shows a header) */
  hideChapterTitle?: boolean;
  /** Callback to report Y-position of verse sections for scrolling */
  onContentLayout?: (sectionPositions: Record<number, number>) => void;
  /**
   * Register the rendered React Native View for a verse section in the By Line
   * explanation tab. The parent uses `measureLayout` against its ScrollView ref
   * to compute the absolute scroll offset for that verse.
   *
   * Receives `null` for verse sections that no longer exist (cleanup).
   */
  onByLineSectionRegister?: (verseNumber: number, node: View | null) => void;
  /** Callback to open notes modal */
  onOpenNotes?: () => void;
  /** Optional filtered highlights (overrides context highlights) */
  filteredHighlights?: Highlight[];
  /** Optional filtered auto-highlights (overrides context auto-highlights) */
  filteredAutoHighlights?: AutoHighlight[];
  /**
   * Progressive-load limit for byline verse sections. When set, only the
   * first N parsed verse sections render. Parent can ramp this up over
   * time (e.g. via setInterval) so the first paint is fast for long
   * chapters (Psalm 119 = 176 verses) and the rest of the sections
   * mount in the background. Undefined = render all sections (default
   * behavior).
   */
  maxBylineSections?: number;
  /**
   * Same idea but for the Bible-view section list (chapter.sections).
   * Long chapters like Psalm 119 have ~22 sections of 8 verses each;
   * paragraph-mode rendering of all of them at once is heavy on first
   * paint. Parent ramps this up after initial mount so the first
   * couple sections render immediately and the rest stream in.
   */
  maxBibleSections?: number;
  /**
   * Bible version the chapter was fetched for. Drives the lexicon source:
   * English versions (NASB1995/KJV) use the bundled `@versemate/lexicon`
   * package; non-English versions fetch Strong's tokens from the chapter
   * endpoint (`?tagged=1`) and resolve lemma cards via `/lemma` on tap.
   * Optional — falls back to English when omitted (backward-compatible).
   */
  bibleVersion?: string;
  /**
   * Per-version language code (e.g. `es`, `de`) for the `/lemma?lang=`
   * fetch on tap. Matches `bible_versions.language_code`; the picker on
   * mobile stores this in `constants/bible-versions.ts`. Ignored for
   * English (the bundled lexicon supplies the popover content).
   */
  bibleLanguage?: string;
}

/**
 * Check if the end of a verse is highlighted
 */
function getEndHighlight(
  verseNumber: number,
  textLength: number,
  highlights: Highlight[],
  autoHighlights: AutoHighlight[]
): { color: string; isAuto: boolean } | null {
  // Check user highlights
  const highlight = highlights.find((h) => {
    // Highlight strictly after this verse -> irrelevant
    if (h.start_verse > verseNumber) return false;
    // Highlight strictly before this verse -> irrelevant
    if (h.end_verse < verseNumber) return false;

    // If highlight ends after this verse, it definitely covers the end
    if (h.end_verse > verseNumber) return true;

    // If highlight ends on this verse, check char
    // Assuming null end_char means end of verse
    const endChar = (h.end_char as number | null) ?? textLength;
    return endChar >= textLength;
  });

  if (highlight) {
    return { color: highlight.color, isAuto: false };
  }

  // Check auto-highlights
  const autoHighlight = autoHighlights.find((h) => {
    // Auto-highlights are always full verse ranges
    return h.start_verse <= verseNumber && h.end_verse >= verseNumber;
  });

  if (autoHighlight) {
    return { color: autoHighlight.theme_color, isAuto: true };
  }

  return null;
}

/**
 * Check if the start of a verse is highlighted
 */
function getStartHighlight(
  verseNumber: number,
  highlights: Highlight[],
  autoHighlights: AutoHighlight[]
): { color: string; isAuto: boolean } | null {
  // Check user highlights
  const highlight = highlights.find((h) => {
    // Highlight strictly after this verse -> irrelevant
    if (h.start_verse > verseNumber) return false;
    // Highlight strictly before this verse -> irrelevant
    if (h.end_verse < verseNumber) return false;

    // If highlight starts before this verse, it definitely covers the start
    if (h.start_verse < verseNumber) return true;

    // If highlight starts on this verse, check char
    const startChar = (h.start_char as number | null) ?? 0;
    return startChar === 0;
  });

  if (highlight) {
    return { color: highlight.color, isAuto: false };
  }

  // Check auto-highlights
  const autoHighlight = autoHighlights.find((h) => {
    return h.start_verse <= verseNumber && h.end_verse >= verseNumber;
  });

  if (autoHighlight) {
    return { color: autoHighlight.theme_color, isAuto: true };
  }

  return null;
}

export function ChapterReader({
  chapter,
  activeTab,
  explanation,
  explanationsOnly = false,
  hideChapterTitle = false,
  onContentLayout,
  onByLineSectionRegister,
  onOpenNotes,
  filteredHighlights,
  filteredAutoHighlights,
  maxBylineSections,
  maxBibleSections,
  bibleVersion,
  bibleLanguage,
}: ChapterReaderProps) {
  const { colors, mode } = useTheme();
  const specs = getHeaderSpecs(mode);
  const { fontSize: userFontSize } = useFontSize();
  const styles = createStyles(colors, explanationsOnly, userFontSize);

  // Dev-only. This is the mount whose cost the whole native-text project exists
  // to remove — instrumented so the before/after is measured, not asserted.
  usePerfMountSpan(
    explanationsOnly ? 'reader.mount.explanations' : 'reader.mount.bible',
    `${chapter.bookId}:${chapter.chapterNumber}:${explanationsOnly}`,
    {
      book: chapter.bookId,
      chapter: chapter.chapterNumber,
      sections: chapter.sections?.length ?? 0,
      verses: chapter.sections?.reduce((n, s) => n + s.verses.length, 0) ?? 0,
    }
  );

  // Red-letter (words of Jesus): render whole verses Jesus speaks in red when
  // the "Jesus's Words" toggle is on. Local, translation-independent dataset
  // (@versemate/red-letter) — no API, works offline / for guests. Mirrors
  // verse-mate-web's `.red-letter` class; the color cascades into the verse's
  // lexicon/highlight child spans (they set no text color of their own).
  const { isEnabled: redLetterEnabled } = useRedLetterEnabled();
  const redLetterVerses = useMemo(
    () =>
      new Set<number>(
        redLetterEnabled ? getRedLetterVerses(chapter.bookId, chapter.chapterNumber) : []
      ),
    [redLetterEnabled, chapter.bookId, chapter.chapterNumber]
  );
  const redLetterStyle = useMemo(
    () => ({ color: mode === 'dark' ? '#ff6b6b' : '#c1121f' }),
    [mode]
  );
  const markdownStyles = useMemo(
    () => createMarkdownStyles(colors, userFontSize),
    [colors, userFontSize]
  );

  // Use Bible Interaction Context for highlights and interactions
  const {
    chapterHighlights: contextHighlights,
    autoHighlights: contextAutoHighlights,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightEditMenu,
  } = useBibleInteraction();

  // Use filtered highlights if provided, otherwise use context highlights
  const chapterHighlights = filteredHighlights ?? contextHighlights;
  const autoHighlights = filteredAutoHighlights ?? contextAutoHighlights;

  // Text visibility context for hybrid tokenization
  const { visibleYRange } = useTextVisibility();

  // Store verse layouts: map startVerse -> { y, height }
  const sectionPositions = useRef<Record<number, number>>({});
  const sectionLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, []);

  // Error modal state (still local for generic errors)
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, _setErrorMessage] = useState('An error occurred. Please try again.');

  // Group consecutive manual highlights
  const highlightGroups = useMemo(() => {
    return groupConsecutiveHighlights(chapterHighlights);
  }, [chapterHighlights]);

  // Chapter alignment: English (NASB1995/KJV) uses the bundled
  // `@versemate/lexicon` package's `loadAlignmentFor`; non-English versions
  // fetch the chapter with `?tagged=1` and adapt API tokens to the same
  // `ChapterAlignment` shape. Both paths return null when no alignment is
  // available (English: no curated alignment for that chapter; non-English:
  // offline or fetch failed), and the rest of this component already
  // handles the null case — no dotted underlines, tap falls through to
  // the regular verse-insight handler. Long-press still goes to native
  // text selection in this screen.
  const alignment = useChapterAlignment(chapter.bookId, chapter.chapterNumber, bibleVersion);

  // True when the popover should fetch the real lemma card from `/lemma`
  // instead of relying on the bundled `LexEntry`. Computed once per render
  // — same for every tap in this chapter — so the popover doesn't recompute
  // on every keystroke.
  const lemmaApiLang = !isEnglishVersion(bibleVersion) && bibleLanguage ? bibleLanguage : undefined;

  const [lexiconActive, setLexiconActive] = useState<{
    surface: string;
    entry: LexEntry;
    token: AlignedToken;
    isTheme: boolean;
  } | null>(null);

  // Line layout information for paragraph groups (for accurate tap detection)
  const paragraphLineLayoutsRef = useRef<
    Map<
      string,
      {
        text: string;
        y: number;
        height: number;
        width: number;
        startCharOffset: number;
      }[]
    >
  >(new Map());

  // --- Native text renderer -------------------------------------------------
  // Runtime-switched so ONE build serves both arms of the Phase 4 A/B; see
  // hooks/bible/use-native-text.ts.
  const { useNativeText: useNativeTextRenderer } = useNativeText();
  const { showUnderlines: showLexUnderlines } = useLexiconUnderlines();

  /**
   * Width a paragraph will be laid out at, in dp.
   *
   * MEASURED, not derived from the window. The reader's insets come from a chain
   * of ancestors (ChapterPage's reader container, the ScrollView's content
   * container, section padding), and deriving the width from
   * `useWindowDimensions()` minus an assumed padding is how text ends up measured
   * at one width and drawn at another — which clips it. A wrong assumption here
   * is invisible in code review and obvious only on a device, so it is not worth
   * making.
   *
   * The cost is that the width is unknown for exactly one frame. While it is,
   * `useNativeTextRenderer && paragraphWidth > 0` is false and the legacy path
   * renders, so nothing flashes empty. The reader stays mounted across chapter
   * swipes, so only the very first chapter of a session pays that frame; after
   * that the width is already known and changes only on rotation.
   */
  // Window height, used as the mount-time viewport for paragraph windowing before
  // the first scroll event exists.
  const { height: windowHeight } = useWindowDimensions();

  const [paragraphWidth, setParagraphWidth] = useState(0);
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    // Round to whole dp: a fractional width churns the native measurement cache
    // (its key includes the width) without changing a single line break.
    const rounded = Math.round(next);
    if (rounded > 0 && rounded !== paragraphWidth) setParagraphWidth(rounded);
  };

  /** Colors the compiler cannot derive, resolved from the active theme. */
  const nativeTextTheme = useMemo<CompileTheme>(
    () => ({
      mode,
      lexUnderlineColor: LEX_UNDERLINE_COLOR,
      lexUnderlineThemeColor: LEX_UNDERLINE_THEME_COLOR,
      lexUnderlineThickness: LEX_UNDERLINE_THICKNESS,
      // Real dots at last — this is the decoration RN cannot express on Android
      // (textDecorationStyle is a no-op there), and the reason the module exists.
      lexUnderlineStyle: 'dotted',
      redLetterColor: redLetterStyle.color,
      selectionColor: SELECTION_COLOR,
    }),
    [mode, redLetterStyle.color]
  );

  /**
   * Paragraph groups per section, memoised on the chapter.
   *
   * These were computed inside an IIFE in the render body, so every `group` array
   * was a fresh reference on every render — which invalidated `ParagraphText`'s
   * compile memo every time. A capture showed `paragraph.compile` running 1250
   * times in a window with 8 chapter mounts, against ~35 groups per mount: a ~4.5x
   * waste, and worse, ~4.5x the React work to reconcile it.
   *
   * `calculateBreakPoints` depends only on the verses, so the grouping is stable
   * for a given chapter and belongs in a memo keyed on it.
   */
  const sectionGroups = useMemo(() => {
    const bySection = new Map<string, ChapterContent['sections'][number]['verses'][]>();
    for (const section of chapter.sections ?? []) {
      const breakPoints = new Set(calculateBreakPoints(section.verses));
      const groups: (typeof section.verses)[] = [];
      let current: typeof section.verses = [];
      section.verses.forEach((verse, index) => {
        current.push(verse);
        if (breakPoints.has(verse.verseNumber) || index === section.verses.length - 1) {
          groups.push(current);
          current = [];
        }
      });
      bySection.set(sectionKeyOf(section), groups);
    }
    return bySection;
  }, [chapter.sections]);

  /**
   * Every paragraph group across every section, flattened, with a stable flat index.
   *
   * Flattened because `useParagraphLayout` is a hook and cannot be called inside a
   * `.map()` over sections — and because offsets have to accumulate across section
   * boundaries to be meaningful.
   */
  const flatGroups = useMemo(() => {
    const out: { key: string; verses: ChapterContent['sections'][number]['verses'] }[] = [];
    for (const section of chapter.sections ?? []) {
      for (const group of sectionGroups.get(sectionKeyOf(section)) ?? []) {
        out.push({ key: `${sectionKeyOf(section)}:${group[0]?.verseNumber}`, verses: group });
      }
    }
    return out;
  }, [chapter.sections, sectionGroups]);

  const flatIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    flatGroups.forEach((g, i) => {
      map.set(g.key, i);
    });
    return map;
  }, [flatGroups]);

  /** Compile inputs shared by every group. Memoised so the layout hook is stable. */
  const paragraphShared = useMemo(
    () => ({
      highlights: chapterHighlights,
      autoHighlights,
      alignment,
      redLetterVerses,
      showLexUnderlines,
      theme: nativeTextTheme,
    }),
    [
      chapterHighlights,
      autoHighlights,
      alignment,
      redLetterVerses,
      showLexUnderlines,
      nativeTextTheme,
    ]
  );

  /**
   * Heights and offsets for every group, known during the FIRST render.
   *
   * Only computed on the native path — it is what makes windowing possible at mount
   * rather than only on later scrolls.
   */
  const paragraphLayouts = useParagraphLayout({
    groups: useNativeTextRenderer ? flatGroups.map((g) => g.verses) : [],
    width: paragraphWidth,
    style: styles.verseTextParagraph as TextStyle,
    gap: spacing.md,
    shared: paragraphShared,
  });

  /**
   * Whether a paragraph group is near enough the viewport to render for real.
   *
   * Uses PRE-LAYOUT offsets, so it works on the first mount. The layout-based
   * version this replaces could not: on first mount nothing has a recorded position,
   * so every group looked "unknown" and rendered anyway — measured as changing
   * nothing (compile still n=349, mount still 761ms).
   *
   * Offsets are relative to the first group, and the chapter title and section
   * headers sit above it by some unknown amount H. Not knowing H is fine because
   * H >= 0 always pushes paragraphs FURTHER from the top: comparing against a base
   * of 0 therefore over-estimates what is visible, never under-estimates it. Once a
   * position has been recorded the real base is used and the window tightens.
   */
  const isGroupVisible = (flatIndex: number): boolean => {
    if (!useNativeTextRenderer) return true;
    const layout = paragraphLayouts[flatIndex];
    if (!layout) return true;
    // Before the first scroll `visibleYRange` is null — it is populated by the
    // scroll worklet, which by definition has not run yet at mount. Falling back to
    // "render everything" there is what made the previous two attempts at windowing
    // measure as no-ops: they both opted out at exactly the moment that matters.
    //
    // The window height is available synchronously and is what the reader occupies,
    // so at mount the visible band is [0, windowHeight].
    const scrollY = visibleYRange?.startY ?? 0;
    const viewportHeight = visibleYRange ? visibleYRange.endY - visibleYRange.startY : windowHeight;
    if (viewportHeight <= 0) return true;
    const firstRecorded = sectionLayouts.current[flatGroups[0]?.verses[0]?.verseNumber ?? -1];
    const base = firstRecorded?.y ?? 0;
    return isParagraphVisible(layout, scrollY - base, viewportHeight, GROUP_WINDOW_BUFFER_PX);
  };

  /**
   * Store native line geometry in the same shape the RN `onTextLayout` path uses,
   * so the lexicon popover's positioning code is untouched by the swap.
   */
  const handleNativeTextLayout = (groupKey: string, lines: TextLineLayout[]) => {
    paragraphLineLayoutsRef.current.set(
      groupKey,
      lines.map((line) => ({
        // The legacy path recorded each line's text; positioning only uses the
        // geometry, and native reports offsets instead, which is strictly more
        // precise than re-deriving them from a text slice.
        text: '',
        y: line.y,
        height: line.height,
        width: line.width,
        startCharOffset: line.start,
      }))
    );
  };

  /**
   * Handle layout of a verse/paragraph
   * Stores both Y position (for scroll-to) and height (for visibility calculation)
   */
  const handleVerseLayout = (startVerse: number, y: number, height: number) => {
    sectionPositions.current[startVerse] = y;
    sectionLayouts.current[startVerse] = { y, height };

    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }

    layoutTimeoutRef.current = setTimeout(() => {
      onContentLayout?.(sectionPositions.current);
    }, 100);
  };

  /**
   * Check if a verse group is visible in the viewport
   */
  const isVerseVisible = (startVerse: number): boolean => {
    const layout = sectionLayouts.current[startVerse];
    if (!layout) {
      // If layout not yet calculated, assume visible (safe default)
      return true;
    }
    return isElementVisible(layout.y, layout.height, visibleYRange);
  };

  /**
   * Handle notes button press
   */
  const handleNotesPress = () => {
    onOpenNotes?.();
  };

  /**
   * Handle tap on highlighted text
   * Shows grouped tooltip via context
   */
  const handleHighlightTap = (highlightId: number) => {
    let group = findGroupByHighlightId(highlightGroups, highlightId);

    if (!group) {
      const highlight = chapterHighlights.find((h) => h.highlight_id === highlightId);
      if (highlight) {
        group = {
          highlights: [highlight],
          startVerse: highlight.start_verse,
          endVerse: highlight.end_verse,
          color: highlight.color,
          isGrouped: false,
        };
      }
    }

    if (group) {
      const text =
        typeof group.highlights[0]?.selected_text === 'string'
          ? group.highlights[0].selected_text
          : undefined;
      openVerseTooltip(null, group, text);
    } else {
      // Fallback
      const highlight = chapterHighlights.find((h) => h.highlight_id === highlightId);
      if (highlight) {
        openHighlightEditMenu(highlight.highlight_id, highlight.color as HighlightColor);
      }
    }
  };

  /**
   * Handle tap on plain text
   * Shows verse insight tooltip via context
   */
  const handleVerseTap = (verseNumber: number) => {
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);
    openVerseTooltip(verseNumber, null, verse?.text);
  };

  /**
   * Handle tap on auto-highlighted text
   */
  const handleAutoHighlightPress = (autoHighlight: AutoHighlight) => {
    openAutoHighlightTooltip(autoHighlight);
  };

  /**
   * Tap on a lexicon-covered word in the verse text — open the popover.
   */
  const handleLexiconWordPress = ({
    surface,
    token,
    entry,
    isTheme,
  }: {
    surface: string;
    token: NonNullable<typeof lexiconActive>['token'];
    entry: LexEntry;
    isTheme: boolean;
  }) => {
    setLexiconActive({ surface, token, entry, isTheme });
  };

  /**
   * Handle text layout event to capture line positions
   */
  const handleTextLayout = (groupKey: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const { lines } = event.nativeEvent;
    let charOffset = 0;
    const lineInfo = lines.map((line) => {
      const info = {
        text: line.text,
        y: line.y,
        height: line.height,
        width: line.width,
        startCharOffset: charOffset,
      };
      charOffset += line.text.length;
      return info;
    });
    paragraphLineLayoutsRef.current.set(groupKey, lineInfo);
  };

  return (
    <View style={styles.container} collapsable={false} onLayout={handleContainerLayout}>
      {/* Chapter Title Row with Bookmark, Notes, and Share buttons - Only show in Bible view */}
      {!explanationsOnly && (
        <View style={styles.titleRow} collapsable={false}>
          {!hideChapterTitle && (
            <Text style={styles.chapterTitle} accessibilityRole="header">
              {chapter.title}
            </Text>
          )}
          <View style={styles.iconButtons}>
            <BookmarkToggle
              bookId={chapter.bookId}
              chapterNumber={chapter.chapterNumber}
              size={specs.iconSize}
              color={colors.textPrimary}
            />
            <NotesButton
              bookId={chapter.bookId}
              chapterNumber={chapter.chapterNumber}
              onPress={handleNotesPress}
              size={specs.iconSize}
              color={colors.textPrimary}
            />
          </View>
        </View>
      )}

      {/* Render Bible verses (only in Bible view). Sliced by
          maxBibleSections so the parent can progressively reveal
          sections — long chapters render the first couple immediately
          and the rest mount in the background instead of all at once. */}
      {!explanationsOnly &&
        (typeof maxBibleSections === 'number' && maxBibleSections < chapter.sections.length
          ? chapter.sections.slice(0, Math.max(1, maxBibleSections))
          : chapter.sections
        ).map((section) => (
          <Fragment key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}>
            {/* Section Subtitle */}
            {section.subtitle ? (
              <Text style={styles.sectionSubtitle} accessibilityRole="header">
                {section.subtitle}
              </Text>
            ) : null}
            {/* Verse Range Caption */}
            <Text
              style={styles.verseRange}
              accessibilityLabel={`Verses ${section.startVerse}-${section.endVerse}`}
            >
              {section.startVerse}-{section.endVerse}
            </Text>
            {/* Verses with Highlighting */}
            {PARAGRAPH_VIEW_ENABLED ? (
              (() => {
                // Memoised above so each `group` keeps a stable identity across
                // renders — ParagraphText's compile memo depends on it.
                const groups = sectionGroups.get(sectionKeyOf(section)) ?? [];

                return groups.map((group, groupIndex) => {
                  const groupKey = `group-${group[0].verseNumber}-${group[group.length - 1].verseNumber}`;

                  // Native path: the whole group becomes ONE view. This replaces
                  // the nested structure below — a paragraph <Text>, a <Text> per
                  // verse, four more per verse for the superscript number and its
                  // highlight background, and one or two per WORD inside
                  // HighlightedText. That is 160-290 shadow nodes for a five-verse
                  // group, which Android re-flattens into a single Spannable on
                  // every commit. See docs/native-text-rendering-plan.md.
                  if (useNativeTextRenderer && paragraphWidth > 0) {
                    return (
                      <View
                        key={groupKey}
                        testID={`verse-group-${group[0].verseNumber}`}
                        onLayout={(e) =>
                          handleVerseLayout(
                            group[0].verseNumber,
                            e.nativeEvent.layout.y,
                            e.nativeEvent.layout.height
                          )
                        }
                      >
                        <ParagraphText
                          alignment={alignment}
                          // Windowing. `handleVerseLayout` below records each
                          // group's Y and height, and the scroll worklet keeps
                          // `visibleYRange` current, so a group far from the
                          // viewport renders as an exact-height placeholder and
                          // creates no native views. Before the first layout the
                          // position is unknown and `isElementVisible` returns true,
                          // so the first paint is never blank.
                          isVisible={isGroupVisible(
                            flatIndexByKey.get(
                              `${sectionKeyOf(section)}:${group[0].verseNumber}`
                            ) ?? -1
                          )}
                          autoHighlights={autoHighlights}
                          highlights={chapterHighlights}
                          onAutoHighlightPress={handleAutoHighlightPress}
                          onHighlightTap={handleHighlightTap}
                          onLexiconWordPress={handleLexiconWordPress}
                          onTextLayout={(lines) => handleNativeTextLayout(groupKey, lines)}
                          onVerseTap={handleVerseTap}
                          redLetterVerses={redLetterVerses}
                          showLexUnderlines={showLexUnderlines}
                          style={styles.verseTextParagraph}
                          theme={nativeTextTheme}
                          verses={group}
                          width={paragraphWidth}
                        />
                        {groupIndex < groups.length - 1 && <View style={{ height: spacing.md }} />}
                      </View>
                    );
                  }

                  return (
                    <View
                      key={groupKey}
                      testID={`verse-group-${group[0].verseNumber}`}
                      onLayout={(e) =>
                        handleVerseLayout(
                          group[0].verseNumber,
                          e.nativeEvent.layout.y,
                          e.nativeEvent.layout.height
                        )
                      }
                    >
                      <Text
                        style={styles.verseTextParagraph}
                        selectable={true}
                        onTextLayout={(e) => handleTextLayout(groupKey, e)}
                      >
                        {group.map((verse, verseIndex) => {
                          let currBackgroundColor: string | undefined;
                          const startHighlight = getStartHighlight(
                            verse.verseNumber,
                            chapterHighlights,
                            autoHighlights
                          );

                          if (startHighlight) {
                            const baseColor = getHighlightColor(
                              startHighlight.color as HighlightColor,
                              mode
                            );
                            const opacity = startHighlight.isAuto ? 0.2 : 0.35;
                            const opacityHex = Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0');
                            currBackgroundColor = baseColor + opacityHex;
                          }

                          let prevBackgroundColor: string | undefined;
                          if (verseIndex > 0) {
                            const prevVerse = group[verseIndex - 1];
                            const endHighlight = getEndHighlight(
                              prevVerse.verseNumber,
                              prevVerse.text.length,
                              chapterHighlights,
                              autoHighlights
                            );

                            if (endHighlight) {
                              const baseColor = getHighlightColor(
                                endHighlight.color as HighlightColor,
                                mode
                              );
                              const opacity = endHighlight.isAuto ? 0.2 : 0.35;
                              const opacityHex = Math.round(opacity * 255)
                                .toString(16)
                                .padStart(2, '0');
                              prevBackgroundColor = baseColor + opacityHex;
                            }
                          }

                          return (
                            <Text key={verse.verseNumber}>
                              <Text style={styles.verseNumberSuperscript}>
                                {verseIndex > 0 && (
                                  <>
                                    <Text
                                      style={
                                        prevBackgroundColor && {
                                          backgroundColor: prevBackgroundColor,
                                        }
                                      }
                                    >
                                      {' '}
                                    </Text>
                                    <Text
                                      style={
                                        currBackgroundColor && {
                                          backgroundColor: currBackgroundColor,
                                        }
                                      }
                                    >
                                      {' '}
                                    </Text>
                                  </>
                                )}
                                <Text
                                  style={
                                    currBackgroundColor && {
                                      backgroundColor: currBackgroundColor,
                                    }
                                  }
                                >
                                  {toSuperscript(verse.verseNumber)}
                                </Text>
                                <Text
                                  style={
                                    currBackgroundColor && {
                                      backgroundColor: currBackgroundColor,
                                    }
                                  }
                                >
                                  {' '}
                                </Text>
                              </Text>
                              <HighlightedText
                                text={verse.text}
                                verseNumber={verse.verseNumber}
                                highlights={chapterHighlights}
                                autoHighlights={autoHighlights}
                                onHighlightTap={handleHighlightTap}
                                onAutoHighlightPress={handleAutoHighlightPress}
                                onVerseTap={handleVerseTap}
                                alignment={alignment}
                                onLexiconWordPress={handleLexiconWordPress}
                                style={
                                  redLetterVerses.has(verse.verseNumber)
                                    ? [styles.verseTextInline, redLetterStyle]
                                    : styles.verseTextInline
                                }
                                isVisible={isVerseVisible(group[0].verseNumber)}
                              />
                            </Text>
                          );
                        })}
                      </Text>
                      {groupIndex < groups.length - 1 && <View style={{ height: spacing.md }} />}
                    </View>
                  );
                });
              })()
            ) : (
              <View style={styles.versesContainer}>
                {section.verses.map((verse) => (
                  <View key={verse.verseNumber} style={styles.verseRow}>
                    <Text
                      style={styles.verseNumber}
                      accessibilityLabel={`Verse ${verse.verseNumber}`}
                    >
                      {verse.verseNumber}
                    </Text>
                    <HighlightedText
                      text={verse.text}
                      verseNumber={verse.verseNumber}
                      highlights={chapterHighlights}
                      autoHighlights={autoHighlights}
                      onHighlightTap={handleHighlightTap}
                      onAutoHighlightPress={handleAutoHighlightPress}
                      onVerseTap={handleVerseTap}
                      alignment={alignment}
                      onLexiconWordPress={handleLexiconWordPress}
                      style={
                        redLetterVerses.has(verse.verseNumber)
                          ? [styles.verseText, redLetterStyle]
                          : styles.verseText
                      }
                      isVisible={true}
                    />
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: spacing.xxxl }} />
          </Fragment>
        ))}

      {/* Explanation Content */}
      {explanation &&
        (() => {
          // Construct deterministic title
          const generatedTitle =
            activeTab === 'summary'
              ? `Summary of ${chapter.bookName} ${chapter.chapterNumber}`
              : activeTab === 'byline'
                ? `Line-by-Line: ${chapter.bookName} ${chapter.chapterNumber}`
                : `Detailed Insight: ${chapter.bookName} ${chapter.chapterNumber}`;

          // Extract title from markdown (H1, H2, etc.)
          // Match heading at start of content, handling various line endings
          const titleMatch = explanation.content.match(/^(#{1,6})\s+(.+?)(?:\r?\n|$)/);
          const extractedTitle = titleMatch ? titleMatch[2].trim() : null;

          // Use extracted title if found, otherwise fallback to generated title
          const title = extractedTitle || generatedTitle;

          // Remove the first heading line from content if found
          const contentWithoutTitle = titleMatch
            ? explanation.content.replace(/^#{1,6}\s+.+?(?:\r?\n|$)/, '')
            : explanation.content;

          return (
            <View style={styles.explanationContainer} collapsable={false}>
              {/* Title row with action buttons */}
              {title && (
                <View style={styles.explanationTitleRow}>
                  <Text style={styles.explanationTitle}>{title}</Text>
                  <View style={styles.explanationTitleActions}>
                    <ShareButton
                      bookId={chapter.bookId}
                      chapterNumber={chapter.chapterNumber}
                      bookName={chapter.bookName}
                      insightType={activeTab}
                      size={22}
                      color={colors.textSecondary}
                      testID="insight-title-share-button"
                    />
                    {/* 
                      TODO: Re-enable when backend supports insight_type in bookmarks response.
                      Currently GET /bible/book/bookmarks does not return insight_type, so persistence fails.

                      <InsightBookmarkButton
                        bookId={chapter.bookId}
                        chapterNumber={chapter.chapterNumber}
                        insightType={activeTab}
                        size={22}
                        color={colors.textSecondary}
                        testID="insight-title-bookmark-button"
                      /> 
                    */}
                  </View>
                </View>
              )}

              {/* Markdown content */}
              {activeTab === 'byline' && onByLineSectionRegister ? (
                (() => {
                  const sections = parseByLineSections(contentWithoutTitle, chapter.chapterNumber);
                  if (sections.length === 0) {
                    return <Markdown style={markdownStyles}>{contentWithoutTitle}</Markdown>;
                  }
                  // Progressive reveal: parent caps via maxBylineSections so
                  // long chapters (e.g. Psalm 119 with 176 verses) don't
                  // parse every Markdown subtree on first paint. Sections
                  // beyond the cap mount as the parent ramps the prop up.
                  const visible =
                    typeof maxBylineSections === 'number' && maxBylineSections < sections.length
                      ? sections.slice(0, Math.max(1, maxBylineSections))
                      : sections;
                  return visible.map((section, index) => (
                    <View
                      key={`byline-section-${section.verseNumber}-${index}`}
                      ref={(node) => onByLineSectionRegister(section.verseNumber, node)}
                      testID={`byline-verse-section-${section.verseNumber}`}
                      collapsable={false}
                    >
                      <Markdown style={markdownStyles}>{section.markdown}</Markdown>
                    </View>
                  ));
                })()
              ) : (
                <Markdown style={markdownStyles}>{contentWithoutTitle}</Markdown>
              )}
            </View>
          );
        })()}

      {/* 
          NOTE: Tooltips and Modals (VerseMateTooltip, HighlightSelectionSheet, etc.)
          are now rendered by the BibleInteractionContext provider at the ChapterScreen level.
          This allows them to float over the SplitView right panel without being clipped
          by the left panel's overflow.
      */}

      {/* Error Modal */}
      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />

      {/* Lexicon Popover — opens on tap of a dotted-underlined word.
          Long-press is now reserved for native text selection; the legacy
          Easton/Strong/Webster WordDefinitionTooltip is no longer wired
          into the Bible reader (it still serves BibleExplanationsPanel
          and topic surfaces, which keep the long-press → dictionary flow). */}
      {lexiconActive && (
        <LexiconPopover
          visible={true}
          onClose={() => setLexiconActive(null)}
          surface={lexiconActive.surface}
          entry={lexiconActive.entry}
          token={lexiconActive.token}
          isTheme={lexiconActive.isTheme}
          apiLang={lemmaApiLang}
        />
      )}
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof getColors>,
  explanationsOnly?: boolean,
  userFontSize: number = fontSizes.bodyLarge
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xxl,
    },
    chapterTitle: {
      flex: 1,
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.displayMedium * lineHeights.display,
      color: colors.textPrimary,
      marginRight: spacing.md,
    },
    iconButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sectionSubtitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    verseRange: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.regular,
      lineHeight: fontSizes.caption * lineHeights.ui,
      color: colors.textTertiary,
      marginBottom: spacing.md,
    },
    versesContainer: {
      flexDirection: 'column',
    },
    verseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    verseNumber: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.bodyLarge * lineHeights.body,
      color: colors.textTertiary,
      marginRight: spacing.xs,
      marginTop: -4,
    },
    verseNumberSuperscript: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.bold,
      color: colors.textTertiary,
    },
    verseText: {
      fontSize: userFontSize,
      fontWeight: fontWeights.regular,
      lineHeight: userFontSize * 2.0,
      color: colors.textPrimary,
    },
    verseTextInline: {
      fontSize: userFontSize,
      fontWeight: fontWeights.regular,
      lineHeight: userFontSize * 2.0,
      color: colors.textPrimary,
    },
    verseTextParagraph: {
      fontSize: userFontSize,
      fontWeight: fontWeights.regular,
      lineHeight: userFontSize * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    explanationContainer: {
      marginTop: explanationsOnly ? 0 : spacing.xxxl,
      paddingTop: explanationsOnly ? 0 : spacing.xxl,
      borderTopWidth: explanationsOnly ? 0 : 1,
      borderTopColor: colors.border,
    },
    explanationTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    // Removed explanationTitleContainer as we are reverting to direct Text usage like titleRow
    explanationTitle: {
      flex: 1,
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      lineHeight: fontSizes.heading1 * lineHeights.heading, // Fixed: Multiply fontSize by lineHeight
      marginRight: spacing.md,
    },
    explanationTitleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
  });

const createMarkdownStyles = (
  colors: ReturnType<typeof getColors>,
  userFontSize: number = fontSizes.bodyLarge
) => {
  // Scale Insight (Summary / By Line / Detailed) markdown with the reader's
  // font-size preference, mirroring the verse-text scaling above. Previously
  // these were fixed tokens, so the slider moved verse text but not the
  // Insight — the bug Andy reported. bodyLarge (18) is the default reader
  // size, so the scale is 1 at the default.
  const contentScale = userFontSize / fontSizes.bodyLarge;
  const bodyFont = fontSizes.bodyLarge * contentScale;
  const heading1Font = fontSizes.heading1 * contentScale;
  const heading2Font = fontSizes.heading2 * contentScale;
  const heading3Font = fontSizes.heading3 * contentScale;
  return StyleSheet.create({
    body: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: heading1Font,
      fontWeight: fontWeights.bold,
      lineHeight: heading1Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: heading2Font,
      fontWeight: fontWeights.semibold,
      lineHeight: heading2Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: heading3Font,
      fontWeight: fontWeights.semibold,
      lineHeight: heading3Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    strong: {
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
      color: colors.textPrimary,
    },
    list_item: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    bullet_list: {
      marginBottom: spacing.lg,
    },
    ordered_list: {
      marginBottom: spacing.lg,
    },
    code_inline: {
      fontFamily: 'monospace',
      fontSize: fontSizes.bodySmall,
      backgroundColor: colors.backgroundElevated,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 3,
      color: colors.textPrimary,
    },
    fence: {
      fontFamily: 'monospace',
      fontSize: fontSizes.bodySmall,
      backgroundColor: colors.backgroundElevated,
      padding: spacing.md,
      borderRadius: 4,
      marginBottom: spacing.lg,
      color: colors.textPrimary,
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    link: {
      color: colors.gold,
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: spacing.xl,
    },
  });
};
