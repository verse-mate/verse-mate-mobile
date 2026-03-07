import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface MicrophoneButtonProps {
  isListening: boolean;
  errorCount?: number;
  onPress: () => void;
}

export function MicrophoneButton({ isListening, errorCount = 0, onPress }: MicrophoneButtonProps) {
  const { colors } = useTheme();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (errorCount > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [errorCount, shakeAnim]);

  const iconName = isListening ? 'mic' : 'mic-off-outline';
  const iconColor = isListening ? colors.gold : colors.textSecondary;

  return (
    <TouchableOpacity
      testID="mic-button"
      onPress={onPress}
      style={styles.button}
      activeOpacity={0.6}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
      accessibilityRole="button"
    >
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
