/**
 * Tests for calibrated height estimation.
 *
 * The estimator exists so chapter mount stops being O(chapter length). Its accuracy
 * only has to be good enough for OFF-SCREEN placement — anything near the viewport
 * is measured exactly — but its failure modes matter, because a wildly wrong
 * estimate makes the scrollbar lie and can push a visible paragraph out of the
 * window.
 */

import {
  calibrateFrom,
  defaultCalibration,
  estimateHeight,
  type HeightCalibration,
} from '@/lib/text/estimate-height';

describe('defaultCalibration', () => {
  it('scales characters-per-line with width and inversely with font size', () => {
    const narrow = defaultCalibration(16, 320);
    const wide = defaultCalibration(16, 640);
    expect(wide.charsPerLine).toBeGreaterThan(narrow.charsPerLine);

    const large = defaultCalibration(32, 320);
    expect(large.charsPerLine).toBeLessThan(narrow.charsPerLine);
  });

  it('uses the supplied line height when given', () => {
    expect(defaultCalibration(16, 320, 32).lineHeight).toBe(32);
  });

  it('falls back to a font-relative line height', () => {
    expect(defaultCalibration(16, 320).lineHeight).toBeCloseTo(16 * 1.4);
  });

  it('never reports zero characters per line', () => {
    // A pathologically narrow container must not produce a divide-by-zero or an
    // infinite line count downstream.
    expect(defaultCalibration(100, 1).charsPerLine).toBeGreaterThanOrEqual(1);
  });
});

describe('calibrateFrom', () => {
  const previous: HeightCalibration = { charsPerLine: 40, lineHeight: 20 };

  it('derives characters-per-line from a multi-line sample', () => {
    // 300 chars measured at 100px with ~20px lines => 5 lines => 60 chars/line.
    const next = calibrateFrom(300, 100, previous);
    expect(next).not.toBeNull();
    expect(next?.charsPerLine).toBe(60);
    expect(next?.lineHeight).toBe(20);
  });

  it('refines the line height from the sample', () => {
    // 200 chars, 4 lines by the old line height, but 96px actual => 24px lines.
    const next = calibrateFrom(200, 96, { charsPerLine: 50, lineHeight: 24 });
    expect(next?.lineHeight).toBeCloseTo(24);
  });

  it('refuses a single-line sample', () => {
    // A one-line paragraph could be 1 character or a full line; using it would
    // collapse charsPerLine to that length and inflate every later estimate.
    expect(calibrateFrom(12, 20, previous)).toBeNull();
  });

  it('refuses empty or zero-height samples', () => {
    expect(calibrateFrom(0, 100, previous)).toBeNull();
    expect(calibrateFrom(300, 0, previous)).toBeNull();
  });
});

describe('estimateHeight', () => {
  const calibration: HeightCalibration = { charsPerLine: 50, lineHeight: 20 };

  it('rounds partial lines up', () => {
    expect(estimateHeight(51, calibration)).toBe(40);
    expect(estimateHeight(50, calibration)).toBe(20);
  });

  it('gives an empty paragraph zero height', () => {
    expect(estimateHeight(0, calibration)).toBe(0);
  });

  it('never returns less than one line for non-empty text', () => {
    expect(estimateHeight(1, calibration)).toBe(20);
  });

  it('scales linearly with length', () => {
    expect(estimateHeight(500, calibration)).toBe(estimateHeight(250, calibration) * 2);
  });
});

describe('estimation accuracy after calibration', () => {
  it('lands within one line of the truth for same-style text', () => {
    // Simulate a font where 55 chars fit per line at 22px line height.
    const truth = (len: number) => Math.max(1, Math.ceil(len / 55)) * 22;

    // Calibrate from one real sample, as the hook does.
    const sample = 600;
    const calibrated = calibrateFrom(sample, truth(sample), defaultCalibration(16, 350));
    expect(calibrated).not.toBeNull();

    for (const len of [120, 340, 700, 1500, 3000]) {
      const estimated = estimateHeight(len, calibrated as HeightCalibration);
      const actual = truth(len);
      // Within one line of the real height, which is all off-screen placement needs.
      expect(Math.abs(estimated - actual)).toBeLessThanOrEqual(calibrated!.lineHeight);
    }
  });
});
