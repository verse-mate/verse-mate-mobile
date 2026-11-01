import { SEARCH_MARK_HIGHLIGHT_ID } from '@/utils/bible/searchMark';

interface HighlightSpan {
  highlight_id: number;
  start_verse: number;
  end_verse: number;
  start_char?: unknown;
  end_char?: unknown;
}

/**
 * The user highlight that covers a whole verse, if one does.
 *
 * A tap on a verse opens its Verse Insight; when the verse is highlighted that sheet must offer
 * "Remove from my highlights", not "Save as my highlight", wherever in the verse the finger landed
 * (Sebastian, 2026-11-01). A highlight of only some words covers the verse only where it is, so it
 * does not count here: a tap on those words is resolved to it directly.
 */
export function wholeVerseHighlight<T extends HighlightSpan>(
  highlights: T[],
  verseNumber: number,
  verseTextLength: number
): T | undefined {
  return highlights.find((h) => {
    if (h.highlight_id === SEARCH_MARK_HIGHLIGHT_ID) return false;
    if (h.start_verse > verseNumber || h.end_verse < verseNumber) return false;
    const startChar = typeof h.start_char === 'number' ? h.start_char : null;
    const endChar = typeof h.end_char === 'number' ? h.end_char : null;
    const fromStart = h.start_verse < verseNumber || startChar === null || startChar <= 0;
    const toEnd = h.end_verse > verseNumber || endChar === null || endChar >= verseTextLength;
    return fromStart && toEnd;
  });
}

interface SelectionSpan {
  startVerse: number;
  startChar: number;
  endVerse: number;
  endChar: number;
}

/**
 * The user highlights a selection touches, for the highlight sheet's Remove (Andy, 2026-11-02:
 * web's highlight toolbar has a delete; the mobile sheet had none). Positions compare as
 * (verse, character); a highlight without character offsets covers its verses whole.
 */
export function highlightsTouching<T extends HighlightSpan>(
  highlights: T[],
  selection: SelectionSpan
): T[] {
  const before = (av: number, ac: number, bv: number, bc: number) =>
    av < bv || (av === bv && ac < bc);
  return highlights.filter((h) => {
    if (h.highlight_id === SEARCH_MARK_HIGHLIGHT_ID) return false;
    const hStartChar = typeof h.start_char === 'number' ? h.start_char : 0;
    const hEndChar = typeof h.end_char === 'number' ? h.end_char : Number.POSITIVE_INFINITY;
    // Overlap: the highlight starts before the selection ends, and the selection starts before
    // the highlight ends.
    return (
      before(h.start_verse, hStartChar, selection.endVerse, selection.endChar) &&
      before(selection.startVerse, selection.startChar, h.end_verse, hEndChar)
    );
  });
}
