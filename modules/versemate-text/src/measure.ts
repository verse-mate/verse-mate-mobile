/**
 * Height measurement, with a JS-side estimate for when native is unavailable.
 */

import type { MeasureRequest } from './VMTextModule';
import { getNativeVMTextModule } from './VMTextModule';

/**
 * Measure one block of text, in dp.
 *
 * Returns `null` when native measurement is unavailable (web, Expo Go, Jest), so
 * the caller can fall back to letting the platform size the text itself rather
 * than being handed a fabricated number it would trust as exact.
 */
export function measureTextHeight(request: MeasureRequest): number | null {
  const native = getNativeVMTextModule();
  if (!native) return null;
  return native.measureHeight(request);
}

/**
 * Measure many blocks in one native call.
 *
 * A chapter mounts ~20 paragraphs together. Batching turns 20 JSI crossings into
 * one; the per-block work is unchanged and still cache-backed on the native side.
 *
 * Returns `null` — not an array of nulls — when native is unavailable, so the
 * caller has one unambiguous check rather than a per-item one.
 */
export function measureTextHeights(requests: MeasureRequest[]): number[] | null {
  const native = getNativeVMTextModule();
  if (!native) return null;
  if (requests.length === 0) return [];
  return native.measureHeights(requests);
}

/**
 * Discard cached measurements.
 *
 * Must be called when the system font scale changes: every cached height was
 * measured against the old scale, and reusing one means text measured small gets
 * drawn large and clips.
 */
export function clearTextMeasurementCache(): void {
  getNativeVMTextModule()?.clearCache();
}
