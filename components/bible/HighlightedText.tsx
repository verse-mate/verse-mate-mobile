/**
 * HighlightedText Component
 *
 * Renders Bible verse text with semi-transparent highlight backgrounds.
 * Handles tap detection for highlighted vs non-highlighted text.
 *
 * Features:
 * - Semi-transparent highlight backgrounds (no borders/underlines)
 * - Character-level precision highlighting
 * - Multiple non-overlapping highlights per verse
 * - Single tap on highlighted text shows tooltip
 * - Single tap on plain text shows verse insight
 * - Long-press with coordinate-based word detection opens dictionary lookup
 * - Theme-aware highlight colors (brighter in dark mode)
 *
 * Performance: Uses segment-based rendering without per-word tokenization.
 * Word detection on long-press uses touch coordinates and text layout estimation.
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md
 * @see Visual: after-selected-text-popup.png (highlighted text appearance)
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  type TextProps,
  View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';

/**
 * Opacity value for highlight backgrounds
 * Ensures text readability while providing visible color indication
 * Based on WCAG contrast guidelines for overlays
 */
const HIGHLIGHT_OPACITY = 0.35;

/**
 * Opacity value for auto-highlight backgrounds
 * Lighter than user highlights to distinguish AI-generated highlights
 */
const AUTO_HIGHLIGHT_OPACITY = 0.2;

/**
 * Text segment representing a portion of verse text
 * Can be highlighted, auto-highlighted, or plain text
 */
interface TextSegment {
  /** Text content of this segment */
  text: string;
  /** User highlight associated with this segment (if highlighted) */
  highlight: Highlight | null;
  /** Auto-highlight associated with this segment (if auto-highlighted) */
  autoHighlight: AutoHighlight | null;
  /** Start character position in verse text */
  startChar: number;
  /** End character position in verse text */
  endChar: number;
  /** Unique key for React rendering */
  key: string;
}

/**
 * Text layout line information from onTextLayout event
 */
interface TextLayoutLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Selection information from Text onSelectionChange event
 */
export interface TextSelection {
  /** Start character position in verse text */
  start: number;
  /** End character position in verse text */
  end: number;
  /** Selected text content */
  text: string;
}

/**
 * Word selection state for dictionary lookup
 * Tracks selected word and position for Define button placement
 */
export interface WordSelection {
  /** The selected word (cleaned of punctuation) */
  word: string;
  /** Start character position in verse text */
  startChar: number;
  /** End character position in verse text */
  endChar: number;
  /** Page X coordinate for floating button positioning */
  pageX: number;
  /** Page Y coordinate for floating button positioning */
  pageY: number;
  /** Verse number containing the selected word */
  verseNumber: number;
}

export interface HighlightedTextProps extends TextProps {
  /** Full text of the verse */
  text: string;
  /** Verse number for this text */
  verseNumber: number;
  /** User highlights that apply to this verse */
  highlights?: Highlight[];
  /** Auto-highlights that apply to this verse (AI-generated) */
  autoHighlights?: AutoHighlight[];
  /** Callback when highlighted text is tapped (show grouped/single tooltip) */
  onHighlightTap?: (highlightId: number) => void;
  /** Callback when auto-highlight is pressed (show info tooltip) */
  onAutoHighlightPress?: (autoHighlight: AutoHighlight) => void;
  /** Callback when plain text is tapped (show verse insight tooltip) */
  onVerseTap?: (verseNumber: number) => void;
  /** Callback when a word is long-pressed (for dictionary lookup) - DEPRECATED: use onWordSelect */
  onWordLongPress?: (verseNumber: number, word: string) => void;
  /** Callback when a word is selected via long-press (shows selection with Define button) */
  onWordSelect?: (selection: WordSelection, clearSelection: () => void) => void;
  /** External selection state for controlled mode (when parent manages selection) */
  selectedWord?: WordSelection | null;
  /** Style override for base text */
  style?: TextProps['style'];
  /** Whether this text is visible in viewport - enables word tokenization for accurate long-press */
  isVisible?: boolean;
  /**
   * Chapter alignment for the Greek/Hebrew lexicon. When provided, words
   * whose surface form appears in `alignment.verses[verseNumber]` render
   * with a dotted underline and become tappable to open the lexicon
   * popover via `onLexiconWordPress`. Other words keep their existing
   * verse-tap behavior. Long-press handlers are NOT wired in this mode —
   * native text selection takes over instead.
   */
  alignment?: ChapterAlignment | null;
  /** Callback fired on tap of a lexicon-covered word. */
  onLexiconWordPress?: (args: {
    surface: string;
    token: AlignedToken;
    entry: LexEntry;
    isTheme: boolean;
  }) => void;
}

