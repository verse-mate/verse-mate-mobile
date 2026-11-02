import { highlightScopes } from '@/components/bible/HighlightSelectionSheet';

const words = { start: 5, end: 5, startChar: 4, endChar: 9 };

describe('highlightScopes', () => {
  it('offers the words, the verse, and the whole book for a short selection in one verse', () => {
    expect(highlightScopes({ verseRange: words, text: 'I am', canHighlightAll: true })).toEqual([
      'selection',
      'verse',
      'book',
    ]);
  });

  it('offers nothing to choose for a whole-verse selection', () => {
    expect(
      highlightScopes({ verseRange: { start: 5, end: 6 }, text: 'x', canHighlightAll: true })
    ).toEqual([]);
  });

  it('leaves "Highlight all" out across verses, for long selections, or when not supported', () => {
    expect(
      highlightScopes({
        verseRange: { start: 5, end: 6, startChar: 2, endChar: 3 },
        text: 'shines in',
        canHighlightAll: true,
      })
    ).toEqual(['selection', 'verse']);
    expect(
      highlightScopes({
        verseRange: words,
        text: 'one two three four five six seven',
        canHighlightAll: true,
      })
    ).toEqual(['selection', 'verse']);
    expect(highlightScopes({ verseRange: words, text: 'I am', canHighlightAll: false })).toEqual([
      'selection',
      'verse',
    ]);
  });
});
