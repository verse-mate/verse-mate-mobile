import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

/**
 * Basic loading skeleton component with shimmer animation
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const shimmerAnimation = useSharedValue(0);

  React.useEffect(() => {
    if (animated) {
      shimmerAnimation.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    }
  }, [animated, shimmerAnimation]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmerAnimation.value, [0, 1], [0.3, 0.7]);

    return {
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        },
        animated && animatedStyle,
        style,
      ]}
      testID="loading-skeleton"
      accessible={false}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e2e2e2',
  },
});
