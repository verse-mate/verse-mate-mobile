/**
 * Tests for `<ParagraphText>` — the join between the compiler and the native view.
 *
 * The interesting behaviour is the callback routing: a native tap arrives as a
 * range index or a character offset, and this component has to turn that back
 * into "the user tapped verse 5" or "the user tapped this lexicon word". Getting
 * that wrong opens the wrong tooltip, which is exactly the class of bug the
 * per-verse node tree used to prevent structurally.
 */

import { render } from '@testing-library/react-native';
import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import { compileParagraph } from '@/lib/text/compile-paragraph';
import { ParagraphText } from '@/lib/text/ParagraphText';
import type { CompileHighlight, CompileTheme } from '@/lib/text/types';
import type { AutoHighlight } from '@/types/auto-highlights';

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
  { verseNumber: 1, text: 'In the beginning God created.' },
  { verseNumber: 2, text: 'And the earth was formless.' },
];

function alignmentFor(surfaces: Record<string, string>): ChapterAlignment {
  const tokens: AlignedToken[] = [];
  const lexicon: Record<string, LexEntry> = {};
  for (const [lemma, surface] of Object.entries(surfaces)) {
    tokens.push({ lemma, surface } as unknown as AlignedToken);
    lexicon[lemma] = { translit: `t-${lemma}`, basicGloss: 'gloss' } as unknown as LexEntry;
  }
  return { verses: { 1: tokens }, lexicon, themeLemmas: [] } as unknown as ChapterAlignment;
}

function highlight(over: Partial<CompileHighlight> = {}): CompileHighlight {
  return {
    highlight_id: 7,
    start_verse: 1,
    end_verse: 1,
    start_char: null,
    end_char: null,
    color: 'yellow',
    ...over,
  };
}

function autoHighlight(): AutoHighlight {
  return {
    auto_highlight_id: 55,
    theme_id: 2,
    theme_name: 'Key Verses',
    theme_color: 'blue',
    book_id: 1,
    chapter_number: 1,
    start_verse: 2,
    end_verse: 2,
    relevance_score: 1,
  } as AutoHighlight;
}

/**
 * Compile the same input the component will, so a test can find the index of a
 * range by intent rather than hard-coding a number that shifts whenever the
 * layer order changes.
 */
function indexOfTag(prefix: string, input: Parameters<typeof compileParagraph>[0]): number {
  const compiled = compileParagraph(input);
  const index = compiled.ranges.findIndex((r) => r.tag?.startsWith(prefix));
  if (index < 0) throw new Error(`no range tagged ${prefix}`);
  return index;
}

/** Render and hand back the props the underlying VMText received. */
function renderParagraph(overrides: Partial<React.ComponentProps<typeof ParagraphText>> = {}) {
  const handlers = {
    onVerseTap: jest.fn(),
    onHighlightTap: jest.fn(),
    onAutoHighlightPress: jest.fn(),
    onLexiconWordPress: jest.fn(),
  };
  const utils = render(
    <ParagraphText theme={THEME} verses={VERSES} width={320} {...handlers} {...overrides} />
  );
  return { ...utils, handlers };
}

describe('ParagraphText rendering', () => {
  it('renders every verse as one block of text', () => {
    const { toJSON } = renderParagraph();
    const text = JSON.stringify(toJSON());
    // Both verses in one view, with real digits for the verse numbers.
    expect(text).toContain('In the beginning God created.');
    expect(text).toContain('And the earth was formless.');
  });

  it('renders without a measured height when native is unavailable', () => {
    // Jest has no native module, so measurement returns null and the component
    // must let the platform size the text rather than pass height={null}.
    expect(() => renderParagraph()).not.toThrow();
  });
});

describe('ParagraphText tap routing', () => {
  it('routes a lexicon range tap to onLexiconWordPress with its entry', () => {
    const alignment = alignmentFor({ G1: 'beginning' });
    const input = { verses: VERSES, alignment, theme: THEME };
    const tree = renderParagraph({ alignment });
    const index = indexOfTag('lexicon:', input);

    // Invoke the handler the way native would: by range index.
    tree.handlers.onLexiconWordPress.mockClear();
    getRangeTap(tree)(index, 0);

    expect(tree.handlers.onLexiconWordPress).toHaveBeenCalledTimes(1);
    expect(tree.handlers.onLexiconWordPress.mock.calls[0][0]).toMatchObject({
      surface: 'beginning',
      isTheme: false,
    });
  });

  it('routes a highlight range tap to onHighlightTap with its id', () => {
    const highlights = [highlight({ highlight_id: 42 })];
    const tree = renderParagraph({ highlights });
    const index = indexOfTag('highlight:', { verses: VERSES, highlights, theme: THEME });

    getRangeTap(tree)(index, 0);
    expect(tree.handlers.onHighlightTap).toHaveBeenCalledWith(42);
  });

  it('routes an auto-highlight range tap with the whole object', () => {
    const autoHighlights = [autoHighlight()];
    const tree = renderParagraph({ autoHighlights });
    const index = indexOfTag('auto-highlight:', { verses: VERSES, autoHighlights, theme: THEME });

    getRangeTap(tree)(index, 0);
    expect(tree.handlers.onAutoHighlightPress).toHaveBeenCalledTimes(1);
    expect(tree.handlers.onAutoHighlightPress.mock.calls[0][0].auto_highlight_id).toBe(55);
  });

  it('ignores a tap on a decorative range', () => {
    // A verse-number superscript or a red-letter run has no target, and firing a
    // domain callback for it would open a tooltip the user did not ask for.
    const tree = renderParagraph({ redLetterVerses: new Set([1]) });
    const index = indexOfTag('red-letter:', {
      verses: VERSES,
      redLetterVerses: new Set([1]),
      theme: THEME,
    });

    getRangeTap(tree)(index, 0);
    expect(tree.handlers.onHighlightTap).not.toHaveBeenCalled();
    expect(tree.handlers.onLexiconWordPress).not.toHaveBeenCalled();
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
  });

  it('ignores an out-of-bounds range index', () => {
    // Defends against a native/JS desync after a fast re-render: an index from
    // the previous ranges array must not be dereferenced blindly.
    const tree = renderParagraph();
    expect(() => getRangeTap(tree)(9999, 0)).not.toThrow();
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
  });
});

