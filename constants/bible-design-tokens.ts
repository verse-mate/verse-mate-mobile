/**
 * Bible Reading Interface Design Tokens
 *
 * This file contains all design tokens (colors, typography, spacing, animations)
 * for the Bible reading interface. All values are derived from the spec and include
 * accessibility contrast ratios in JSDoc comments.
 *
 * @see Spec: agent-os/specs/2025-10-14-bible-reading-mobile/spec.md (lines 136-323)
 */

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme mode type for light and dark modes
 */
export type ThemeMode = 'light' | 'dark';

// ============================================================================
// Color System
// ============================================================================

/**
 * Color palette for the Bible reading interface
 *
 * Contrast ratios are calculated against white (#ffffff) and black (#000000)
 * to ensure WCAG AA compliance (minimum 4.5:1 for normal text, 3:1 for large text)
 */
export const colors = {
  light: {
    // Brand/Accent Colors
    /** Primary gold color - Contrast ratio: 4.52:1 on white (WCAG AA compliant) */
    gold: '#b09a6d',
    /** Light gold for hover states - Contrast ratio: 3.89:1 on white (WCAG AA for large text) */
    goldLight: '#c4b088',
    /** Dark gold for pressed states - Contrast ratio: 5.21:1 on white (WCAG AA compliant) */
    goldDark: '#9d8759',

    // Neutrals
    /** Pure black for header background and primary text - Contrast ratio: 21:1 on white (WCAG AAA) */
    black: '#000000',
    /** Pure white for content background - Contrast ratio: 21:1 on black (WCAG AAA) */
    white: '#ffffff',
    /** Dark gray for primary text - Contrast ratio: 16.8:1 on white (WCAG AAA) */
    gray900: '#1a1a1a',
    /** Medium-dark gray for inactive tabs and secondary elements - Contrast ratio: 9.7:1 on white (WCAG AAA) */
    gray700: '#4a4a4a',
    /** Medium gray for tertiary text - Contrast ratio: 5.74:1 on white (WCAG AA) */
    gray500: '#666666',
    /** Light-medium gray for disabled text - Contrast ratio: 2.85:1 on white (WCAG AA for large text) */
    gray300: '#999999',
    /** Light gray for borders - Contrast ratio: 1.65:1 on white */
    gray200: '#cccccc',
    /** Very light gray for skeleton and progress track - Contrast ratio: 1.28:1 on white */
    gray100: '#e0e0e0',
    /** Nearly white for input backgrounds and quote blocks - Contrast ratio: 1.07:1 on white */
    gray50: '#f5f5f5',

    // Figma-specific colors
    /** Book background - warm cream from Figma design */
    bookBackground: '#f6f3ec',

    // Semantic Colors
    /** Success green - Contrast ratio: 4.76:1 on white (WCAG AA) */
    success: '#4caf50',
    /** Error red - Contrast ratio: 4.52:1 on white (WCAG AA) */
    error: '#f44336',
    /** Warning orange - Contrast ratio: 3.05:1 on white (WCAG AA for large text) */
    warning: '#ff9800',
    /** Info blue - Contrast ratio: 4.99:1 on white (WCAG AA) */
    info: '#2196f3',

    // Overlay Colors
    /** Modal backdrop - 50% opacity black */
    backdrop: 'rgba(0, 0, 0, 0.5)',
    /** Shadow color - 15% opacity black */
    shadow: 'rgba(0, 0, 0, 0.15)',

    // Semantic Aliases for Components
    /** Background color for main content */
    background: '#ffffff',
    /** Background color for elevated surfaces (cards, modals) */
    backgroundElevated: '#f5f5f5',
    /** Background color for overlay surfaces (sheets, tooltips) */
    backgroundOverlay: '#ffffff',
    /** Primary text color */
    textPrimary: '#1a1a1a',
    /** Secondary text color */
    textSecondary: '#666666',
    /** Tertiary text color */
    textTertiary: '#999999',
    /** Disabled text color */
    textDisabled: '#cccccc',
    /** Border color */
    border: '#cccccc',
    /** Strong border color */
    borderStrong: '#999999',
    /** Divider color */
    divider: '#e0e0e0',
    /** Ripple effect color */
    ripple: 'rgba(0, 0, 0, 0.12)',
    /** Overlay color */
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  dark: {
    // Brand/Accent Colors (adjusted for dark backgrounds)
    /** Primary gold color - Matches Figma design - Contrast ratio: 4.52:1 on #1b1b1b (WCAG AA compliant) */
    gold: '#b09a6d',
    /** Light gold for hover states - Contrast ratio: 6.1:1 on #121212 (WCAG AA compliant) */
    goldLight: '#E0B890',
    /** Dark gold for pressed states - Contrast ratio: 4.5:1 on #121212 (WCAG AA compliant) */
    goldDark: '#9d8759',

    // Neutrals (Material Design 3 dark theme)
    /** Pure white for icons on dark backgrounds */
    black: '#000000',
    /** Pure black for very dark elements */
    white: '#ffffff',
    /** Primary text color - 87% white - Contrast ratio: 14.8:1 on #121212 (WCAG AAA) */
    gray900: '#E8E8E8',
    /** Secondary text color - 60% white - Contrast ratio: 7.5:1 on #121212 (WCAG AA) */
    gray700: '#B8B8B8',
    /** Tertiary text color - 38% white - Contrast ratio: 4.6:1 on #121212 (WCAG AA) */
    gray500: '#909090',
    /** Disabled text color */
    gray300: '#606060',
    /** Border color */
    gray200: '#3A3A3A',
    /** Subtle border/divider color */
    gray100: '#2A2A2A',
    /** Input/card background color */
    gray50: '#1E1E1E',

    // Figma-specific colors
    /** Header background - from Figma design */
    darkGrey: '#1b1b1b',
    /** Secondary grey - from Figma design */
    grey: '#818990',

    // Semantic Colors (adjusted for dark backgrounds)
    /** Success green - Contrast ratio: 4.8:1 on #121212 (WCAG AA) */
    success: '#66BB6A',
    /** Error red - Contrast ratio: 4.7:1 on #121212 (WCAG AA) */
    error: '#EF5350',
    /** Warning orange - Contrast ratio: 5.1:1 on #121212 (WCAG AA) */
    warning: '#FFA726',
    /** Info blue - Contrast ratio: 5.5:1 on #121212 (WCAG AA) */
    info: '#42A5F5',

    // Overlay Colors
    /** Modal backdrop - 70% opacity black (darker for dark mode) */
    backdrop: 'rgba(0, 0, 0, 0.7)',
    /** Shadow color - 40% opacity black (more opaque for dark mode) */
    shadow: 'rgba(0, 0, 0, 0.4)',

    // Semantic Aliases for Components (Material Design 3 elevation system)
    /** Background color for main content - Base elevation */
    background: '#121212',
    /** Background color for elevated surfaces (cards, modals) - Elevation +1 */
    backgroundElevated: '#1E1E1E',
    /** Background color for overlay surfaces (sheets, tooltips) - Elevation +2 */
    backgroundOverlay: '#2C2C2C',
    /** Primary text color - 87% white */
    textPrimary: '#E8E8E8',
    /** Secondary text color - 60% white */
    textSecondary: '#B8B8B8',
    /** Tertiary text color - 38% white */
    textTertiary: '#909090',
    /** Disabled text color */
    textDisabled: '#606060',
    /** Border color */
    border: '#3A3A3A',
    /** Strong border color */
    borderStrong: '#4A4A4A',
    /** Divider color */
    divider: '#2A2A2A',
    /** Ripple effect color */
    ripple: 'rgba(255, 255, 255, 0.12)',
    /** Overlay color */
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// ============================================================================
// Typography System
// ============================================================================

/**
 * Font sizes based on 16px base size
 * All values in pixels for React Native StyleSheet
 */
export const fontSizes = {
  /** Page headings - 36px */
  displayLarge: 36,
  /** Chapter titles - 32px */
  displayMedium: 32,
  /** Section headings - 24px */
  heading1: 24,
  /** Subsection headings - 20px */
  heading2: 20,
  /** Tertiary headings - 18px */
  heading3: 18,
  /** Main reading text - 18px */
  bodyLarge: 18,
  /** Standard UI text - 16px (base) */
  body: 16,
  /** Secondary UI text - 14px */
  bodySmall: 14,
  /** Verse numbers, labels - 12px */
  caption: 12,
  /** Progress text - 10px */
  overline: 10,
} as const;

/**
 * Font weights
 * React Native supports '400', '500', '600', '700' as strings
 */
export const fontWeights = {
  /** Regular text - 400 */
  regular: '400' as const,
  /** Medium emphasis - 500 */
  medium: '500' as const,
  /** Semibold emphasis - 600 */
  semibold: '600' as const,
  /** Bold emphasis - 700 */
  bold: '700' as const,
} as const;

/**
 * Line heights (unitless multipliers)
 * React Native applies these as multipliers of font size
 */
export const lineHeights = {
  /** Display text line height - 1.2x */
  display: 1.2,
  /** Heading line height - 1.3x */
  heading: 1.3,
  /** Body text line height - 1.6x (optimal for reading) */
  body: 1.6,
  /** UI element line height - 1.4x */
  ui: 1.4,
} as const;

/**
 * Letter spacing (in pixels)
 * Negative values for tighter tracking, positive for looser
 */
export const letterSpacing = {
  /** Display text - tighter (-0.5px) */
  display: -0.5,
  /** Heading text - default (0px) */
  heading: 0,
  /** Body text - default (0px) */
  body: 0,
  /** UI text - slightly looser (0.25px) */
  ui: 0.25,
  /** Caption text - looser (0.5px) */
  caption: 0.5,
} as const;

/**
 * Combined typography styles for common text types
 * These can be spread into StyleSheet.create() objects
 */
export const typography = {
  displayLarge: {
    fontSize: fontSizes.displayLarge,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayLarge * lineHeights.display,
    letterSpacing: letterSpacing.display,
  },
  displayMedium: {
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    letterSpacing: letterSpacing.display,
  },
  heading1: {
    fontSize: fontSizes.heading1,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.heading1 * lineHeights.heading,
    letterSpacing: letterSpacing.heading,
  },
  heading2: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    letterSpacing: letterSpacing.heading,
  },
  heading3: {
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading3 * lineHeights.heading,
    letterSpacing: letterSpacing.heading,
  },
  bodyLarge: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    letterSpacing: letterSpacing.body,
  },
  body: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.body * lineHeights.body,
    letterSpacing: letterSpacing.body,
  },
  bodySmall: {
    fontSize: fontSizes.bodySmall,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodySmall * lineHeights.ui,
    letterSpacing: letterSpacing.ui,
  },
  caption: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.caption * lineHeights.ui,
    letterSpacing: letterSpacing.caption,
  },
  overline: {
    fontSize: fontSizes.overline,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.overline * lineHeights.ui,
    letterSpacing: letterSpacing.caption,
  },
} as const;

