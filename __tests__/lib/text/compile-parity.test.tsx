/**
 * Differential parity test: compiler output vs the shipped `HighlightedText` tree.
 *
 * ## Why this test carries the most weight in Phase 1
 *
 * The native renderer is only safe to swap in if it draws the *same* decorations
 * the current nested-`<Text>` tree draws. Asserting the compiler against my own
 * reading of the render path would just re-encode any misreading. So instead this
 * renders the real component, flattens the tree into a per-character decoration
 * map, and compares that against the compiler's ranges flattened the same way.
 *
 * If the two disagree, one of them is wrong — and the disagreement is visible as
 * a character range rather than as a vague visual difference on a device.
 *
 * ## What is compared, and what is not
 *
 * Compared: `backgroundColor` (user + auto highlights) and underline presence
 * (lexicon). Those are the decorations `HighlightedText` owns.
 *
 * Not compared: red-letter color and verse-number superscripts. Both are applied
 * by `ChapterReader` *around* `HighlightedText` — red letter via the `style` prop,
 * verse numbers as sibling `<Text>` nodes — so they are outside this component's
 * output and are covered by the compiler's own unit tests instead.
 */

import { render } from '@testing-library/react-native';
import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { compileParagraph } from '@/lib/text/compile-paragraph';
import type { CompileHighlight, CompileTheme } from '@/lib/text/types';
import type { AutoHighlight } from '@/types/auto-highlights';

jest.mock('expo-haptics');

const mockUseTheme = jest.fn();
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockShowUnderlines = jest.fn();
jest.mock('@/hooks/bible/use-lexicon-underlines', () => ({
  useLexiconUnderlines: () => ({ showUnderlines: mockShowUnderlines() }),
}));

jest.mock('@/lib/perf', () => ({
  ...jest.requireActual('@/lib/perf'),
  perfAdd: jest.fn(),
}));

const VERSE = 'In the beginning God created the heavens and the earth.';

/**
 * Theme matching `HighlightedText`'s hardcoded lexicon underline constants, so a
 * colour mismatch is a real divergence rather than a difference in test setup.
 */
const THEME: CompileTheme = {
  mode: 'light',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'solid',
  redLetterColor: '#c1121f',
  selectionColor: '#3390FF40',
};

/** Per-character decoration, as extracted from either source. */
interface CharDecoration {
  backgroundColor?: string;
  underlined: boolean;
  underlineColor?: string;
}

/** Flattened comparison result: the text, plus one decoration per character. */
interface Flattened {
  text: string;
  chars: CharDecoration[];
}

// ---------------------------------------------------------------------------
// Extracting decorations from the rendered component tree
// ---------------------------------------------------------------------------

/**
 * Walk the rendered tree in document order, accumulating text and the effective
 * style at each character.
 *
 * Styles inherit down the `<Text>` nesting, which is how the current renderer
 * expresses a highlighted segment containing an underlined word: the background
 * comes from the segment wrapper and the underline from the token inside it.
 */
function flattenRendered(
  node: ReactTestRendererJSON | string,
  inherited: CharDecoration
): Flattened {
  if (typeof node === 'string') {
    return { text: node, chars: Array.from(node, () => ({ ...inherited })) };
  }

  const style = flattenStyle((node.props as { style?: unknown }).style);
  const next: CharDecoration = {
    backgroundColor: style.backgroundColor ?? inherited.backgroundColor,
    underlined: style.textDecorationLine === 'underline' || inherited.underlined,
    underlineColor: style.textDecorationColor ?? inherited.underlineColor,
  };

  let text = '';
  const chars: CharDecoration[] = [];
  for (const child of node.children ?? []) {
    const part = flattenRendered(child as ReactTestRendererJSON | string, next);
    text += part.text;
    chars.push(...part.chars);
  }
  return { text, chars };
}

/** Collapse a possibly-nested RN style prop into one object. */
function flattenStyle(style: unknown): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const visit = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value === 'object') Object.assign(out, value);
  };
  visit(style);
  return out;
}

// ---------------------------------------------------------------------------
// Extracting the same shape from compiler output
// ---------------------------------------------------------------------------

