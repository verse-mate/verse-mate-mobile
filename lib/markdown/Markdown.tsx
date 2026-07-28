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
 */

import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import MarkdownDisplay, { MarkdownIt } from 'react-native-markdown-display';

/**
 * One parser for the whole app.
 *
 * Module scope rather than a `useMemo` on purpose: a hook-level memo is still
 * per-component-instance, and the app mounts many `<Markdown>`s at once (the
 * Insight subtree alone renders one per section).
 */
const sharedParser = MarkdownIt({ typographer: true });

/**
 * Top-level blocks rendered in the first pass.
 *
 * ## Why cap at all
 *
 * A Hermes profile of tab switching found the JS thread **98% idle** — ~440ms busy across 22
 * seconds, with `completeRoot` at 109ms. So the lag when first opening Summary or By Line is
 * not JS work, and the three previous attempts on this surface (pre-warming tabs, stabilising
 * the explanation prop, hunting per-word text nodes) moved little for that reason. With JS idle
 * and the GPU at ~2ms, what remains is the UI thread's measure and layout pass over the whole
 * markdown tree, done in one commit.
 *
 * Capping the first pass makes that pass small. The remainder mounts once interactions settle,
 * which is invisible: a reader sees the top of an explanation first and cannot read past the
 * fold in the time it takes to fill in.
 *
 * Enough to cover a tall screen, so the cap is never visible to someone who does not scroll.
 */
const INITIAL_BLOCKS = 10;

type MarkdownProps = ComponentProps<typeof MarkdownDisplay>;

export function Markdown(props: MarkdownProps) {
  // Uncapped after the first interaction window. Starting capped and lifting is what keeps the
  // expensive layout pass off the switch itself.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setShowAll(true));
    return () => handle.cancel();
  }, []);

  // `maxTopLevelChildren` and `topLevelMaxExceededItem` are implemented by the library and
  // documented in its README, but missing from its shipped type definitions — hence the cast.
  // Verified against node_modules/react-native-markdown-display/src/lib/AstRenderer.js, which
  // reads both.
  const capProps = {
    // An explicit value from the caller still wins, so a consumer that needs every block up
    // front is not blocked by this.
    maxTopLevelChildren: showAll ? undefined : INITIAL_BLOCKS,
    // Nothing is shown in place of the deferred blocks: an ellipsis would flash and then be
    // replaced a frame later, which reads as a glitch rather than as loading.
    topLevelMaxExceededItem: null,
  } as Partial<MarkdownProps>;

  return <MarkdownDisplay markdownit={sharedParser} {...capProps} {...props} />;
}

export default Markdown;
