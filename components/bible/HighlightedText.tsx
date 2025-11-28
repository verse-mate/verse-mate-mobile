/**
 * HighlightedText Component
 *
 * Renders Bible verse text with semi-transparent highlight backgrounds.
 * Handles tap detection for highlighted vs non-highlighted text.
 * Supports text selection for creating new highlights.
 *
 * Features:
 * - Semi-transparent highlight backgrounds (no borders/underlines)
 * - Character-level precision highlighting
 * - Multiple non-overlapping highlights per verse
 * - Long-press detection on highlighted regions (edit)
 * - Long-press detection on plain text (create new highlight for entire verse)
 * - Theme-aware highlight colors (brighter in dark mode)
 *
 * Note: Native text selection (onSelectionChange) is not reliable in React Native
 * for Text components. We use long-press on plain text to trigger verse highlighting.
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md
 * @see Visual: after-selected-text-popup.png (highlighted text appearance)
 */

import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
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
  /** Callback when highlighted text is long-pressed (edit highlight) */
  onHighlightPress?: (highlightId: number) => void;
  /** Callback when auto-highlight is pressed (show info tooltip) */
  onAutoHighlightPress?: (autoHighlight: AutoHighlight) => void;
  /** Callback when plain text is long-pressed (create new highlight for entire verse) */
  onVerseLongPress?: (verseNumber: number) => void;
  /** Style override for base text */
  style?: TextProps['style'];
}

/**
 * HighlightedText Component
 *
 * Renders verse text with highlights as semi-transparent backgrounds.
 * Segments text based on highlight character positions for precise rendering.
 */
export function HighlightedText({
  text,
  verseNumber,
  highlights = [],
  autoHighlights = [],
  onHighlightPress,
  onAutoHighlightPress,
  onVerseLongPress,
  style,
  ...textProps
}: HighlightedTextProps) {
  // Get current theme mode for highlight color selection
  const { mode } = useTheme();

  /**
   * Segment verse text based on highlights and auto-highlights
   * Creates array of text segments, some highlighted, some auto-highlighted, some plain
   * User highlights take precedence over auto-highlights
   */
  const segments = useMemo(() => {
    // Filter highlights relevant to this verse
    const verseHighlights = highlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    const verseAutoHighlights = autoHighlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    // If no highlights or auto-highlights, return plain text
    if (verseHighlights.length === 0 && verseAutoHighlights.length === 0) {
      return [{ text, highlight: null, autoHighlight: null, startChar: 0, endChar: text.length }];
    }

    // Process user highlights first (they take precedence)
    // Sort highlights by start position
    const sortedHighlights = [...verseHighlights].sort((a, b) => {
      const aStart = (a.start_char ?? 0) as number;
      const bStart = (b.start_char ?? 0) as number;
      return aStart - bStart;
    });

    const textSegments: TextSegment[] = [];
    let currentPosition = 0;

    // Track which character positions are covered by user highlights
    const userHighlightedRanges: { start: number; end: number }[] = [];

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

      userHighlightedRanges.push({ start: highlightStart, end: highlightEnd });

      // Add plain text or auto-highlighted segment before user highlight (if any)
      if (currentPosition < highlightStart) {
        // Check if this range overlaps with any auto-highlights
        const autoHighlightInRange = verseAutoHighlights.find((ah) => {
          // Auto-highlights are always full verses (no character-level precision)
          return ah.start_verse <= verseNumber && ah.end_verse >= verseNumber;
        });

        if (autoHighlightInRange) {
          textSegments.push({
            text: text.slice(currentPosition, highlightStart),
            highlight: null,
            autoHighlight: autoHighlightInRange,
            startChar: currentPosition,
            endChar: highlightStart,
          });
        } else {
          textSegments.push({
            text: text.slice(currentPosition, highlightStart),
            highlight: null,
            autoHighlight: null,
            startChar: currentPosition,
            endChar: highlightStart,
          });
        }
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

      if (autoHighlightInRange) {
        textSegments.push({
          text: text.slice(currentPosition),
          highlight: null,
          autoHighlight: autoHighlightInRange,
          startChar: currentPosition,
          endChar: text.length,
        });
      } else {
        textSegments.push({
          text: text.slice(currentPosition),
          highlight: null,
          autoHighlight: null,
          startChar: currentPosition,
          endChar: text.length,
        });
      }
    }

    return textSegments;
  }, [text, highlights, autoHighlights, verseNumber]);

  /**
   * Handle tap on a text segment
   * Different behavior for user highlights vs auto-highlights
   */
  const handleSegmentPress = (segment: TextSegment) => {
    if (segment.highlight && onHighlightPress) {
      // Haptic feedback on highlighted text tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onHighlightPress(segment.highlight.highlight_id);
    } else if (segment.autoHighlight && onAutoHighlightPress) {
      // Haptic feedback on auto-highlight tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAutoHighlightPress(segment.autoHighlight);
    }
  };

  /**
   * Handle long-press on plain text (non-highlighted)
   * Opens highlight creation sheet for entire verse
   */
  const handleVerseLongPress = async () => {
    if (!onVerseLongPress) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVerseLongPress(verseNumber);
  };

  return (
    <Text
      style={style}
      onLongPress={handleVerseLongPress}
      // TODO: Temporary disable - native text selection shows immediately on any touch/scroll
      // Consider building custom text selection UI with 300ms delay to prevent accidental triggers
      selectable={false}
      suppressHighlighting={true}
      {...textProps}
    >
      {segments.map((segment) => {
        // Use startChar and endChar for stable, unique keys
        const segmentKey = segment.highlight
          ? `highlight-${segment.highlight.highlight_id}-${segment.startChar}-${segment.endChar}`
          : segment.autoHighlight
            ? `auto-highlight-${segment.autoHighlight.auto_highlight_id}-${segment.startChar}-${segment.endChar}`
            : `text-${verseNumber}-${segment.startChar}-${segment.endChar}`;

        // User highlight segment (solid color)
        if (segment.highlight) {
          // Use theme-aware highlight color
          const backgroundColor = getHighlightColor(segment.highlight.color, mode);
          const highlightStyle = {
            backgroundColor:
              backgroundColor +
              Math.round(HIGHLIGHT_OPACITY * 255)
                .toString(16)
                .padStart(2, '0'),
          };

          return (
            <Text
              key={segmentKey}
              style={highlightStyle}
              onLongPress={() => handleSegmentPress(segment)}
              suppressHighlighting={true}
            >
              {segment.text}
            </Text>
          );
        }

        // Auto-highlight segment (lighter color + border)
        if (segment.autoHighlight) {
          // Use theme-aware highlight color for auto-highlights too
          const backgroundColor = getHighlightColor(segment.autoHighlight.theme_color, mode);
          const autoHighlightStyle = {
            backgroundColor:
              backgroundColor +
              Math.round(AUTO_HIGHLIGHT_OPACITY * 255)
                .toString(16)
                .padStart(2, '0'),
            borderBottomWidth: 2,
            borderBottomColor:
              backgroundColor +
              Math.round(0.5 * 255)
                .toString(16)
                .padStart(2, '0'),
          };

          return (
            <Text
              key={segmentKey}
              style={autoHighlightStyle}
              onPress={() => handleSegmentPress(segment)}
              suppressHighlighting={true}
            >
              {segment.text}
            </Text>
          );
        }

        // Plain text segment
        return (
          <Text key={segmentKey} suppressHighlighting={true}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