function flattenCompiled(
  text: string,
  ranges: ReturnType<typeof compileParagraph>['ranges']
): Flattened {
  const chars: CharDecoration[] = Array.from(text, () => ({ underlined: false }));
  // Applied in array order so later layers win, mirroring how the native view
  // layers spans.
  for (const range of ranges) {
    for (let i = range.start; i < range.end && i < chars.length; i++) {
      if (range.backgroundColor) chars[i].backgroundColor = range.backgroundColor;
      if (range.underline) {
        chars[i].underlined = true;
        chars[i].underlineColor = range.underline.color;
      }
    }
  }
  return { text, chars };
}

// ---------------------------------------------------------------------------

/** Render the component and flatten it. */
function renderAndFlatten(props: {
  highlights?: CompileHighlight[];
  autoHighlights?: AutoHighlight[];
  alignment?: ChapterAlignment | null;
}): Flattened {
  const tree = render(
    <HighlightedText
      text={VERSE}
      verseNumber={1}
      highlights={(props.highlights ?? []) as never}
      autoHighlights={props.autoHighlights ?? []}
      alignment={props.alignment ?? null}
      onVerseTap={() => undefined}
      onHighlightTap={() => undefined}
      onAutoHighlightPress={() => undefined}
      onLexiconWordPress={() => undefined}
      isVisible
    />
  ).toJSON();

  if (!tree || Array.isArray(tree)) throw new Error('expected a single root node');
  return flattenRendered(tree, { underlined: false });
}

/** Compile the same inputs. */
function compileSame(props: {
  highlights?: CompileHighlight[];
  autoHighlights?: AutoHighlight[];
  alignment?: ChapterAlignment | null;
}): Flattened {
  const compiled = compileParagraph({
    verses: [{ verseNumber: 1, text: VERSE }],
    highlights: props.highlights,
    autoHighlights: props.autoHighlights,
    alignment: props.alignment,
    // HighlightedText renders only the verse body; ChapterReader adds the number.
    includeVerseNumbers: false,
    theme: THEME,
  });
  return flattenCompiled(compiled.text, compiled.ranges);
}

/**
 * Compare the two flattenings and describe any divergence as character runs,
 * which is far easier to act on than a 54-element array diff.
 */
function diff(rendered: Flattened, compiled: Flattened): string[] {
  const problems: string[] = [];
  if (rendered.text !== compiled.text) {
    problems.push(
      `text differs:\n  rendered: ${JSON.stringify(rendered.text)}\n  compiled: ${JSON.stringify(compiled.text)}`
    );
    return problems;
  }

  let runStart: number | null = null;
  const closeRun = (end: number): void => {
    if (runStart === null) return;
    const slice = JSON.stringify(rendered.text.slice(runStart, end));
    problems.push(
      `chars ${runStart}-${end - 1} ${slice}: ` +
        `rendered=${JSON.stringify(rendered.chars[runStart])} ` +
        `compiled=${JSON.stringify(compiled.chars[runStart])}`
    );
    runStart = null;
  };

  for (let i = 0; i < rendered.chars.length; i++) {
    const r = rendered.chars[i];
    const c = compiled.chars[i];
    const same =
      r.backgroundColor === c.backgroundColor &&
      r.underlined === c.underlined &&
      // Only compare underline colour where both agree there IS an underline.
      (!r.underlined || r.underlineColor === c.underlineColor);
    if (same) closeRun(i);
    else if (runStart === null) runStart = i;
  }
  closeRun(rendered.chars.length);

  return problems;
}

function alignmentFor(surfaces: Record<string, string | string[]>, themeLemmas: string[] = []) {
  const tokens: AlignedToken[] = [];
  const lexicon: Record<string, LexEntry> = {};
  for (const [lemma, surface] of Object.entries(surfaces)) {
    tokens.push({ lemma, surface } as unknown as AlignedToken);
    lexicon[lemma] = { translit: `t-${lemma}`, basicGloss: 'gloss' } as unknown as LexEntry;
  }
  return { verses: { 1: tokens }, lexicon, themeLemmas } as unknown as ChapterAlignment;
}

function highlight(over: Partial<CompileHighlight> = {}): CompileHighlight {
  return {
    highlight_id: 1,
    start_verse: 1,
    end_verse: 1,
    start_char: null,
    end_char: null,
    color: 'yellow',
    ...over,
  };
}

