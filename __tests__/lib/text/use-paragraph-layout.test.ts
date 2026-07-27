/**
 * Tests for pre-layout paragraph positioning.
 *
 * The point of this module is that offsets are known during the FIRST render, so a
 * chapter's off-screen groups can be skipped at mount rather than only on later
 * scrolls. These tests pin the arithmetic and — more importantly — the fallback
 * behaviour when measurement is unavailable, because getting that wrong shows the
 * user blank text rather than a slow screen.
 */

import { isParagraphVisible, type ParagraphLayout } from '@/lib/text/use-paragraph-layout';

function layout(offsetY: number, height: number | null): ParagraphLayout {
  return {
    compiled: { text: '', ranges: [], targets: [], verses: [] },
    height,
    offsetY,
  };
}

describe('isParagraphVisible', () => {
  const viewport = 800;
  const buffer = 600;

  it('renders a group inside the viewport', () => {
    expect(isParagraphVisible(layout(0, 200), 0, viewport, buffer)).toBe(true);
    expect(isParagraphVisible(layout(400, 200), 0, viewport, buffer)).toBe(true);
  });

  it('renders a group within the buffer above the viewport', () => {
    // Scrolled to 2000; a group ending at 1500 is 500px above, inside the 600 buffer.
    expect(isParagraphVisible(layout(1300, 200), 2000, viewport, buffer)).toBe(true);
  });

  it('renders a group within the buffer below the viewport', () => {
    // Viewport bottom is 800; a group starting at 1300 is 500px below.
    expect(isParagraphVisible(layout(1300, 200), 0, viewport, buffer)).toBe(true);
  });

  it('skips a group far above the viewport', () => {
    expect(isParagraphVisible(layout(0, 200), 5000, viewport, buffer)).toBe(false);
  });

  it('skips a group far below the viewport', () => {
    expect(isParagraphVisible(layout(5000, 200), 0, viewport, buffer)).toBe(false);
  });

  it('renders a group whose height is unknown', () => {
    // Without a height the offsets downstream are unreliable too, so guessing
    // "not visible" would blank real content. Over-rendering costs time;
    // under-rendering is a visible bug.
    expect(isParagraphVisible(layout(99999, null), 0, viewport, buffer)).toBe(true);
  });

  it('includes a group that straddles the viewport top', () => {
    expect(isParagraphVisible(layout(1900, 400), 2000, viewport, buffer)).toBe(true);
  });

  it('treats a zero buffer as viewport-only', () => {
    expect(isParagraphVisible(layout(900, 100), 0, viewport, 0)).toBe(false);
    expect(isParagraphVisible(layout(700, 100), 0, viewport, 0)).toBe(true);
  });
});
