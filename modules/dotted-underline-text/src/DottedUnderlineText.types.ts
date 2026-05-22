import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type UnderlineStyle = 'dotted' | 'solid';

/**
 * A single decoration range to apply to a sub-string of the view's text.
 *
 * Ranges are character indices into `text` (start inclusive, end exclusive,
 * same convention as `String.slice`). Ranges should not overlap.
 *
 * NOTE on iOS thickness: NSAttributedString has no per-range underline-stroke-
 * width attribute, so `thickness` is honoured on Android only. On iOS the
 * underline keeps the platform's default stroke width.
 */
export interface UnderlineRange {
  start: number;
  end: number;
  /**
   * Underline pattern for this range. When omitted, the range has no
   * underline (useful when only `backgroundColor` / per-range font is set —
   * e.g. for highlight backgrounds without decoration).
   */
  style?: UnderlineStyle;
  color?: string;
  /** Android only — iOS ignores this (see note above). */
  thickness?: number;
  /**
   * Optional client-side flag forwarded back via `onRangeTap` callbacks.
   * Not used by the native side; useful for the caller to discriminate
   * between visual tiers (e.g. theme vs regular) without keeping a side
   * map.
   */
  isTheme?: boolean;
  /**
   * Per-range background fill (e.g. user highlight color). Drawn behind
   * the text, behind the underline. Color string is parsed by the native
   * side (hex `#RRGGBB`, `#RRGGBBAA`, or rgba()).
   */
  backgroundColor?: string;
  /**
   * Per-range font weight. Override the view-wide `fontWeight` prop on
   * this range only — useful for `theme` tier lex words that should
   * appear in semibold/bold within an otherwise-regular verse.
   */
  fontWeight?: string;
  /**
   * Per-range text color. Lets a single range render with a brighter /
   * different color from the rest of the verse (e.g. theme tier).
   */
  textColor?: string;
}

export interface DottedUnderlineTextProps {
  /**
   * Text content. Only string children are supported (the native side renders
   * a single attributed/measured string, not nested React elements).
   */
  children?: ReactNode;

  /**
   * Optional pre-resolved text. Useful when callers want to pass text via a
   * prop instead of children (e.g. when composing imperatively).
   * If both `text` and `children` are provided, `text` wins.
   */
  text?: string;

  /**
   * Standard RN style. `fontSize`, `color`, `fontFamily`, `fontWeight`,
   * `letterSpacing`, `lineHeight`, and `textAlign` are forwarded to the
   * native view. Layout props (width/height/margin/padding) work as expected
   * because the native view participates in the RN layout system.
   */
  style?: StyleProp<TextStyle>;

  /** Hex/rgba color for the underline stroke. Defaults to the text color. */
  underlineColor?: string;

  /**
   * Underline pattern. `'dotted'` renders a repeating dot pattern that is
   * pixel-consistent across iOS (`NSUnderlineStyle.patternDot`) and Android
   * (custom `DashPathEffect` in `onDraw`). `'solid'` falls back to the
   * platform's normal single underline.
   *
   * Used when `ranges` is not provided. When `ranges` is provided, each
   * range carries its own `style` and this top-level value is ignored.
   */
  underlineStyle?: UnderlineStyle;

  /**
   * Stroke thickness in dp/pt. Default 1. Android-only when applied to the
   * whole text. Per-range thickness is also Android-only.
   */
  underlineThickness?: number;

  /**
   * Per-range decoration specs. When provided (even an empty array), the
   * whole-text `underlineStyle` / `underlineColor` / `underlineThickness`
   * props are ignored and the view draws ONLY the specified ranges.
   * Ranges should not overlap.
   */
  ranges?: UnderlineRange[];

  /**
   * Called when the user taps inside one of the `ranges`. `rangeIndex` is the
   * position of the matched range in the `ranges` array. Fires before / instead
   * of `onPress` when the tap lands inside a range.
   */
  onRangeTap?: (rangeIndex: number) => void;

  /**
   * Whether the user can long-press to select / copy. Defaults to `true` so
   * the component behaves like RN `<Text selectable>`.
   */
  selectable?: boolean;

  /** Tap handler for taps OUTSIDE any underlined range. */
  onPress?: () => void;

  /** Accessibility label override. If unset, the text content is used. */
  accessibilityLabel?: string;

  /** TestID for E2E. */
  testID?: string;
}
