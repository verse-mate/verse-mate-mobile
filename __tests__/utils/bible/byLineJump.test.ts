/**
 * Regression coverage for the quick-verse-jump scroll-target math used on
 * react-native-web. Round-1 fix landed the pill above the chapter-nav FAB row;
 * round-2 QA found `View.measureLayout` is a no-op on RNW so the integration
 * scroll dispatch silently died. This helper isolates the web math so a
 * non-zero scroll target is asserted by unit test (QA round-2 explicit ask).
 */

import { computeByLineJumpY } from '@/utils/bible/byLineJump';

describe('computeByLineJumpY', () => {
  it('returns a non-zero target when the section is below the viewport', () => {
    // Section sits 800px down the page; scroll container starts at top of viewport.
    const y = computeByLineJumpY({ top: 100, scrollTop: 0 }, { top: 900 }, 12);
    expect(y).toBe(788); // 900 - 100 + 0 - 12
    expect(y).toBeGreaterThan(0);
  });

  it('preserves the existing scrollTop offset (forward jump from mid-page)', () => {
    // User already scrolled 500px; section's viewport top reflects that.
    const y = computeByLineJumpY({ top: 0, scrollTop: 500 }, { top: 200 }, 12);
    expect(y).toBe(688); // 200 - 0 + 500 - 12
  });

  it('clamps to 0 instead of returning a negative scroll target', () => {
    // Section is above the current scroll position (negative top), bias would
    // otherwise produce a negative y; scrollTo expects non-negative.
    const y = computeByLineJumpY({ top: 0, scrollTop: 0 }, { top: -50 }, 12);
    expect(y).toBe(0);
  });

  it('handles long-chapter offsets without overflow (Psalm 119 v176 magnitude)', () => {
    // v176 was reported at offsetTop ~127425 in QA round-2 evidence.
    const y = computeByLineJumpY({ top: 0, scrollTop: 0 }, { top: 127425 }, 12);
    expect(y).toBe(127413);
  });
});
