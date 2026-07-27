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
import { isPerfMonitorRunning, startPerfMonitor, stopPerfMonitor } from './monitor';
import type { PerfReport } from './types';

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
  if (!__DEV__ || !isPerfMonitorRunning()) return null;
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
export function installPerfSession(): () => void {
  if (!__DEV__ || installed) return () => undefined;
  installed = true;

  startPerfMonitor('session');

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
