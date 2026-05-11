/**
 * Recipe StyleSheet Factories
 *
 * Pure factory functions that build StyleSheet objects for the four MVP
 * primitives (Button, Card, Input, Text) from a theme blob. Recipes never
 * import token *values* at module level — only types — so every styling
 * literal is sourced from the caller-provided theme (br-005). Designer
 * output (Lovable today, Claude Design tomorrow) flows in through
 * `theme/tokens.ts`; recipes are the second hop.
 *
 * Usage:
 *   const theme = useTheme();              // ThemeContextValue is a superset of RecipeTheme
 *   const styles = createButtonStyles(theme);
 *
 * @see Spec: specs/feat-design-system-foundation/spec.md
 * @see Doc: design.md
 */

import { type TextStyle, StyleSheet, type ViewStyle } from 'react-native';
import type { getColors, radii, spacing, typography } from './tokens';

/**
 * Theme blob accepted by every recipe factory. Structurally compatible with
 * `useTheme()` from `@/contexts/ThemeContext` — `useTheme()` returns more
 * fields (preference, mode, setPreference, isLoading), which TS happily
 * narrows down to this shape.
 */
export type RecipeTheme = {
  colors: ReturnType<typeof getColors>;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
};

// ============================================================================
// Button
// ============================================================================

/**
 * Button recipe — the single source of truth for VerseMate button styling.
 *
 * Variants: primary | secondary | outline | outlineGold | auth
 * Modifiers: disabled | fullWidth
 * Text variants: one per button variant + textDisabled
 */
export function createButtonStyles(theme: RecipeTheme) {
  const { colors, spacing, radii, typography } = theme;
  return StyleSheet.create({
    button: {
      paddingVertical: spacing.md, // 12
      paddingHorizontal: spacing.xxl, // 24
      borderRadius: radii.md, // 8
      alignItems: 'center',
      justifyContent: 'center',
      // 48 — WCAG 2.5.5 minimum touch target. Kept inline as an a11y constant
      // (not a design token that varies across brands).
      minHeight: 48,
    },
    primary: {
      backgroundColor: colors.info,
    },
    secondary: {
      backgroundColor: colors.gray700,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.info,
    },
    outlineGold: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.gold,
    },
    auth: {
      backgroundColor: colors.gold,
      borderRadius: radii.md,
    },
    fullWidth: {
      width: '100%',
    },
    buttonDisabled: {
      backgroundColor: colors.gray300,
      borderColor: colors.gray300,
    },
    text: {
      fontSize: typography.body.fontSize,
      fontWeight: '600',
    },
    primaryText: {
      color: colors.white,
    },
    secondaryText: {
      color: colors.white,
    },
    outlineText: {
      color: colors.info,
    },
    outlineGoldText: {
      color: colors.gold,
    },
    authText: {
      // Contrast: black-on-gold (dark mode) / white-on-gold (light mode) via colors.background
      color: colors.background,
    },
    textDisabled: {
      color: colors.gray500,
    },
  });
}

// ============================================================================
// Card
// ============================================================================

/**
 * Card recipe — surface containers with three elevation patterns.
 *
 * Variants: default | elevated | outlined
 */
export function createCardStyles(theme: RecipeTheme) {
  const { colors, spacing, radii } = theme;
  const base: ViewStyle = {
    padding: spacing.lg, // 16
    borderRadius: radii.lg, // 16
  };
  return StyleSheet.create({
    default: {
      ...base,
      backgroundColor: colors.background,
    },
    elevated: {
      ...base,
      backgroundColor: colors.backgroundElevated,
      // RN cross-platform shadow: iOS uses shadow*, Android uses elevation
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    outlined: {
      ...base,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}

// ============================================================================
// Input
// ============================================================================

/**
 * Input recipe — text-field styling with default / error / disabled states.
 *
 * Variants: default | error | disabled
 */
export function createInputStyles(theme: RecipeTheme) {
  const { colors, spacing, radii, typography } = theme;
  const base: ViewStyle & TextStyle = {
    paddingVertical: spacing.md, // 12
    paddingHorizontal: spacing.lg, // 16
    borderWidth: 1,
    borderRadius: radii.md, // 8
    fontSize: typography.body.fontSize,
    minHeight: 48,
  };
  return StyleSheet.create({
    default: {
      ...base,
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.textPrimary,
    },
    error: {
      ...base,
      backgroundColor: colors.background,
      borderColor: colors.error,
      color: colors.textPrimary,
    },
    disabled: {
      ...base,
      backgroundColor: colors.gray100,
      borderColor: colors.borderSecondary,
      color: colors.textDisabled,
    },
  });
}

// ============================================================================
// Text
// ============================================================================

/**
 * Text recipe — typography variants matched 1:1 to `theme.typography`.
 *
 * Variants: 10 entries — displayLarge, displayMedium, heading1..3,
 * bodyLarge, body, bodySmall, caption, overline.
 */
export function createTextStyles(theme: RecipeTheme) {
  const { colors, typography } = theme;
  const color: TextStyle = { color: colors.textPrimary };
  return StyleSheet.create({
    displayLarge: { ...typography.displayLarge, ...color },
    displayMedium: { ...typography.displayMedium, ...color },
    heading1: { ...typography.heading1, ...color },
    heading2: { ...typography.heading2, ...color },
    heading3: { ...typography.heading3, ...color },
    bodyLarge: { ...typography.bodyLarge, ...color },
    body: { ...typography.body, ...color },
    bodySmall: { ...typography.bodySmall, ...color },
    caption: { ...typography.caption, ...color },
    overline: { ...typography.overline, ...color },
  });
}
