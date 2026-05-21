import { requireNativeViewManager } from 'expo-modules-core';
import type { ComponentType } from 'react';

/**
 * JS-side prop shape for the native view. Mirrors the `Prop(...)` entries
 * declared in `DottedUnderlineTextModule.kt` and `DottedUnderlineTextModule.swift`.
 */
export type NativeUnderlineRange = {
  start: number;
  end: number;
  style?: 'dotted' | 'solid';
  color?: string;
  thickness?: number;
  backgroundColor?: string;
  fontWeight?: string;
  textColor?: string;
};

export type NativeDottedUnderlineTextProps = {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  underlineColor?: string;
  underlineStyle?: 'dotted' | 'solid';
  underlineThickness?: number;
  /**
   * Per-range decoration specs. When present, the whole-text underline props
   * are ignored and the native view draws only these ranges.
   */
  ranges?: NativeUnderlineRange[];
  selectable?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  onPress?: () => void;
  onRangeTap?: (event: { nativeEvent: { index: number } }) => void;
  style?: unknown;
};

/**
 * Lazily resolves the native view component. We cannot call
 * `requireNativeViewManager` at module top-level because the web stub of
 * `expo-modules-core` throws an `UnavailabilityError` synchronously, which
 * would crash any web bundle that even imports this file.
 *
 * Returns `null` if the native view is not registered (web, Expo Go without
 * a custom dev client, jest, etc.). The React wrapper falls back to plain
 * `<Text>` in that case.
 */
let cachedNativeView: ComponentType<NativeDottedUnderlineTextProps> | null | undefined;

export function getNativeDottedUnderlineTextView(): ComponentType<NativeDottedUnderlineTextProps> | null {
  if (cachedNativeView !== undefined) {
    return cachedNativeView;
  }
  try {
    cachedNativeView =
      requireNativeViewManager<NativeDottedUnderlineTextProps>('DottedUnderlineText');
  } catch {
    cachedNativeView = null;
  }
  return cachedNativeView;
}
