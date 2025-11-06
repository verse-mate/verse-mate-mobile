/**
 * Text Selection Utilities
 *
 * Helper functions for calculating character positions and handling
 * text selection across verse boundaries for Bible highlighting.
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md
 */

import type { TextSelection } from '@/components/bible/HighlightedText';

/**
 * Verse text information for selection calculations
 */
export interface VerseInfo {
  verseNumber: number;
  text: string;
}

/**
 * Selection span across multiple verses
 */
export interface SelectionSpan {
  /** First verse in selection */
  startVerse: number;
  /** Last verse in selection */
  endVerse: number;
  /** Character position in start verse (0-indexed) */
  startChar: number;
  /** Character position in end verse (0-indexed) */
  endChar: number;
  /** Full selected text across all verses */
  selectedText: string;
}

/**
 * Calculate character position within a specific verse
 *
 * @param verseText - The text of the verse
 * @param absolutePosition - Absolute character position from selection start
 * @returns Character position relative to verse start (0-indexed)
 *
 * @example
 * const verseText = "In the beginning God created the heavens and the earth.";
 * const position = calculateCharPosition(verseText, 7);
 * // Returns: 7 (position of "b" in "beginning")
 */
export function calculateCharPosition(verseText: string, absolutePosition: number): number {
  // Clamp to verse boundaries
  return Math.max(0, Math.min(absolutePosition, verseText.length));
}

/**
 * Calculate selection span across multiple verses
 *
 * When user selects text spanning multiple verses, this calculates
 * the verse-relative character positions for each boundary.
 *
 * @param verses - Array of verse information (ordered by verse number)
 * @param startVerseNumber - Verse number where selection starts
 * @param endVerseNumber - Verse number where selection ends
 * @param startPosition - Character position in start verse (0-indexed)
 * @param endPosition - Character position in end verse (0-indexed)
 * @returns Selection span with verse-relative positions
 *
 * @example
 * const verses = [
 *   { verseNumber: 1, text: "In the beginning..." },
 *   { verseNumber: 2, text: "The earth was formless..." }
 * ];
 * const span = calculateMultiVerseSelection(verses, 1, 2, 10, 20);
 * // Returns: { startVerse: 1, endVerse: 2, startChar: 10, endChar: 20, selectedText: "..." }
 */
export function calculateMultiVerseSelection(
  verses: VerseInfo[],
  startVerseNumber: number,
  endVerseNumber: number,
  startPosition: number,
  endPosition: number
): SelectionSpan {
  const startVerse = verses.find((v) => v.verseNumber === startVerseNumber);
  const endVerse = verses.find((v) => v.verseNumber === endVerseNumber);

  if (!startVerse || !endVerse) {
    throw new Error(`Verses ${startVerseNumber} or ${endVerseNumber} not found`);
  }

  // Calculate character positions relative to verse boundaries
  const startChar = calculateCharPosition(startVerse.text, startPosition);
  const endChar = calculateCharPosition(endVerse.text, endPosition);

  // Build selected text across verses
  let selectedText = '';

  for (let i = startVerseNumber; i <= endVerseNumber; i++) {
    const verse = verses.find((v) => v.verseNumber === i);
    if (!verse) continue;

    if (i === startVerseNumber && i === endVerseNumber) {
      // Single verse selection
      selectedText = verse.text.slice(startChar, endChar);
    } else if (i === startVerseNumber) {
      // First verse of multi-verse selection
      selectedText += `${verse.text.slice(startChar)} `;
    } else if (i === endVerseNumber) {
      // Last verse of multi-verse selection
      selectedText += verse.text.slice(0, endChar);
    } else {
      // Middle verse of multi-verse selection
      selectedText += `${verse.text} `;
    }
  }

  return {
    startVerse: startVerseNumber,
    endVerse: endVerseNumber,
    startChar,
    endChar,
    selectedText: selectedText.trim(),
  };
}

/**
 * Extract selection information from Text component selection event
 *
 * @param selection - Selection object from Text onSelectionChange event
 * @param verseText - Full text of the verse
 * @returns TextSelection with start, end, and selected text
 */
export function extractTextSelection(
  selection: { start: number; end: number },
  verseText: string
): TextSelection {
  const { start, end } = selection;
  const normalizedStart = Math.max(0, Math.min(start, verseText.length));
  const normalizedEnd = Math.max(0, Math.min(end, verseText.length));

  return {
    start: normalizedStart,
    end: normalizedEnd,
    text: verseText.slice(normalizedStart, normalizedEnd),
  };
}

/**
 * Validate that a selection does not overlap with existing highlights
 *
 * This is a client-side pre-check. Backend also enforces overlap detection.
 *
 * @param startVerse - Start verse of new selection
 * @param endVerse - End verse of new selection
 * @param startChar - Start character position
 * @param endChar - End character position
 * @param existingHighlights - Array of existing highlights to check against
 * @returns True if selection overlaps with existing highlight, false otherwise
 */
export function checkSelectionOverlap(
  startVerse: number,
  endVerse: number,
  startChar: number,
  endChar: number,
  existingHighlights: {
    start_verse: number;
    end_verse: number;
    start_char: number | null;
    end_char: number | null;
  }[]
): boolean {
  return existingHighlights.some((highlight) => {
    // Check verse range overlap
    const verseOverlap = highlight.start_verse <= endVerse && highlight.end_verse >= startVerse;

    if (!verseOverlap) return false;

    // If highlight has character-level precision, check character overlap
    if (highlight.start_char !== null && highlight.end_char !== null) {
      // Single verse comparison
      if (
        startVerse === endVerse &&
        highlight.start_verse === highlight.end_verse &&
        startVerse === highlight.start_verse
      ) {
        return (
          (highlight.start_char as number) < endChar && (highlight.end_char as number) > startChar
        );
      }

      // Multi-verse comparison - any verse overlap counts as character overlap
      return true;
    }

    // No character-level precision - verse overlap is enough
    return true;
  });
}

/**
 * Format verse range for display in UI
 *
 * @param startVerse - Start verse number
 * @param endVerse - End verse number
 * @returns Formatted string like "Verse 1" or "Verses 1-5"
 *
 * @example
 * formatVerseRange(1, 1) // "Verse 1"
 * formatVerseRange(1, 5) // "Verses 1-5"
 */
export function formatVerseRange(startVerse: number, endVerse: number): string {
  if (startVerse === endVerse) {
    return `Verse ${startVerse}`;
  }
  return `Verses ${startVerse}-${endVerse}`;
}