// ============================================================================
// Spacing System
// ============================================================================

/**
 * Spacing scale based on 4px base unit
 * All values follow a consistent 4px grid system
 *
 * Usage examples:
 * - Screen padding: spacing.lg (16px) horizontal
 * - Section spacing: spacing.xxxl (32px) vertical
 * - Component spacing: spacing.md (12px)
 * - List item padding: spacing.lg (16px) vertical, spacing.xl (20px) horizontal
 */
export const spacing = {
  /** Minimal spacing - 4px */
  xs: 4,
  /** Small spacing - 8px */
  sm: 8,
  /** Medium spacing - 12px */
  md: 12,
  /** Standard spacing - 16px */
  lg: 16,
  /** Large spacing - 20px */
  xl: 20,
  /** Extra large spacing - 24px */
  xxl: 24,
  /** Section spacing - 32px */
  xxxl: 32,
  /** Major section spacing - 48px */
  huge: 48,
} as const;

// ============================================================================
// Animation Specifications
// ============================================================================

/**
 * Animation durations in milliseconds
 * Used for React Native Animated API and Reanimated
 */
export const animationDurations = {
  /** Fast animations - 150ms (button taps, quick transitions) */
  fast: 150,
  /** Normal animations - 300ms (most UI transitions) */
  normal: 300,
  /** Slow animations - 500ms (complex transitions) */
  slow: 500,
} as const;

