/**
 * ReadingProgressBar Component
 *
 * Reusable reading progress bar for split view layouts.
 * Shows a horizontal progress bar with percentage indicator.
 *
 * Used by both Bible reading and Topics screens in split view mode.
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  fontSizes,
  fontWeights,
  getSplitViewSpecs,
  spacing,
} from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for ReadingProgressBar
 */
export interface ReadingProgressBarProps {
  /** Current reading progress (0-100) */
  progress: number;

  /** Whether to show the progress bar */
  visible?: boolean;

  /** Test ID for testing */
  testID?: string;
}

/**
 * ReadingProgressBar Component
 *
 * Renders a horizontal progress bar with percentage display.
 * Designed to sit at the bottom of the content panel in split view.
 */
export function ReadingProgressBar({
  progress,
  visible = true,
  testID = 'reading-progress-bar',
}: ReadingProgressBarProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const styles = createStyles(specs, colors);

  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Progress Bar Track */}
      <View style={styles.barContainer}>
        {/* Background Track */}
        <View style={styles.track} />

        {/* Progress Fill */}
        <View style={[styles.fill, { width: `${clampedProgress}%` }]} />
      </View>

      {/* Percentage Label */}
      <Text style={styles.percentageText}>{Math.round(clampedProgress)}%</Text>
    </View>
  );
}

/**
 * Create styles for ReadingProgressBar
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      height: specs.progressBarHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: `${colors.border}80`, // 50% opacity
      gap: spacing.md,
    },
    barContainer: {
      flex: 1,
      height: 6,
      borderRadius: 10,
      overflow: 'hidden',
      position: 'relative',
    },
    track: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: specs.progressBarTrackColor,
      borderRadius: 10,
    },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: specs.progressBarFillColor,
      borderRadius: 10,
    },
    percentageText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      minWidth: 40,
      textAlign: 'right',
    },
  });
}

export default ReadingProgressBar;
