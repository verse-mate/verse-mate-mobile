/**
 * Tests for paragraph placement and windowing.
 *
 * The property that matters is that mount work does NOT scale with chapter length.
 * That is the whole reason this hook exists: the previous version compiled and
 * measured every paragraph to compute offsets, so a 176-verse chapter did 35 lexicon
 * compiles and 35 layout builds where a 31-verse chapter did 7 — which is exactly
 * what "swiping depends on the length of the chapter" felt like.
 */

import { renderHook } from '@testing-library/react-native';
import type { CompileTheme, ParagraphInput } from '@/lib/text/types';
import { useParagraphLayout } from '@/lib/text/use-paragraph-layout';

const THEME: CompileTheme = {
  mode: 'light',
  lexUnderlineColor: 'rgba(176,154,109,0.55)',
  lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
  lexUnderlineThickness: 1,
  lexUnderlineStyle: 'dotted',
  redLetterColor: '#c1121f',
  selectionColor: '#3390FF40',
};

/** `count` paragraph groups of five verses each, roughly Bible-sized. */
function makeGroups(count: number): ParagraphInput['verses'][] {
  return Array.from({ length: count }, (_, g) =>
    Array.from({ length: 5 }, (_, v) => ({
      verseNumber: g * 5 + v + 1,
      text: 'In the beginning God created the heavens and the earth, and it was very good.',
    }))
  );
}

function render(groupCount: number, over: Partial<Parameters<typeof useParagraphLayout>[0]> = {}) {
  return renderHook(() =>
    useParagraphLayout({
      groups: makeGroups(groupCount),
      width: 360,
      style: { fontSize: 18, lineHeight: 36 },
      gap: 12,
      scrollY: 0,
      viewportHeight: 800,
      bufferPx: 600,
      shared: { theme: THEME },
      ...over,
    })
  ).result.current;
}

describe('useParagraphLayout — work does not scale with chapter length', () => {
  it('compiles only the paragraphs inside the window', () => {
    const short = render(7); // ~Genesis 1
    const long = render(35); // ~Psalm 119

    const compiledShort = short.filter((p) => p.compiled !== null).length;
    const compiledLong = long.filter((p) => p.compiled !== null).length;

    // The long chapter must not compile ~5x more just for being longer. Both are
    // bounded by what fits in viewport + buffer.
    expect(compiledLong).toBeLessThanOrEqual(compiledShort + 2);
    expect(compiledLong).toBeLessThan(long.length);
  });

  it('still positions every paragraph, compiled or not', () => {
    const layouts = render(35);
    expect(layouts).toHaveLength(35);
    expect(layouts.every((p) => Number.isFinite(p.offsetY))).toBe(true);
    expect(layouts.every((p) => p.height > 0)).toBe(true);
  });

  it('produces strictly increasing offsets', () => {
    // A non-monotonic offset would place a later paragraph above an earlier one and
    // corrupt the window decision for everything after it.
    const layouts = render(35);
    for (let i = 1; i < layouts.length; i++) {
      expect(layouts[i].offsetY).toBeGreaterThan(layouts[i - 1].offsetY);
    }
  });

  it('marks far-off paragraphs as not visible', () => {
    const layouts = render(35);
    expect(layouts[layouts.length - 1].visible).toBe(false);
  });

  it('marks the top of the chapter visible at scroll 0', () => {
    const layouts = render(35);
    expect(layouts[0].visible).toBe(true);
  });

  it('moves the window as the reader scrolls', () => {
    const atTop = render(35, { scrollY: 0 });
    const scrolled = render(35, { scrollY: 5000 });

    expect(atTop[0].visible).toBe(true);
    expect(scrolled[0].visible).toBe(false);
    // Something further down must have taken its place.
    expect(scrolled.some((p, i) => p.visible && i > 5)).toBe(true);
  });

  it('renders something rather than nothing when the viewport is unknown', () => {
    // A zero viewport would otherwise window everything out and blank the reader,
    // which is far worse than doing a little extra work.
    const layouts = render(35, { viewportHeight: 0, bufferPx: 0 });
    expect(layouts.some((p) => p.visible)).toBe(true);
  });

  it('returns nothing for an empty chapter or an unknown width', () => {
    expect(render(0)).toEqual([]);
    expect(render(10, { width: 0 })).toEqual([]);
  });
});
