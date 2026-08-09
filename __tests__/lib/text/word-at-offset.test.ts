import { wordAtOffset } from '@/lib/text/word-at-offset';

describe('wordAtOffset', () => {
  const text = 'In the beginning God created the heavens and the earth.';

  it('resolves a word from an offset inside it', () => {
    const at = wordAtOffset(text, text.indexOf('beginning') + 3);
    expect(at.word).toBe('beginning');
  });

  it('resolves from the first and last character of a word', () => {
    const start = text.indexOf('created');
    expect(wordAtOffset(text, start).word).toBe('created');
    expect(wordAtOffset(text, start + 'created'.length - 1).word).toBe('created');
  });

  it('trims trailing punctuation so a lookup gets the word', () => {
    // The tokenizer this replaces kept punctuation attached, but "earth." is not a dictionary entry.
    const at = wordAtOffset(text, text.indexOf('earth'));
    expect(at.word).toBe('earth');
  });

  it('keeps punctuation INSIDE a word', () => {
    expect(wordAtOffset('took worn-out sacks', 6).word).toBe('worn-out');
    expect(wordAtOffset("God's promise", 2).word).toBe("God's");
  });

  it('returns empty on whitespace rather than guessing a neighbour', () => {
    // A popover for a word the reader did not tap is worse than no popover.
    const spaceIdx = text.indexOf(' ');
    expect(wordAtOffset(text, spaceIdx).word).toBe('');
  });

  it('returns empty outside the text and for empty input', () => {
    expect(wordAtOffset(text, -1).word).toBe('');
    expect(wordAtOffset(text, text.length).word).toBe('');
    expect(wordAtOffset('', 0).word).toBe('');
  });

  it('reports the untrimmed span, so callers can map back to the source', () => {
    const idx = text.indexOf('earth');
    const at = wordAtOffset(text, idx);
    expect(text.slice(at.start, at.end)).toBe('earth.');
  });

  it('handles a word at the very start and very end', () => {
    expect(wordAtOffset(text, 0).word).toBe('In');
    expect(wordAtOffset(text, text.length - 1).word).toBe('earth');
  });
});
