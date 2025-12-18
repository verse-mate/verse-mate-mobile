/**
 * Group Consecutive Highlights Utility
 *
 * Groups consecutive user highlights with the same color into logical groups.
 * Used to display grouped manual highlight tooltip when user taps on a
 * sequence of highlighted verses.
 */

import type { HighlightColor } from '@/constants/highlight-colors';
import type { Highlight } from '@/hooks/bible/use-highlights';

/**
 * Represents a group of consecutive highlights
 */
export interface HighlightGroup {
  /** Array of highlights in this group */
  highlights: Highlight[];
  /** Starting verse number */
  startVerse: number;
  /** Ending verse number */
  endVerse: number;
  /** Color shared by all highlights in group */
  color: HighlightColor;
  /** Whether this group contains multiple verses (true) or single verse (false) */
  isGrouped: boolean;
}

/**
 * Groups consecutive user highlights by color
 *
 * Algorithm:
 * 1. Filters out highlights with character-level precision (start_char/end_char)
 * 2. Sorts remaining highlights by verse number
 * 3. Groups consecutive verses with same color
 * 4. Only creates groups if ALL verses in range are highlighted (no gaps)
 *
 * @param highlights - Array of user highlights for a chapter
 * @returns Array of highlight groups
 *
 * @example
 * ```ts
 * const highlights = [
 *   { start_verse: 1, end_verse: 1, color: 'yellow', ... },
 *   { start_verse: 2, end_verse: 2, color: 'yellow', ... },
 *   { start_verse: 3, end_verse: 3, color: 'yellow', ... },
 *   { start_verse: 5, end_verse: 5, color: 'blue', ... }
 * ];
 *
 * const groups = groupConsecutiveHighlights(highlights);
 * // Returns:
 * // [
 * //   { highlights: [...], startVerse: 1, endVerse: 3, color: 'yellow', isGrouped: true },
 * //   { highlights: [...], startVerse: 5, endVerse: 5, color: 'blue', isGrouped: false }
 * // ]
 * ```
 */
export function groupConsecutiveHighlights(highlights: Highlight[]): HighlightGroup[] {
  // Filter to only full-verse highlights
  // A highlight is considered "full verse" if:
  // 1. Both start_char and end_char are null (new style), OR
  // 2. start_char is 0 (likely full verse, even if end_char is set - old style)
  const fullVerseHighlights = highlights.filter(
    (h) =>
      (h.start_char === null && h.end_char === null) || // New style: no char positions
      (h.start_char === 0 && h.end_char !== null) // Old style: starts at 0, has end position
  );

  // Sort by start verse
  const sorted = [...fullVerseHighlights].sort((a, b) => a.start_verse - b.start_verse);

  if (sorted.length === 0) {
    return [];
  }

  const groups: HighlightGroup[] = [];
  let currentGroup: Highlight[] = [sorted[0]];
  let currentColor = sorted[0].color;
  let currentStartVerse = sorted[0].start_verse;

  for (let i = 1; i < sorted.length; i++) {
    const highlight = sorted[i];
    const prevHighlight = sorted[i - 1];

    // Check if this highlight is consecutive/contiguous and same color
    // Handles both single-verse and multi-verse highlights
    const isConsecutive = highlight.start_verse <= prevHighlight.end_verse + 1;
    const isSameColor = highlight.color === currentColor;

    if (isConsecutive && isSameColor) {
      // Add to current group
      currentGroup.push(highlight);
    } else {
      // Finalize current group and start new one
      // Use max end_verse from all highlights in the group
      const groupEndVerse = Math.max(...currentGroup.map((h) => h.end_verse));
      groups.push({
        highlights: currentGroup,
        startVerse: currentStartVerse,
        endVerse: groupEndVerse,
        color: currentColor,
        isGrouped: currentGroup.length > 1,
      });

      // Start new group
      currentGroup = [highlight];
      currentColor = highlight.color;
      currentStartVerse = highlight.start_verse;
    }
  }

  // Finalize last group
  // Use max end_verse from all highlights in the group
  const groupEndVerse = Math.max(...currentGroup.map((h) => h.end_verse));
  groups.push({
    highlights: currentGroup,
    startVerse: currentStartVerse,
    endVerse: groupEndVerse,
    color: currentColor,
    isGrouped: currentGroup.length > 1,
  });

  return groups;
}

/**
 * Finds the highlight group that contains a specific verse number
 *
 * @param groups - Array of highlight groups
 * @param verseNumber - Verse number to find
 * @returns The highlight group containing the verse, or null if not found
 */
export function findGroupByVerse(
  groups: HighlightGroup[],
  verseNumber: number
): HighlightGroup | null {
  return (
    groups.find((group) => verseNumber >= group.startVerse && verseNumber <= group.endVerse) || null
  );
}

/**
 * Finds the highlight group that contains a specific highlight ID
 *
 * @param groups - Array of highlight groups
 * @param highlightId - Highlight ID to find
 * @returns The highlight group containing the highlight, or null if not found
 */
export function findGroupByHighlightId(
  groups: HighlightGroup[],
  highlightId: number
): HighlightGroup | null {
  return (
    groups.find((group) => group.highlights.some((h) => h.highlight_id === highlightId)) || null
  );
}
