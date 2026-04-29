import type React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { createButtonStyles } from '@/theme/recipes';

/**
 * Button Component
 * Primary button component for VerseMate app interactions.
 *
 * Styling lives in the Button recipe (`theme/recipes.ts`) — this component
 * is the rendering shell.
 */
export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'outlineGold' | 'auth';
  fullWidth?: boolean;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createButtonStyles(theme);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        disabled && styles.buttonDisabled,
        fullWidth && styles.fullWidth,
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, styles[`${variant}Text`], disabled && styles.textDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};
