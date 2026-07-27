/**
 * Compute paragraph heights and positions BEFORE anything is laid out.
 *
 * ## Why this exists
 *
 * Windowing paragraph groups by their recorded `onLayout` position does not help
 * the case that needs it most. On a chapter's first mount nothing has been laid out
 * yet, so every group looks "position unknown" and renders for real — which is
 * exactly the moment ~31 off-screen views get created. Measured: adding
 * layout-based windowing left `paragraph.compile` at n=349 and chapter mount at
 * 761ms, i.e. changed nothing.
 *
 * The native module can measure text synchronously *without creating a view*, so
 * heights — and therefore cumulative offsets — are knowable during the very first
 * render. That is what lets the first mount skip work rather than merely the
 * scrolls after it.
 *
 * Positions are exact, not estimated, so placeholders occupy precisely the space
 * their text would: content height is correct from the first frame, the scrollbar
 * does not jump as groups fill in, and `measureLayout`-based scroll-to-verse keeps
 * working. That is the difference between this and the `setBibleSectionsMax`
 * progressive-reveal it replaces, which shows the right number of sections
 * eventually but the wrong content height meanwhile.
 */

import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { measureTextHeights } from '@/modules/versemate-text';
import { compileParagraph } from './compile-paragraph';
import type { CompiledParagraph, ParagraphInput } from './types';

/** One group's compiled content plus where it sits in the scroll content. */
export interface ParagraphLayout {
  compiled: CompiledParagraph;
  /** Measured height in dp, or null when native measurement is unavailable. */
  height: number | null;
  /** Distance from the top of the first group to the top of this one, in dp. */
  offsetY: number;
}

export interface UseParagraphLayoutOptions {
  /** One entry per paragraph group, in document order. */
  groups: ParagraphInput['verses'][];
  /** Width the groups will be laid out at, in dp. */
  width: number;
  /** Base text style; font attributes drive measurement. */
  style?: TextStyle;
  /** Vertical gap between groups, in dp. Part of the offset arithmetic. */
  gap: number;
  /** Everything else `compileParagraph` needs, shared by every group. */
  shared: Omit<ParagraphInput, 'verses'>;
}

/**
 * Compile and measure every group, and accumulate offsets.
 *
 * Measurement is batched into ONE native call. A chapter can hold ~35 groups, and
 * 35 separate JSI crossings for work that is identical per item is pure overhead —
 * the per-item cost is the same either way and is cached natively by spec.
 */
export function useParagraphLayout(options: UseParagraphLayoutOptions): ParagraphLayout[] {
  const { groups, width, style, gap, shared } = options;

  const compiled = useMemo(
    () => groups.map((verses) => compileParagraph({ ...shared, verses })),
    [groups, shared]
  );

  // Font attributes are read once here rather than per group: they are shared, and
  // pulling them out keeps the measurement memo's key small.
  const fontSize = typeof style?.fontSize === 'number' ? style.fontSize : 14;
  const fontFamily = style?.fontFamily;
  const fontWeight = style?.fontWeight != null ? String(style.fontWeight) : undefined;
  const lineHeight = typeof style?.lineHeight === 'number' ? style.lineHeight : undefined;
  const letterSpacing = typeof style?.letterSpacing === 'number' ? style.letterSpacing : undefined;
  const textAlign = style?.textAlign;

  return useMemo(() => {
    const heights =
      width > 0
        ? measureTextHeights(
            compiled.map((c) => ({
              text: c.text,
              // Only metric-affecting ranges. Background and foreground colour spans
              // are CharacterStyle, not MetricAffectingSpan, so they provably cannot
              // change line breaking — including them would evict the native
              // measurement cache on every highlight toggle for nothing.
              ranges: c.ranges
                .filter(
                  (r) =>
                    r.fontScale !== undefined ||
                    r.baselineShift !== undefined ||
                    r.fontWeight !== undefined
                )
                .map((r) => ({
                  start: r.start,
                  end: r.end,
                  fontWeight: r.fontWeight,
                  fontScale: r.fontScale,
                  baselineShift: r.baselineShift,
                  interactive: false,
                })),
              width,
              fontSize,
              fontFamily,
              fontWeight,
              lineHeight,
              letterSpacing,
              textAlign,
            }))
          )
        : null;

    let offsetY = 0;
    return compiled.map((c, i) => {
      const height = heights?.[i] ?? null;
      const layout: ParagraphLayout = { compiled: c, height, offsetY };
      // An unmeasured group contributes nothing to the running offset. That makes
      // every subsequent offset meaningless, which is why `isParagraphVisible`
      // treats a null height as "always render" rather than trusting the number.
      if (height != null) offsetY += height + gap;
      return layout;
    });
  }, [
    compiled,
    width,
    gap,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    textAlign,
  ]);
}

/**
 * Whether a group is close enough to the viewport to be worth rendering for real.
 *
 * `scrollY` and `viewportHeight` are in the same coordinate space as `offsetY` —
 * i.e. relative to the first group — so the caller passes the scroll position
 * already adjusted for whatever sits above the paragraph list.
 *
 * Returns true when the height is unknown, because then the offsets downstream are
 * unreliable too and a wrong guess shows blank content. Over-rendering is a
 * performance cost; under-rendering is a visible bug.
 */
export function isParagraphVisible(
  layout: ParagraphLayout,
  scrollY: number,
  viewportHeight: number,
  bufferPx: number
): boolean {
  if (layout.height == null) return true;
  const top = layout.offsetY;
  const bottom = top + layout.height;
  return bottom >= scrollY - bufferPx && top <= scrollY + viewportHeight + bufferPx;
}
