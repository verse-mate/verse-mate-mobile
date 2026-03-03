import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface MicrophoneButtonProps {
  isListening: boolean;
  onPress: () => void;
}

export function MicrophoneButton({ isListening, onPress }: MicrophoneButtonProps) {
  const { colors } = useTheme();

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
      <Ionicons name={iconName} size={24} color={iconColor} />
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
