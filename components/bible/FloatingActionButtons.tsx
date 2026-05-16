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
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { animationDurations, getFabSpecs, type ThemeMode } from '@/theme/tokens';

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
 *
 * Hit areas are always active regardless of opacity so that a tap at an arrow's
 * last-visible position still triggers navigation rather than falling through to
 * verse text beneath (VER-46). Only the visual chrome is animated.
 */
export function FloatingActionButtons({
  onPrevious,
  onNext,
  showPrevious,
  showNext,
  visible = true,
}: FloatingActionButtonsProps) {
  const { mode } = useTheme();
  const styles = createStyles(mode);
  const specs = getFabSpecs(mode);

  // Animated opacity value
  const opacity = useSharedValue(visible ? 1 : 0);

  // Update opacity when visibility changes
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: animationDurations.normal,
    });
  }, [visible, opacity]);

  // Animated style for fade in/out — applied to inner visual only, not the hit area
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePreviousPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPrevious();
  };

  const handleNextPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    // Static (non-animated) container so hit areas are always active regardless of opacity.
    // On web, Reanimated's opacity animation can suppress pointer events on children even
    // with pointerEvents="box-none"; keeping the container un-animated fixes the
    // tap-fallthrough bug (VER-46) where taps on faded arrows landed on verse text.
    <View style={styles.container} pointerEvents="box-none">
      {/* Previous Chapter Button (Left) */}
      <Pressable
        onPress={showPrevious ? handlePreviousPress : undefined}
        style={styles.fabHitArea}
        accessibilityLabel="Previous chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to the previous chapter"
        accessibilityState={{ disabled: !showPrevious }}
        testID="previous-chapter-button"
        disabled={!showPrevious}
      >
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.fab,
              showPrevious && pressed && styles.fabPressed,
              !showPrevious && styles.fabDisabled,
              animatedStyle,
            ]}
          >
            <Ionicons name="chevron-back" size={specs.iconSize} color={specs.iconColor} />
          </Animated.View>
        )}
      </Pressable>

      {/* Next Chapter Button (Right) */}
      <Pressable
        onPress={showNext ? handleNextPress : undefined}
        style={styles.fabHitArea}
        accessibilityLabel="Next chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to the next chapter"
        accessibilityState={{ disabled: !showNext }}
        testID="next-chapter-button"
        disabled={!showNext}
      >
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.fab,
              showNext && pressed && styles.fabPressed,
              !showNext && styles.fabDisabled,
              animatedStyle,
            ]}
          >
            <Ionicons name="chevron-forward" size={specs.iconSize} color={specs.iconColor} />
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (mode: ThemeMode) => {
  const specs = getFabSpecs(mode);

  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: specs.bottomOffset, // 60px above progress bar
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: specs.sideOffset, // 20px from edges
      // Allow touches to pass through empty space between buttons
      pointerEvents: 'box-none',
    },
    // Hit area for each button — same size as visual, always interactive
    fabHitArea: {
      width: specs.size,
      height: specs.size,
    },
    fab: {
      width: specs.size,
      height: specs.size,
      borderRadius: specs.borderRadius,
      backgroundColor: specs.backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      // Platform-specific shadows
      ...Platform.select({
        ios: {
          shadowColor: specs.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: specs.shadowOpacity,
          shadowRadius: specs.shadowRadius,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    fabPressed: {
      // Slight opacity change on press for visual feedback
      opacity: 0.85,
    },
    fabDisabled: {
      opacity: 0.3,
    },
  });
};
