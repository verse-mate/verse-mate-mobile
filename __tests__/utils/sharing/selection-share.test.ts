import { selectionReference, selectionShareText } from '@/utils/sharing/selection-share';

describe('selectionReference', () => {
  it('names one verse', () => {
    expect(selectionReference('John', 1, { startVerse: 5, endVerse: 5 })).toBe('John 1:5');
  });

  it('names a run of verses', () => {
    expect(selectionReference('John', 1, { startVerse: 4, endVerse: 5 })).toBe('John 1:4-5');
  });
});

describe('selectionShareText', () => {
  it('quotes the words with their reference and version', () => {
    expect(
      selectionShareText({ text: ' the Light shines ', reference: 'John 1:5', version: 'NASB1995' })
    ).toBe('"the Light shines"\n\n- John 1:5 NASB1995');
  });

  it('adds the link last when there is one', () => {
    expect(
      selectionShareText({
        text: 'the Light',
        reference: 'John 1:5',
        url: 'https://app.versemate.org/bible/john/1',
      })
    ).toBe('"the Light"\n\n- John 1:5\n\nhttps://app.versemate.org/bible/john/1');
  });
});
