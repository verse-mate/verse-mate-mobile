/**
 * ProgressBar Component
 *
 * Displays reading progress through the current book as a percentage bar.
 * Fixed position at bottom of screen with animated fill width.
 *
 * Features:
 * - Fixed 6px height bar at bottom of screen
 * - Light gray track (#e0e0e0)
 * - Gold fill (#b09a6d) with animated width
 * - Percentage text (10px, gold, right-aligned)
 * - Animates fill width on percentage change (200ms ease-in-out)
 *
 * @see Spec lines 283-294, 1480-1504 (ProgressBar specs)
 * @see Task Group 8.3
 *
 * @example
 * <ProgressBar percentage={42} />
 * // Renders: 42% progress bar at bottom of screen
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { animations, progressBarSpecs } from '@/constants/bible-design-tokens';

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  percentage: number;
}

export function ProgressBar({ percentage }: ProgressBarProps) {
  // Shared value for animated width
  const fillWidth = useSharedValue(percentage);

  // Animate fill width when percentage changes
  useEffect(() => {
    fillWidth.value = withTiming(percentage, {
      duration: animations.progressBar.duration, // 200ms
    });
  }, [percentage, fillWidth]);

  // Animated style for fill bar
  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }));

  return (
    <View style={styles.container} testID="progress-bar">
      {/* Track (background) */}
      <View style={styles.track}>
        {/* Fill (animated gold bar) */}
        <Animated.View style={[styles.fill, fillStyle]} testID="progress-bar-fill" />
      </View>

      {/* Percentage text (right-aligned) */}
      <Text style={styles.percentage} testID="progress-bar-percentage">
        {percentage}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: progressBarSpecs.height,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  track: {
    flex: 1,
    height: progressBarSpecs.height,
    backgroundColor: progressBarSpecs.backgroundColor,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: progressBarSpecs.fillColor,
  },
  percentage: {
    fontSize: progressBarSpecs.percentageFontSize,
    color: progressBarSpecs.percentageColor,
    marginLeft: 8,
    fontWeight: '500',
  },
});
