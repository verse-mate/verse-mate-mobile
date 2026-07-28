/**
 * `<Markdown>` with a shared parser instance.
 *
 * ## Why this wrapper exists
 *
 * `react-native-markdown-display` declares its parser as a DEFAULT PARAMETER:
 *
 * ```js
 * markdownit = MarkdownIt({ typographer: true })
 * ```
 *
 * A default parameter is evaluated on every call, so every render of every
 * `<Markdown>` builds a brand-new MarkdownIt — and MarkdownIt's constructor
 * compiles LinkifyIt's regex set. The library's own
 * `useMemo(() => markdownit, [markdownit])` cannot help, because the identity it
 * memoises on is new each time.
 *
 * A Hermes CPU profile of six chapter swipes measured `regExpConstructor` at
 * **178ms of self time**, entirely under `LinkifyIt.compile <- MarkdownIt`. That
 * is more than the app spent in its own native text measurement (167ms), and
 * about 85% of all markdown cost was constructing the parser rather than parsing
 * anything.
 *
 * Passing one module-level instance removes that work. The parser is stateless
 * across `render` calls — MarkdownIt is designed to be reused, and this is
 * exactly what the library's `markdownit` prop is for — so sharing it is safe.
 *
 * Import this instead of the library directly. `typographer: true` is kept so
 * output is byte-identical to what the library's default produced.
 *
 * ## Staged mounting
 *
 * A long explanation also mounts as ONE Fabric batch, which lands in a single Choreographer
 * frame and blows the 8.3ms budget on this 120Hz device. The block cap is ramped a few blocks
 * per frame so the batch is split — see `useProgressiveReveal` for the measurements behind it.
 *
 * The cap is dropped entirely (not merely raised) once the ramp completes, so content can never
 * be truncated by a bad block-count estimate. That matters because the estimate is deliberately
 * cheap: counting blank-line groups, rather than parsing the document twice per render.
 */

import { useProgressiveReveal } from '@/lib/perf/use-progressive-reveal';
import MarkdownDisplay, { MarkdownIt } from 'react-native-markdown-display';
import type { ComponentProps } from 'react';

/**
 * One parser for the whole app, built on first use.
 *
 * Shared rather than a `useMemo` on purpose: a hook-level memo is still
 * per-component-instance, and the app mounts many `<Markdown>`s at once (the
 * Insight subtree alone renders one per section).
 *
 * Lazy rather than at module scope because a module-scope call runs at IMPORT time, which means
 * any test that mocks `react-native-markdown-display` without re-exporting `MarkdownIt` fails to
 * load the module at all — `TypeError: MarkdownIt is not a function`, before a single test runs.
 * That took down the whole StudyPanel suite. Deferring the call to first render, and tolerating
 * a mock that has no parser to give, keeps the optimisation from dictating how consumers mock.
 */
let sharedParser: ReturnType<typeof MarkdownIt> | undefined;
function getSharedParser() {
  // `undefined` is a valid value to pass on: the library falls back to its own default parameter,
  // which is precisely the behaviour this wrapper exists to avoid in production and is harmless
  // under a mock that ignores the prop entirely.
  if (typeof MarkdownIt !== 'function') return undefined;
  sharedParser ??= MarkdownIt({ typographer: true });
  return sharedParser;
}

type MarkdownProps = ComponentProps<typeof MarkdownDisplay>;

/** Blocks rendered on the first frame, then added per frame. Sized so a typical explanation
 *  finishes ramping in about five frames — long enough to split the batch, short enough that
 *  the tail arrives before a reader could scroll to it. */
const FIRST_FRAME_BLOCKS = 6;
const BLOCKS_PER_FRAME = 6;

/**
 * Upper bound on top-level blocks, from blank-line groups.
 *
 * Only ever used to decide when to STOP capping, so overestimating costs a frame or two of
 * ramping and underestimating costs nothing at all.
 */
function estimateBlocks(source: string): number {
  let blocks = 1;
  for (let i = source.indexOf('\n\n'); i !== -1; i = source.indexOf('\n\n', i + 2)) blocks++;
  return blocks;
}

export function Markdown(props: MarkdownProps) {
  // Ramping needs the source text to size itself; anything else renders in one pass as before.
  const source = typeof props.children === 'string' ? props.children : null;
  const total = source ? estimateBlocks(source) : 0;
  const budget = useProgressiveReveal(total, {
    initial: FIRST_FRAME_BLOCKS,
    step: BLOCKS_PER_FRAME,
    enabled: source !== null && total > FIRST_FRAME_BLOCKS,
  });
  // Undefined — not a large number — so a low estimate cannot hide the tail of a document.
  const maxTopLevelChildren = source !== null && budget < total ? budget : undefined;

  // An explicit `markdownit` in props still wins, so a caller that needs its own
  // configured parser is not blocked by this.
  return (
    <MarkdownDisplay
      markdownit={getSharedParser()}
      maxTopLevelChildren={maxTopLevelChildren}
      topLevelMaxExceededItem={null}
      {...props}
    />
  );
}

export default Markdown;
