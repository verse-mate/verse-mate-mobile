import { Children, type ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, type TextStyle } from 'react-native';
import type { DottedUnderlineTextProps, UnderlineRange } from './DottedUnderlineText.types';
import {
  getNativeDottedUnderlineTextView,
  type NativeDottedUnderlineTextProps,
  type NativeUnderlineRange,
} from './DottedUnderlineTextModule';

/**
 * Flatten any string/number children into a single string. We do NOT support
 * nested React elements — the native side renders one attributed string per
 * view. Callers that need rich content should compose multiple
 * `<DottedUnderlineText>` siblings.
 */
function childrenToText(children: ReactNode): string {
  let out = '';
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      out += String(child);
    }
  });
  return out;
}

export function DottedUnderlineText(props: DottedUnderlineTextProps) {
  const {
    children,
    text,
    style,
    underlineColor,
    underlineStyle = 'dotted',
    underlineThickness = 1,
    ranges,
    onRangeTap,
    selectable = true,
    onPress,
    accessibilityLabel,
    testID,
  } = props;

  const resolvedText = text ?? childrenToText(children);
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const NativeDottedUnderlineTextView =
    Platform.OS === 'web' ? null : getNativeDottedUnderlineTextView();

  // Strip the `isTheme` client-side flag before forwarding to native — the
  // bridge has no concept of it and Expo would reject unknown range fields.
  const nativeRanges: NativeUnderlineRange[] | undefined = useMemo(() => {
    if (!ranges) return undefined;
    return ranges.map((r: UnderlineRange) => ({
      start: r.start,
      end: r.end,
      style: r.style,
      color: r.color,
      thickness: r.thickness,
      backgroundColor: r.backgroundColor,
      fontWeight: r.fontWeight,
      textColor: r.textColor,
    }));
  }, [ranges]);

  // ---- Fallback: web, Expo Go, or anywhere the native view didn't register.
  if (!NativeDottedUnderlineTextView) {
    // When `ranges` is provided, render each range inline so the fallback
    // path still shows decoration (used by Jest tests and the web bundle).
    if (ranges && ranges.length > 0) {
      const nodes: ReactNode[] = [];
      let cursor = 0;
      ranges.forEach((r, i) => {
        if (r.start > cursor) {
          nodes.push(<Text key={`p-${cursor}`}>{resolvedText.slice(cursor, r.start)}</Text>);
        }
        // Build the per-range fallback style. `style` may be omitted now
        // (background-only range). On iOS we can still get the dotted
        // pattern; Android always renders solid (RN limitation).
        const styleForRange: TextStyle = {};
        if (r.style) {
          styleForRange.textDecorationLine = 'underline';
          styleForRange.textDecorationColor = r.color ?? underlineColor;
          if (r.style === 'dotted' && Platform.OS === 'ios') {
            styleForRange.textDecorationStyle = 'dotted';
          }
        }
        if (r.backgroundColor) {
          styleForRange.backgroundColor = r.backgroundColor;
        }
        if (r.fontWeight) {
          styleForRange.fontWeight = r.fontWeight as TextStyle['fontWeight'];
        }
        if (r.textColor) {
          styleForRange.color = r.textColor;
        }
        nodes.push(
          <Text
            key={`r-${i}-${r.start}`}
            style={styleForRange}
            onPress={onRangeTap ? () => onRangeTap(i) : undefined}
          >
            {resolvedText.slice(r.start, r.end)}
          </Text>
        );
        cursor = r.end;
      });
      if (cursor < resolvedText.length) {
        nodes.push(<Text key={`p-tail`}>{resolvedText.slice(cursor)}</Text>);
      }
      return (
        <Text
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          selectable={selectable}
          style={style}
          testID={testID}
        >
          {nodes}
        </Text>
      );
    }

    const fallbackUnderline: TextStyle =
      underlineStyle === 'solid' || Platform.OS !== 'ios'
        ? { textDecorationLine: 'underline', textDecorationColor: underlineColor }
        : {
            textDecorationLine: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: underlineColor,
          };

    return (
      <Text
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        selectable={selectable}
        style={[style, fallbackUnderline]}
        testID={testID}
      >
        {resolvedText}
      </Text>
    );
  }

  // ---- Native path (iOS + Android).
  const handleRangeTap = onRangeTap
    ? (e: { nativeEvent: { index: number } }) => onRangeTap(e.nativeEvent.index)
    : undefined;

  const nativeProps: NativeDottedUnderlineTextProps = {
    text: resolvedText,
    fontSize: typeof flat?.fontSize === 'number' ? flat.fontSize : undefined,
    color: typeof flat?.color === 'string' ? flat.color : undefined,
    fontFamily: flat?.fontFamily,
    fontWeight:
      typeof flat?.fontWeight === 'string' || typeof flat?.fontWeight === 'number'
        ? String(flat.fontWeight)
        : undefined,
    letterSpacing: typeof flat?.letterSpacing === 'number' ? flat.letterSpacing : undefined,
    lineHeight: typeof flat?.lineHeight === 'number' ? flat.lineHeight : undefined,
    textAlign: flat?.textAlign,
    underlineColor: underlineColor ?? (typeof flat?.color === 'string' ? flat.color : undefined),
    underlineStyle,
    underlineThickness,
    ranges: nativeRanges,
    selectable,
    accessibilityLabel: accessibilityLabel ?? resolvedText,
    testID,
    onPress,
    onRangeTap: handleRangeTap,
    // Forward layout-related style only. We strip attributes that are also
    // forwarded as explicit props (color, fontSize, fontFamily, fontWeight,
    // lineHeight, letterSpacing, textAlign, backgroundColor) because RN's
    // ViewManager bridge converts them to native processed values (e.g. hex
    // string → Int color on Android) and tries to set them on our ExpoView
    // via the same prop name — colliding with our string-typed `Prop("color")`
    // binding and failing with `Cannot cast Double to String`.
    style: stripTextStyleAttrs(flat),
  };

  return <NativeDottedUnderlineTextView {...nativeProps} />;
}

/**
 * Strip ONLY the color attributes from a flattened style. RN's Android view-
 * bridge converts hex strings to processed Int colors before forwarding, then
 * tries to set them as our `Prop("color")` / `Prop("backgroundColor")` binding
 * with the Int value — colliding with the explicit string-typed color we
 * already pass as a top-level prop. Stripping these from the style avoids the
 * double-forward + cast failure.
 *
 * Other text attributes (fontSize, lineHeight, fontFamily, textAlign, etc.)
 * are KEPT in the forwarded style so Yoga can size the ExpoView correctly —
 * stripping them collapses the view to 0 height. They're also still forwarded
 * as explicit native props, but numeric props don't have the string→Int cast
 * collision that color props do.
 */
function stripTextStyleAttrs(flat: TextStyle | undefined): TextStyle | undefined {
  if (!flat) return flat;
  const { color: _color, backgroundColor: _bg, ...rest } = flat;
  return rest;
}
