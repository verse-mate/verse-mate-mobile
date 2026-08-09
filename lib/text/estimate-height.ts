/**
 * Cheap O(1) paragraph height estimation, calibrated against real measurements.
 *
 * ## Why estimation is needed at all
 *
 * Windowing can only skip work if it knows where each paragraph *is*, and offsets
 * need heights. Measuring every paragraph to get them makes chapter mount O(chapter
 * length) — 35 layout builds for Psalm 119 against 7 for Genesis 1 — which is
 * exactly the "swiping depends on the length of the chapter when it shouldn't"
 * symptom.
 *
 * So: estimate every paragraph cheaply, use the estimates to decide the window, and
 * measure exactly only the handful inside it. Mount becomes O(visible) plus O(n)
 * arithmetic.
 *
 * ## Why calibrated rather than guessed
 *
 * A fixed average-character-width constant is wrong for every font, weight, size and
 * script, and the error compounds over a long chapter until the scrollbar is
 * visibly lying. Instead the first real measurement teaches the estimator how many
 * characters actually fit on a line at this width and style, and every later
 * estimate uses that. One exact data point costs nothing — the window needs it
 * anyway — and it makes estimates correct to within a line for text in the same
 * style.
 *
 * Estimates are only ever used for paragraphs far off-screen. Anything near the
 * viewport is measured exactly, so what the user can actually see and scroll
 * through is never approximated.
 */

/** Calibration derived from one or more exact measurements. */
export interface HeightCalibration {
  /** Characters that fit on one line at this width and style. */
  charsPerLine: number;
  /** Height of one line in dp, including leading. */
  lineHeight: number;
}

/**
 * Fallback used before any exact measurement exists.
 *
 * 0.5em average advance is a reasonable middle for Latin body text; it is wrong for
 * any specific font, which is why it is replaced by real calibration as soon as one
 * paragraph has been measured. Only affects the very first frame of the very first
 * chapter of a session.
 */
export function defaultCalibration(fontSize: number, width: number, lineHeight?: number): HeightCalibration {
  const avgCharWidth = fontSize * 0.5;
  return {
    charsPerLine: Math.max(1, Math.floor(width / avgCharWidth)),
    lineHeight: lineHeight && lineHeight > 0 ? lineHeight : fontSize * 1.4,
  };
}

/**
 * Learn from an exactly-measured paragraph.
 *
 * Returns null when the sample cannot teach anything — an empty paragraph, or one
 * short enough to occupy a single line, where the height reveals the line height but
 * says nothing about how many characters fit on one.
 */
export function calibrateFrom(
  textLength: number,
  measuredHeight: number,
  previous: HeightCalibration
): HeightCalibration | null {
  if (textLength <= 0 || measuredHeight <= 0) return null;
  const lines = Math.round(measuredHeight / previous.lineHeight);
  // A single-line sample gives no information about wrapping: the text could be one
  // character or exactly a full line. Using it would collapse charsPerLine to the
  // sample's length and inflate every later estimate.
  if (lines < 2) return null;
  return {
    charsPerLine: Math.max(1, Math.round(textLength / lines)),
    lineHeight: measuredHeight / lines,
  };
}

/** Estimated height in dp for a paragraph of `textLength` characters. */
export function estimateHeight(textLength: number, calibration: HeightCalibration): number {
  if (textLength <= 0) return 0;
  const lines = Math.max(1, Math.ceil(textLength / calibration.charsPerLine));
  return lines * calibration.lineHeight;
}
