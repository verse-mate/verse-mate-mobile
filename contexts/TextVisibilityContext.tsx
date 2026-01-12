/**
 * TextVisibilityContext
 *
 * Provides viewport visibility information to text components for hybrid tokenization.
 * Only visible text is tokenized into individual word elements for accurate long-press detection.
 * Off-screen text renders as segments for performance.
 */

import { createContext, useContext } from 'react';

/**
 * Represents the visible Y range within the scroll container
 */
export interface VisibleYRange {
  /** Top Y coordinate of visible viewport (relative to scroll content) */
  startY: number;
  /** Bottom Y coordinate of visible viewport (relative to scroll content) */
  endY: number;
}

/**
 * Context value for text visibility tracking
 */
interface TextVisibilityContextValue {
  /** Current visible Y range, null if not yet calculated */
  visibleYRange: VisibleYRange | null;
}

/**
 * Context for tracking which portions of text are visible in the viewport.
 * Used by HighlightedText to decide whether to tokenize into individual words.
 */
export const TextVisibilityContext = createContext<TextVisibilityContextValue>({
  visibleYRange: null,
});

/**
 * Hook to access the current visible Y range
 */
export function useTextVisibility() {
  return useContext(TextVisibilityContext);
}

/**
 * Check if an element is within the visible viewport
 * @param elementY - Y position of the element (relative to scroll content)
 * @param elementHeight - Height of the element
 * @param visibleRange - Current visible Y range
 * @param buffer - Extra pixels to include beyond viewport edges (default: 200)
 * @returns true if element is at least partially visible (with buffer)
 */
export function isElementVisible(
  elementY: number,
  elementHeight: number,
  visibleRange: VisibleYRange | null,
  buffer: number = 200
): boolean {
  if (!visibleRange) {
    // If no visibility info, assume visible (safe default)
    return true;
  }

  const elementTop = elementY;
  const elementBottom = elementY + elementHeight;
  const viewportTop = visibleRange.startY - buffer;
  const viewportBottom = visibleRange.endY + buffer;

  // Element is visible if it overlaps with the buffered viewport
  return elementBottom >= viewportTop && elementTop <= viewportBottom;
}
