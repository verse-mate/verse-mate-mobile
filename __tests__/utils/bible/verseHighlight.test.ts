import { SEARCH_MARK_HIGHLIGHT_ID } from '@/utils/bible/searchMark';
import { highlightsTouching, wholeVerseHighlight } from '@/utils/bible/verseHighlight';

const h = (id: number, sv: number, ev: number, sc?: number | null, ec?: number | null) => ({
  highlight_id: id,
  start_verse: sv,
  end_verse: ev,
  start_char: sc,
  end_char: ec,
});

describe('wholeVerseHighlight', () => {
  it('finds a whole-verse highlight, and a multi-verse one for a verse inside it', () => {
    expect(wholeVerseHighlight([h(1, 5, 5)], 5, 40)?.highlight_id).toBe(1);
    expect(wholeVerseHighlight([h(2, 4, 6, 10, 3)], 5, 40)?.highlight_id).toBe(2);
  });

  it('counts a character range that spans the whole verse', () => {
    expect(wholeVerseHighlight([h(3, 5, 5, 0, 40)], 5, 40)?.highlight_id).toBe(3);
  });

  it('does not count a highlight of only some words', () => {
    expect(wholeVerseHighlight([h(4, 5, 5, 4, 9)], 5, 40)).toBeUndefined();
    // Starts part-way into this verse, ends in the next.
    expect(wholeVerseHighlight([h(5, 5, 6, 12, 8)], 5, 40)).toBeUndefined();
  });

  it('ignores other verses and the search mark', () => {
    expect(wholeVerseHighlight([h(6, 1, 4)], 5, 40)).toBeUndefined();
    expect(wholeVerseHighlight([h(SEARCH_MARK_HIGHLIGHT_ID, 5, 5)], 5, 40)).toBeUndefined();
  });
});

describe('highlightsTouching', () => {
  const sel = (sv: number, sc: number, ev: number, ec: number) => ({
    startVerse: sv,
    startChar: sc,
    endVerse: ev,
    endChar: ec,
  });

  it('finds a word highlight the selection overlaps, and a whole-verse one', () => {
    expect(
      highlightsTouching([h(1, 5, 5, 4, 9)], sel(5, 7, 5, 12)).map((x) => x.highlight_id)
    ).toEqual([1]);
    expect(highlightsTouching([h(2, 5, 5)], sel(5, 30, 5, 34)).map((x) => x.highlight_id)).toEqual([
      2,
    ]);
  });

  it('leaves out highlights that only sit next to the selection', () => {
    // Highlight ends at 9 (exclusive); selection starts at 9.
    expect(highlightsTouching([h(3, 5, 5, 4, 9)], sel(5, 9, 5, 14))).toEqual([]);
    expect(highlightsTouching([h(4, 6, 6)], sel(5, 0, 5, 40))).toEqual([]);
  });

  it('crosses verses, and ignores the search mark', () => {
    expect(
      highlightsTouching([h(5, 4, 6, 10, 3)], sel(5, 2, 5, 6)).map((x) => x.highlight_id)
    ).toEqual([5]);
    expect(highlightsTouching([h(SEARCH_MARK_HIGHLIGHT_ID, 5, 5)], sel(5, 0, 5, 4))).toEqual([]);
  });
});
