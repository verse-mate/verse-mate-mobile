import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  retryText?: string;
  style?: ViewStyle;
  showIcon?: boolean;
}

/**
 * Error display component with optional retry functionality
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  message,
  onRetry,
  retryText = 'Retry',
  style,
  showIcon = false,
}) => {
  return (
    <View style={[styles.container, style]} testID="error-display">
      {showIcon && (
        <View style={styles.iconContainer} testID="error-icon">
          <Text style={styles.icon}>⚠️</Text>
        </View>
      )}

      <Text
        style={styles.message}
        accessible={true}
        accessibilityLabel="Error message"
        accessibilityRole="text"
      >
        {message}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          accessible={true}
          accessibilityLabel="Retry button"
          accessibilityRole="button"
          accessibilityHint="Tap to retry the previous action"
        >
          <Text style={styles.retryText}>{retryText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'RobotoSerif',
  },
  retryButton: {
    backgroundColor: '#b09a6d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'RobotoSerif',
  },
});