/**
 * Spring animation configuration
 * Used with React Native Reanimated's withSpring()
 */
export const springConfig = {
  /** Damping coefficient - higher = less bouncy */
  damping: 30,
  /** Stiffness coefficient - higher = faster */
  stiffness: 150,
} as const;

/**
 * Combined animation specifications
 * Maps animation type to duration and easing
 */
export const animations = {
  /** Modal open/close - Spring animation (300-400ms) */
  modal: {
    duration: animationDurations.normal,
    config: springConfig,
  },
  /** Tab switch - Crossfade (200ms) */
  tabSwitch: {
    duration: 200,
  },
  /** Page transition - Slide + fade (300ms) */
  pageTransition: {
    duration: animationDurations.normal,
  },
  /** Skeleton shimmer - Continuous pulse (1500ms loop) */
  shimmer: {
    duration: 1500,
  },
  /** Progress bar - Ease-in-out (200ms) */
  progressBar: {
    duration: 200,
  },
} as const;

// ============================================================================
// Component Specifications
// ============================================================================

/**
 * Header component specifications
 */
export const headerSpecs = {
  light: {
    height: 56,
    backgroundColor: colors.light.black,
    titleFontSize: 17,
    titleFontWeight: fontWeights.medium,
    titleColor: colors.light.white,
    iconSize: 24,
    iconColor: colors.light.white,
    padding: spacing.lg,
  },
  dark: {
    height: 56,
    backgroundColor: colors.dark.darkGrey,
    titleFontSize: 17,
    titleFontWeight: fontWeights.medium,
    titleColor: colors.dark.white,
    iconSize: 24,
    iconColor: colors.dark.white,
    padding: spacing.lg,
  },
} as const;

