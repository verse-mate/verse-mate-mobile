import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Button Component
 * Primary button component for VerseMate app interactions
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    button: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    primary: {
      backgroundColor: colors.info,
    },
    secondary: {
      backgroundColor: colors.gray700,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.info,
    },
    outlineGold: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.gold,
    },
    auth: {
      backgroundColor: colors.gold,
      borderRadius: 8,
    },
    fullWidth: {
      width: '100%',
    },
    buttonDisabled: {
      backgroundColor: colors.gray300,
      borderColor: colors.gray300,
    },
    text: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryText: {
      color: colors.white,
    },
    secondaryText: {
      color: colors.white,
    },
    outlineText: {
      color: colors.info,
    },
    outlineGoldText: {
      color: colors.gold,
    },
    authText: {
      color: colors.background, // Contrast: Black on Gold (Dark), White on Gold (Light)
    },
    textDisabled: {
      color: colors.gray500,
    },
  });
