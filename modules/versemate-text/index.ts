/**
 * `@versemate/text` — a native text view that renders one string with decorated
 * character ranges, and reports taps, selection and line geometry back by
 * character offset.
 *
 * It knows nothing about Bibles, verses or lexicons — see `lib/text/` for the
 * domain compiler that produces its input. See
 * `docs/native-text-rendering-plan.md` for why it exists.
 *
 * Import via the `@/modules/versemate-text` path alias, NOT as a `file:`
 * dependency: bun hardlink-copies `file:` deps into `node_modules`, so edits here
 * would silently go stale until the next install.
 */

export {
  clearTextMeasurementCache,
  measureTextHeight,
  measureTextHeights,
} from './src/measure';
export type {
  RangeUnderline,
  TextLineLayout,
  TextPressEvent,
  TextRange,
  TextSelectionRange,
  UnderlineStyle,
} from './src/types';
export { VMText, type VMTextProps } from './src/VMText';
export {
  getNativeVMTextModule,
  getNativeVMTextView,
  isNativeTextAvailable,
  type MeasureRequest,
  type NativeVMTextProps,
  resetNativeVMTextCacheForTests,
} from './src/VMTextModule';
