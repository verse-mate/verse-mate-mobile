/**
 * `verseNumberNearOffset`: the tolerance around a verse number.
 *
 * Andy (App Store build): "need a bit more clickable area around the numbers to get to the bible
 * insights. Ideally no more space but more place for fingers to hit." The page does not change; a
 * plain-text tap that lands just beside a number is resolved to it.
 */
import {
  compileParagraph,
  VERSE_NUMBER_TAP_SLOP_CHARS,
  verseNumberNearOffset,
} from '@/lib/text/compile-paragraph';
import type { CompileTheme } from '@/lib/text/types';

const THEME: CompileTheme = {
  mode: 'dark',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'dotted',
  redLetterColor: '#c1121f',
  selectionColor: '#3390FF40',
  baseFontSize: 18,
};

const compiled = compileParagraph({
  verses: [
    { verseNumber: 1, text: 'In the beginning God created.' },
    { verseNumber: 2, text: 'And the earth was formless.' },
  ],
  theme: THEME,
});
const [v1, v2] = compiled.verses;
/** Every offset on one line. */
const oneLine = () => 0;

describe('verseNumberNearOffset', () => {
  it('takes the first letters after a number as a tap on it', () => {
    expect(verseNumberNearOffset(compiled, v2.textStart)).toBe(2);
    expect(verseNumberNearOffset(compiled, v2.textStart + VERSE_NUMBER_TAP_SLOP_CHARS - 1)).toBe(2);
  });

  it('stops after the slop, so the rest of the verse stays plain text', () => {
    expect(verseNumberNearOffset(compiled, v2.textStart + VERSE_NUMBER_TAP_SLOP_CHARS)).toBeNull();
    expect(verseNumberNearOffset(compiled, v1.textStart + 10, oneLine)).toBeNull();
  });

  it('takes the joining space and the character before it, on the same line', () => {
    // v2.start is the "2"; the joining space sits just before it.
    expect(verseNumberNearOffset(compiled, v2.start - 1, oneLine)).toBe(2);
    expect(verseNumberNearOffset(compiled, v2.start - VERSE_NUMBER_TAP_SLOP_CHARS, oneLine)).toBe(
      2
    );
    expect(
      verseNumberNearOffset(compiled, v2.start - VERSE_NUMBER_TAP_SLOP_CHARS - 1, oneLine)
    ).toBeNull();
  });

  it('ignores the before side when the number starts a new line', () => {
    // The joining space then hangs at the end of the PREVIOUS line, under the previous verse's
    // last word — a tap there is not aimed at a number on another line.
    const lineOf = (offset: number) => (offset < v2.start ? 0 : 1);
    expect(verseNumberNearOffset(compiled, v2.start - 1, lineOf)).toBeNull();
    // The after side is unaffected: the number and its first word never break apart.
    expect(verseNumberNearOffset(compiled, v2.textStart, lineOf)).toBe(2);
  });

  it('ignores the before side when line geometry is not known yet', () => {
    expect(verseNumberNearOffset(compiled, v2.start - 1)).toBeNull();
  });

  it('does nothing for paragraphs rendered without verse numbers', () => {
    const bare = compileParagraph({
      verses: [
        { verseNumber: 1, text: 'In the beginning God created.' },
        { verseNumber: 2, text: 'And the earth was formless.' },
      ],
      includeVerseNumbers: false,
      theme: THEME,
    });
    for (let offset = 0; offset < bare.text.length; offset++) {
      expect(verseNumberNearOffset(bare, offset, oneLine)).toBeNull();
    }
  });
});
