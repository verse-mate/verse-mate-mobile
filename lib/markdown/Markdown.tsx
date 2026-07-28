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

import MarkdownDisplay, { MarkdownIt } from 'react-native-markdown-display';
import type { ComponentProps } from 'react';

/**
 * One parser for the whole app.
 *
 * Module scope rather than a `useMemo` on purpose: a hook-level memo is still
 * per-component-instance, and the app mounts many `<Markdown>`s at once (the
 * Insight subtree alone renders one per section).
 */
const sharedParser = MarkdownIt({ typographer: true });

type MarkdownProps = ComponentProps<typeof MarkdownDisplay>;

export function Markdown(props: MarkdownProps) {
  // An explicit `markdownit` in props still wins, so a caller that needs its own
  // configured parser is not blocked by this.
  return <MarkdownDisplay markdownit={sharedParser} {...props} />;
}

export default Markdown;
