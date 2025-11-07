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
import { HIGHLIGHT_COLORS } from '@/constants/highlight-colors';
import type { Highlight } from '@/hooks/bible/use-highlights';

/**
 * Opacity value for highlight backgrounds
 * Ensures text readability while providing visible color indication
 * Based on WCAG contrast guidelines for overlays
 */
const HIGHLIGHT_OPACITY = 0.35;

/**
 * Text segment representing a portion of verse text
 * Can be highlighted or plain text
 */
interface TextSegment {
  /** Text content of this segment */
  text: string;
  /** Highlight associated with this segment (if highlighted) */
  highlight: Highlight | null;
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
  /** Highlights that apply to this verse */
  highlights?: Highlight[];
  /** Callback when highlighted text is long-pressed (edit highlight) */
  onHighlightPress?: (highlightId: number) => void;
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
  onHighlightPress,
  onVerseLongPress,
  style,
  ...textProps
}: HighlightedTextProps) {
  /**
   * Segment verse text based on highlights
   * Creates array of text segments, some highlighted, some plain
   */
  const segments = useMemo(() => {
    if (highlights.length === 0) {
      return [{ text, highlight: null, startChar: 0, endChar: text.length }];
    }

    // Filter highlights relevant to this verse
    const verseHighlights = highlights.filter(
      (h) => h.start_verse <= verseNumber && h.end_verse >= verseNumber
    );

    if (verseHighlights.length === 0) {
      return [{ text, highlight: null, startChar: 0, endChar: text.length }];
    }

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

      // Add plain text segment before highlight (if any)
      if (currentPosition < highlightStart) {
        textSegments.push({
          text: text.slice(currentPosition, highlightStart),
          highlight: null,
          startChar: currentPosition,
          endChar: highlightStart,
        });
      }

      // Add highlighted segment
      textSegments.push({
        text: text.slice(highlightStart, highlightEnd),
        highlight,
        startChar: highlightStart,
        endChar: highlightEnd,
      });

      currentPosition = highlightEnd;
    }

    // Add remaining plain text (if any)
    if (currentPosition < text.length) {
      textSegments.push({
        text: text.slice(currentPosition),
        highlight: null,
        startChar: currentPosition,
        endChar: text.length,
      });
    }

    return textSegments;
  }, [text, highlights, verseNumber]);

  /**
   * Handle tap on a text segment
   */
  const handleSegmentPress = (segment: TextSegment) => {
    if (segment.highlight && onHighlightPress) {
      // Haptic feedback on highlighted text tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onHighlightPress(segment.highlight.highlight_id);
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
          : `text-${verseNumber}-${segment.startChar}-${segment.endChar}`;

        if (segment.highlight) {
          const backgroundColor = HIGHLIGHT_COLORS[segment.highlight.color];
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
              // TODO: Temporary disable - prevents native selection UI on touch/scroll
              suppressHighlighting={true}
            >
              {segment.text}
            </Text>
          );
        }

        // Plain text segment
        return (
          // TODO: Temporary disable - prevents native selection UI on touch/scroll
          <Text key={segmentKey} suppressHighlighting={true}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
