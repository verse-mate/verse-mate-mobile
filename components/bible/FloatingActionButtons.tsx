/**
 * FloatingActionButtons Component
 *
 * Circular floating action buttons for chapter navigation.
 * Positioned at bottom corners, above progress bar.
 *
 * Features:
 * - Gold background with white chevron icons
 * - Haptic feedback on tap
 * - Platform-specific shadows (iOS) / elevation (Android)
 * - Conditional rendering based on chapter position
 *
 * @see Spec lines 269-282, 459-468 (FAB specifications)
 * @see Task 6.2 - Implement FloatingActionButtons component
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { animationDurations, colors, fabSpecs } from '@/constants/bible-design-tokens';

interface FloatingActionButtonsProps {
  /** Callback fired when previous button is tapped */
  onPrevious: () => void;
  /** Callback fired when next button is tapped */
  onNext: () => void;
  /** Whether to show previous button (false when at first chapter) */
  showPrevious: boolean;
  /** Whether to show next button (false when at last chapter) */
  showNext: boolean;
  /** Whether buttons should be visible (fades in/out based on user interaction) */
  visible?: boolean;
}

/**
 * FloatingActionButtons Component
 *
 * Renders previous/next chapter navigation buttons as floating action buttons
 * positioned at the bottom corners of the screen.
 *
 * Features fade in/out animation based on user interaction:
 * - Fades out when reading (slow scroll or idle)
 * - Fades in when navigating (fast scroll, tap, or at bottom)
 */
export function FloatingActionButtons({
  onPrevious,
  onNext,
  showPrevious,
  showNext,
  visible = true,
}: FloatingActionButtonsProps) {
  // Animated opacity value
  const opacity = useSharedValue(visible ? 1 : 0);

  // Update opacity when visibility changes
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: animationDurations.normal,
    });
  }, [visible, opacity]);

  // Animated style for fade in/out
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePreviousPress = () => {
    // Haptic feedback: medium impact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPrevious();
  };

  const handleNextPress = () => {
    // Haptic feedback: medium impact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      {/* Previous Chapter Button (Left) */}
      <Pressable
        onPress={showPrevious ? handlePreviousPress : undefined}
        style={({ pressed }) => [
          styles.fab,
          styles.fabLeft,
          showPrevious && pressed && styles.fabPressed,
          !showPrevious && styles.fabDisabled,
        ]}
        accessibilityLabel="Previous chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to the previous chapter"
        accessibilityState={{ disabled: !showPrevious }}
        testID="previous-chapter-button"
        disabled={!showPrevious}
      >
        <Ionicons name="chevron-back" size={fabSpecs.iconSize} color={fabSpecs.iconColor} />
      </Pressable>

      {/* Next Chapter Button (Right) */}
      <Pressable
        onPress={showNext ? handleNextPress : undefined}
        style={({ pressed }) => [
          styles.fab,
          styles.fabRight,
          showNext && pressed && styles.fabPressed,
          !showNext && styles.fabDisabled,
        ]}
        accessibilityLabel="Next chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to the next chapter"
        accessibilityState={{ disabled: !showNext }}
        testID="next-chapter-button"
        disabled={!showNext}
      >
        <Ionicons name="chevron-forward" size={fabSpecs.iconSize} color={fabSpecs.iconColor} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: fabSpecs.bottomOffset, // 60px above progress bar
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: fabSpecs.sideOffset, // 20px from edges
    // Allow touches to pass through empty space
    pointerEvents: 'box-none',
  },
  fab: {
    width: fabSpecs.size,
    height: fabSpecs.size,
    borderRadius: fabSpecs.borderRadius,
    backgroundColor: fabSpecs.backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: fabSpecs.shadowOpacity,
        shadowRadius: fabSpecs.shadowRadius,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  fabLeft: {
    // Positioned on the left side
  },
  fabRight: {
    // Positioned on the right side
  },
  fabPressed: {
    // Slight opacity change on press for visual feedback
    opacity: 0.85,
  },
  fabDisabled: {
    opacity: 0.3,
  },
});
