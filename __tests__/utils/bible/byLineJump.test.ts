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

  // VERA-36: desktop viewport regression. At width >= 900dp the app renders
  // the explanations panel as a split-view right panel, so the byline
  // ScrollView's rect.top is offset by the panel header + tab bar (~120dp).
  // The math must produce the correct target when scrollTop is mid-chapter.
  it('computes desktop-viewport target when ScrollView sits below the split-panel header', () => {
    const y = computeByLineJumpY({ top: 120, scrollTop: 0 }, { top: 800 }, 12);
    expect(y).toBe(668); // 800 - 120 + 0 - 12
  });

  it('preserves desktop forward-jump magnitude when user has scrolled mid-chapter', () => {
    // Right panel scrolled 1200px; the section's viewport-relative top is just
    // below the visible area. Result must equal the absolute scroll target,
    // unaffected by the panel's chrome offset.
    const y = computeByLineJumpY({ top: 120, scrollTop: 1200 }, { top: 400 }, 12);
    expect(y).toBe(1468); // 400 - 120 + 1200 - 12
  });

  it('handles Psalm 119 v176 magnitude inside a split-view right panel', () => {
    // Same offsetTop magnitude as the phone case above (~127425), but with the
    // ScrollView mounted inside a 120dp-tall chrome stack.
    const y = computeByLineJumpY({ top: 120, scrollTop: 0 }, { top: 127425 }, 12);
    expect(y).toBe(127293);
  });
});
