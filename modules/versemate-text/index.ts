/**
 * `@versemate/text` — a self-measuring native text view.
 *
 * Renders one string with decorated character ranges, and reports taps,
 * selection and line geometry back by character offset. It knows nothing about
 * Bibles, verses or lexicons; see `lib/text/` for the domain compiler that
 * produces its input.
 *
 * See `docs/native-text-rendering-plan.md` for why this exists.
 */

export type {
  RangeUnderline,
  TextLineLayout,
  TextPressEvent,
  TextRange,
  TextSelectionRange,
  UnderlineStyle,
} from './src/types';
