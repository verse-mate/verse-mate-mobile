import type React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

interface LoadingSkeletonProps {
  testID?: string;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

/**
 * Basic loading skeleton component
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  testID,
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}
      testID={testID || 'loading-skeleton'}
      accessible={false}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e2e2e2',
  },
});
