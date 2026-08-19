/**
 * Android Verse-of-the-Day widget tree tests (GH-265).
 *
 * Renders the component through the library's own `buildWidgetTree` — the same
 * renderer the headless widget task uses, and the one that blew up with
 * `useMemoCache of null` when React Compiler instrumented this component. It
 * also runs the library's `validateWidgetTree`, so an unsupported style prop or
 * an illegal nesting fails here instead of on a home screen.
 *
 * Deep import: buildWidgetTree is not re-exported from the package index, and
 * the index pulls in native-only modules that cannot load under jest.
 */
import { buildWidgetTree } from 'react-native-android-widget/src/api/build-widget-tree';
import { VerseOfTheDayWidget } from '@/widgets/VerseOfTheDayWidget';
import { planLayout } from '@/widgets/widget-layout';
import { widgetStrings } from '@/widgets/widget-strings';

const VERSES = [
  { verseNumber: 14, text: 'I am fearfully and wonderfully made; wonderful are Your works.' },
];

const BASE = {
  verses: VERSES,
  reference: 'Psalm 139:14',
  deepLink: 'versemate:///bible/19/139?verseStart=14&src=widget',
  noteDeepLink: 'versemate:///bible/19/139?verseStart=14&src=widget&tab=summary',
  fallbackText: "Open VerseMate to see today's verse",
  versionLabel: 'NASB1995',
  // Measured 4x4 on a Pixel emulator — the layout budget keys off this.
  height: 483,
  strings: widgetStrings('en'),
} as const;

/** Collect every node of a built tree, depth-first. */
function flatten(tree: ReturnType<typeof buildWidgetTree>): ReturnType<typeof buildWidgetTree>[] {
  return [tree, ...(tree.children ?? []).flatMap(flatten)];
}

function texts(tree: ReturnType<typeof buildWidgetTree>): string[] {
  return flatten(tree)
    .filter((n) => n.type === 'TextWidget')
    .map((n) => (n.props as { text: string }).text);
}

function clickUrls(tree: ReturnType<typeof buildWidgetTree>): string[] {
  return flatten(tree)
    .map((n) => (n.props as { clickActionData?: { url?: string } }).clickActionData?.url)
    .filter((url): url is string => typeof url === 'string');
}

describe('VerseOfTheDayWidget', () => {
  // Every composition must survive the real renderer + validator.
  it.each([
    ['compact', 'light'],
    ['compact', 'dark'],
    ['expanded', 'light'],
    ['expanded', 'dark'],
  ] as const)('builds a valid %s / %s tree', (size, theme) => {
    expect(() =>
      buildWidgetTree(
        <VerseOfTheDayWidget
          {...BASE}
          size={size}
          theme={theme}
          explanation="David pictures God weaving him together in the womb."
        />
      )
    ).not.toThrow();
  });

  // Was "clamps to 3 lines". The constant is gone on purpose: a fixed clamp is
  // what left the compact widget with a gap on cells taller than the 148dp it
  // was drawn for (~200dp measured on an S22 Ultra).
  it('sizes the compact verse from the measured cell, and pins the reference row', () => {
    const tree = buildWidgetTree(<VerseOfTheDayWidget {...BASE} size="compact" theme="dark" />);

    const expected = planLayout({ height: BASE.height, size: 'compact', hasNote: false });
    const verse = flatten(tree).find(
      (n) =>
        n.type === 'TextWidget' &&
        (n.props as { maxLines?: number }).maxLines === expected.verseMaxLines
    );
    expect(verse).toBeDefined();
    expect(expected.verseMaxLines).toBeGreaterThan(3);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Psalm 139:14', '✦ VerseMate']));
    // Design: progressive disclosure — no note copy at this size.
    expect(texts(tree)).not.toContain('WHY IT MATTERS');
  });

  it('renders the note panel and its own tap zone when an explanation exists', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget
        {...BASE}
        size="expanded"
        theme="dark"
        explanation="David pictures God weaving him together in the womb."
      />
    );

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'VERSE OF THE DAY',
        'NASB1995',
        'WHY IT MATTERS',
        'Read the full note →',
      ])
    );
    // Two tap zones: the verse block → chapter, the note block → summary tab.
    expect(clickUrls(tree)).toEqual(expect.arrayContaining([BASE.deepLink, BASE.noteDeepLink]));

    // The explanation's line count must come from the MEASURED cell, not a
    // constant. A constant is what left blank rows on tall launchers; a
    // container bound is what clipped the last line mid-glyph. Reintroducing
    // either fails here.
    const expected = planLayout({ height: BASE.height, size: 'expanded', hasNote: true });
    const note = flatten(tree).find((n) =>
      (n.props as { text?: string }).text?.startsWith('David pictures')
    );
    expect((note?.props as { maxLines?: number }).maxLines).toBe(expected.noteMaxLines);
  });

  it('falls back to a verse-only expanded layout when no explanation is served', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} size="expanded" theme="dark" explanation={null} />
    );

    // No empty panel, and the verse takes the freed rows (AMB-001).
    expect(texts(tree)).not.toContain('WHY IT MATTERS');
    expect(texts(tree)).not.toContain('Read the full note →');
    const noNote = planLayout({ height: BASE.height, size: 'expanded', hasNote: false });
    const withNote = planLayout({ height: BASE.height, size: 'expanded', hasNote: true });
    expect(noNote.verseMaxLines).toBeGreaterThan(withNote.verseMaxLines);
    const verse = flatten(tree).find(
      (n) =>
        n.type === 'TextWidget' &&
        (n.props as { maxLines?: number }).maxLines === noNote.verseMaxLines
    );
    expect(verse).toBeDefined();
  });

  // The widget paints into a bitmap, so every word is pixels — without a
  // content description TalkBack announces "VerseMate, image" and the verse is
  // unreadable. This has never worked; it is not a regression guard but a
  // first-time one.
  it.each(['compact', 'expanded'] as const)('labels the %s widget for screen readers', (size) => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} size={size} theme="light" explanation="Why it matters." />
    );

    const label = (tree.props as { accessibilityLabel?: string }).accessibilityLabel ?? '';
    expect(label).toContain('fearfully and wonderfully made');
    expect(label).toContain('Psalm 139:14');
  });

  // Content localised long before the frame did — a Portuguese reader got a
  // Portuguese verse in an English shell.
  it('renders chrome in the stored language', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget
        {...BASE}
        strings={widgetStrings('pt-BR')}
        size="expanded"
        theme="light"
        explanation="Por que importa."
      />
    );

    expect(texts(tree)).toEqual(expect.arrayContaining(['VERSÍCULO DO DIA', 'POR QUE IMPORTA']));
    expect(texts(tree)).not.toContain('VERSE OF THE DAY');
  });

  it('falls back to English when no language is stored', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} strings={widgetStrings(null)} size="expanded" theme="light" />
    );

    expect(texts(tree)).toContain('VERSE OF THE DAY');
  });

  it('shows the fallback message with no reference when the pool is empty', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} verses={null} reference="" size="compact" theme="light" />
    );

    expect(texts(tree)).toContain("Open VerseMate to see today's verse");
    expect(texts(tree)).not.toContain('Psalm 139:14');
  });
});
