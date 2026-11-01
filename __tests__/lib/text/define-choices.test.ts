/**
 * `defineChoicesFor` — the words a multi-word Define offers as chips.
 *
 * Sebastian, on the hold-and-drag build: Define on several words "simply shows the definition of the
 * word you initially started selecting from"; the reader should be able to see the others too.
 */

import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import { compileParagraph } from '@/lib/text/compile-paragraph';
import { defineChoicesFor } from '@/lib/text/ParagraphText';
import type { CompileTheme } from '@/lib/text/types';

const THEME: CompileTheme = {
  mode: 'light',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'dotted',
  redLetterColor: '#c1121f',
  selectionColor: '#3390FF40',
  baseFontSize: 18,
};

const VERSES = [
  { verseNumber: 19, text: 'And this is the testimony of John, when the Jews sent priests.' },
  { verseNumber: 20, text: 'And he confessed and did not deny, but confessed.' },
];

function alignment(words: Record<string, string>): ChapterAlignment {
  const tokens: AlignedToken[] = Object.entries(words).map(
    ([lemma, surface]) => ({ lemma, surface }) as unknown as AlignedToken
  );
  const lexicon = Object.fromEntries(
    Object.keys(words).map((lemma) => [lemma, { translit: lemma } as unknown as LexEntry])
  );
  return {
    verses: { 19: tokens, 20: tokens },
    lexicon,
    themeLemmas: [],
  } as unknown as ChapterAlignment;
}

const labels = (compiled: ReturnType<typeof compileParagraph>, from: string, to: string) => {
  const start = compiled.text.indexOf(from);
  const end = compiled.text.indexOf(to, start) + to.length;
  return defineChoicesFor(compiled, start, end).map((c) => c.label);
};

describe('defineChoicesFor', () => {
  it('offers each word once, in order, leaving out filler words', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    expect(labels(compiled, 'this is the testimony', 'priests')).toEqual([
      'testimony',
      'John',
      'Jews',
      'sent',
      'priests',
    ]);
  });

  it('keeps a filler word that has a Greek entry, and offers a lemma once', () => {
    const compiled = compileParagraph({
      verses: VERSES,
      theme: THEME,
      alignment: alignment({ G2532: 'And', G3141: 'testimony', G3670: 'confessed' }),
    });
    // "And" is καί (G2532): a lexicon word, so it stays; "confessed" twice is one choice.
    expect(labels(compiled, 'testimony of John', 'confessed.')).toEqual([
      'testimony',
      'John',
      'Jews',
      'sent',
      'priests',
      'And',
      'confessed',
      'deny',
    ]);
  });

  it('skips verse numbers and carries each word’s verse', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const start = compiled.text.indexOf('priests');
    const end = compiled.text.indexOf('confessed') + 'confessed'.length;
    expect(defineChoicesFor(compiled, start, end)).toEqual([
      { label: 'priests', word: 'priests', verseNumber: 19, lexicon: undefined },
      { label: 'confessed', word: 'confessed', verseNumber: 20, lexicon: undefined },
    ]);
  });

  it('offers the filler words when nothing else was selected', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    expect(labels(compiled, 'did not', 'not')).toEqual(['did', 'not']);
  });
});
