/**
 * Shared types for the performance instrumentation layer.
 *
 * Everything here is dev-only. The public API in `lib/perf/index.ts` compiles
 * to no-ops when `__DEV__` is false, so production bundles pay nothing.
 */

/** A single recorded performance event. */
export type PerfRecord =
  | {
      kind: 'span';
      /** Dotted name, e.g. `chapter.mount` — grouped by name when summarising. */
      name: string;
      /** Duration in milliseconds. */
      ms: number;
      /** Wall-clock start, ms since the monitor started. */
      at: number;
      meta?: PerfMeta;
    }
  | {
      kind: 'jsBlock';
      /**
       * How long the JS thread was unavailable, in milliseconds. This is the
       * observed gap between heartbeat ticks minus the expected interval, so it
       * measures time the thread could NOT service a timer.
       */
      ms: number;
      at: number;
      /**
       * Names of spans that were open when the block was observed. This is the
       * single most useful field — it attributes a stall to the work that caused
       * it instead of leaving you to correlate timestamps by hand.
       */
      during: string[];
    }
  | {
      kind: 'count';
      name: string;
      /** Value at the time of recording (counters are absolute, not deltas). */
      value: number;
      at: number;
      meta?: PerfMeta;
    };

/** Arbitrary structured context attached to a span or counter. */
export type PerfMeta = Record<string, string | number | boolean | null | undefined>;

/** Aggregated stats for one span name. */
export interface PerfSpanSummary {
  name: string;
  count: number;
  totalMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  /** 95th percentile, or max when there are fewer than 20 samples. */
  p95Ms: number;
}

/** Aggregated stats for observed JS-thread blocks. */
export interface PerfBlockSummary {
  /** Number of blocks over the monitor's threshold. */
  count: number;
  totalMs: number;
  maxMs: number;
  /** Blocks bucketed by severity, for a quick read of "how bad". */
  buckets: {
    /** 30–100ms: perceptible as a stutter. */
    minor: number;
    /** 100–300ms: clearly janky. */
    major: number;
    /** >300ms: the app looks frozen. */
    severe: number;
  };
  /** Span names most often open during a block, most frequent first. */
  topSuspects: { name: string; blocks: number; totalMs: number }[];
}

/** A complete report, ready to be serialised into logcat and scraped. */
export interface PerfReport {
  /** Label passed to `startPerfMonitor`, e.g. `psalm-119`. */
  label: string;
  /** How long the monitor ran, in milliseconds. */
  durationMs: number;
  spans: PerfSpanSummary[];
  blocks: PerfBlockSummary;
  counts: { name: string; value: number }[];
  /** Every raw record, for offline analysis. Capped by the ring buffer. */
  records: PerfRecord[];
  /** True when the ring buffer overflowed and early records were dropped. */
  truncated: boolean;
}
