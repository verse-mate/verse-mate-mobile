/**
 * JS-thread performance monitor.
 *
 * ## Why this exists
 *
 * The 2026-05-21 swipe-debug session established that the only reliable way to
 * find render stalls in this app is to watch the JS thread directly: a
 * fixed-cadence heartbeat whose observed gap tells you exactly how long the
 * thread was unavailable. Three plausible static-analysis theories were
 * discarded by that data. Guessing at causes cost hours; the heartbeat found
 * the real one in twenty minutes.
 *
 * That instrumentation was deleted when the fix shipped, so the next
 * investigation started from zero. This module is the permanent version.
 *
 * ## What it measures
 *
 * - **JS blocks** — heartbeat gaps beyond `blockThresholdMs`. A blocked JS
 *   thread means dropped frames, unresponsive taps, and stuck animations.
 * - **Spans** — named durations (`chapter.mount`, `view.switch`, …), with the
 *   set of spans open during each block recorded so a stall is *attributed*
 *   rather than merely timestamped.
 * - **Counters** — absolute values worth trending, e.g. rendered node counts.
 *
 * ## What it does NOT measure
 *
 * Real UI-thread frame timing. A JS heartbeat cannot see the UI thread, so a
 * native-side stall (a slow `Spannable` re-measure, say) is invisible here.
 * Pair this with `adb shell dumpsys gfxinfo <pkg> framestats` — the capture
 * script does exactly that. Treat the two as complementary: this attributes
 * blocks to app work, gfxinfo says what the user actually saw.
 */

import type {
  PerfBlockSummary,
  PerfMeta,
  PerfRecord,
  PerfReport,
  PerfSpanSummary,
} from './types';
import { perfEnabled } from './enabled';

/**
 * Max records held. At ~16ms cadence a heartbeat alone produces no records
 * (only over-threshold gaps do), so this is generous for a multi-minute run.
 * Overflow drops the OLDEST records and sets `truncated`, which is reported —
 * silent truncation would read as "nothing more happened".
 */
const RING_CAPACITY = 5000;

/** Heartbeat cadence. One frame at 60Hz. */
const TICK_MS = 16;

/**
 * Default block threshold. Below ~30ms a gap is indistinguishable from normal
 * timer scheduling slop, so reporting it would be noise.
 */
const DEFAULT_BLOCK_THRESHOLD_MS = 30;

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

interface MonitorState {
  label: string;
  startedAt: number;
  timer: ReturnType<typeof setInterval> | null;
  lastTick: number;
  blockThresholdMs: number;
  records: PerfRecord[];
  dropped: number;
  /** Currently-open span names, innermost last. Used to attribute blocks. */
  openSpans: string[];
  /**
   * Spans that were open at any point since the previous heartbeat tick,
   * including ones that have already closed.
   *
   * Without this, attribution misses the case it exists for. A span whose work
   * blocks the thread synchronously — a chapter mount, say — prevents the
   * heartbeat from firing at all while it runs. By the time a tick does fire, the
   * render has committed and the effect has closed the span, so `openSpans` is
   * empty and the block is recorded as unattributed. That is exactly what the
   * first real device capture showed: a 569ms `reader.mount.bible` span and a
   * 2112ms block, with the block attributed to "(none)".
   */
  spansSinceTick: Set<string>;
  counters: Map<string, number>;
}

let state: MonitorState | null = null;

function push(record: PerfRecord): void {
  if (!state) return;
  state.records.push(record);
  if (state.records.length > RING_CAPACITY) {
    state.records.shift();
    state.dropped += 1;
  }
}

/**
 * Start monitoring. Safe to call when already running — it restarts cleanly so
 * a re-run never silently appends to a previous session's data.
 */
export function startPerfMonitor(label: string, blockThresholdMs = DEFAULT_BLOCK_THRESHOLD_MS): void {
  if (!perfEnabled()) return;
  if (state) stopPerfMonitor();

  const startedAt = now();
  state = {
    label,
    startedAt,
    timer: null,
    lastTick: startedAt,
    blockThresholdMs,
    records: [],
    dropped: 0,
    openSpans: [],
    spansSinceTick: new Set(),
    counters: new Map(),
  };

  state.timer = setInterval(() => {
    if (!state) return;
    const t = now();
    // The gap beyond the expected cadence is time the thread could not service
    // the timer — i.e. time it was busy elsewhere.
    const gap = t - state.lastTick - TICK_MS;
    state.lastTick = t;
    if (gap >= state.blockThresholdMs) {
      // Union of still-open spans and any that opened AND closed inside the gap.
      // The latter is the important half: synchronous work that blocks the thread
      // also prevents the tick that would have observed it while it was open.
      const during = new Set(state.spansSinceTick);
      for (const name of state.openSpans) during.add(name);
      push({
        kind: 'jsBlock',
        ms: round(gap),
        at: round(t - state.startedAt),
        during: [...during],
      });
    }
    // Reset per-tick tracking AFTER recording, and re-seed with what is still
    // open — a span spanning several ticks must stay attributable to each.
    state.spansSinceTick = new Set(state.openSpans);
  }, TICK_MS);

  log(`monitor started label=${label} threshold=${blockThresholdMs}ms`);
}