/**
 * Word token for tokenized rendering
 * Each word becomes a separate Text element for accurate long-press detection
 */
interface WordToken {
  /** The word text (may include punctuation) */
  word: string;
  /** Start character position in the segment */
  startChar: number;
  /** End character position in the segment (exclusive) */
  endChar: number;
  /** Whether there's a trailing space after this word */
  hasTrailingSpace: boolean;
}

/**
 * Tokenize text into individual words for per-word rendering
 * Preserves spaces and punctuation for accurate positioning
 */
function tokenizeText(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  // Match word characters and any attached punctuation, followed by optional whitespace
  const regex = /(\S+)(\s*)/g;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    const wordMatch = match[1];
    const spaceMatch = match[2];
    tokens.push({
      word: wordMatch,
      startChar: match.index ?? 0,
      endChar: (match.index ?? 0) + wordMatch.length,
      hasTrailingSpace: spaceMatch.length > 0,
    });
  }

  return tokens;
}

/**
 * Result of word extraction including boundaries
 */
interface WordExtractionResult {
  word: string;
  startChar: number;
  endChar: number;
}

/**
 * Extract the word at a given character index from text
 * Expands from the index to find word boundaries
 * Returns word and its character boundaries
 */
function extractWordAtIndex(text: string, charIndex: number): WordExtractionResult | null {
  if (charIndex < 0 || charIndex >= text.length) return null;

  // Find word boundaries by expanding from the character index
  let wordStart = charIndex;
  let wordEnd = charIndex;

  // If we're on whitespace/punctuation, try to find the nearest word
  if (!/\w/.test(text[charIndex])) {
    // Look backward for a word
    let backwardIdx = charIndex - 1;
    while (backwardIdx >= 0 && !/\w/.test(text[backwardIdx])) {
      backwardIdx--;
    }
    // Look forward for a word
    let forwardIdx = charIndex + 1;
    while (forwardIdx < text.length && !/\w/.test(text[forwardIdx])) {
      forwardIdx++;
    }

    // Choose the closer word
    const backwardDist = backwardIdx >= 0 ? charIndex - backwardIdx : Infinity;
    const forwardDist = forwardIdx < text.length ? forwardIdx - charIndex : Infinity;

    if (backwardDist <= forwardDist && backwardIdx >= 0) {
      charIndex = backwardIdx;
    } else if (forwardIdx < text.length) {
      charIndex = forwardIdx;
    } else {
      return null;
    }
    wordStart = charIndex;
    wordEnd = charIndex;
  }

  // Expand backward to find start of word
  while (wordStart > 0 && /\w/.test(text[wordStart - 1])) {
    wordStart--;
  }

  // Expand forward to find end of word
  while (wordEnd < text.length - 1 && /\w/.test(text[wordEnd + 1])) {
    wordEnd++;
  }

  const word = text.slice(wordStart, wordEnd + 1);
  if (word.length === 0 || !/\w/.test(word)) return null;

  return {
    word,
    startChar: wordStart,
    endChar: wordEnd + 1, // End is exclusive
  };
}

/**
 * Estimate average character width based on text and container width
 * Uses a simple heuristic that works well for most fonts
 */
const DEFAULT_CHAR_WIDTH = 8; // Fallback character width in pixels

/**
 * HighlightedText Component
 *
 * Renders verse text with highlights as semi-transparent backgrounds.
 * Segments text based on highlight character positions for precise rendering.
 * Uses coordinate-based word detection for dictionary lookup on long-press.
 *
 * Performance optimizations:
 * - Segment-based rendering (not per-word tokenization)
 * - Memoized with React.memo and useMemo
 * - Text layout tracked for accurate word detection
 */