function autoHighlight(over: Partial<AutoHighlight> = {}): AutoHighlight {
  return {
    auto_highlight_id: 10,
    theme_id: 2,
    theme_name: 'Key Verses',
    theme_color: 'blue',
    book_id: 1,
    chapter_number: 1,
    start_verse: 1,
    end_verse: 1,
    relevance_score: 1,
    ...over,
  } as AutoHighlight;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({
    mode: 'light',
    preference: 'light',
    colors: {},
    setPreference: jest.fn(),
    isLoading: false,
  });
  mockShowUnderlines.mockReturnValue(true);
});

describe('compiler / renderer parity', () => {
  it('agrees on plain text', () => {
    expect(diff(renderAndFlatten({}), compileSame({}))).toEqual([]);
  });

  it('agrees on a character-precise user highlight', () => {
    const highlights = [highlight({ start_char: 7, end_char: 20 })];
    expect(diff(renderAndFlatten({ highlights }), compileSame({ highlights }))).toEqual([]);
  });

  it('agrees on a whole-verse user highlight', () => {
    const highlights = [highlight()];
    expect(diff(renderAndFlatten({ highlights }), compileSame({ highlights }))).toEqual([]);
  });

  it('agrees on an auto-highlight', () => {
    const autoHighlights = [autoHighlight()];
    expect(diff(renderAndFlatten({ autoHighlights }), compileSame({ autoHighlights }))).toEqual([]);
  });

  it('agrees when a user highlight sits inside an auto-highlight', () => {
    const highlights = [highlight({ start_char: 7, end_char: 20 })];
    const autoHighlights = [autoHighlight()];
    expect(
      diff(
        renderAndFlatten({ highlights, autoHighlights }),
        compileSame({ highlights, autoHighlights })
      )
    ).toEqual([]);
  });

  it('agrees on single-word lexicon underlines', () => {
    const alignment = alignmentFor({ G1: 'beginning', G2: 'heavens', G3: 'earth' });
    expect(diff(renderAndFlatten({ alignment }), compileSame({ alignment }))).toEqual([]);
  });

  it('agrees on a theme-tier lexicon underline', () => {
    const alignment = alignmentFor({ G1: 'beginning' }, ['G1']);
    expect(diff(renderAndFlatten({ alignment }), compileSame({ alignment }))).toEqual([]);
  });

  it('agrees on a multi-word lexicon phrase', () => {
    const alignment = alignmentFor({ G1: 'the heavens' });
    expect(diff(renderAndFlatten({ alignment }), compileSame({ alignment }))).toEqual([]);
  });

  it('agrees when a lexicon word sits inside a highlight', () => {
    const highlights = [highlight({ start_char: 7, end_char: 20 })];
    const alignment = alignmentFor({ G1: 'beginning', G2: 'earth' });
    expect(
      diff(renderAndFlatten({ highlights, alignment }), compileSame({ highlights, alignment }))
    ).toEqual([]);
  });

  it('agrees on everything applied at once', () => {
    const highlights = [highlight({ start_char: 7, end_char: 20 })];
    const autoHighlights = [autoHighlight()];
    const alignment = alignmentFor({ G1: 'beginning', G2: 'heavens', G3: 'earth' }, ['G2']);
    expect(
      diff(
        renderAndFlatten({ highlights, autoHighlights, alignment }),
        compileSame({ highlights, autoHighlights, alignment })
      )
    ).toEqual([]);
  });
});

describe('parity harness self-checks', () => {
  it('detects a difference when one is present', () => {
    // Without this, a bug that made `diff` always return [] would turn every
    // test above into a vacuous pass.
    const rendered = renderAndFlatten({ highlights: [highlight({ start_char: 7, end_char: 20 })] });
    const compiled = compileSame({});
    expect(diff(rendered, compiled).length).toBeGreaterThan(0);
  });

  it('extracts the full verse text from the rendered tree', () => {
    // Guards the token-reassembly assumption: the renderer emits per-token
    // strings plus separate spaces, so a joining bug would silently shift every
    // offset and make the comparisons meaningless.
    expect(renderAndFlatten({}).text).toBe(VERSE);
  });

  it('extracts a decoration per character', () => {
    const flat = renderAndFlatten({ highlights: [highlight()] });
    expect(flat.chars).toHaveLength(VERSE.length);
    expect(flat.chars.every((c) => c.backgroundColor !== undefined)).toBe(true);
  });
});