/** Stop monitoring and return the report. Returns null if never started. */
export function stopPerfMonitor(): PerfReport | null {
  if (!perfEnabled() || !state) return null;
  if (state.timer) clearInterval(state.timer);
  const report = buildReport(state);
  state = null;
  return report;
}

/** True when a monitor session is active. */
export function isPerfMonitorRunning(): boolean {
  return perfEnabled() && state !== null;
}

/**
 * Open a named span. Returns the closer.
 *
 * ```ts
 * const end = perfSpan('chapter.mount', { book: 1, chapter: 1 });
 * // ...work...
 * end();
 * ```
 *
 * The closer is idempotent — calling it twice records one span, so it is safe
 * in a `useEffect` cleanup that may run more than once under StrictMode.
 */
export function perfSpan(name: string, meta?: PerfMeta): () => void {
  if (!perfEnabled() || !state) return noop;
  const started = now();
  state.openSpans.push(name);
  state.spansSinceTick.add(name);
  let closed = false;
  return () => {
    if (closed || !state) return;
    closed = true;
    const idx = state.openSpans.lastIndexOf(name);
    if (idx >= 0) state.openSpans.splice(idx, 1);
    push({
      kind: 'span',
      name,
      ms: round(now() - started),
      at: round(started - state.startedAt),
      meta,
    });
  };
}

/**
 * Record an instantaneous absolute value (node counts, cache sizes, …).
 * Counters are absolute rather than incremental so a dropped record can't
 * corrupt the running total.
 */
export function perfCount(name: string, value: number, meta?: PerfMeta): void {
  if (!perfEnabled() || !state) return;
  state.counters.set(name, value);
  push({ kind: 'count', name, value, at: round(now() - state.startedAt), meta });
}

/**
 * Add to a running total, e.g. how many text nodes a flow rendered in all.
 *
 * Unlike `perfCount` this does not push a record per call — a per-token counter
 * would swamp the ring buffer and evict the JS blocks, which are the records
 * that matter. Only the accumulated total reaches the report.
 */
export function perfAdd(name: string, delta: number): void {
  if (!perfEnabled() || !state) return;
  state.counters.set(name, (state.counters.get(name) ?? 0) + delta);
}

// ---------------------------------------------------------------------------
// Report building
// ---------------------------------------------------------------------------

function buildReport(s: MonitorState): PerfReport {
  const spans = summariseSpans(s.records);
  const blocks = summariseBlocks(s.records);
  return {
    label: s.label,
    durationMs: round(now() - s.startedAt),
    spans,
    blocks,
    counts: [...s.counters.entries()].map(([name, value]) => ({ name, value })),
    records: s.records,
    truncated: s.dropped > 0,
  };
}

function summariseSpans(records: PerfRecord[]): PerfSpanSummary[] {
  const byName = new Map<string, number[]>();
  for (const r of records) {
    if (r.kind !== 'span') continue;
    const list = byName.get(r.name);
    if (list) list.push(r.ms);
    else byName.set(r.name, [r.ms]);
  }
  const out: PerfSpanSummary[] = [];
  for (const [name, samples] of byName) {
    samples.sort((a, b) => a - b);
    const totalMs = samples.reduce((acc, v) => acc + v, 0);
    out.push({
      name,
      count: samples.length,
      totalMs: round(totalMs),
      meanMs: round(totalMs / samples.length),
      minMs: samples[0],
      maxMs: samples[samples.length - 1],
      p95Ms: percentile(samples, 0.95),
    });
  }
  // Worst total cost first — that's the thing worth fixing.
  return out.sort((a, b) => b.totalMs - a.totalMs);
}

function summariseBlocks(records: PerfRecord[]): PerfBlockSummary {
  const blocks = records.filter((r): r is Extract<PerfRecord, { kind: 'jsBlock' }> =>
    r.kind === 'jsBlock'
  );
  const suspects = new Map<string, { blocks: number; totalMs: number }>();
  let totalMs = 0;
  let maxMs = 0;
  const buckets = { minor: 0, major: 0, severe: 0 };

  for (const b of blocks) {
    totalMs += b.ms;
    if (b.ms > maxMs) maxMs = b.ms;
    if (b.ms >= 300) buckets.severe += 1;
    else if (b.ms >= 100) buckets.major += 1;
    else buckets.minor += 1;

    // Attribute the block to every span open at the time. A block nested three
    // spans deep is evidence about all three, and which one matters is a
    // judgement for whoever reads the report.
    for (const name of b.during.length > 0 ? b.during : ['(none)']) {
      const entry = suspects.get(name) ?? { blocks: 0, totalMs: 0 };
      entry.blocks += 1;
      entry.totalMs += b.ms;
      suspects.set(name, entry);
    }
  }

  return {
    count: blocks.length,
    totalMs: round(totalMs),
    maxMs: round(maxMs),
    buckets,
    topSuspects: [...suspects.entries()]
      .map(([name, v]) => ({ name, blocks: v.blocks, totalMs: round(v.totalMs) }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 10),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Below 20 samples a percentile is not meaningful; report the max so the
  // number is never quietly optimistic.
  if (sorted.length < 20) return sorted[sorted.length - 1];
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function noop(): void {
  /* monitor inactive */
}

function log(message: string): void {
  console.log(`[VMPERF] ${message}`);
}
