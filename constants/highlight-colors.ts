/**
 * Highlight Color Constants
 *
 * Pre-defined color palette for Bible text highlighting.
 * Backend supports 9 colors: yellow, green, blue, pink, purple, orange, red, teal, brown.
 * Uses Material Design color palette for vibrant, consistent mobile UI.
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 46-52)
 */

/**
 * Highlight color type union
 * Must match backend enum exactly
 */
export type HighlightColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'brown';

/**
 * Highlight color palette using Material Design colors
 *
 * Colors render as semi-transparent backgrounds for text readability.
 * Uses vibrant Material Design colors for better visibility on mobile.
 * Maintain WCAG contrast ratios for accessibility.
 */
export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#2196F3',
  pink: '#E91E63',
  purple: '#9C27B0',
  orange: '#FF9800',
  red: '#F44336',
  teal: '#009688',
  brown: '#795548',
} as const;

/**
 * Default highlight color when user creates new highlight
 */
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow';

/**
 * Array of color keys for rendering color picker grid
 * Order matches visual design: Yellow, Green, Blue, Pink, Purple, Orange, Red, Teal, Brown
 */
export const HIGHLIGHT_COLOR_ORDER: HighlightColor[] = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
  'orange',
  'red',
  'teal',
  'brown',
] as const;
