import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface FloatingNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  currentBook: string;
  currentChapter: number;
}

/**
 * Floating navigation controls for Bible reading
 */
export const FloatingNavigation: React.FC<FloatingNavigationProps> = ({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  currentBook,
  currentChapter,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    // Entrance animation
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const handlePreviousPress = () => {
    if (canGoPrevious) {
      scale.value = withSpring(0.95, { damping: 20, stiffness: 300 }, () => {
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      });
      onPrevious();
    }
  };

  const handleNextPress = () => {
    if (canGoNext) {
      scale.value = withSpring(0.95, { damping: 20, stiffness: 300 }, () => {
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      });
      onNext();
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]} testID="floating-navigation">
      {/* Previous Button */}
      <TouchableOpacity
        style={[styles.navButton, styles.previousButton, !canGoPrevious && styles.disabledButton]}
        onPress={handlePreviousPress}
        disabled={!canGoPrevious}
        accessible={true}
        accessibilityLabel="Previous chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to previous chapter"
        testID="previous-chapter-button"
      >
        <Text style={[styles.buttonText, !canGoPrevious && styles.disabledText]}>‹</Text>
      </TouchableOpacity>

      {/* Current Position Indicator */}
      <View style={styles.positionIndicator}>
        <Text style={styles.positionText} numberOfLines={1}>
          {currentBook} {currentChapter}
        </Text>
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.navButton, styles.nextButton, !canGoNext && styles.disabledButton]}
        onPress={handleNextPress}
        disabled={!canGoNext}
        accessible={true}
        accessibilityLabel="Next chapter"
        accessibilityRole="button"
        accessibilityHint="Navigate to next chapter"
        testID="next-chapter-button"
      >
        <Text style={[styles.buttonText, !canGoNext && styles.disabledText]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b09a6d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  previousButton: {
    marginRight: 12,
  },
  nextButton: {
    marginLeft: 12,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  disabledText: {
    color: '#999',
  },
  positionIndicator: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212531',
    fontFamily: 'RobotoSerif',
    textAlign: 'center',
  },
});
