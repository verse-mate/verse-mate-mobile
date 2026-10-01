/**
 * The reader's paragraph rule, now shared with the Jesus passages so both
 * break scripture in the same places.
 */
import { calculateBreakPoints, groupIntoParagraphs } from '@/lib/text/paragraph-breaks';

const v = (verseNumber: number, text: string) => ({ verseNumber, text });

describe('paragraph breaks', () => {
  it('never breaks three verses or fewer', () => {
    expect(calculateBreakPoints([v(1, 'a.'), v(2, 'Then b.'), v(3, 'Now c.')])).toEqual([]);
  });

  it('caps a paragraph at five verses', () => {
    const verses = [1, 2, 3, 4, 5, 6, 7].map((n) => v(n, `word ${n},`));
    expect(calculateBreakPoints(verses)).toEqual([5]);
  });

  it('breaks early at a sentence end followed by a transition word', () => {
    const verses = [v(1, 'a,'), v(2, 'b.'), v(3, 'Then c,'), v(4, 'd,'), v(5, 'e,')];
    expect(calculateBreakPoints(verses)).toEqual([2]);
  });

  it('groups verses at the break points and keeps every verse', () => {
    const verses = [1, 2, 3, 4, 5, 6, 7].map((n) => v(n, `word ${n},`));
    const groups = groupIntoParagraphs(verses);
    expect(groups.map((g) => g.map((x) => x.verseNumber))).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7],
    ]);
  });
});