describe('ParagraphText verse resolution', () => {
  it('routes a verse-number range tap to onVerseTap for that verse', () => {
    const input = { verses: VERSES, theme: THEME };
    const tree = renderParagraph();

    getRangeTap(tree)(indexOfTag('verse-number:1', input), 0);
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1);

    tree.handlers.onVerseTap.mockClear();
    getRangeTap(tree)(indexOfTag('verse-number:2', input), 0);
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2);
  });

  it('opens a verse for a plain-text tap just beside its number, and for nothing else', () => {
    // Replaces "wires no plain-press handler at all". Plain text is still inert — a tap in the middle
    // of a verse opens nothing — but Andy asked for more room around the numbers without more space
    // on the page, so a tap that lands on the first letters after a number is taken as aimed at it.
    // The resolver itself is covered in verse-number-near-offset.test.ts; this pins the wiring.
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const tree = renderParagraph();
    const press = getPress(tree);

    press({ charOffset: compiled.verses[1].textStart, x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2);

    tree.handlers.onVerseTap.mockClear();
    press({ charOffset: compiled.verses[0].textStart + 8, x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
  });

  it('defines the tapped word when the tap is not beside a number', () => {
    // Andy: "expand the definitions to all words". A word with no lexicon entry is a plain-text tap,
    // and it now opens the dictionary for that word.
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onWordPress = jest.fn();
    const tree = renderParagraph({ onWordPress });
    const offset = compiled.text.indexOf('beginning') + 2;

    getPress(tree)({ charOffset: offset, x: 0, y: 0 });
    expect(onWordPress).toHaveBeenCalledWith({ word: 'beginning', verseNumber: 1 });
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
  });

  it('gives a tap beside a number to the number, not to the word it overlaps', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onWordPress = jest.fn();
    const tree = renderParagraph({ onWordPress });

    getPress(tree)({ charOffset: compiled.verses[1].textStart, x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2);
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('defines nothing for a tap on whitespace', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onWordPress = jest.fn();
    const tree = renderParagraph({ onWordPress });
    const space = compiled.text.indexOf(' beginning');

    getPress(tree)({ charOffset: space, x: 0, y: 0 });
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('gives a tap on the first letters after a number to the number, even on a lexicon word', () => {
    // The first word after a number is often a lexicon word, and with the underlines off nothing
    // shows it. Letting the word win would keep the miss Andy reported.
    const alignment = alignmentFor({ en: 'In' });
    const input = { verses: VERSES, alignment, theme: THEME };
    const compiled = compileParagraph(input);
    const tree = renderParagraph({ alignment });
    const lexiconIndex = indexOfTag('lexicon:1:0', input);

    getRangeTap(tree)(lexiconIndex, compiled.verses[0].textStart);
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1);
    expect(tree.handlers.onLexiconWordPress).not.toHaveBeenCalled();
  });

  it('wires no plain-press handler when nothing listens for verse taps', () => {
    // A paragraph without onVerseTap has no use for plain taps, so the native view is not asked to
    // send them.
    renderParagraph({ onVerseTap: undefined });

    // capturedRangeTap first: it proves VMText was actually rendered, so the
    // assertion below is about the prop being absent rather than about the
    // component never having mounted.
    expect(capturedRangeTap).toBeDefined();
    expect(capturedPress).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The fallback renders an RN <Text>, so the native callbacks are not reachable
// from the tree. Re-render through a captured VMText to invoke them directly.
// ---------------------------------------------------------------------------

let capturedRangeTap: ((index: number, charOffset: number) => void) | undefined;
let capturedPress: ((event: { charOffset: number; x: number; y: number }) => void) | undefined;

jest.mock('@/modules/versemate-text', () => {
  const actual = jest.requireActual('@/modules/versemate-text');
  return {
    ...actual,
    // Replace the view with a probe that records the handlers it was given. The
    // compiler and the routing logic are what these tests are about; how the text
    // is drawn is covered by the module's own tests and by on-device checks.
    VMText: (props: {
      onRangeTap?: (index: number, charOffset: number) => void;
      onPress?: (event: { charOffset: number; x: number; y: number }) => void;
      text: string;
    }) => {
      capturedRangeTap = props.onRangeTap;
      capturedPress = props.onPress;
      return actual.VMText(props);
    },
  };
});

function getRangeTap(_tree: unknown): (index: number, charOffset: number) => void {
  if (!capturedRangeTap) throw new Error('VMText never received onRangeTap');
  return capturedRangeTap;
}

function getPress(_tree: unknown): (event: { charOffset: number; x: number; y: number }) => void {
  if (!capturedPress) throw new Error('VMText never received onPress');
  return capturedPress;
}
