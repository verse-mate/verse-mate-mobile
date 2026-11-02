/**
 * The text on screen must not move while the reader scrolls.
 *
 * Sebastian (2026-11-01): scrolling, even slowly, the text glitches, on iOS and Android, highlights
 * or not. Only paragraphs inside the render window are measured; the rest are placed by an
 * estimate. A paragraph that left the window went back to its estimated height, so everything
 * below it, the text on screen included, shifted by the estimate's error — and back again when
 * the paragraph re-entered the window.
 */

import { renderHook } from '@testing-library/react-native';
import type { CompileTheme, ParagraphInput } from '@/lib/text/types';
import { useParagraphLayout } from '@/lib/text/use-paragraph-layout';

// Real measurements that an estimate cannot match for every paragraph: the same text length
// wraps to 5, 6 or 7 lines depending on the paragraph (by its group, read from its first verse
// number), the way real paragraphs with the same character count wrap differently.
jest.mock('@/modules/versemate-text', () => ({
  measureTextHeights: (inputs: { text: string }[]) =>
    inputs.map(({ text }) => {
      const firstVerse = Number(/\d+/.exec(text)?.[0] ?? 0);
      const group = Math.floor(firstVerse / 3);
      return 180 + (group % 3) * 36;
    }),
}));

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

function makeGroups(count: number): ParagraphInput['verses'][] {
  return Array.from({ length: count }, (_, g) =>
    Array.from({ length: 3 }, (_, v) => ({
      verseNumber: g * 3 + v + 1,
      text: `Verse ${g * 3 + v + 1}: in the beginning God created the heavens and the earth.`,
    }))
  );
}

const GROUPS = makeGroups(40);

function useLayoutAt(scrollY: number) {
  return useParagraphLayout({
    groups: GROUPS,
    width: 360,
    style: { fontSize: 18, lineHeight: 36 },
    gap: 12,
    scrollY,
    viewportHeight: 800,
    bufferPx: 600,
    shared: { theme: THEME },
  });
}

describe('useParagraphLayout — what is on screen stays put while scrolling', () => {
  it('keeps a visible paragraph at the same offset as paragraphs above leave the window', () => {
    const { result, rerender } = renderHook(({ y }: { y: number }) => useLayoutAt(y), {
      initialProps: { y: 0 },
    });
    rerender({ y: 1600 });
    // A paragraph on screen at the start (top edge at least 300 below the viewport top), followed
    // through a slow scroll of 600 in steps of 100 while it stays on screen.
    const watched = result.current.findIndex((p) => p.offsetY >= 1600 + 300);
    expect(watched).toBeGreaterThan(0);
    const offsets: number[] = [];
    for (let y = 1600; y <= 2200; y += 100) {
      rerender({ y });
      expect(result.current[watched].visible).toBe(true);
      offsets.push(result.current[watched].offsetY);
    }
    expect(new Set(offsets).size).toBe(1);
  });

  it('puts a paragraph back where it was after scrolling away and back', () => {
    const { result, rerender } = renderHook(({ y }: { y: number }) => useLayoutAt(y), {
      initialProps: { y: 2000 },
    });
    const before = result.current[14].offsetY;
    rerender({ y: 6000 });
    rerender({ y: 2000 });
    expect(result.current[14].offsetY).toBe(before);
  });
});
