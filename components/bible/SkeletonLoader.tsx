import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getSkeletonSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * SkeletonLoader Component
 *
 * A loading skeleton with shimmer animation for Bible reading content.
 * Uses react-native-reanimated for smooth 60fps animations.
 *
 * Features:
 * - Shimmer animation: opacity pulse from 1.0 → 0.5 → 1.0 (1500ms loop)
 * - Title skeleton: 60% width, 32px height
 * - Subtitle skeleton: 40% width, 20px height
 * - 3 paragraph skeletons: 100%, 100%, 80% width, 16px height
 * - Uses gray100 background with white shimmer overlay
 *
 * @see Spec lines 698-776 (SkeletonLoader implementation)
 */
export function SkeletonLoader() {
  const { mode } = useTheme();
  const skeletonSpecs = getSkeletonSpecs(mode);
  const styles = createStyles(skeletonSpecs);

  const opacity = useSharedValue(1);

  useEffect(() => {
    // Start shimmer animation on mount
    // Pulse from 1.0 → 0.5 → 1.0 in 1500ms loop (infinite)
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 750 }), withTiming(1, { duration: 750 })),
      -1, // infinite
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container} testID="skeleton-loader">
      {/* Title skeleton: 60% width, 32px height */}
      <Animated.View style={[styles.title, animatedStyle]} testID="skeleton-title" />

      {/* Subtitle skeleton: 40% width, 20px height */}
      <Animated.View style={[styles.subtitle, animatedStyle]} testID="skeleton-subtitle" />

      {/* Paragraph skeletons: 100%, 100%, 80% width, 16px height */}
      <Animated.View style={[styles.paragraph, animatedStyle]} testID="skeleton-paragraph-1" />
      <Animated.View style={[styles.paragraph, animatedStyle]} testID="skeleton-paragraph-2" />
      <Animated.View style={[styles.paragraphShort, animatedStyle]} testID="skeleton-paragraph-3" />
    </View>
  );
}

const createStyles = (skeletonSpecs: ReturnType<typeof getSkeletonSpecs>) =>
  StyleSheet.create({
    container: {
      padding: 20,
    },
    title: {
      width: '60%',
      height: skeletonSpecs.titleHeight,
      backgroundColor: skeletonSpecs.backgroundColor,
      borderRadius: skeletonSpecs.borderRadius,
      marginBottom: 16,
    },
    subtitle: {
      width: '40%',
      height: skeletonSpecs.subtitleHeight,
      backgroundColor: skeletonSpecs.backgroundColor,
      borderRadius: skeletonSpecs.borderRadius,
      marginBottom: 12,
    },
    paragraph: {
      width: '100%',
      height: skeletonSpecs.paragraphHeight,
      backgroundColor: skeletonSpecs.backgroundColor,
      borderRadius: skeletonSpecs.borderRadius,
      marginBottom: 8,
    },
    paragraphShort: {
      width: '80%',
      height: skeletonSpecs.paragraphHeight,
      backgroundColor: skeletonSpecs.backgroundColor,
      borderRadius: skeletonSpecs.borderRadius,
      marginBottom: 12,
    },
  });
