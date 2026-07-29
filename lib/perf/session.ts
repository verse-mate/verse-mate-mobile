/**
 * Automatic perf session lifecycle.
 *
 * ## How a capture run is driven
 *
 * The monitor needs to be started and its report emitted without any UI to tap,
 * so a Maestro flow can drive it and a script can scrape the result. Rather
 * than add dev-only buttons or a deep-link route, the session is bound to the
 * app lifecycle:
 *
 * 1. `installPerfSession()` runs from the root layout and starts the monitor at
 *    launch (dev only).
 * 2. The report is emitted when the app goes to **background** — which
 *    `adb shell input keyevent KEYCODE_HOME` triggers deterministically at the
 *    end of a flow.
 * 3. A periodic safety emit covers the case where the flow crashes or the app
 *    never backgrounds, so a failed run still yields data instead of nothing.
 *
 * Records accumulate for the whole session rather than resetting per emit, so
 * a span is never split across two reports. The *scenario* label comes from the
 * capture script (which knows what flow it ran), not from the app.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { emitPerfReport } from './emit';
import { isPerfMonitorRunning, startPerfMonitor, stopPerfMonitor, perfCount } from './monitor';
import type { PerfReport } from './types';
import { perfEnabled } from './enabled';

/**
 * Safety-net emit interval.
 *
 * Deliberately LONG, so a capture run produces exactly ONE window covering the
 * whole flow.
 *
 * This was 30s, and it made the A/B unsound: the interval boundaries fall wherever
 * they fall, so one arm's window contained 1 chapter mount and 2 view switches
 * while the other's contained 6 and 12. Comparing "percent of session blocked"
 * across windows holding different amounts of work measures the window, not the
 * renderer — and the numbers looked plausible either way, which is the dangerous
 * kind of wrong.
 *
 * With one window per run, both arms execute the identical Maestro flow and their
 * windows are activity-matched by construction. The interval survives only as a
 * genuine safety net for a run that crashes before it can background.
 */
const SAFETY_EMIT_MS = 600_000;

let installed = false;
let safetyTimer: ReturnType<typeof setInterval> | null = null;
let subscription: { remove: () => void } | null = null;

/**
 * Emit the current report without ending the session.
 *
 * Implemented as stop-then-restart because the monitor owns its accumulation
 * window. The restart re-arms the heartbeat immediately, so at most one
 * heartbeat tick is missed; a span open across the boundary is lost, which is
 * why the safety interval is long relative to the spans we record.
 */
export function flushPerfReport(label = 'session'): PerfReport | null {
  if (!perfEnabled() || !isPerfMonitorRunning()) return null;
  const report = stopPerfMonitor();
  if (report) {
    emitPerfReport({ ...report, label });
  }
  startPerfMonitor(label);
  return report;
}

/**
 * Start the dev perf session. Idempotent — safe to call from a layout that
 * remounts. Returns a teardown function for tests.
 */
/**
 * Mirror every console error into the perf channel, tagged `[VMERR]`.
 *
 * ## Why
 *
 * A red-box error is visible to whoever is holding the phone and invisible to anyone
 * reading a capture afterwards. That gap cost a whole debugging round: the blank screen
 * during a swipe stress test was the app's error boundary catching
 * "Cannot set prop 'ranges' ... Already in the pool!", and it was diagnosed instead as a
 * coordinate divergence in the pager — a wrong conclusion that a visible error would have
 * prevented immediately.
 *
 * Errors DO reach Metro's log, but only as prose buried in thousands of lines. `[VMERR]`
 * makes them greppable, and the counter makes them appear in the report next to
 * everything else, so a capture says "this run had 3 errors" rather than staying silent.
 *
 * The original console.error is always called, so LogBox and any other consumer behave
 * exactly as before.
 */
let restoreConsoleError: (() => void) | null = null;

function installErrorCapture(): void {
  if (restoreConsoleError) return;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    try {
      perfCount('errors', 1);
      // The FIRST argument is truncated; the later ones are kept.
      //
      // Joining everything and then slicing to 300 chars looks equivalent and is not: React's
      // warnings put a long paragraph in argument 0 and the interesting VALUE in argument 1, so the
      // slice ate exactly the part worth having. A real case — "Encountered two children with the
      // same key, `%s`" — reported 15 times without ever naming the key, and the key
      // (`precept-book-luketime`, a duplicated id in the visuals registry) was what identified the
      // bug. A stack is still in Metro's output; the arguments are not, once dropped.
      const line = (value: unknown, limit: number) =>
        (value instanceof Error ? value.message : String(value)).split('\n')[0].slice(0, limit);
      const [head, ...rest] = args;
      const summary = [line(head, 200), ...rest.map((a) => line(a, 80))]
        .filter((part) => part.length > 0)
        .join(' | ');
      original(`[VMERR] ${summary}`);
    } catch {
      // Never let the reporter break error reporting.
    }
    original(...(args as []));
  };
  restoreConsoleError = () => {
    console.error = original;
  };
}

export function installPerfSession(): () => void {
  if (!perfEnabled() || installed) return () => undefined;
  installed = true;

  startPerfMonitor('session');
  installErrorCapture();

  const onChange = (next: AppStateStatus) => {
    // 'inactive' is an iOS-only transitional state (control centre, app
    // switcher); emitting there would produce duplicate partial reports for
    // what is not really a session boundary.
    if (next === 'background') {
      flushPerfReport('background');
    }
  };
  subscription = AppState.addEventListener('change', onChange);

  safetyTimer = setInterval(() => flushPerfReport('interval'), SAFETY_EMIT_MS);

  return uninstallPerfSession;
}

/** Tear down the session. Exposed for tests. */
export function uninstallPerfSession(): void {
  if (!installed) return;
  installed = false;
  if (safetyTimer) {
    clearInterval(safetyTimer);
    safetyTimer = null;
  }
  subscription?.remove();
  subscription = null;
  stopPerfMonitor();
}
