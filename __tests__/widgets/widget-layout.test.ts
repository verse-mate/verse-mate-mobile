/**
 * Line-budget tests for the Verse-of-the-Day widget (GH-265 UX follow-up).
 *
 * The budget converts a MEASURED widget height into a line count. Two
 * properties matter more than any single number:
 *
 *  1. It never depends on the text. How many characters fit on a line is
 *     language- and script-dependent (Portuguese and German average longer
 *     words, CJK glyphs are far wider), and getting it wrong fails silently —
 *     it looks like a layout bug. `planLayout` therefore takes no content at
 *     all, and the tests below lock that in.
 *  2. The worst-case stack never exceeds the cell. Overflow is what produced
 *     the two shipped bugs in this widget: text clipped mid-glyph, and a
 *     footer pushed out of the layout entirely.
 */
import { LINE_HEIGHT_FACTOR, planLayout } from '@/widgets/widget-layout';

// Measured this session — see the spec's exploration.md.
const PIXEL_4X4 = 483;
const SAMSUNG_4X4 = 430;
const DESIGN_4X4 = 336;

describe('planLayout — expanded', () => {
  it('gives more room on a taller cell', () => {
    const small = planLayout({ height: DESIGN_4X4, size: 'expanded', hasNote: true });
    const large = planLayout({ height: PIXEL_4X4, size: 'expanded', hasNote: true });

    expect(large.noteMaxLines).toBeGreaterThan(small.noteMaxLines);
  });

  it('never returns fewer lines as the cell grows (monotonic)', () => {
    let previous = 0;
    for (let height = 250; height <= 600; height += 10) {
      const plan = planLayout({ height, size: 'expanded', hasNote: true });
      const total = plan.verseMaxLines + plan.noteMaxLines;
      expect(total).toBeGreaterThanOrEqual(previous);
      previous = total;
    }
  });

  // The property that protects the language-independence decision. If someone
  // reintroduces a chars-per-line estimate, the signature has to change and
  // this stops compiling — which is the point.
  it('depends only on height and composition, never on the text', () => {
    const a = planLayout({ height: SAMSUNG_4X4, size: 'expanded', hasNote: true });
    const b = planLayout({ height: SAMSUNG_4X4, size: 'expanded', hasNote: true });

    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual(['noteMaxLines', 'showTags', 'verseMaxLines'].sort());
  });

  // Overflow is the failure mode that shipped twice. The worst case is every
  // block rendering to its full allocation at once.
  it('worst-case stack fits inside the measured cell', () => {
    for (const height of [DESIGN_4X4, SAMSUNG_4X4, PIXEL_4X4, 250, 600]) {
      const plan = planLayout({ height, size: 'expanded', hasNote: true });
      const used =
        plan.verseMaxLines * 16 * LINE_HEIGHT_FACTOR + plan.noteMaxLines * 13 * LINE_HEIGHT_FACTOR;
      expect(used).toBeLessThanOrEqual(height);
    }
  });

  it('keeps a legible minimum on a cell smaller than the design', () => {
    const plan = planLayout({ height: 200, size: 'expanded', hasNote: true });

    expect(plan.verseMaxLines).toBeGreaterThanOrEqual(2);
    expect(plan.noteMaxLines).toBeGreaterThanOrEqual(2);
  });

  it('gives the note nothing when the API served no summary', () => {
    const plan = planLayout({ height: PIXEL_4X4, size: 'expanded', hasNote: false });

    expect(plan.noteMaxLines).toBe(0);
    // AMB-001: with no note to promote, the verse takes the freed rows.
    const withNote = planLayout({ height: PIXEL_4X4, size: 'expanded', hasNote: true });
    expect(plan.verseMaxLines).toBeGreaterThan(withNote.verseMaxLines);
  });

  it('only offers tags once the cell is genuinely large', () => {
    expect(planLayout({ height: DESIGN_4X4, size: 'expanded', hasNote: true }).showTags).toBe(
      false
    );
    expect(planLayout({ height: PIXEL_4X4, size: 'expanded', hasNote: true }).showTags).toBe(true);
  });
});

// Half the original report. The first draft of the spec ignored compact
// entirely; the user's screenshot showed it just as empty as expanded.
describe('planLayout — compact', () => {
  it('grows the verse into a taller-than-designed cell', () => {
    const design = planLayout({ height: 148, size: 'compact', hasNote: false });
    const real = planLayout({ height: 200, size: 'compact', hasNote: false });

    expect(real.verseMaxLines).toBeGreaterThan(design.verseMaxLines);
  });

  it('never shows a note or tags', () => {
    const plan = planLayout({ height: 260, size: 'compact', hasNote: true });

    expect(plan.noteMaxLines).toBe(0);
    expect(plan.showTags).toBe(false);
  });

  it('worst-case stack fits inside the measured cell', () => {
    for (const height of [148, 200, 260]) {
      const plan = planLayout({ height, size: 'compact', hasNote: false });
      expect(plan.verseMaxLines * 15 * LINE_HEIGHT_FACTOR).toBeLessThanOrEqual(height);
    }
  });
});
