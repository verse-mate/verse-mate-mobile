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

  it('clamps the compact verse to 3 lines and pins the reference row', () => {
    const tree = buildWidgetTree(<VerseOfTheDayWidget {...BASE} size="compact" theme="dark" />);

    const verse = flatten(tree).find(
      (n) => n.type === 'TextWidget' && (n.props as { maxLines?: number }).maxLines === 3
    );
    expect(verse).toBeDefined();
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
  });

  it('falls back to a verse-only expanded layout when no explanation is served', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} size="expanded" theme="dark" explanation={null} />
    );

    // No empty panel, and the verse takes the freed rows.
    expect(texts(tree)).not.toContain('WHY IT MATTERS');
    expect(texts(tree)).not.toContain('Read the full note →');
    const verse = flatten(tree).find(
      (n) => n.type === 'TextWidget' && (n.props as { maxLines?: number }).maxLines === 9
    );
    expect(verse).toBeDefined();
  });

  it('shows the fallback message with no reference when the pool is empty', () => {
    const tree = buildWidgetTree(
      <VerseOfTheDayWidget {...BASE} verses={null} reference="" size="compact" theme="light" />
    );

    expect(texts(tree)).toContain("Open VerseMate to see today's verse");
    expect(texts(tree)).not.toContain('Psalm 139:14');
  });
});
