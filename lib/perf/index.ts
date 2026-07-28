/**
 * Dev-only performance instrumentation for VerseMate mobile.
 *
 * See `lib/perf/monitor.ts` for the rationale and for what this can and cannot
 * measure. Everything is gated on `__DEV__` and compiles to no-ops in release.
 *
 * ## Typical use
 *
 * ```ts
 * // once, from the root layout
 * useEffect(() => installPerfSession(), []);
 *
 * // around work worth attributing a stall to
 * useEffect(() => {
 *   const end = perfSpan('chapter.mount', { book: bookId, chapter: chapterNumber });
 *   return end;
 * }, [bookId, chapterNumber]);
 * ```
 *
 * Prefer a small number of meaningful spans over blanket instrumentation. The
 * value is in the `during` attribution on each recorded JS block, and that gets
 * *less* useful as the span set grows — if everything is always open, nothing is
 * implicated.
 */

export { checksum, emitPerfReport } from './emit';
export { watchFrames } from './frame-watch';
export { perfRenderSpan, usePerfMountSpan } from './hooks';
export { formatPerfReport, parsePerfReports, type ParsedReport } from './parse';
export {
  isPerfMonitorRunning,
  perfAdd,
  perfCount,
  perfSpan,
  startPerfMonitor,
  stopPerfMonitor,
} from './monitor';
export { flushPerfReport, installPerfSession, uninstallPerfSession } from './session';
export { useWhyRender } from './why-render';
export type {
  PerfBlockSummary,
  PerfMeta,
  PerfRecord,
  PerfReport,
  PerfSpanSummary,
} from './types';
