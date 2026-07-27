/**
 * Tests for the perf monitor.
 *
 * These use fake timers so the heartbeat's block detection can be exercised
 * deterministically — the whole point of the monitor is measuring elapsed time,
 * so both `setInterval` AND the clock it reads have to be controlled together.
 * `performance.now()` is stubbed to follow the fake clock for that reason.
 */

import {
  isPerfMonitorRunning,
  perfCount,
  perfSpan,
  startPerfMonitor,
  stopPerfMonitor,
} from '@/lib/perf/monitor';
import type { PerfRecord } from '@/lib/perf/types';

/** Current fake wall-clock, advanced only via `advance()`. */
let clock = 0;

/**
 * Advance both the fake timer queue and the clock the monitor reads.
 *
 * Order matters: the clock has to move BEFORE the timers fire, otherwise the
 * heartbeat callback reads the pre-advance time and observes no gap.
 */
function advance(ms: number): void {
  clock += ms;
  jest.advanceTimersByTime(ms);
}

/**
 * Simulate a blocked JS thread: time passes but no timer callback gets to run
 * until the end, which is exactly what a long synchronous task looks like to
 * the heartbeat.
 */
function blockThread(ms: number): void {
  clock += ms;
  // A single advance flushes the whole backlog of missed 16ms ticks, and the
  // first one to run sees the full gap — the same coalescing a real blocked
  // thread produces.
  jest.advanceTimersByTime(ms);
}

function spans(records: PerfRecord[]) {
  return records.filter((r): r is Extract<PerfRecord, { kind: 'span' }> => r.kind === 'span');
}

function blocks(records: PerfRecord[]) {
  return records.filter((r): r is Extract<PerfRecord, { kind: 'jsBlock' }> => r.kind === 'jsBlock');
}

beforeEach(() => {
  clock = 0;
  jest.useFakeTimers();
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  stopPerfMonitor();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('startPerfMonitor / stopPerfMonitor', () => {
  it('reports running state and returns a report on stop', () => {
    expect(isPerfMonitorRunning()).toBe(false);
    startPerfMonitor('test');
    expect(isPerfMonitorRunning()).toBe(true);

    advance(100);
    const report = stopPerfMonitor();

    expect(isPerfMonitorRunning()).toBe(false);
    expect(report).not.toBeNull();
    expect(report?.label).toBe('test');
    expect(report?.durationMs).toBe(100);
  });

  it('returns null when never started', () => {
    expect(stopPerfMonitor()).toBeNull();
  });

  it('restarts cleanly instead of appending to the previous session', () => {
    startPerfMonitor('first');
    perfCount('nodes', 42);
    startPerfMonitor('second');

    const report = stopPerfMonitor();
    expect(report?.label).toBe('second');
    // The first session's counter must not leak into the second, or an A/B
    // comparison would silently mix arms.
    expect(report?.counts).toEqual([]);
  });
});

describe('JS block detection', () => {
  it('does not record blocks while ticks arrive on cadence', () => {
    startPerfMonitor('test');
    for (let i = 0; i < 20; i++) advance(16);
    const report = stopPerfMonitor();
    expect(blocks(report?.records ?? [])).toHaveLength(0);
  });

  it('records a block when the thread stalls past the threshold', () => {
    startPerfMonitor('test', 30);
    advance(16);
    blockThread(250);

    const recorded = blocks(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    // 250ms elapsed minus the 16ms tick the heartbeat expected to consume.
    expect(recorded[0].ms).toBeCloseTo(234, 0);
  });

  it('ignores gaps below the threshold', () => {
    startPerfMonitor('test', 100);
    advance(16);
    blockThread(60);

    expect(blocks(stopPerfMonitor()?.records ?? [])).toHaveLength(0);
  });

  it('attributes a block to the spans open at the time', () => {
    startPerfMonitor('test', 30);
    const endOuter = perfSpan('chapter.mount');
    const endInner = perfSpan('paragraph.render');

    advance(16);
    blockThread(200);

    endInner();
    endOuter();

    const recorded = blocks(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].during).toEqual(['chapter.mount', 'paragraph.render']);
  });

  it('attributes a block to a span that opened AND closed inside the gap', () => {
    // The case attribution exists for: synchronous work inside a span blocks the
    // thread, which also prevents the tick that would have seen the span open.
    // The first real device capture reported a 569ms mount span alongside a
    // 2112ms block attributed to "(none)" — this is that gap closed.
    startPerfMonitor('test', 30);
    advance(16);

    const end = perfSpan('reader.mount.bible');
    blockThread(600);
    end();
    advance(16);

    const recorded = blocks(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].during).toEqual(['reader.mount.bible']);
  });

  it('stops attributing to a closed span once a clean tick has passed', () => {
    // Otherwise every later block would inherit a long-finished span and the
    // attribution would become useless noise.
    startPerfMonitor('test', 30);
    advance(16);
    const end = perfSpan('reader.mount.bible');
    end();
    advance(16);
    advance(16);

    blockThread(300);
    const recorded = blocks(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].during).toEqual([]);
  });

  it('marks a block with no open spans as unattributed in the summary', () => {
    startPerfMonitor('test', 30);
    advance(16);
    blockThread(200);

    const report = stopPerfMonitor();
    expect(report?.blocks.topSuspects).toEqual([
      { name: '(none)', blocks: 1, totalMs: expect.any(Number) },
    ]);
  });

  it('buckets blocks by severity', () => {
    startPerfMonitor('test', 30);
    advance(16);
    blockThread(60); //  ~44ms -> minor
    advance(16);
    blockThread(150); // ~134ms -> major
    advance(16);
    blockThread(500); // ~484ms -> severe

    const report = stopPerfMonitor();
    expect(report?.blocks.buckets).toEqual({ minor: 1, major: 1, severe: 1 });
    expect(report?.blocks.count).toBe(3);
  });
});

