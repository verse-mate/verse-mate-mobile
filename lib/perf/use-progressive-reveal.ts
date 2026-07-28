/**
 * Grow a render budget by a few items PER FRAME, so a large subtree mounts across several
 * cheap frames instead of one expensive one.
 *
 * ## Why this exists
 *
 * On Fabric, mount operations are dispatched from the Choreographer callback — the same place
 * `dumpsys gfxinfo framestats` labels `animation`. Everything React commits in one go is
 * therefore handed to the UI thread as a single batch inside a single frame, and a big batch
 * blows the frame budget no matter how idle the JS thread is.
 *
 * That matches every measurement taken on this screen. Across 25 captures the slow-frame count
 * tracks the `animation` phase and nothing else: `traversals` (measure and layout) sits at
 * 0.2-0.6ms throughout, `draw` at 1-3ms, while `animation` ranges from 0.9ms to 28.8ms and the
 * slow-frame count moves with it from 3/119 to 51/119. The best capture on this device —
 * swiping across pages that were ALREADY mounted — is `animation` 0.9ms and 3 slow frames of
 * 119, which is the reference app's territory (2.6ms, 2 of 120). Nothing needed to mount in it.
 *
 * A one-shot reveal does not help, and that was measured too: capping the markdown and lifting
 * the cap on the next `runAfterInteractions` left the tab-switch mean at 62.6ms, because an
 * idle app fires that callback almost immediately and the same batch simply lands one frame
 * later. Splitting it is the point, not delaying it.
 *
 * ## Why requestAnimationFrame and not a timer
 *
 * One `rAF` callback maps to one Choreographer frame, so a state bump per `rAF` produces at
 * most one mount batch per frame. A timer can coalesce several bumps into one commit under
 * load, which rebuilds the batch this is trying to break up.
 */

import { useEffect, useRef, useState } from 'react';

export interface ProgressiveRevealOptions {
  /** Items rendered on the first frame. */
  initial?: number;
  /** Items added per subsequent frame. */
  step?: number;
  /** While false, everything renders at once — for tests, and for surfaces already cheap. */
  enabled?: boolean;
}

/**
 * Return the number of items that may render this frame, ramping to `total`.
 *
 * The ramp restarts whenever `total` changes, which is what makes it correct across content
 * swaps: a new chapter or a new tab is a new mount and deserves the same staging as the first.
 *
 * ```tsx
 * const budget = useProgressiveReveal(blocks.length, { initial: 6, step: 6 });
 * ```
 */
export function useProgressiveReveal(total: number, options: ProgressiveRevealOptions = {}): number {
  const { initial = 6, step = 6, enabled = true } = options;
  const [budget, setBudget] = useState(() => (enabled ? Math.min(initial, total) : total));
  // Ramping must not depend on `budget` in the effect's deps, or every bump would tear down
  // and restart the chain — one frame's work per two frames, and a visible stutter.
  const budgetRef = useRef(budget);
  budgetRef.current = budget;

  useEffect(() => {
    if (!enabled) {
      setBudget(total);
      return;
    }
    // A new `total` is new content: stage it from the start rather than inheriting a budget
    // that happens to be large from the previous item.
    const from = Math.min(initial, total);
    budgetRef.current = from;
    setBudget(from);
    if (from >= total) return;

    let frame: number | null = null;
    const pump = () => {
      const next = Math.min(budgetRef.current + step, total);
      budgetRef.current = next;
      setBudget(next);
      frame = next < total ? requestAnimationFrame(pump) : null;
    };
    frame = requestAnimationFrame(pump);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [total, initial, step, enabled]);

  return enabled ? budget : total;
}
