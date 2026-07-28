/**
 * Attribute a component's re-renders to the inputs that actually changed.
 *
 * ## Why this exists
 *
 * A Hermes profile showed the dominant cost of a chapter swipe is React
 * reconciliation plus Fabric's commit — `[Host Function] completeRoot` alone was
 * 1262ms of self time — and the span report showed `reader.render.bible` firing
 * 112 times in a 48-second session, about sixteen renders per chapter. Roughly
 * 112 commits at the observed per-commit cost accounts for essentially all of
 * `completeRoot`.
 *
 * That makes "how many times does this render, and why" the load-bearing
 * question. Neither existing instrument can answer the second half: a span says
 * a render happened and how long it took, never what triggered it. Guessing the
 * trigger is how this project already lost four hypotheses.
 *
 * ## What it reports
 *
 * One counter per input, incremented whenever that input's identity changed
 * since the previous render — so `render.bible.by.visibleYRange` vs
 * `render.bible.by.highlights` is a direct ranking of what to memoise or stop
 * subscribing to. Renders where nothing tracked changed land in
 * `<name>.by.nothing-tracked`, which is itself the signal that the cause is a
 * parent re-render or an untracked input.
 *
 * Identity comparison, not deep equality, on purpose: a fresh array or object
 * with identical contents is exactly the bug worth finding, and deep-comparing
 * would hide it.
 */

import { useRef } from 'react';
import { perfAdd } from './monitor';

/**
 * Count which of `inputs` changed since the last render of this component.
 *
 * Dev-only and allocation-light: it keeps one object of previous values and does
 * `n` identity comparisons.
 *
 * ```ts
 * useWhyRender('render.bible', { visibleYRange, highlights, alignment, width });
 * ```
 */
export function useWhyRender(name: string, inputs: Record<string, unknown>): void {
  const previous = useRef<Record<string, unknown> | null>(null);

  if (!__DEV__) return;

  const before = previous.current;
  // Snapshot before any early return, so the NEXT render compares against this
  // one even when this one is the first.
  previous.current = { ...inputs };

  if (before === null) {
    perfAdd(`${name}.by.first-render`, 1);
    return;
  }

  let changed = 0;
  for (const key of Object.keys(inputs)) {
    if (!Object.is(before[key], inputs[key])) {
      perfAdd(`${name}.by.${key}`, 1);
      changed += 1;
    }
  }
  if (changed === 0) perfAdd(`${name}.by.nothing-tracked`, 1);
}
