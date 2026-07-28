/**
 * `<VMText>` — render a string with decorated character ranges.
 *
 * One native view per block, instead of one or two RN `<Text>` nodes per word.
 * See `docs/native-text-rendering-plan.md`.
 */

import { type ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { perfAdd } from '@/lib/perf';
import type { TextLineLayout, TextPressEvent, TextRange, TextSelectionRange } from './types';
import { getNativeVMTextView, isNativeTextAvailable, type NativeVMTextProps } from './VMTextModule';

export interface VMTextProps {
  text: string;
  /**
   * Decorations, applied in array order so a later range wins on any attribute
   * it sets. `lib/text` emits them pre-sorted by an explicit layer constant.
   */
  ranges?: TextRange[];
  style?: TextStyle | TextStyle[];
  /**
   * Height in dp, from `measureTextHeight`. Supplying it lets Yoga size the view
   * correctly on the FIRST layout pass — which is the entire point of measuring
   * synchronously. Omitting it makes the view size itself, costing a reflow frame
   * per mount; acceptable for a one-off, wrong for a chapter of paragraphs.
   */
  height?: number;
  /** Width the text was measured against, in dp. Must match `height`'s measurement. */
  width?: number;
  /** Fired when an `interactive` range is tapped, with its index in `ranges`. */
  onRangeTap?: (index: number, charOffset: number) => void;
  /** Fired for a tap that hit no interactive range. */
  onPress?: (event: TextPressEvent) => void;
  /** Line geometry after layout, for anchoring popovers. */
  onTextLayout?: (lines: TextLineLayout[]) => void;
  /**
   * Native selection changed. `start`/`end` are -1 when nothing is selected.
   *
   * The platform draws the selection itself, along with handles and the Copy
   * menu; this is for the app's own affordances on top of it, e.g. the Define
   * button for a dictionary lookup.
   */
  onSelectionChange?: (selection: TextSelectionRange) => void;
  testID?: string;
  accessibilityLabel?: string;
}

export function VMText(props: VMTextProps) {
  const {
    text,
    ranges,
    style,
    height,
    width,
    onRangeTap,
    onPress,
    onTextLayout,
    onSelectionChange,
    testID,
    accessibilityLabel,
  } = props;

  // Gate on the module being present too, not just the view. `requireNativeView-
  // Manager` does not throw when the view is unregistered — under jest-expo and
  // in Expo Go it warns and hands back a STUB component that renders nothing.
  // Branching on the view alone therefore silently produces blank text. The
  // module is the honest signal, and it is needed anyway: without it there is no
  // synchronous measurement, so the native view could not be sized.
  const NativeView = isNativeTextAvailable() ? getNativeVMTextView() : null;
  const flat = useMemo(() => StyleSheet.flatten(style) as TextStyle | undefined, [style]);

  // Flatten `underline` for the bridge.
  //
  // The public TS type nests it (`underline: { style, color, thickness }`) because
  // that reads better and makes "no underline" a single absent key. The Kotlin
  // Record declares the three fields flat. Sending the nested shape meant
  // `underlineStyle` arrived null for every range and NOTHING was ever underlined
  // — the native reader rendered with no lexicon underlines at all while the
  // legacy path underlined nearly every phrase. Caught by diffing device
  // screenshots of the two arms.
  const nativeRanges = useMemo(
    () =>
      ranges?.map((range) => ({
        start: range.start,
        end: range.end,
        underlineStyle: range.underline?.style,
        underlineColor: range.underline?.color,
        underlineThickness: range.underline?.thickness,
        backgroundColor: range.backgroundColor,
        color: range.color,
        fontWeight: range.fontWeight,
        fontScale: range.fontScale,
        baselineShift: range.baselineShift,
        interactive: range.interactive ?? false,
      })),
    [ranges]
  );

  const handleRangeTap = useCallback(
    (event: { nativeEvent: { index: number; charOffset: number } }) => {
      onRangeTap?.(event.nativeEvent.index, event.nativeEvent.charOffset);
    },
    [onRangeTap]
  );

  const handlePress = useCallback(
    (event: { nativeEvent: TextPressEvent }) => {
      onPress?.(event.nativeEvent);
    },
    [onPress]
  );

  const handleSelectionChange = useCallback(
    (event: { nativeEvent: TextSelectionRange }) => {
      // Counted unconditionally: the operator reports a slow horizontal drag
      // starting a word selection, and a selection that fires during a SWIPE is
      // invisible from JS otherwise — the haptic is Android's, not ours. This is
      // the only signal that says whether selection is happening at all.
      const range = event.nativeEvent;
      perfAdd('text.selectionEvent', 1);
      if (range && range.end > range.start) perfAdd('text.selectionNonEmpty', 1);
      onSelectionChange?.(range);
    },
    [onSelectionChange]
  );

  const handleTextLayout = useCallback(
    (event: { nativeEvent: { lines: TextLineLayout[] } }) => {
      onTextLayout?.(event.nativeEvent.lines);
    },
    [onTextLayout]
  );

  if (!NativeView) {
    return (
      <FallbackText
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        ranges={ranges}
        style={style}
        testID={testID}
        text={text}
      />
    );
  }

  const nativeProps: NativeVMTextProps = {
    text,
    ranges: nativeRanges,
    // Text attributes are forwarded as explicit props rather than left in
    // `style`. RN's Android view bridge pre-processes colour strings into ints
    // and then tries to set them on the same-named prop, which collides with a
    // string-typed binding and fails with "Cannot cast Double to String".
    fontSize: numberOr(flat?.fontSize),
    fontFamily: flat?.fontFamily,
    fontWeight: flat?.fontWeight != null ? String(flat.fontWeight) : undefined,
    lineHeight: numberOr(flat?.lineHeight),
    letterSpacing: numberOr(flat?.letterSpacing),
    textAlign: flat?.textAlign,
    color: typeof flat?.color === 'string' ? flat.color : undefined,
    style: buildLayoutStyle(flat, width, height),
    testID,
    onPress: onPress ? handlePress : undefined,
    onRangeTap: onRangeTap ? handleRangeTap : undefined,
    onTextLayout: onTextLayout ? handleTextLayout : undefined,
    // Always attached so the dev-only selection counters see every event, not
    // only the ones a consumer happened to subscribe to.
    onSelectionChange: handleSelectionChange,
  };

  return <NativeView {...nativeProps} />;
}

/**
 * Layout-only style for the native view.
 *
 * Text attributes are stripped — they travel as explicit props (see above) — and
 * the measured width/height are pinned so Yoga needs no measurement pass.
 */
function buildLayoutStyle(
  flat: TextStyle | undefined,
  width: number | undefined,
  height: number | undefined
): Record<string, unknown> {
  const {
    color: _color,
    fontSize: _fontSize,
    fontFamily: _fontFamily,
    fontWeight: _fontWeight,
    lineHeight: _lineHeight,
    letterSpacing: _letterSpacing,
    textAlign: _textAlign,
    textDecorationLine: _decoration,
    textDecorationColor: _decorationColor,
    textDecorationStyle: _decorationStyle,
    ...layout
  } = flat ?? {};

  const out: Record<string, unknown> = { ...layout };
  if (width != null) out.width = width;
  if (height != null) out.height = height;
  return out;
}

function numberOr(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * RN `<Text>` fallback for web, Expo Go and Jest.
 *
 * Renders the same decorations as nested `<Text>` — so it looks close but pays
 * the per-range node cost the native path exists to avoid, and cannot draw dotted
 * underlines on Android. It is a compatibility path, not a second implementation:
 * correctness of the *decoration set* is guaranteed by sharing `ranges` with the
 * native path, so the two cannot disagree about what should be decorated, only
 * about how faithfully it is drawn.
 */
function FallbackText({
  text,
  ranges,
  style,
  onPress,
  testID,
  accessibilityLabel,
}: Pick<VMTextProps, 'text' | 'ranges' | 'style' | 'onPress' | 'testID' | 'accessibilityLabel'>) {
  const nodes = useMemo(() => buildFallbackNodes(text, ranges), [text, ranges]);
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      onPress={onPress ? () => onPress({ charOffset: 0, x: 0, y: 0 }) : undefined}
      selectable
      style={style}
      testID={testID}
    >
      {nodes}
    </Text>
  );
}

/**
 * Split `text` at every range boundary and emit one `<Text>` per resulting run
 * with the merged style of the ranges covering it.
 *
 * Boundary-splitting rather than nesting, because ranges can overlap partially
 * (a lexicon underline crossing the edge of a highlight) and nesting cannot
 * express that.
 */
function buildFallbackNodes(text: string, ranges: TextRange[] | undefined): ReactNode {
  if (!ranges || ranges.length === 0) return text;

  const boundaries = new Set<number>([0, text.length]);
  for (const range of ranges) {
    if (range.start > 0 && range.start < text.length) boundaries.add(range.start);
    if (range.end > 0 && range.end < text.length) boundaries.add(range.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const nodes: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;

    const merged: TextStyle = {};
    for (const range of ranges) {
      if (range.start > from || range.end < to) continue;
      if (range.backgroundColor) merged.backgroundColor = range.backgroundColor;
      if (range.color) merged.color = range.color;
      if (range.fontWeight) merged.fontWeight = range.fontWeight as TextStyle['fontWeight'];
      if (range.fontStyle) merged.fontStyle = range.fontStyle;
      if (range.underline) {
        merged.textDecorationLine = 'underline';
        merged.textDecorationColor = range.underline.color;
      }
    }

    const slice = text.slice(from, to);
    nodes.push(
      Object.keys(merged).length === 0 ? (
        slice
      ) : (
        <Text key={`${from}-${to}`} style={merged}>
          {slice}
        </Text>
      )
    );
  }
  return nodes;
}
