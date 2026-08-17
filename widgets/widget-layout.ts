/**
 * Line budget for the Verse-of-the-Day widget (GH-265 UX follow-up).
 *
 * Converts the MEASURED widget height into per-block line counts, so the
 * composition fills the cell it actually got rather than the one the design
 * assumed. Real cells run far larger than the 336dp design — 483dp measured on
 * a Pixel emulator, ~430dp on a Samsung S22 Ultra — which is why the widget
 * rendered mostly empty.
 *
 * TWO RULES HOLD THIS TOGETHER.
 *
 * 1. The budget NEVER looks at the text. How many characters fit on a line is
 *    language- and script-dependent, and an estimate that is wrong fails
 *    silently — it reads as a layout bug rather than a miscalibration. We decide
 *    only how many LINES there is room for; the TextView decides what fits on
 *    each one. `planLayout` therefore takes no content, and a test locks the
 *    signature in.
 *
 * 2. The worst case must fit. `RemoteViews` can only ellipsize at `maxLines`,
 *    never at a container bound, so a budget that over-allocates produces text
 *    clipped mid-glyph — or, worse, a footer pushed out of the layout entirely.
 *    Both have shipped from this file before. The allocation below is
 *    constructed so every block at its full allocation still fits.
 *
 * Space left over when the copy is shorter than its allocation is NOT reclaimed
 * here — it can't be, without measuring text. The widget centres its content
 * instead (`justifyContent: 'center'` maps to `CENTER_VERTICAL`), so the layout
 * engine distributes the slack using real rendered heights and it reads as
 * framing rather than a hole. That is the common case: the median summary is
 * 234 characters against ~11 lines of room.
 */

/**
 * Android's default line height is roughly 1.2× the font size (ascent + descent
 * + leading). 1.25 rounds against us on purpose — over-estimating the line box
 * under-fills slightly, which is recoverable; under-estimating overflows, which
 * is the failure mode above.
 */
export const LINE_HEIGHT_FACTOR = 1.25;

export type WidgetSize = 'compact' | 'expanded';

export interface LayoutPlan {
  verseMaxLines: number;
  /** 0 when there is no summary to show, or on the compact composition. */
  noteMaxLines: number;
  showTags: boolean;
}

interface PlanInput {
  /** Measured cell height in dp — `props.widgetInfo.height`. */
  height: number;
  size: WidgetSize;
  /** Whether the API served an `explanation` for today's verse. */
  hasNote: boolean;
}

/**
 * Non-text vertical space per composition, in dp: paddings, margins, gaps, and
 * the single-line rows (eyebrow, reference/wordmark footer, note label, note
 * link). Derived from the style values in `VerseOfTheDayWidget.tsx` — if those
 * change, these change with them.
 */
const CHROME = {
  compact: 48, // paddingVertical 16×2 + footer row ~16
  expandedWithNote: 166, // verse block 82 + panel 84 (margin, padding, label, link)
  expandedNoNote: 82, // paddingTop 18 + eyebrow 13 + gaps 20 + footer 17 + paddingBottom 14
} as const;

const FONT = { compactVerse: 15, expandedVerse: 16, note: 13 } as const;

/** Below this measured height, tags are noise rather than filler. */
const TAGS_MIN_HEIGHT = 460;

const lineBox = (fontSize: number) => fontSize * LINE_HEIGHT_FACTOR;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function planLayout({ height, size, hasNote }: PlanInput): LayoutPlan {
  if (size === 'compact') {
    // No note at this size by design — progressive disclosure. All the text
    // space is the verse's, which is what fixes the compact widget's gap: on a
    // 200dp cell it can run to 8 lines instead of a hard 3.
    const space = height - CHROME.compact;
    const verseMaxLines = clamp(Math.floor(space / lineBox(FONT.compactVerse)), 2, 10);
    return { verseMaxLines, noteMaxLines: 0, showTags: false };
  }

  if (!hasNote) {
    // AMB-001: nothing to promote into the slack, so the verse takes it.
    const space = height - CHROME.expandedNoNote;
    const verseMaxLines = clamp(Math.floor(space / lineBox(FONT.expandedVerse)), 3, 14);
    return { verseMaxLines, noteMaxLines: 0, showTags: false };
  }

  const space = height - CHROME.expandedWithNote;
  const verseBox = lineBox(FONT.expandedVerse);
  const noteBox = lineBox(FONT.note);

  // Ladder order: the verse is the product, so it takes slack first — but only
  // up to a cap, because a wall of verse with a two-line note reads worse than
  // a balanced card. Everything past the cap goes to the summary.
  const NOTE_MIN = 2;
  const verseMaxLines = clamp(
    Math.floor((space - NOTE_MIN * noteBox) / verseBox),
    3,
    6
  );
  const noteMaxLines = clamp(
    Math.floor((space - verseMaxLines * verseBox) / noteBox),
    NOTE_MIN,
    24
  );

  return { verseMaxLines, noteMaxLines, showTags: height >= TAGS_MIN_HEIGHT };
}
