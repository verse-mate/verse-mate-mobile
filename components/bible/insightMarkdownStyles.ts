/**
 * The Insight markdown styles — Summary, By-Line and Detailed commentary.
 *
 * Lifted out of ChapterReader so the Jesus feature renders commentary with the
 * SAME styles rather than an approximation of them. The approximation is what
 * Andy reported twice: By-Line in grey at a fixed small size ("colors aren't
 * consistent w the other pages … make all Jesus same as others") while the
 * reader's By-Line is primary-coloured and follows the font-size setting.
 * One definition, two readers.
 */
import { StyleSheet } from 'react-native';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';

export const createInsightMarkdownStyles = (
  colors: ReturnType<typeof getColors>,
  userFontSize: number = fontSizes.bodyLarge
) => {
  // Scale Insight (Summary / By Line / Detailed) markdown with the reader's
  // font-size preference, mirroring the verse-text scaling above. Previously
  // these were fixed tokens, so the slider moved verse text but not the
  // Insight — the bug Andy reported. bodyLarge (18) is the default reader
  // size, so the scale is 1 at the default.
  const contentScale = userFontSize / fontSizes.bodyLarge;
  const bodyFont = fontSizes.bodyLarge * contentScale;
  const heading1Font = fontSizes.heading1 * contentScale;
  const heading2Font = fontSizes.heading2 * contentScale;
  const heading3Font = fontSizes.heading3 * contentScale;
  return StyleSheet.create({
    body: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: heading1Font,
      fontWeight: fontWeights.bold,
      lineHeight: heading1Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: heading2Font,
      fontWeight: fontWeights.semibold,
      lineHeight: heading2Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: heading3Font,
      fontWeight: fontWeights.semibold,
      lineHeight: heading3Font * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    strong: {
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
      color: colors.textPrimary,
    },
    list_item: {
      fontSize: bodyFont,
      lineHeight: bodyFont * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    bullet_list: {
      marginBottom: spacing.lg,
    },
    ordered_list: {
      marginBottom: spacing.lg,
    },
    code_inline: {
      fontFamily: 'monospace',
      fontSize: fontSizes.bodySmall,
      backgroundColor: colors.backgroundElevated,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 3,
      color: colors.textPrimary,
    },
    fence: {
      fontFamily: 'monospace',
      fontSize: fontSizes.bodySmall,
      backgroundColor: colors.backgroundElevated,
      padding: spacing.md,
      borderRadius: 4,
      marginBottom: spacing.lg,
      color: colors.textPrimary,
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    link: {
      color: colors.gold,
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: spacing.xl,
    },
  });
};
