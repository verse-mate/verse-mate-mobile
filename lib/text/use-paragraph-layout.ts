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
 *
 * ## What is on screen must not move
 * A measured height is kept once known (per paragraph, until the width or font changes). It used
 * to last only while its paragraph was in the window: one that scrolled out went back to its
 * estimate, so everything below it — the text on screen included — shifted by the estimate's
 * error, and back again when it returned. That was the reader's "text glitches while scrolling,
 * even slowly" on both platforms (Sebastian, 2026-11-01; test: use-paragraph-layout.stability).
 *
 * The window also reaches twice as far in the direction of scrolling, and a paragraph that is
 * rendering keeps rendering until it is that far behind, so a fast fling does not run into
 * placeholders and a paragraph near the edge is not unmounted and rebuilt on every push.
 */

import { useMemo, useRef } from 'react';
import type { TextStyle } from 'react-native';
import { perfSpan } from '@/lib/perf';
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

  /**
   * Measured heights by paragraph, kept across renders. Reset when anything that changes line
   * breaking changes (width, font), since every height is then stale.
   */
  const heightCacheRef = useRef<{
    key: string;
    heights: Map<string, number>;
    /**
     * The estimate a paragraph was first placed with, kept until it is measured. Calibration keeps
     * learning, and re-estimating with it moved every unmeasured paragraph above the screen — and
     * so the screen — on each push.
     */
    estimates: Map<string, number>;
  }>({ key: '', heights: new Map(), estimates: new Map() });
  /** Last scroll position and direction, and which paragraphs rendered, for the window below. */
  const windowStateRef = useRef<{
    scrollY: number;
    /** 0 until the first scroll: a chapter opening gets the plain buffer, no extra mount work. */
    direction: 1 | -1 | 0;
    rendered: Set<string>;
  }>({ scrollY: 0, direction: 0, rendered: new Set() });

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

    // Whole-hook cost, so windowing can be judged against the mount it sits
    // inside. `paragraph.compile` already covers step 3's compiles; this adds the
    // estimation, the window decision and the batched native measure around them.
    const endSpan = perfSpan('layout.paragraphs', { groups: groups.length });

    const calibration =
      calibrationRef.current ?? defaultCalibration(fontSize, width, lineHeight);

    // --- 1. Offsets, O(1) per group ------------------------------------------
    const estimated: number[] = new Array(groups.length);

    // Heights measured earlier stay valid while width and font do.
    const metricsKey = [width, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, textAlign].join('|');
    if (heightCacheRef.current.key !== metricsKey) {
      heightCacheRef.current = { key: metricsKey, heights: new Map(), estimates: new Map() };
    }
    const knownHeights = heightCacheRef.current.heights;
    const frozenEstimates = heightCacheRef.current.estimates;
    const keyOf = (i: number) => {
      const verses = groups[i];
      // Verse range, length and opening words: unique within a chapter and, in practice, across.
      return `${verses[0]?.verseNumber}-${verses[verses.length - 1]?.verseNumber}-${textLengths[i]}-${verses[0]?.text.slice(0, 24)}`;
    };
    const heightOf = (i: number) => {
      const key = keyOf(i);
      const known = knownHeights.get(key) ?? frozenEstimates.get(key);
      if (known !== undefined) return known;
      const estimate = estimateHeight(textLengths[i], calibration);
      frozenEstimates.set(key, estimate);
      return estimate;
    };

    // Offsets from known heights where there are any, estimates elsewhere.
    for (let i = 0, cursor = 0; i < groups.length; i++) {
      estimated[i] = cursor;
      cursor += heightOf(i) + gap;
    }

    // --- 2. Window -----------------------------------------------------------
    // Twice the buffer ahead in the direction of travel; a paragraph already rendering keeps
    // rendering until it is that far behind (hysteresis), so nothing flickers at the edge.
    const state = windowStateRef.current;
    if (scrollY !== state.scrollY) state.direction = scrollY > state.scrollY ? 1 : -1;
    state.scrollY = scrollY;
    const ahead = bufferPx * 2;
    const top = scrollY - (state.direction < 0 ? ahead : bufferPx);
    const bottom = scrollY + viewportHeight + (state.direction > 0 ? ahead : bufferPx);
    const keepTop = scrollY - ahead;
    const keepBottom = scrollY + viewportHeight + ahead;
    const inWindow = estimated.map((offset, i) => {
      const end = offset + heightOf(i);
      if (end >= top && offset <= bottom) return true;
      return state.rendered.has(keyOf(i)) && end >= keepTop && offset <= keepBottom;
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
                r.advanceScale !== undefined ||
                r.fontScale !== undefined ||
                r.baselineShift !== undefined ||
                r.fontWeight !== undefined
            )
            .map((r) => ({
              start: r.start,
              end: r.end,
              fontWeight: r.fontWeight,
              fontScale: r.fontScale,
              advanceScale: r.advanceScale,
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
        if (typeof h === 'number') {
          exactByIndex.set(groupIndex, h);
          knownHeights.set(keyOf(groupIndex), h);
        }
      });
    }
    // Measured before and out of the window now: still exact.
    for (let i = 0; i < groups.length; i++) {
      if (exactByIndex.has(i)) continue;
      const known = knownHeights.get(keyOf(i));
      if (known !== undefined) exactByIndex.set(i, known);
    }
    state.rendered = new Set(windowIndices.map(keyOf));

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
      const height = exact ?? heightOf(i);
      out.push({
        compiled: compiledByIndex.get(i) ?? null,
        height,
        exact: exact != null,
        offsetY,
        visible: inWindow[i],
      });
      offsetY += height + gap;
    }
    endSpan();
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
