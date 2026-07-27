/**
 * React bindings for the perf monitor.
 *
 * Kept separate from `monitor.ts` so the monitor stays framework-free and
 * testable without a renderer.
 */

import { useEffect, useRef } from 'react';
import { perfSpan } from './monitor';
import type { PerfMeta } from './types';

/**
 * Measure how long a component takes to become visible: the span opens during
 * render and closes in a passive effect, so it covers element construction,
 * reconciliation, commit and the native layout pass that follows.
 *
 * `useEffect` rather than `useLayoutEffect` on purpose — a layout effect fires
 * before paint, which would exclude the very work we care about. This number is
 * meant to approximate "how long until the user sees it".
 *
 * The span reopens whenever `key` changes, which is how one component instance
 * being reused for a different chapter still gets measured per chapter.
 *
 * ```ts
 * usePerfMountSpan('chapter.mount', `${bookId}:${chapterNumber}`, {
 *   book: bookId,
 *   chapter: chapterNumber,
 * });
 * ```
 */
export function usePerfMountSpan(name: string, key: string | number, meta?: PerfMeta): void {
  const endRef = useRef<(() => void) | null>(null);
  const keyRef = useRef<string | number | null>(null);

  // Opening the span during render is deliberate: the render itself is part of
  // what we are measuring, so waiting for an effect would miss it.
  if (keyRef.current !== key) {
    // Close a span still open from a previous key — otherwise a rapid change
    // (fast swiping) would leak spans and skew the "open during block" set.
    endRef.current?.();
    keyRef.current = key;
    endRef.current = perfSpan(name, meta);
  }

  useEffect(() => {
    endRef.current?.();
    endRef.current = null;
  }, [key]);

  // Unmounting mid-mount is itself signal (the user swiped away before the
  // chapter finished), so close rather than discard.
  useEffect(() => {
    return () => {
      endRef.current?.();
      endRef.current = null;
    };
  }, []);
}

/**
 * Measure the synchronous cost of building a component's element tree.
 *
 * Returns a closer to call immediately before `return`. Unlike
 * `usePerfMountSpan` this excludes reconciliation and commit — use it to
 * separate "my render function is slow" from "React/native layout is slow",
 * which are very different problems with very different fixes.
 */
export function perfRenderSpan(name: string, meta?: PerfMeta): () => void {
  return perfSpan(name, meta);
}
