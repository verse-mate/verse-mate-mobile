/**
 * Native binding for `@versemate/text`.
 *
 * Resolution is lazy and failure-tolerant: the module is absent on web, in Expo
 * Go, and in Jest, and every one of those has to keep working. `VMText` falls
 * back to an RN `<Text>` tree when `getNativeVMTextView()` returns null.
 */

import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type { TextRange } from './types';

/** Props the native view accepts. Values are dp/sp, resolved from style by `VMText`. */
/**
 * Range shape the native side actually accepts — the underline fields flattened.
 *
 * Kept distinct from the public `TextRange` so the mismatch that caused every
 * underline to be dropped cannot recur silently: the bridge shape is now a type,
 * not a convention.
 */
export interface NativeTextRange {
  start: number;
  end: number;
  underlineStyle?: string;
  underlineColor?: string;
  underlineThickness?: number;
  backgroundColor?: string;
  color?: string;
  fontWeight?: string;
  /** "italic" or absent. Present here too so MEASUREMENT sees the same style the view draws. */
  fontStyle?: string;
  fontScale?: number;
  baselineShift?: number;
  interactive: boolean;
}

export interface NativeVMTextProps {
  text: string;
  /**
   * Decorations as one encoded string — see `encodeRanges` in VMText.tsx.
   *
   * Not an array: an array prop is converted element-by-element through pooled RN
   * `Dynamic` objects and crashed the native setter under rapid mount/unmount.
   */
  rangesEncoded?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  color?: string;
  style?: unknown;
  testID?: string;
  onPress?: (event: { nativeEvent: { charOffset: number; x: number; y: number } }) => void;
  onRangeTap?: (event: { nativeEvent: { index: number; charOffset: number } }) => void;
  onSelectionChange?: (event: { nativeEvent: { start: number; end: number } }) => void;
  onTextLayout?: (event: {
    nativeEvent: {
      lines: {
        start: number;
        end: number;
        x: number;
        y: number;
        width: number;
        height: number;
        baseline: number;
      }[];
    };
  }) => void;
}

/** A measurement request. All sizes in dp/sp, matching RN style units. */
export interface MeasureRequest {
  text: string;
  /** Flat bridge shape, same as the view prop — see `NativeTextRange`. */
  ranges?: NativeTextRange[];
  /** Available width in dp. Text wraps to this. */
  width: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  /** Explicit line height in dp; omit for the font's natural spacing. */
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
}

interface VMTextNativeModule {
  /** Height in dp. Synchronous — see `VMTextModule.kt` for why that matters. */
  measureHeight(request: MeasureRequest): number;
  /** Batched form; one JSI crossing for a whole chapter's paragraphs. */
  measureHeights(requests: MeasureRequest[]): number[];
  clearCache(): void;
}

// `undefined` means "not yet attempted"; `null` means "attempted and absent".
let cachedModule: VMTextNativeModule | null | undefined;
let cachedView: ComponentType<NativeVMTextProps> | null | undefined;

export function getNativeVMTextModule(): VMTextNativeModule | null {
  if (cachedModule === undefined) {
    try {
      cachedModule = requireNativeModule<VMTextNativeModule>('VMText');
    } catch {
      // Expected on web / Expo Go / Jest. Not an error worth logging on every
      // call — the caller's fallback path is the designed behaviour.
      cachedModule = null;
    }
  }
  return cachedModule;
}

export function getNativeVMTextView(): ComponentType<NativeVMTextProps> | null {
  if (cachedView === undefined) {
    try {
      cachedView = requireNativeViewManager<NativeVMTextProps>('VMText');
    } catch {
      cachedView = null;
    }
  }
  return cachedView;
}

/** True when the native renderer is available on this platform/build. */
export function isNativeTextAvailable(): boolean {
  return getNativeVMTextView() !== null && getNativeVMTextModule() !== null;
}

/**
 * Reset the memoised lookups. Tests only — production resolves once per process.
 */
export function resetNativeVMTextCacheForTests(): void {
  cachedModule = undefined;
  cachedView = undefined;
}