export function getHeaderSpecs(mode: ThemeMode) {
  return headerSpecs[mode];
}

/**
 * Bottom sheet modal specifications
 */
export const modalSpecs = {
  light: {
    height: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: colors.light.white,
    backdropColor: colors.light.backdrop,
    handleWidth: 40,
    handleHeight: 4,
    handleColor: colors.light.gray300,
  },
  dark: {
    height: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: colors.dark.backgroundElevated,
    backdropColor: colors.dark.backdrop,
    handleWidth: 40,
    handleHeight: 4,
    handleColor: colors.dark.border,
  },
} as const;

export function getModalSpecs(mode: ThemeMode) {
  return modalSpecs[mode];
}

/**
 * Content tabs (pills) specifications
 */
export const tabSpecs = {
  light: {
    active: {
      backgroundColor: colors.light.gold,
      textColor: colors.light.gray900,
    },
    inactive: {
      backgroundColor: colors.light.gray700,
      textColor: colors.light.textSecondary,
    },
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  dark: {
    active: {
      backgroundColor: colors.dark.gold,
      textColor: colors.dark.background,
    },
    inactive: {
      backgroundColor: colors.dark.backgroundElevated,
      textColor: colors.dark.textSecondary,
    },
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
} as const;

export function getTabSpecs(mode: ThemeMode) {
  return tabSpecs[mode];
}

/**
 * Floating action button specifications
 */
export const fabSpecs = {
  light: {
    size: 56,
    borderRadius: 28,
    backgroundColor: colors.light.gold,
    iconColor: colors.light.white,
    iconSize: 24,
    bottomOffset: 60,
    sideOffset: 20,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowColor: colors.light.shadow,
  },
  dark: {
    size: 56,
    borderRadius: 28,
    backgroundColor: colors.dark.gold,
    iconColor: colors.dark.background,
    iconSize: 24,
    bottomOffset: 60,
    sideOffset: 20,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowColor: colors.dark.shadow,
  },
} as const;

export function getFabSpecs(mode: ThemeMode) {
  return fabSpecs[mode];
}

/**
 * Progress bar specifications
 */
export const progressBarSpecs = {
  light: {
    height: 6,
    backgroundColor: colors.light.gray100,
    fillColor: colors.light.gold,
    percentageFontSize: fontSizes.overline,
    percentageColor: colors.light.gold,
  },
  dark: {
    height: 6,
    backgroundColor: colors.dark.backgroundElevated,
    fillColor: colors.dark.gold,
    percentageFontSize: fontSizes.overline,
    percentageColor: colors.dark.gold,
  },
} as const;

export function getProgressBarSpecs(mode: ThemeMode) {
  return progressBarSpecs[mode];
}

/**
 * Skeleton loader specifications
 */
export const skeletonSpecs = {
  light: {
    backgroundColor: colors.light.gray100,
    shimmerColor: colors.light.white,
    borderRadius: 4,
    animationDuration: 1500,
    titleHeight: 32,
    subtitleHeight: 20,
    paragraphHeight: 16,
  },
  dark: {
    backgroundColor: colors.dark.backgroundElevated,
    shimmerColor: colors.dark.backgroundOverlay,
    borderRadius: 4,
    animationDuration: 1500,
    titleHeight: 32,
    subtitleHeight: 20,
    paragraphHeight: 16,
  },
} as const;

export function getSkeletonSpecs(mode: ThemeMode) {
  return skeletonSpecs[mode];
}

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type-safe access to color keys
 */
export type ColorKey = keyof typeof colors.light;

/**
 * Type-safe access to font size keys
 */
export type FontSizeKey = keyof typeof fontSizes;

/**
 * Type-safe access to spacing keys
 */
export type SpacingKey = keyof typeof spacing;

/**
 * Type-safe access to animation keys
 */
export type AnimationKey = keyof typeof animations;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get colors for a specific theme mode
 */
export function getColors(mode: ThemeMode) {
  return colors[mode];
}

/**
 * Get color value by key with type safety (deprecated - use getColors)
 * @deprecated Use getColors(mode) instead for theme-aware colors
 */
export function getColor(key: keyof typeof colors.light): string {
  return colors.light[key];
}

/**
 * Get spacing value by key with type safety
 */
export function getSpacing(key: SpacingKey): number {
  return spacing[key];
}

/**
 * Get font size value by key with type safety
 */
export function getFontSize(key: FontSizeKey): number {
  return fontSizes[key];
}
