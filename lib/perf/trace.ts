/**
 * One-line timing traces for questions that are about a single path, not a
 * whole session — "did this read come from SQLite or the network, and how long
 * did each step take?".
 *
 * The monitor's spans only record while a session is running and are reported
 * in aggregate at the end; a trace is printed the moment it happens, so it can
 * be read straight off the device log while reproducing something by hand.
 * Added for Verse Insight's By-Line sitting on a spinner on a slow connection
 * despite the commentary being downloaded (Andy, on a plane, 2026-09-28).
 *
 * Same gate as the rest of the perf channel: `perfEnabled` is `__DEV__` unless
 * the build sets EXPO_PUBLIC_PERF=1, so a normal release pays nothing.
 */
import { perfEnabled } from './enabled';

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

export function perfTrace(event: string, fields: Record<string, unknown>): void {
  if (!perfEnabled()) return;
  console.log(`[VMTRACE] ${event} ${JSON.stringify(fields)}`);
}

/** A stopwatch: `const ms = perfTimer(); …; ms()` → elapsed milliseconds. */
export function perfTimer(): () => number {
  const t0 = now();
  return () => Math.round(now() - t0);
}
