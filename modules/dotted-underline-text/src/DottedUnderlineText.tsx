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
        const styleForRange: TextStyle =
          (r.style ?? underlineStyle) === 'solid' || Platform.OS !== 'ios'
            ? {
                textDecorationLine: 'underline',
                textDecorationColor: r.color ?? underlineColor,
              }
            : {
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
                textDecorationColor: r.color ?? underlineColor,
              };
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
    // Forward the rest of the style for layout (margin, padding, width, etc.).
    // The native view extends ExpoView/UIView so layout props are applied by RN.
    style,
  };

  return <NativeDottedUnderlineTextView {...nativeProps} />;
}
