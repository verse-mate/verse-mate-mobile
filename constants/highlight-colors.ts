/**
 * Highlight Color Constants
 *
 * Pre-defined color palette for Bible text highlighting.
 * Backend supports 9 colors: yellow, green, blue, pink, purple, orange, red, teal, brown.
 * Uses Material Design color palette for vibrant, consistent mobile UI.
 *
 * Supports both light and dark mode with appropriate color adjustments:
 * - Light mode: Standard Material Design colors
 * - Dark mode: Brighter/more saturated versions for visibility on dark backgrounds
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 46-52)
 */

import type { ThemeMode } from '@/constants/bible-design-tokens';

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
 * Light mode highlight color palette using Material Design colors
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
 * Dark mode highlight color palette - adjusted for visibility on dark backgrounds
 *
 * Brighter/more saturated versions for better contrast against dark backgrounds.
 * These colors are lighter variants to ensure text remains readable when
 * highlights are rendered with semi-transparent backgrounds on dark themes.
 */
export const HIGHLIGHT_COLORS_DARK: Record<HighlightColor, string> = {
  yellow: '#FFF176', // Brighter yellow (Material Yellow 300)
  green: '#81C784', // Brighter green (Material Green 300)
  blue: '#64B5F6', // Brighter blue (Material Blue 300)
  pink: '#F48FB1', // Brighter pink (Material Pink 200)
  purple: '#BA68C8', // Brighter purple (Material Purple 300)
  orange: '#FFB74D', // Brighter orange (Material Orange 300)
  red: '#EF5350', // Brighter red (Material Red 400)
  teal: '#4DB6AC', // Brighter teal (Material Teal 300)
  brown: '#A1887F', // Brighter brown (Material Brown 300)
} as const;

/**
 * Get highlight color based on theme mode
 *
 * Returns the appropriate color variant for the current theme.
 * Dark mode uses brighter colors for better visibility.
 *
 * @param color - The highlight color key
 * @param mode - The current theme mode ('light' or 'dark')
 * @returns The hex color string for the specified theme
 *
 * @example
 * ```tsx
 * const { mode } = useTheme();
 * const backgroundColor = getHighlightColor('yellow', mode);
 * // Returns '#FFEB3B' in light mode, '#FFF176' in dark mode
 * ```
 */
export function getHighlightColor(color: HighlightColor, mode: ThemeMode): string {
  return mode === 'dark' ? HIGHLIGHT_COLORS_DARK[color] : HIGHLIGHT_COLORS[color];
}

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
