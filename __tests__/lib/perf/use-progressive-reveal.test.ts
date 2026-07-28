/**
 * Tests for the per-frame render budget.
 *
 * The properties that matter are the ones the perf work depends on: it must reach `total`
 * (never truncate), it must take MORE THAN ONE frame to get there (or it is not splitting the
 * mount batch and is just overhead), and it must restart on new content.
 */

import { useProgressiveReveal } from '@/lib/perf/use-progressive-reveal';
import { act, renderHook } from '@testing-library/react-native';

/** Drive `requestAnimationFrame` manually so frame boundaries are observable. */
function withManualFrames() {
  const queue: FrameRequestCallback[] = [];
  const rAF = jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    });
  const cancel = jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  return {
    /** Run exactly one pending frame. Returns false when nothing was queued. */
    tick() {
      const cb = queue.shift();
      if (!cb) return false;
      act(() => {
        cb(0);
      });
      return true;
    },
    pending: () => queue.length,
    restore() {
      rAF.mockRestore();
      cancel.mockRestore();
    },
  };
}

describe('useProgressiveReveal', () => {
  let frames: ReturnType<typeof withManualFrames>;
  beforeEach(() => {
    frames = withManualFrames();
  });
  afterEach(() => frames.restore());

  it('starts at the initial budget rather than the total', () => {
    const { result } = renderHook(() => useProgressiveReveal(40, { initial: 6, step: 6 }));
    expect(result.current).toBe(6);
  });

  it('takes several frames to reach the total, which is the whole point', () => {
    const { result } = renderHook(() => useProgressiveReveal(40, { initial: 6, step: 6 }));
    const seen = [result.current];
    // Bounded so a bug that never terminates fails the test instead of hanging it.
    for (let i = 0; i < 50 && frames.tick(); i++) seen.push(result.current);

    expect(seen[0]).toBe(6);
    expect(seen.length).toBeGreaterThan(3);
    expect(result.current).toBe(40);
    // Strictly increasing: a repeated value would mean a wasted frame.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
  });

  it('stops scheduling frames once the total is reached', () => {
    renderHook(() => useProgressiveReveal(12, { initial: 6, step: 6 }));
    frames.tick();
    expect(frames.pending()).toBe(0);
  });

  it('never exceeds the total', () => {
    const { result } = renderHook(() => useProgressiveReveal(10, { initial: 6, step: 6 }));
    for (let i = 0; i < 10 && frames.tick(); i++);
    expect(result.current).toBe(10);
  });

  it('does not ramp when the total already fits in the first frame', () => {
    const { result } = renderHook(() => useProgressiveReveal(4, { initial: 6, step: 6 }));
    expect(result.current).toBe(4);
    expect(frames.pending()).toBe(0);
  });

  it('renders everything at once when disabled', () => {
    const { result } = renderHook(() =>
      useProgressiveReveal(40, { initial: 6, step: 6, enabled: false })
    );
    expect(result.current).toBe(40);
    expect(frames.pending()).toBe(0);
  });

  it('restarts the ramp for new content', () => {
    const { result, rerender } = renderHook(({ total }) => useProgressiveReveal(total, {}), {
      initialProps: { total: 40 },
    });
    for (let i = 0; i < 10 && frames.tick(); i++);
    expect(result.current).toBe(40);

    // A different chapter or tab is a fresh mount and must be staged the same way.
    rerender({ total: 30 });
    expect(result.current).toBe(6);
  });
});