describe('perfSpan', () => {
  it('records duration and metadata', () => {
    startPerfMonitor('test');
    const end = perfSpan('chapter.mount', { book: 1, chapter: 1 });
    advance(120);
    end();

    const recorded = spans(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      name: 'chapter.mount',
      ms: 120,
      meta: { book: 1, chapter: 1 },
    });
  });

  it('is idempotent so a double cleanup does not double-count', () => {
    startPerfMonitor('test');
    const end = perfSpan('chapter.mount');
    advance(50);
    end();
    advance(50);
    end();

    const recorded = spans(stopPerfMonitor()?.records ?? []);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].ms).toBe(50);
  });

  it('closes the matching span when the same name is nested', () => {
    startPerfMonitor('test');
    const endA = perfSpan('paragraph.render');
    advance(10);
    const endB = perfSpan('paragraph.render');
    advance(10);
    endB();
    advance(10);
    endA();

    const recorded = spans(stopPerfMonitor()?.records ?? []);
    expect(recorded.map((r) => r.ms).sort((a, b) => a - b)).toEqual([10, 30]);
  });

  it('returns a safe no-op when the monitor is not running', () => {
    const end = perfSpan('orphan');
    expect(() => end()).not.toThrow();
  });

  it('summarises spans worst-total-cost first', () => {
    startPerfMonitor('test');
    const cheap = perfSpan('cheap');
    advance(5);
    cheap();
    for (let i = 0; i < 3; i++) {
      const expensive = perfSpan('expensive');
      advance(40);
      expensive();
    }

    const report = stopPerfMonitor();
    expect(report?.spans[0].name).toBe('expensive');
    expect(report?.spans[0]).toMatchObject({ count: 3, totalMs: 120, meanMs: 40 });
  });

  it('reports max instead of an interpolated p95 below 20 samples', () => {
    startPerfMonitor('test');
    for (const ms of [10, 20, 90]) {
      const end = perfSpan('few');
      advance(ms);
      end();
    }

    const report = stopPerfMonitor();
    // With 3 samples a percentile would be misleadingly precise; max is the
    // honest answer.
    expect(report?.spans[0].p95Ms).toBe(90);
  });
});

describe('perfCount', () => {
  it('keeps the latest absolute value per name', () => {
    startPerfMonitor('test');
    perfCount('nodes', 100);
    advance(10);
    perfCount('nodes', 250);

    const report = stopPerfMonitor();
    expect(report?.counts).toEqual([{ name: 'nodes', value: 250 }]);
  });

  it('is a no-op when the monitor is not running', () => {
    expect(() => perfCount('nodes', 1)).not.toThrow();
  });
});
