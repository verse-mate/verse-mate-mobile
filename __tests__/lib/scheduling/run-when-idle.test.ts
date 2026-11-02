import { runWhenIdle } from '@/lib/scheduling/run-when-idle';

describe('runWhenIdle', () => {
  const g = globalThis as { requestIdleCallback?: unknown; cancelIdleCallback?: unknown };
  const saved = { ric: g.requestIdleCallback, cic: g.cancelIdleCallback };

  afterEach(() => {
    g.requestIdleCallback = saved.ric;
    g.cancelIdleCallback = saved.cic;
    jest.useRealTimers();
  });

  it('uses requestIdleCallback when the runtime has it, and cancels through it', () => {
    const ric = jest.fn(() => 7);
    const cic = jest.fn();
    g.requestIdleCallback = ric;
    g.cancelIdleCallback = cic;
    const task = jest.fn();

    runWhenIdle(task).cancel();
    expect(ric).toHaveBeenCalledWith(task);
    expect(cic).toHaveBeenCalledWith(7);
  });

  it('falls back to the next macrotask, and cancel stops it', () => {
    jest.useFakeTimers();
    g.requestIdleCallback = undefined;
    const ran = jest.fn();
    const skipped = jest.fn();

    runWhenIdle(ran);
    runWhenIdle(skipped).cancel();
    jest.runAllTimers();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(skipped).not.toHaveBeenCalled();
  });
});
