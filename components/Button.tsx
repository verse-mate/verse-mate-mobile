import type React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * Button Component
 * Primary button component for VerseMate app interactions
 */
export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'auth';
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

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#6B7280',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  auth: {
    backgroundColor: '#B4956B', // Tan/gold brand color
    borderRadius: 8,
  },
  fullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    borderColor: '#D1D5DB',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#007AFF',
  },
  authText: {
    color: '#FFFFFF', // White text for auth variant
  },
  textDisabled: {
    color: '#9CA3AF',
  },
});
