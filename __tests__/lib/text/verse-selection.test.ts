/**
 * `verseSelectionFromOffsets` — a native selection in compiled-text offsets, turned into the shape a
 * highlight is stored in: start verse + offset into its text, end verse + offset into its text.
 *
 * `emitHighlights` reads that shape back, so the round trip is pinned here too: whatever a reader
 * selects must come back highlighted over exactly the same characters.
 */

import { compileParagraph, verseSelectionFromOffsets } from '@/lib/text/compile-paragraph';
import type { CompileTheme } from '@/lib/text/types';

const THEME: CompileTheme = {
  mode: 'dark',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'dotted',
  redLetterColor: '#ff6b6b',
  selectionColor: '#3390FF40',
  baseFontSize: 18,
};

// 2 Samuel 9:11-12, the passage in Andy's report.
const VERSES = [
  {
    verseNumber: 11,
    text: 'Then Ziba said to the king, “According to all that my lord the king commands his servant so your servant will do.”',
  },
  {
    verseNumber: 12,
    text: 'Mephibosheth had a young son whose name was Mica. And all who lived in the house of Ziba were servants to Mephibosheth.',
  },
];

const compiled = compileParagraph({ verses: VERSES, theme: THEME });
const at = (needle: string) => compiled.text.indexOf(needle);

describe('verseSelectionFromOffsets', () => {
  it('maps a few words inside one verse', () => {
    const start = at('young son');
    const result = verseSelectionFromOffsets(compiled, start, start + 'young son'.length);
    expect(result).toEqual({
      startVerse: 12,
      startChar: VERSES[1].text.indexOf('young son'),
      endVerse: 12,
      endChar: VERSES[1].text.indexOf('young son') + 'young son'.length,
      text: 'young son',
    });
  });

  it('keeps start_char > end_char across verses: each indexes its own verse', () => {
    const start = at('servant will');
    const end = at('had a') + 'had a'.length;
    const result = verseSelectionFromOffsets(compiled, start, end);
    expect(result).toMatchObject({
      startVerse: 11,
      startChar: VERSES[0].text.indexOf('servant will'),
      endVerse: 12,
      endChar: VERSES[1].text.indexOf('had a') + 'had a'.length,
    });
    expect(result?.startChar).toBeGreaterThan(result?.endChar ?? Number.POSITIVE_INFINITY);
    expect(result?.text).toBe('servant will do.” Mephibosheth had a');
  });

  it('starts at the verse text when the selection starts on its number', () => {
    const numberStart = compiled.verses[1].start;
    const end = at('Mephibosheth had') + 'Mephibosheth'.length;
    expect(verseSelectionFromOffsets(compiled, numberStart, end)).toMatchObject({
      startVerse: 12,
      startChar: 0,
      endVerse: 12,
      text: 'Mephibosheth',
    });
  });

  it('stops at the previous verse when the selection ends on a number', () => {
    const start = at('will do');
    const end = compiled.verses[1].textStart; // through the "12" and its space
    expect(verseSelectionFromOffsets(compiled, start, end)).toMatchObject({
      startVerse: 11,
      endVerse: 11,
      endChar: VERSES[0].text.length,
      text: 'will do.”',
    });
  });

  it('selects a whole verse', () => {
    const span = compiled.verses[1];
    expect(verseSelectionFromOffsets(compiled, span.start, span.end)).toEqual({
      startVerse: 12,
      startChar: 0,
      endVerse: 12,
      endChar: VERSES[1].text.length,
      text: VERSES[1].text,
    });
  });

  it('is null for nothing but a number and whitespace', () => {
    const span = compiled.verses[1];
    expect(verseSelectionFromOffsets(compiled, span.start - 1, span.textStart)).toBeNull();
    expect(verseSelectionFromOffsets(compiled, 5, 5)).toBeNull();
  });

  it('round-trips through the highlight renderer onto the same characters', () => {
    const start = at('servant will');
    const end = at('had a') + 'had a'.length;
    const selection = verseSelectionFromOffsets(compiled, start, end);
    if (!selection) throw new Error('no selection');

    const highlighted = compileParagraph({
      verses: VERSES,
      theme: THEME,
      highlights: [
        {
          highlight_id: 1,
          start_verse: selection.startVerse,
          end_verse: selection.endVerse,
          start_char: selection.startChar,
          end_char: selection.endChar,
          color: 'yellow',
        },
      ],
    });
    const covered = highlighted.ranges
      .filter((r) => r.tag === 'highlight:1')
      .map((r) => highlighted.text.slice(r.start, r.end));
    expect(covered).toEqual(['servant will do.”', 'Mephibosheth had a']);
  });
});
