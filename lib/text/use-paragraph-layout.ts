/**
 * Position every paragraph, but only do real work for the ones on screen.
 *
 * ## The problem this solves
 *
 * Windowing needs offsets, offsets need heights, and the first version got heights
 * by compiling and measuring EVERY paragraph. That made chapter mount O(chapter
 * length): 35 lexicon compiles and 35 layout builds for Psalm 119 against 7 for
 * Genesis 1. Rendering was windowed; the arithmetic behind it was not — which is
 * precisely the reported symptom that swiping "depends on the length of the chapter
 * when it really shouldn't", since a swipe mounts the adjacent chapter.
 *
 * ## How it is O(visible)
 *
 * 1. Estimate every paragraph's height from its character count. O(1) each, no
 *    compile, no native call.
 * 2. Accumulate estimated offsets and decide the window.
 * 3. Compile and measure EXACTLY the paragraphs in the window — a handful.
 * 4. Rebuild offsets using exact heights where known and estimates elsewhere.
 * 5. Feed one exact measurement back into the estimator, so later estimates are
 *    calibrated to the real font and width rather than a guessed constant.
 *
 * Everything the user can see or is about to scroll into is exact. Only far
 * off-screen placement is approximate, and only to within about a line.
 */

import { useMemo, useRef } from 'react';
import type { TextStyle } from 'react-native';
import { measureTextHeights } from '@/modules/versemate-text';
import { compileParagraph } from './compile-paragraph';
import {
  calibrateFrom,
  defaultCalibration,
  estimateHeight,
  type HeightCalibration,
} from './estimate-height';
import type { CompiledParagraph, ParagraphInput } from './types';

/** One group's position, and its content when it is close enough to render. */
export interface ParagraphLayout {
  /** Compiled content — only present for paragraphs inside the window. */
  compiled: CompiledParagraph | null;
  /** Height in dp: exact when measured, otherwise estimated. */
  height: number;
  /** True when `height` came from a real measurement rather than an estimate. */
  exact: boolean;
  /** Distance from the top of the first group to the top of this one, in dp. */
  offsetY: number;
  /** Whether this group should render for real. */
  visible: boolean;
}

export interface UseParagraphLayoutOptions {
  groups: ParagraphInput['verses'][];
  /** Width the groups will be laid out at, in dp. */
  width: number;
  style?: TextStyle;
  /** Vertical gap between groups, in dp. */
  gap: number;
  /** Scroll position, in the same space as `offsetY` (i.e. relative to group 0). */
  scrollY: number;
  /** Visible height in dp. */
  viewportHeight: number;
  /** How far beyond the viewport still counts as visible, in dp. */
  bufferPx: number;
  /** Everything else `compileParagraph` needs, shared by every group. */
  shared: Omit<ParagraphInput, 'verses'>;
}

export function useParagraphLayout(options: UseParagraphLayoutOptions): ParagraphLayout[] {
  const { groups, width, style, gap, scrollY, viewportHeight, bufferPx, shared } = options;

  const fontSize = typeof style?.fontSize === 'number' ? style.fontSize : 14;
  const fontFamily = style?.fontFamily;
  const fontWeight = style?.fontWeight != null ? String(style.fontWeight) : undefined;
  const lineHeight = typeof style?.lineHeight === 'number' ? style.lineHeight : undefined;
  const letterSpacing = typeof style?.letterSpacing === 'number' ? style.letterSpacing : undefined;
  const textAlign = style?.textAlign;

  /**
   * Calibration persists across renders and chapters.
   *
   * A ref rather than state on purpose: learning a slightly better constant must
   * never trigger a re-render, and the value is an optimisation detail — using a
   * marginally stale calibration costs nothing, since it only places off-screen
   * content.
   */
  const calibrationRef = useRef<HeightCalibration | null>(null);

  // Character counts drive the estimate. Cheap, and independent of everything except
  // the verses themselves, so this survives scrolling.
  const textLengths = useMemo(
    () =>
      groups.map((verses) =>
        verses.reduce(
          // +2 approximates the verse number and its following space.
          (total, verse) => total + verse.text.length + String(verse.verseNumber).length + 2,
          0
        )
      ),
    [groups]
  );

  return useMemo(() => {
    if (groups.length === 0 || width <= 0) return [];

    const calibration =
      calibrationRef.current ?? defaultCalibration(fontSize, width, lineHeight);

    // --- 1. Estimated offsets, O(1) per group -------------------------------
    const estimated: number[] = [];
    let cursor = 0;
    for (const length of textLengths) {
      estimated.push(cursor);
      cursor += estimateHeight(length, calibration) + gap;
    }

    // --- 2. Window from estimates -------------------------------------------
    const top = scrollY - bufferPx;
    const bottom = scrollY + viewportHeight + bufferPx;
    const inWindow = estimated.map((offset, i) => {
      const height = estimateHeight(textLengths[i], calibration);
      return offset + height >= top && offset <= bottom;
    });

    // Nothing visible means the estimates are probably nonsense (no viewport yet).
    // Render the first screenful rather than nothing — a blank reader is far worse
    // than a little extra work.
    if (!inWindow.some(Boolean)) {
      for (let i = 0; i < Math.min(inWindow.length, 3); i++) inWindow[i] = true;
    }

    // --- 3. Compile + measure ONLY the window -------------------------------
    const windowIndices: number[] = [];
    inWindow.forEach((v, i) => {
      if (v) windowIndices.push(i);
    });

    const compiledByIndex = new Map<number, CompiledParagraph>();
    for (const i of windowIndices) {
      compiledByIndex.set(i, compileParagraph({ ...shared, verses: groups[i] }));
    }

    const measured = measureTextHeights(
      windowIndices.map((i) => {
        const c = compiledByIndex.get(i) as CompiledParagraph;
        return {
          text: c.text,
          // Only metric-affecting ranges: background and foreground colour spans are
          // CharacterStyle, not MetricAffectingSpan, so they cannot change line
          // breaking, and including them would evict the native cache on every
          // highlight toggle.
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
        };
      })
    );

    const exactByIndex = new Map<number, number>();
    if (measured) {
      windowIndices.forEach((groupIndex, k) => {
        const h = measured[k];
        if (typeof h === 'number') exactByIndex.set(groupIndex, h);
      });
    }

    // --- 4. Teach the estimator from a real sample --------------------------
    for (const [groupIndex, height] of exactByIndex) {
      const next = calibrateFrom(textLengths[groupIndex], height, calibration);
      if (next) {
        calibrationRef.current = next;
        break;
      }
    }

    // --- 5. Final offsets: exact where known, estimated elsewhere -----------
    const out: ParagraphLayout[] = [];
    let offsetY = 0;
    for (let i = 0; i < groups.length; i++) {
      const exact = exactByIndex.get(i);
      const height = exact ?? estimateHeight(textLengths[i], calibration);
      out.push({
        compiled: compiledByIndex.get(i) ?? null,
        height,
        exact: exact != null,
        offsetY,
        visible: inWindow[i],
      });
      offsetY += height + gap;
    }
    return out;
  }, [
    groups,
    textLengths,
    width,
    gap,
    scrollY,
    viewportHeight,
    bufferPx,
    shared,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    textAlign,
  ]);
}