export function HighlightedText({
  text,
  verseNumber,
  highlights = [],
  autoHighlights = [],
  onHighlightTap,
  onAutoHighlightPress,
  onVerseTap,
  onWordLongPress,
  onWordSelect,
  alignment,
  onLexiconWordPress,
  selectedWord: externalSelectedWord,
  style,
  isVisible = true,
  ...textProps
}: HighlightedTextProps) {
  // When the caller wires up the lexicon, the gesture model flips:
  // - tap on a covered word → lexicon popover (new behavior)
  // - tap on any other word → verse insight (existing onVerseTap)
  // - long-press → native text selection (we omit our onLongPress handler so
  //   the outer `selectable={true}` <Text> takes over)
  //
  // Without lexicon wiring we keep the legacy long-press → dictionary path
  // intact so BibleExplanationsPanel / TopicContentPanel still work.
  const lexiconMode = Boolean(alignment && onLexiconWordPress);
  const longPressEnabled = !lexiconMode && Boolean(onWordSelect || onWordLongPress);

  // Lookup map: normalized lowercase surface → { token, entry, isTheme }
  // for fast match on every per-word render. Cleared when alignment or
  // verseNumber changes.
  const lexiconLookup = useMemo(() => {
    if (!alignment || !alignment.verses[verseNumber]) return null;
    const map = new Map<
      string,
      { token: AlignedToken; entry: LexEntry; isTheme: boolean }
    >();
    const themeSet = new Set(alignment.themeLemmas ?? []);
    for (const token of alignment.verses[verseNumber]) {
      const entry = alignment.lexicon[token.lemma];
      if (!entry) continue;
      const normalized = token.surface.toLowerCase();
      // First-write-wins keeps the data file's ordering authoritative when
      // the same surface maps to multiple lemmas in a verse.
      if (!map.has(normalized)) {
        map.set(normalized, { token, entry, isTheme: themeSet.has(token.lemma) });
      }
    }
    return map;
  }, [alignment, verseNumber]);

  // Normalize a displayed word (e.g. "Trials,") to its lookup key ("trials").
  const lexiconMatch = (rawWord: string) => {
    if (!lexiconLookup) return null;
    const clean = rawWord
      .toLowerCase()
      .replace(/^[.,;:!?"'’()]+/, '')
      .replace(/[.,;:!?"'’()]+$/, '');
    if (!clean) return null;
    return lexiconLookup.get(clean) ?? null;
  };
  // Get current theme mode for highlight color selection
  const { mode } = useTheme();

  // Debounce timer to distinguish single-tap from double-tap
  // When selectable={true}, double-tap triggers native text selection.
  // We delay onPress by 300ms and cancel if a second tap (double-tap) or long-press occurs.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verse-tap selection state: briefly highlights the whole verse while the
  // debounce window is open so the user sees feedback before the insight
  // tooltip opens (regressed by PR #260; restored per VER-78).
  const [verseTapSelected, setVerseTapSelected] = useState(false);

  const debouncedPress = (callback: () => void) => {
    if (tapTimerRef.current) {
      // Second tap within 300ms = double-tap for native selection, cancel tooltip
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setVerseTapSelected(false);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setVerseTapSelected(false);
      callback();
    }, 300);
  };

  // Cancel pending tap when long-press fires (dictionary lookup)
  const cancelPendingTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    setVerseTapSelected(false);
  };

  // Clean up pending tap timer on unmount
  useEffect(() => {
    return cancelPendingTap;
  }, []);

  // Track text layout for coordinate-based word detection
  const textLayoutRef = useRef<TextLayoutLine[]>([]);
  const containerWidthRef = useRef<number>(0);

  // Internal selection state (used when not controlled externally)
  const [internalSelectedWord, setInternalSelectedWord] = useState<WordSelection | null>(null);

  // Use external selection if provided, otherwise use internal state
  const selectedWordState =
    externalSelectedWord !== undefined ? externalSelectedWord : internalSelectedWord;

  // Clear selection callback
  const clearSelection = () => {
    setInternalSelectedWord(null);
  };

  /**
   * Process segments - memoized for performance
   * No tokenization - each segment is rendered as a single Text component
   */
  const segments = useMemo((): TextSegment[] => {
    // Filter highlights relevant to this verse
    const verseHighlights = highlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    const verseAutoHighlights = autoHighlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    // If no highlights or auto-highlights, return plain text
    if (verseHighlights.length === 0 && verseAutoHighlights.length === 0) {
      return [
        {
          text,
          highlight: null,
          autoHighlight: null,
          startChar: 0,
          endChar: text.length,
          key: `text-${verseNumber}-0-${text.length}`,
        },
      ];
    } else {
      // Process user highlights first (they take precedence)
      // Sort highlights by start position
      const sortedHighlights = [...verseHighlights].sort((a, b) => {
        const aStart = (a.start_char ?? 0) as number;
        const bStart = (b.start_char ?? 0) as number;
        return aStart - bStart;
      });

      const textSegments: TextSegment[] = [];
      let currentPosition = 0;

      for (const highlight of sortedHighlights) {
        // Determine highlight boundaries within this verse
        let highlightStart = 0;
        let highlightEnd = text.length;

        // If highlight has character-level precision
        if (highlight.start_char !== null && highlight.end_char !== null) {
          // Single verse highlight
          if (highlight.start_verse === highlight.end_verse) {
            highlightStart = highlight.start_char as number;
            highlightEnd = highlight.end_char as number;
          } else if (verseNumber === highlight.start_verse) {
            // First verse of multi-verse highlight
            highlightStart = highlight.start_char as number;
            highlightEnd = text.length;
          } else if (verseNumber === highlight.end_verse) {
            // Last verse of multi-verse highlight
            highlightStart = 0;
            highlightEnd = highlight.end_char as number;
          } else {
            // Middle verse of multi-verse highlight
            highlightStart = 0;
            highlightEnd = text.length;
          }
        }

        // Add plain text or auto-highlighted segment before user highlight (if any)
        if (currentPosition < highlightStart) {
          // Check if this range overlaps with any auto-highlights
          const autoHighlightInRange = verseAutoHighlights.find((ah) => {
            // Auto-highlights are always full verses (no character-level precision)
            return ah.start_verse <= verseNumber && ah.end_verse >= verseNumber;
          });

          const key = autoHighlightInRange
            ? `auto-${autoHighlightInRange.auto_highlight_id}-${currentPosition}-${highlightStart}`
            : `text-${verseNumber}-${currentPosition}-${highlightStart}`;

          textSegments.push({
            text: text.slice(currentPosition, highlightStart),
            highlight: null,
            autoHighlight: autoHighlightInRange || null,
            startChar: currentPosition,
            endChar: highlightStart,
            key,
          });
        }

        // Add user highlighted segment
        textSegments.push({
          text: text.slice(highlightStart, highlightEnd),
          highlight,
          autoHighlight: null, // User highlights take precedence
          startChar: highlightStart,
          endChar: highlightEnd,
          key: `highlight-${highlight.highlight_id}-${highlightStart}-${highlightEnd}`,
        });

        currentPosition = highlightEnd;
      }

      // Add remaining text (plain or auto-highlighted)
      if (currentPosition < text.length) {
        // Check if remaining text should be auto-highlighted
        const autoHighlightInRange = verseAutoHighlights.find((ah) => {
          return ah.start_verse <= verseNumber && ah.end_verse >= verseNumber;
        });

        const key = autoHighlightInRange
          ? `auto-${autoHighlightInRange.auto_highlight_id}-${currentPosition}-${text.length}`
          : `text-${verseNumber}-${currentPosition}-${text.length}`;

        textSegments.push({
          text: text.slice(currentPosition),
          highlight: null,
          autoHighlight: autoHighlightInRange || null,
          startChar: currentPosition,
          endChar: text.length,
          key,
        });
      }

      return textSegments;
    }
  }, [text, highlights, autoHighlights, verseNumber]);

  /**
   * Handle tap on a user highlight segment
   * Debounced to avoid firing on double-tap (native text selection)
   */
  const handleHighlightTap = (highlightId: number) => {
    if (!onHighlightTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    debouncedPress(() => {
      onHighlightTap(highlightId);
    });
  };

  /**
   * Handle tap on auto-highlight segment
   * Debounced to avoid firing on double-tap (native text selection)
   */
  const handleAutoHighlightPress = (autoHighlight: AutoHighlight) => {
    if (!onAutoHighlightPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    debouncedPress(() => {
      onAutoHighlightPress(autoHighlight);
    });
  };

  /**
   * Handle tap on plain text
   * Debounced to avoid firing on double-tap (native text selection)
   */
  const handleVerseTap = () => {
    if (!onVerseTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Mark the whole verse as selected for the duration of the debounce window
    // so the user sees a clear tap target before the insight tooltip opens.
    setVerseTapSelected(true);
    debouncedPress(() => {
      onVerseTap(verseNumber);
    });
  };

  /**
   * Handle text layout event to track line information
   * Used for coordinate-based word detection on long-press
   */
  const handleTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    textLayoutRef.current = event.nativeEvent.lines as TextLayoutLine[];
  };

  /**
   * Handle container layout to track width
   * Used for character width estimation
   */
  const handleLayout = (event: LayoutChangeEvent) => {
    containerWidthRef.current = event.nativeEvent.layout.width;
  };

  /**
   * Detect word from long-press coordinates within a segment
   * Uses line layout data for accurate character detection in wrapped text.
   * Falls back to simple estimation when line data unavailable.
   */
  const detectWordFromLongPress = (
    segmentText: string,
    segmentStartChar: number,
    event: GestureResponderEvent
  ) => {
    // Bail when long-press is disabled (lexicon mode or no callback wired)
    // so the outer selectable Text gets the gesture for native selection.
    if (!longPressEnabled) return;
    cancelPendingTap();
    const { locationX, locationY, pageX, pageY } = event.nativeEvent;

    // Use line layout for accurate wrapped text detection
    const lines = textLayoutRef.current;
    let charIndexInFullText = -1;

    if (lines.length > 0) {
      // Find which line was tapped using Y coordinate
      let cumulativeCharOffset = 0;
      for (const line of lines) {
        // Check if tap Y is within this line's bounds
        if (locationY >= line.y && locationY < line.y + line.height) {
          // Calculate character position within this line
          const lineCharWidth =
            line.width > 0 && line.text.length > 0
              ? line.width / line.text.length
              : DEFAULT_CHAR_WIDTH;

          // locationX relative to line start
          const xInLine = locationX - line.x;
          const charInLine = Math.floor(xInLine / lineCharWidth);
          const clampedCharInLine = Math.max(0, Math.min(charInLine, line.text.length - 1));

          charIndexInFullText = cumulativeCharOffset + clampedCharInLine;
          break;
        }
        cumulativeCharOffset += line.text.length;
      }
    }

    // Fallback: simple X-based estimation if line detection didn't work
    if (charIndexInFullText < 0) {
      // Use a reasonable character width for bodyLarge font (~17px)
      const FALLBACK_CHAR_WIDTH = 10;
      charIndexInFullText = Math.floor(locationX / FALLBACK_CHAR_WIDTH);
    }

    // Convert full-text index to segment-relative index
    const segmentRelativeIndex = charIndexInFullText - segmentStartChar;

    // Clamp to segment bounds - if tap was outside this segment, use nearest edge
    const clampedIndex = Math.max(0, Math.min(segmentRelativeIndex, segmentText.length - 1));

    const result = extractWordAtIndex(segmentText, clampedIndex);

    if (result) {
      // Clean punctuation from word
      const cleanWord = result.word.replace(/[.,;:!?"']+$/, '').replace(/^[.,;:!?"']+/, '');
      if (!cleanWord) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Calculate absolute character positions in full verse text
      const wordStartInFullText = segmentStartChar + result.startChar;
      const wordEndInFullText = segmentStartChar + result.endChar;

      // Create selection object
      const selection: WordSelection = {
        word: cleanWord,
        startChar: wordStartInFullText,
        endChar: wordEndInFullText,
        pageX,
        pageY,
        verseNumber,
      };

      // Use new selection API if available
      if (onWordSelect) {
        setInternalSelectedWord(selection);
        onWordSelect(selection, clearSelection);
      } else if (onWordLongPress) {
        // Legacy fallback: directly trigger dictionary lookup
        onWordLongPress(verseNumber, cleanWord);
      }
    }
  };

  /**
   * Handle long-press on a tokenized word (when isVisible=true)
   * Since each word is a separate Text element, we know exactly which word was pressed
   */
  const handleTokenizedWordLongPress = (
    word: string,
    startChar: number,
    endChar: number,
    event: GestureResponderEvent
  ) => {
    cancelPendingTap();
    const { pageX, pageY } = event.nativeEvent;

    // Clean punctuation from word
    const cleanWord = word.replace(/[.,;:!?"']+$/, '').replace(/^[.,;:!?"']+/, '');
    if (!cleanWord) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Create selection object
    const selection: WordSelection = {
      word: cleanWord,
      startChar,
      endChar,
      pageX,
      pageY,
      verseNumber,
    };

    // Use new selection API if available
    if (onWordSelect) {
      setInternalSelectedWord(selection);
      onWordSelect(selection, clearSelection);
    } else if (onWordLongPress) {
      // Legacy fallback: directly trigger dictionary lookup
      onWordLongPress(verseNumber, cleanWord);
    }
  };

  /**
   * Memoized highlight styles
   */
  const highlightStyles = useMemo(() => {
    const styles: Record<string, { backgroundColor: string }> = {};
    for (const segment of segments) {
      if (segment.highlight) {
        const color = segment.highlight.color;
        if (!styles[color]) {
          styles[color] = {
            backgroundColor:
              getHighlightColor(color, mode) +
              Math.round(HIGHLIGHT_OPACITY * 255)
                .toString(16)
                .padStart(2, '0'),
          };
        }
      }
    }
    return styles;
  }, [segments, mode]);

  /**
   * Memoized auto-highlight styles
   */
  const autoHighlightStyles = useMemo(() => {
    const styles: Record<
      string,
      { backgroundColor: string; borderBottomWidth: number; borderBottomColor: string }
    > = {};
    for (const segment of segments) {
      if (segment.autoHighlight) {
        const color = segment.autoHighlight.theme_color;
        if (!styles[color]) {
          const bgColor = getHighlightColor(color, mode);
          styles[color] = {
            backgroundColor:
              bgColor +
              Math.round(AUTO_HIGHLIGHT_OPACITY * 255)
                .toString(16)
                .padStart(2, '0'),
            borderBottomWidth: 2,
            borderBottomColor:
              bgColor +
              Math.round(0.5 * 255)
                .toString(16)
                .padStart(2, '0'),
          };
        }
      }
    }
    return styles;
  }, [segments, mode]);

  /**
   * Check if a segment contains the selected word
   * Returns the text split into [before, selected, after] if selection exists in segment
   */
  const getSelectionParts = (
    segment: TextSegment
  ): { before: string; selected: string; after: string } | null => {
    if (!selectedWordState) return null;

    // Check if selection falls within this segment
    const selStart = selectedWordState.startChar;
    const selEnd = selectedWordState.endChar;
    const segStart = segment.startChar;
    const segEnd = segment.endChar;

    // Selection must overlap with segment
    if (selEnd <= segStart || selStart >= segEnd) return null;

    // Calculate relative positions within segment
    const relativeStart = Math.max(0, selStart - segStart);
    const relativeEnd = Math.min(segment.text.length, selEnd - segStart);

    return {
      before: segment.text.slice(0, relativeStart),
      selected: segment.text.slice(relativeStart, relativeEnd),
      after: segment.text.slice(relativeEnd),
    };
  };

  /**
   * Handle tap on outer text to clear selection
   */
  const handleOuterPress = () => {
    if (selectedWordState) {
      clearSelection();
    }
  };

  /**
   * Render a segment as tokenized words (when visible)
   * Each word is a separate Text element. When lexicon mode is active,
   * words covered by the alignment get a dotted underline + tap-to-open
   * lexicon popover behavior; other words fall through to the segment's
   * regular tap (verse-insight or highlight). Long-press handlers are
   * suppressed in lexicon mode so native text selection works.
   */
  const renderTokenizedSegment = (
    segment: TextSegment,
    segmentStyle: { backgroundColor: string } | undefined,
    onPressHandler: (() => void) | undefined
  ) => {
    const tokens = tokenizeText(segment.text);

    return (
      <Text key={segment.key} style={segmentStyle} suppressHighlighting={true}>
        {tokens.map((token) => {
          // Calculate absolute char positions in verse text
          const absoluteStartChar = segment.startChar + token.startChar;
          const absoluteEndChar = segment.startChar + token.endChar;

          // Check if this word is selected
          const isSelected =
            selectedWordState &&
            selectedWordState.startChar === absoluteStartChar &&
            selectedWordState.endChar === absoluteEndChar;

          // Responder props exist at runtime but not in Text's TS types
          // They allow ScrollView to take over the gesture when scrolling
          const responderProps: Record<string, () => boolean> = {
            onStartShouldSetResponder: () => true,
            onResponderTerminationRequest: () => true,
          };

          // Lexicon-covered word? Render via LexiconWord (Text + SVG dotted
          // underline) and route tap to the lexicon callback. Trailing
          // punctuation + space are siblings so the underline stops at the
          // last word character.
          const lexHit = lexiconMatch(token.word);
          if (lexHit && onLexiconWordPress) {
            const match = token.word.match(/^([\p{L}\p{M}\p{N}'’-]+)(.*)$/u);
            const wordCore = match ? match[1] : token.word;
            const trailing = match ? match[2] : '';
            const space = token.hasTrailingSpace ? ' ' : '';
            return (
              <Text
                key={`word-${segment.key}-${token.startChar}`}
                suppressHighlighting={true}
                {...responderProps}
              >
                <LexiconWord
                  text={wordCore}
                  isTheme={lexHit.isTheme}
                  selected={isSelected || verseTapSelected}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onLexiconWordPress({
                      surface: wordCore,
                      token: lexHit.token,
                      entry: lexHit.entry,
                      isTheme: lexHit.isTheme,
                    });
                  }}
                  accessibilityLabel={`${wordCore} — ${lexHit.entry.translit}, ${lexHit.entry.basicGloss}`}
                />
                {trailing}
                {space}
              </Text>
            );
          }

          return (
            <Text
              key={`word-${segment.key}-${token.startChar}`}
              style={isSelected || verseTapSelected ? selectionStyles.selected : undefined}
              onPress={onPressHandler}
              onLongPress={
                longPressEnabled
                  ? (e) =>
                      handleTokenizedWordLongPress(
                        token.word,
                        absoluteStartChar,
                        absoluteEndChar,
                        e
                      )
                  : undefined
              }
              suppressHighlighting={true}
              {...responderProps}
            >
              {token.word}
              {token.hasTrailingSpace ? ' ' : ''}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <Text
      style={style}
      selectable={true}
      suppressHighlighting={true}
      onTextLayout={handleTextLayout}
      onLayout={handleLayout}
      onPress={handleOuterPress}
      testID={`verse-text-${verseNumber}`}
      {...textProps}
    >
      {segments.map((segment) => {
        // When visible, use tokenized rendering for accurate word detection
        if (isVisible) {
          // Determine style and press handler based on segment type
          let segmentStyle: { backgroundColor: string } | undefined;
          let onPressHandler: (() => void) | undefined;

          if (segment.highlight) {
            segmentStyle = highlightStyles[segment.highlight.color];
            const highlightId = segment.highlight.highlight_id;
            onPressHandler = () => handleHighlightTap(highlightId);
          } else if (segment.autoHighlight) {
            segmentStyle = autoHighlightStyles[segment.autoHighlight.theme_color];
            const autoHighlight = segment.autoHighlight;
            onPressHandler = () => handleAutoHighlightPress(autoHighlight);
          } else {
            onPressHandler = handleVerseTap;
          }

          return renderTokenizedSegment(segment, segmentStyle, onPressHandler);
        }

        // Non-visible: use original segment-based rendering (faster, coordinate-based detection)
        // Check if this segment contains selected word
        const selectionParts = getSelectionParts(segment);

        // User highlight segment (solid color)
        if (segment.highlight) {
          const highlightStyle = highlightStyles[segment.highlight.color];
          const highlightId = segment.highlight.highlight_id;

          // If segment contains selection, render with blue highlight on selected word
          if (selectionParts) {
            return (
              <Text
                key={segment.key}
                style={highlightStyle}
                onPress={() => handleHighlightTap(highlightId)}
                onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
                suppressHighlighting={true}
              >
                {selectionParts.before}
                <Text style={selectionStyles.selected}>{selectionParts.selected}</Text>
                {selectionParts.after}
              </Text>
            );
          }

          return (
            <Text
              key={segment.key}
              style={highlightStyle}
              onPress={() => handleHighlightTap(highlightId)}
              onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
              suppressHighlighting={true}
            >
              {verseTapSelected ? (
                <Text style={selectionStyles.selected}>{segment.text}</Text>
              ) : (
                segment.text
              )}
            </Text>
          );
        }

        // Auto-highlight segment (lighter color + border)
        if (segment.autoHighlight) {
          const autoHighlightStyle = autoHighlightStyles[segment.autoHighlight.theme_color];
          const autoHighlight = segment.autoHighlight;

          // If segment contains selection, render with blue highlight on selected word
          if (selectionParts) {
            return (
              <Text
                key={segment.key}
                style={autoHighlightStyle}
                onPress={() => handleAutoHighlightPress(autoHighlight)}
                onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
                suppressHighlighting={true}
              >
                {selectionParts.before}
                <Text style={selectionStyles.selected}>{selectionParts.selected}</Text>
                {selectionParts.after}
              </Text>
            );
          }

          return (
            <Text
              key={segment.key}
              style={autoHighlightStyle}
              onPress={() => handleAutoHighlightPress(autoHighlight)}
              onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
              suppressHighlighting={true}
            >
              {verseTapSelected ? (
                <Text style={selectionStyles.selected}>{segment.text}</Text>
              ) : (
                segment.text
              )}
            </Text>
          );
        }

        // Plain text segment
        // If segment contains selection, render with blue highlight on selected word
        if (selectionParts) {
          return (
            <Text
              key={segment.key}
              onPress={handleVerseTap}
              onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
              suppressHighlighting={true}
            >
              {selectionParts.before}
              <Text style={selectionStyles.selected}>{selectionParts.selected}</Text>
              {selectionParts.after}
            </Text>
          );
        }

        return (
          <Text
            key={segment.key}
            onPress={handleVerseTap}
            onLongPress={(e) => detectWordFromLongPress(segment.text, segment.startChar, e)}
            suppressHighlighting={true}
          >
            {verseTapSelected ? (
              <Text style={selectionStyles.selected}>{segment.text}</Text>
            ) : (
              segment.text
            )}
          </Text>
        );
      })}
    </Text>
  );
}

/**
 * Styles for word selection highlight
 * Blue background similar to native text selection
 */
const selectionStyles = StyleSheet.create({
  selected: {
    backgroundColor: '#3390FF40', // Light blue with transparency
  },
});

/**
 * Lexicon-covered words. We can't rely on `textDecorationStyle: 'dotted'`
 * because Android silently falls back to solid, and `borderStyle: 'dotted'`
 * doesn't render on inline `<Text>` on Android. So we draw the underline
 * ourselves with an inline SVG element positioned beneath the word — works
 * the same on both platforms. Theme words get a slightly thicker stroke +
 * heavier weight so the chapter spine reads at a glance.
 */
const LEX_UNDERLINE = '#B09A6D';
const lexiconWordStyles = StyleSheet.create({
  // Word-text style (no textDecoration — the SVG draws the line)
  regular: {},
  theme: { fontWeight: '500' },
  // Outer wrapper: a positioning context for the absolutely-positioned SVG.
  // View nested inside <Text> is inline-block in RN; it auto-sizes to its
  // Text child after the first layout pass.
  wrapper: { position: 'relative' as const },
  svg: { position: 'absolute' as const, bottom: -2, left: 0 },
});

/**
 * Inline component that renders the lexicon word + an SVG dotted line
 * beneath. Measures its layout width on first paint, then re-renders the
 * SVG sized to that width. The 1-frame "no underline" flash on initial
 * mount is acceptable for a static verse renderer.
 */
function LexiconWord({
  text,
  isTheme,
  onPress,
  accessibilityLabel,
  selected,
}: {
  text: string;
  isTheme: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
}) {
  const [width, setWidth] = useState(0);

  return (
    <View
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w !== width) setWidth(w);
      }}
      style={lexiconWordStyles.wrapper}
    >
      <Text
        style={[
          isTheme ? lexiconWordStyles.theme : lexiconWordStyles.regular,
          selected ? selectionStyles.selected : null,
        ]}
        onPress={onPress}
        suppressHighlighting={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {text}
      </Text>
      {width > 0 ? (
        <Svg
          width={width}
          height={3}
          style={lexiconWordStyles.svg}
          pointerEvents="none"
        >
          <Line
            x1={0.5}
            y1={1.5}
            x2={width - 0.5}
            y2={1.5}
            stroke={LEX_UNDERLINE}
            strokeWidth={isTheme ? 1.5 : 1}
            strokeDasharray="1,2"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
