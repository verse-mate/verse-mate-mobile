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
import { memo, useCallback, useMemo, useRef } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  Text,
  type TextLayoutEventData,
  type TextProps,
} from 'react-native';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import type { Highlight } from '@/hooks/bible/use-highlights';
import type { AutoHighlight } from '@/types/auto-highlights';

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
  /** Callback when a word is long-pressed (for dictionary lookup) */
  onWordLongPress?: (verseNumber: number, word: string) => void;
  /** Style override for base text */
  style?: TextProps['style'];
}

/**
 * Extract the word at a given character index from text
 * Expands from the index to find word boundaries
 */
function extractWordAtIndex(text: string, charIndex: number): string | null {
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
  return word.length > 0 && /\w/.test(word) ? word : null;
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
export const HighlightedText = memo(function HighlightedText({
  text,
  verseNumber,
  highlights = [],
  autoHighlights = [],
  onHighlightTap,
  onAutoHighlightPress,
  onVerseTap,
  onWordLongPress,
  style,
  ...textProps
}: HighlightedTextProps) {
  // Get current theme mode for highlight color selection
  const { mode } = useTheme();

  // Track text layout for coordinate-based word detection
  const textLayoutRef = useRef<TextLayoutLine[]>([]);
  const containerWidthRef = useRef<number>(0);

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
   * Shows grouped/single highlight tooltip
   */
  const handleHighlightTap = useCallback(
    (highlightId: number) => {
      if (!onHighlightTap) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onHighlightTap(highlightId);
    },
    [onHighlightTap]
  );

  /**
   * Handle tap on auto-highlight segment
   * Shows auto-highlight tooltip
   */
  const handleAutoHighlightPress = useCallback(
    (autoHighlight: AutoHighlight) => {
      if (!onAutoHighlightPress) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAutoHighlightPress(autoHighlight);
    },
    [onAutoHighlightPress]
  );

  /**
   * Handle tap on plain text
   * Shows verse insight tooltip
   */
  const handleVerseTap = useCallback(() => {
    if (!onVerseTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onVerseTap(verseNumber);
  }, [onVerseTap, verseNumber]);

  /**
   * Handle text layout event to track line information
   * Used for coordinate-based word detection on long-press
   */
  const handleTextLayout = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    textLayoutRef.current = event.nativeEvent.lines as TextLayoutLine[];
  }, []);

  /**
   * Handle container layout to track width
   * Used for character width estimation
   */
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    containerWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  /**
   * Detect word from long-press coordinates within a segment
   * Uses text layout and character position estimation
   */
  const detectWordFromLongPress = useCallback(
    (segmentText: string, event: GestureResponderEvent) => {
      if (!onWordLongPress) return;

      const { locationX } = event.nativeEvent;

      // Estimate character position based on location
      // Use segment width and character count for approximation
      const avgCharWidth =
        containerWidthRef.current > 0 && segmentText.length > 0
          ? containerWidthRef.current / text.length
          : DEFAULT_CHAR_WIDTH;

      const charIndex = Math.floor(locationX / avgCharWidth);
      const word = extractWordAtIndex(segmentText, charIndex);

      if (word) {
        // Clean trailing punctuation from word
        const cleanWord = word.replace(/[.,;:!?"']+$/, '').replace(/^[.,;:!?"']+/, '');
        if (cleanWord) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onWordLongPress(verseNumber, cleanWord);
        }
      }
    },
    [onWordLongPress, verseNumber, text.length]
  );

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

  return (
    <Text
      style={style}
      selectable={false}
      suppressHighlighting={true}
      onTextLayout={handleTextLayout}
      onLayout={handleLayout}
      {...textProps}
    >
      {segments.map((segment) => {
        // User highlight segment (solid color)
        if (segment.highlight) {
          const highlightStyle = highlightStyles[segment.highlight.color];
          const highlightId = segment.highlight.highlight_id;

          return (
            <Text
              key={segment.key}
              style={highlightStyle}
              onPress={() => handleHighlightTap(highlightId)}
              onLongPress={(e) => detectWordFromLongPress(segment.text, e)}
              suppressHighlighting={true}
            >
              {segment.text}
            </Text>
          );
        }

        // Auto-highlight segment (lighter color + border)
        if (segment.autoHighlight) {
          const autoHighlightStyle = autoHighlightStyles[segment.autoHighlight.theme_color];
          const autoHighlight = segment.autoHighlight;

          return (
            <Text
              key={segment.key}
              style={autoHighlightStyle}
              onPress={() => handleAutoHighlightPress(autoHighlight)}
              onLongPress={(e) => detectWordFromLongPress(segment.text, e)}
              suppressHighlighting={true}
            >
              {segment.text}
            </Text>
          );
        }

        // Plain text segment
        return (
          <Text
            key={segment.key}
            onPress={handleVerseTap}
            onLongPress={(e) => detectWordFromLongPress(segment.text, e)}
            suppressHighlighting={true}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
});
