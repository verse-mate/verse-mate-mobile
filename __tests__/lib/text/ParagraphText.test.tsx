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
import { defineChoicesFor, ParagraphText } from '@/lib/text/ParagraphText';
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
  it('opens the verse for a tap on a lexicon word; its card is a hold away', () => {
    // Replaces "routes a lexicon range tap to onLexiconWordPress". Andy moved Verse Insight back onto
    // the whole verse ("press the verse once for the insight", web #313): a tap anywhere in a verse,
    // a lexicon word included, opens it, and the definition comes from the selection menu's Define.
    const alignment = alignmentFor({ G1: 'beginning' });
    const input = { verses: VERSES, alignment, theme: THEME };
    const compiled = compileParagraph(input);
    const tree = renderParagraph({ alignment });
    const index = indexOfTag('lexicon:', input);

    // Invoke the handler the way native would: by range index.
    getRangeTap(tree)(index, compiled.text.indexOf('beginning') + 3);

    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1, 'text');
    expect(tree.handlers.onLexiconWordPress).not.toHaveBeenCalled();
  });

  it('routes a highlight range tap to onHighlightTap with its id', () => {
    const highlights = [highlight({ highlight_id: 42 })];
    const tree = renderParagraph({ highlights });
    const index = indexOfTag('highlight:', { verses: VERSES, highlights, theme: THEME });

    getRangeTap(tree)(index, 0);
    expect(tree.handlers.onHighlightTap).toHaveBeenCalledWith(42);
  });

  it('gives a tap on a lexicon word inside a highlight to the highlight', () => {
    // The lexicon word's tap target is layered above the highlight's. Routing it to the verse
    // opened Verse Insight as unhighlighted ("Save as my highlight") on a highlighted verse.
    const alignment = alignmentFor({ G1: 'beginning' });
    const highlights = [highlight({ highlight_id: 42 })];
    const input = { verses: VERSES, alignment, highlights, theme: THEME };
    const compiled = compileParagraph(input);
    const tree = renderParagraph({ alignment, highlights });

    getRangeTap(tree)(indexOfTag('lexicon:', input), compiled.text.indexOf('beginning') + 3);
    expect(tree.handlers.onHighlightTap).toHaveBeenCalledWith(42);
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
  });

  it('gives a plain press inside a highlight to the highlight', () => {
    const highlights = [highlight({ highlight_id: 42 })];
    const compiled = compileParagraph({ verses: VERSES, highlights, theme: THEME });
    const tree = renderParagraph({ highlights });

    getPress(tree)({ charOffset: compiled.text.indexOf('beginning') + 3, x: 0, y: 0 });
    expect(tree.handlers.onHighlightTap).toHaveBeenCalledWith(42);
    expect(tree.handlers.onVerseTap).not.toHaveBeenCalled();
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
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1, 'number');

    tree.handlers.onVerseTap.mockClear();
    getRangeTap(tree)(indexOfTag('verse-number:2', input), 0);
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2, 'number');
  });

  it('opens the verse a plain-text tap lands in, anywhere in it', () => {
    // Replaces "opens a verse for a plain-text tap just beside its number, and for nothing else" and
    // "defines the tapped word when the tap is not beside a number". Plain text used to be inert
    // (then a word tap defined the word); Andy asked for the verse itself to open its insight, as on
    // web, because the numbers alone were not intuitive.
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onWordPress = jest.fn();
    const tree = renderParagraph({ onWordPress });
    const press = getPress(tree);

    press({ charOffset: compiled.text.indexOf('beginning') + 2, x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1, 'text');

    tree.handlers.onVerseTap.mockClear();
    press({ charOffset: compiled.text.indexOf('formless'), x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2, 'text');
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('gives a tap beside a number to the number, not to the verse before it', () => {
    // The joining space before a number belongs to the previous verse's text; the tolerance Andy
    // asked for around numbers still sends it to the number.
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const tree = renderParagraph();

    getPress(tree)({ charOffset: compiled.verses[1].textStart, x: 0, y: 0 });
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(2, 'number');
  });

  it('gives a tap on the first letters after a number to the number, even on a lexicon word', () => {
    const alignment = alignmentFor({ en: 'In' });
    const input = { verses: VERSES, alignment, theme: THEME };
    const compiled = compileParagraph(input);
    const tree = renderParagraph({ alignment });
    const lexiconIndex = indexOfTag('lexicon:1:0', input);

    getRangeTap(tree)(lexiconIndex, compiled.verses[0].textStart);
    expect(tree.handlers.onVerseTap).toHaveBeenCalledWith(1, 'number');
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

describe('ParagraphText selection menu', () => {
  const LABELS = { highlight: 'Highlight', define: 'Define' };

  it('offers Highlight and Define only when each has a label and a handler', () => {
    renderParagraph({ onHighlightSelection: jest.fn(), selectionLabels: LABELS });
    // Andy's order (2026-11-01): Define first.
    expect(capturedSelectionActions).toEqual([
      { id: 'define', label: 'Define' },
      { id: 'highlight', label: 'Highlight' },
    ]);

    renderParagraph({ onLexiconWordPress: undefined, selectionLabels: LABELS });
    expect(capturedSelectionActions).toEqual([]);
    expect(capturedSelectionAction).toBeUndefined();
  });

  it('offers Define, Highlight, Copy, Note, Share in that order, and hands each the selection', () => {
    const handlers = {
      onHighlightSelection: jest.fn(),
      onCopySelection: jest.fn(),
      onNoteSelection: jest.fn(),
      onShareSelection: jest.fn(),
    };
    renderParagraph({
      ...handlers,
      selectionLabels: { ...LABELS, copy: 'Copy', note: 'Note', share: 'Share' },
    });
    expect(capturedSelectionActions?.map((a) => a.id)).toEqual([
      'define',
      'highlight',
      'copy',
      'note',
      'share',
    ]);
    // Andy: the arrow opens only what the row does not already show.
    expect(capturedSelectionActions?.filter((a) => a.more).map((a) => a.id)).toEqual([
      'note',
      'share',
    ]);

    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const start = compiled.text.indexOf('God');
    const end = start + 'God'.length;
    for (const [id, handler] of [
      ['copy', handlers.onCopySelection],
      ['note', handlers.onNoteSelection],
      ['share', handlers.onShareSelection],
    ] as const) {
      getSelectionAction()({ id, start, end });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ startVerse: 1, endVerse: 1, text: 'God' })
      );
    }
  });

  it('turns Highlight into verse and character offsets, numbers left out', () => {
    // "In the beginning God created. 2 And the earth was formless." — select from "God" to "earth".
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onHighlightSelection = jest.fn();
    renderParagraph({ onHighlightSelection, selectionLabels: LABELS });
    const start = compiled.text.indexOf('God');
    const end = compiled.text.indexOf('earth') + 'earth'.length;

    getSelectionAction()({ id: 'highlight', start, end });
    expect(onHighlightSelection).toHaveBeenCalledWith({
      startVerse: 1,
      startChar: VERSES[0].text.indexOf('God'),
      endVerse: 2,
      endChar: VERSES[1].text.indexOf('earth') + 'earth'.length,
      text: 'God created. And the earth',
    });
  });

  it('defines a lexicon word with its Greek/Hebrew card', () => {
    const alignment = alignmentFor({ G1: 'beginning' });
    const compiled = compileParagraph({ verses: VERSES, alignment, theme: THEME });
    const onWordPress = jest.fn();
    const tree = renderParagraph({ alignment, onWordPress, selectionLabels: LABELS });
    const start = compiled.text.indexOf('beginning');

    getSelectionAction()({ id: 'define', start, end: start + 'beginning'.length });
    expect(tree.handlers.onLexiconWordPress).toHaveBeenCalledTimes(1);
    expect(tree.handlers.onLexiconWordPress.mock.calls[0][0]).toMatchObject({
      surface: 'beginning',
      isTheme: false,
    });
    expect(onWordPress).not.toHaveBeenCalled();
  });

  it('hands a multi-word Define its words, so the sheet can offer each one', () => {
    const alignment = alignmentFor({ G1: 'beginning' });
    const compiled = compileParagraph({ verses: VERSES, alignment, theme: THEME });
    const onDefineSelection = jest.fn();
    const onWordPress = jest.fn();
    const tree = renderParagraph({
      alignment,
      onWordPress,
      onDefineSelection,
      selectionLabels: LABELS,
    });
    const start = compiled.text.indexOf('the beginning');
    const end = compiled.text.indexOf('created') + 'created'.length;

    getSelectionAction()({ id: 'define', start, end });
    expect(onDefineSelection).toHaveBeenCalledTimes(1);
    const choices = onDefineSelection.mock.calls[0][0];
    expect(choices.map((c: { label: string }) => c.label)).toEqual(['beginning', 'God', 'created']);
    expect(choices[0].lexicon).toMatchObject({ surface: 'beginning' });
    expect(choices[1].lexicon).toBeUndefined();
    expect(onWordPress).not.toHaveBeenCalled();
    expect(tree.handlers.onLexiconWordPress).not.toHaveBeenCalled();
  });

  it('keeps the one-word Define when the selection has only one word to offer', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onDefineSelection = jest.fn();
    const onWordPress = jest.fn();
    renderParagraph({ onWordPress, onDefineSelection, selectionLabels: LABELS });
    // "the earth": "the" is filler, so only "earth" is left to offer.
    const start = compiled.text.indexOf('the earth');

    getSelectionAction()({ id: 'define', start, end: start + 'the earth'.length });
    expect(onDefineSelection).not.toHaveBeenCalled();
    expect(onWordPress).toHaveBeenCalledWith({ word: 'the', verseNumber: 2 });
  });

  it('defines any other word with the dictionary, and nothing for a verse number', () => {
    const compiled = compileParagraph({ verses: VERSES, theme: THEME });
    const onWordPress = jest.fn();
    renderParagraph({ onWordPress, selectionLabels: LABELS });
    const start = compiled.text.indexOf('formless');

    getSelectionAction()({ id: 'define', start, end: start + 'formless'.length });
    expect(onWordPress).toHaveBeenCalledWith({ word: 'formless', verseNumber: 2 });

    onWordPress.mockClear();
    getSelectionAction()({
      id: 'define',
      start: compiled.verses[1].start,
      end: compiled.verses[1].start + 1,
    });
    expect(onWordPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The fallback renders an RN <Text>, so the native callbacks are not reachable
// from the tree. Re-render through a captured VMText to invoke them directly.
// ---------------------------------------------------------------------------

let capturedRangeTap: ((index: number, charOffset: number) => void) | undefined;
let capturedPress: ((event: { charOffset: number; x: number; y: number }) => void) | undefined;
let capturedSelectionActions: { id: string; label: string; more?: boolean }[] | undefined;
let capturedSelectionAction:
  | ((event: { id: string; start: number; end: number }) => void)
  | undefined;

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
      selectionActions?: { id: string; label: string }[];
      onSelectionAction?: (event: { id: string; start: number; end: number }) => void;
      text: string;
    }) => {
      capturedRangeTap = props.onRangeTap;
      capturedPress = props.onPress;
      capturedSelectionActions = props.selectionActions;
      capturedSelectionAction = props.onSelectionAction;
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

function getSelectionAction(): (event: { id: string; start: number; end: number }) => void {
  if (!capturedSelectionAction) throw new Error('VMText never received onSelectionAction');
  return capturedSelectionAction;
}
