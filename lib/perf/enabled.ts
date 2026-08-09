/**
 * Single source of truth for whether the perf channel is live.
 *
 * ## Why this exists
 *
 * Every perf primitive was gated on `__DEV__` directly, in six different files. That is correct for
 * shipping — a release bundle should pay nothing — but it made the most important measurement
 * impossible to take.
 *
 * The largest single number in any capture is `data.alignment`: 18 calls, 9,785ms total, mean 543ms,
 * against 1,600ms total for all tab switching. It cannot be attributed, because chapter alignments load
 * through `import()` and the lexicon package ships each chapter as its own Metro code-split chunk — so
 * in dev the first request for one makes Metro TRANSFORM it on demand, routinely 100-500ms. That matches
 * the mean almost exactly, and the spread (543ms mean against a 2,856ms max) looks like I/O rather than a
 * deterministic loop. In a release build those chunks are pre-bundled and the cost may largely vanish.
 *
 * So the question "is 9.8 seconds real or an artifact of the dev server?" can only be answered by
 * measuring a RELEASE build — and the instrument switched itself off in exactly that build. Deciding
 * whether to do the lexicon work at all (a data-regeneration change) hinges on the answer.
 *
 * ## How to take that measurement
 *
 * Build a preview with the flag set, e.g. in the EAS build profile's `env`:
 *
 *   EXPO_PUBLIC_PERF=1
 *
 * `EXPO_PUBLIC_*` is inlined at build time, so with the flag unset this resolves to
 * `__DEV__ || false` and dead-code elimination removes the perf code exactly as before. A normal
 * release build is unchanged; only a build explicitly made for measuring carries the instrument.
 *
 * A build-time constant rather than a runtime toggle on purpose: `perfCount` is called during render,
 * so the check has to be free and synchronous, and an AsyncStorage read is neither.
 */

/**
 * Inlined by Expo's babel plugin, so this is a literal in the bundle rather than a lookup.
 */
const PERF_FORCED = process.env.EXPO_PUBLIC_PERF === '1';

/**
 * True when perf instrumentation should record.
 *
 * `__DEV__` keeps the existing behaviour for every dev session; the flag is the opt-in for measuring a
 * release build.
 */
export function perfEnabled(): boolean {
  return __DEV__ || PERF_FORCED;
}
