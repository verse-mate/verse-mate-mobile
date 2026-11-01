import { SEARCH_MARK_HIGHLIGHT_ID } from '@/utils/bible/searchMark';
import { wholeVerseHighlight } from '@/utils/bible/verseHighlight';

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
