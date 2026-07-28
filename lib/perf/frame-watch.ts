/**
 * Measure frame cadence during a specific interaction.
 *
 * ## Why the existing instruments cannot see this
 *
 * The operator reports that the Bible↔Insight switch happens instantly but its
 * *animation* stutters. Neither existing instrument can find that:
 *
 * - The JS heartbeat watches the JS thread, and the animation runs on the UI thread
 *   via Reanimated. A perfectly idle JS thread is compatible with a visibly janky
 *   animation.
 * - `dumpsys gfxinfo` sees the UI thread but reports whole-session aggregates. A
 *   300ms animation's dropped frames vanish into a 60-second average.
 *
 * This closes the gap: a short, scoped frame recording around one interaction,
 * reported as its own record. It answers "was THIS animation smooth", which is the
 * question actually being asked.
 *
 * ## What it measures
 *
 * `requestAnimationFrame` cadence. In React Native rAF is serviced by the JS thread,
 * so a gap here means JS could not keep up. That is not the same as a UI-thread
 * stall, and the distinction is the useful part: if an animation looks janky and
 * this shows clean cadence, the animation is fine on the JS side and the jank is
 * native — the two conclusions lead to completely different fixes.
 */

import { perfCount, perfSpan } from './monitor';

/** Nominal frame budget at 60Hz, in ms. */
const BUDGET_60_MS = 16.67;

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

/**
 * Record frame cadence for `durationMs` and report it under `name`.
 *
 * Returns a cancel function. Safe to call when a recording for the same name is
 * already running — the previous one is finished early rather than producing two
 * overlapping records.
 *
 * ```ts
 * watchFrames('anim.viewSwitch', 400);
 * ```
 */
export function watchFrames(name: string, durationMs: number): () => void {
  if (!__DEV__) return () => undefined;

  const start = now();
  let last = start;
  let frames = 0;
  let dropped = 0;
  let worst = 0;
  let cancelled = false;
  let handle: number | null = null;

  const endSpan = perfSpan(`${name}.window`);

  const tick = () => {
    if (cancelled) return;
    const t = now();
    const delta = t - last;
    last = t;
    frames += 1;
    if (delta > worst) worst = delta;
    // A frame that took more than ~1.5 budgets means at least one was missed.
    // 1.5 rather than 1.0 because rAF timestamps jitter either side of the budget
    // even when nothing is wrong, and counting that as a drop would report jank on
    // a perfectly smooth animation.
    if (delta > BUDGET_60_MS * 1.5) dropped += 1;

    if (t - start >= durationMs) {
      finish();
      return;
    }
    handle = requestAnimationFrame(tick);
  };

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    if (handle !== null) cancelAnimationFrame(handle);
    endSpan();
    // Absolute counters rather than a rate: a rate hides how few frames a short
    // animation has, and "3 dropped of 18" is a very different claim from
    // "3 dropped of 300".
    perfCount(`${name}.frames`, frames);
    perfCount(`${name}.dropped`, dropped);
    perfCount(`${name}.worstFrameMs`, Math.round(worst));
  };

  handle = requestAnimationFrame(tick);

  return () => {
    if (!cancelled) finish();
  };
}
