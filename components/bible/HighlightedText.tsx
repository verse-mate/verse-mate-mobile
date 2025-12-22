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
 * - Long-press on individual word opens dictionary lookup
 * - Theme-aware highlight colors (brighter in dark mode)
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md
 * @see Visual: after-selected-text-popup.png (highlighted text appearance)
 */

import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
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
}

/**
 * Token representing a word or non-word (whitespace/punctuation)
 */
interface TextToken {
  /** The token text */
  token: string;
  /** Whether this token is a word (contains alphanumeric characters) */
  isWord: boolean;
  /** Unique key for React */
  key: string;
}

/**
 * Processed segment with pre-tokenized text
 */
interface ProcessedSegment {
  segment: TextSegment;
  tokens: TextToken[];
  segmentKey: string;
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
 * Tokenize text into words and non-words (whitespace/punctuation)
 * Preserves exact spacing and punctuation for proper rendering
 */
function tokenizeText(text: string, segmentKey: string): TextToken[] {
  // Split on word boundaries, keeping all parts
  // This regex splits on transitions between word chars (\w) and non-word chars
  const parts = text.split(/(\s+|[^\w\s]+)/);

  return parts
    .filter((part) => part.length > 0)
    .map((token, idx) => ({
      token,
      isWord: /\w/.test(token), // Contains at least one alphanumeric character
      key: `${segmentKey}-${idx}`,
    }));
}

/**
 * HighlightedText Component
 *
 * Renders verse text with highlights as semi-transparent backgrounds.
 * Segments text based on highlight character positions for precise rendering.
 * Each word is wrapped in its own Text component for precise long-press detection.
 *
 * Optimized with React.memo and useMemo for performance.
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

  /**
   * Process segments and tokenize text - all memoized together
   * This is the main optimization: compute everything once when dependencies change
   */
  const processedSegments = useMemo((): ProcessedSegment[] => {
    // Filter highlights relevant to this verse
    const verseHighlights = highlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    const verseAutoHighlights = autoHighlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    // Build segments
    let segments: TextSegment[];

    // If no highlights or auto-highlights, return plain text
    if (verseHighlights.length === 0 && verseAutoHighlights.length === 0) {
      segments = [
        { text, highlight: null, autoHighlight: null, startChar: 0, endChar: text.length },
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

          textSegments.push({
            text: text.slice(currentPosition, highlightStart),
            highlight: null,
            autoHighlight: autoHighlightInRange || null,
            startChar: currentPosition,
            endChar: highlightStart,
          });
        }

        // Add user highlighted segment
        textSegments.push({
          text: text.slice(highlightStart, highlightEnd),
          highlight,
          autoHighlight: null, // User highlights take precedence
          startChar: highlightStart,
          endChar: highlightEnd,
        });

        currentPosition = highlightEnd;
      }

      // Add remaining text (plain or auto-highlighted)
      if (currentPosition < text.length) {
        // Check if remaining text should be auto-highlighted
        const autoHighlightInRange = verseAutoHighlights.find((ah) => {
          return ah.start_verse <= verseNumber && ah.end_verse >= verseNumber;
        });

        textSegments.push({
          text: text.slice(currentPosition),
          highlight: null,
          autoHighlight: autoHighlightInRange || null,
          startChar: currentPosition,
          endChar: text.length,
        });
      }

      segments = textSegments;
    }

    // Now tokenize each segment and create processed segments
    return segments.map((segment) => {
      const segmentKey = segment.highlight
        ? `highlight-${segment.highlight.highlight_id}-${segment.startChar}-${segment.endChar}`
        : segment.autoHighlight
          ? `auto-highlight-${segment.autoHighlight.auto_highlight_id}-${segment.startChar}-${segment.endChar}`
          : `text-${verseNumber}-${segment.startChar}-${segment.endChar}`;

      return {
        segment,
        tokens: tokenizeText(segment.text, segmentKey),
        segmentKey,
      };
    });
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
   * Handle long-press on a word
   * Opens word definition dictionary
   */
  const handleWordLongPress = useCallback(
    (word: string) => {
      if (!onWordLongPress) return;
      // Clean trailing punctuation from word
      const cleanWord = word.replace(/[.,;:!?"']+$/, '');
      if (!cleanWord) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onWordLongPress(verseNumber, cleanWord);
    },
    [onWordLongPress, verseNumber]
  );

  /**
   * Memoized highlight styles
   */
  const highlightStyles = useMemo(() => {
    const styles: Record<string, { backgroundColor: string }> = {};
    for (const { segment } of processedSegments) {
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
  }, [processedSegments, mode]);

  /**
   * Memoized auto-highlight styles
   */
  const autoHighlightStyles = useMemo(() => {
    const styles: Record<
      string,
      { backgroundColor: string; borderBottomWidth: number; borderBottomColor: string }
    > = {};
    for (const { segment } of processedSegments) {
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
  }, [processedSegments, mode]);

  return (
    <Text style={style} selectable={false} suppressHighlighting={true} {...textProps}>
      {processedSegments.map(({ segment, tokens, segmentKey }) => {
        // User highlight segment (solid color)
        if (segment.highlight) {
          const highlightStyle = highlightStyles[segment.highlight.color];
          const onPressHandler = () => {
            if (segment.highlight?.highlight_id !== undefined) {
              handleHighlightTap(segment.highlight.highlight_id);
            }
          };

          return (
            <Text key={segmentKey} suppressHighlighting={true}>
              {tokens.map((token) => (
                <Text
                  key={token.key}
                  style={highlightStyle}
                  onPress={onPressHandler}
                  onLongPress={token.isWord ? () => handleWordLongPress(token.token) : undefined}
                  suppressHighlighting={true}
                >
                  {token.token}
                </Text>
              ))}
            </Text>
          );
        }

        // Auto-highlight segment (lighter color + border)
        if (segment.autoHighlight) {
          const autoHighlightStyle = autoHighlightStyles[segment.autoHighlight.theme_color];
          const onPressHandler = () => {
            /* biome-ignore lint/style/noNonNullAssertion: Guarded by if (segment.autoHighlight) check */
            handleAutoHighlightPress(segment.autoHighlight!);
          };

          return (
            <Text key={segmentKey} suppressHighlighting={true}>
              {tokens.map((token) => (
                <Text
                  key={token.key}
                  style={autoHighlightStyle}
                  onPress={onPressHandler}
                  onLongPress={token.isWord ? () => handleWordLongPress(token.token) : undefined}
                  suppressHighlighting={true}
                >
                  {token.token}
                </Text>
              ))}
            </Text>
          );
        }

        // Plain text segment
        return (
          <Text key={segmentKey} suppressHighlighting={true}>
            {tokens.map((token) => (
              <Text
                key={token.key}
                onPress={handleVerseTap}
                onLongPress={token.isWord ? () => handleWordLongPress(token.token) : undefined}
                suppressHighlighting={true}
              >
                {token.token}
              </Text>
            ))}
          </Text>
        );
      })}
    </Text>
  );
});
