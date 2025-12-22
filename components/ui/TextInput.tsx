import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import { useMemo, useState } from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * TextInput Component
 *
 * Reusable text input component for forms with label, error handling,
 * and password visibility toggle functionality.
 *
 * Features:
 * - Label positioned above input
 * - Rounded border styling matching design mockups
 * - Error message display below input (red text)
 * - Password visibility toggle with eye icon (tan/gold color)
 * - Accessibility support
 */
export interface TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  testID?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoComplete?:
    | 'off'
    | 'email'
    | 'name'
    | 'password'
    | 'new-password'
    | 'username'
    | 'tel'
    | 'street-address'
    | 'postal-code'
    | 'cc-number'
    | 'cc-exp'
    | 'cc-csc';
  textContentType?:
    | 'none'
    | 'emailAddress'
    | 'name'
    | 'givenName'
    | 'familyName'
    | 'password'
    | 'newPassword'
    | 'telephoneNumber'
    | 'streetAddressLine1'
    | 'streetAddressLine2'
    | 'postalCode'
    | 'creditCardNumber';
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  testID,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoComplete,
  textContentType,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <RNTextInput
          style={[styles.input, error && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          testID={testID}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          accessible={true}
          accessibilityLabel={label}
          accessibilityHint={error}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={togglePasswordVisibility}
            testID={`${testID}-toggle-visibility`}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={colors.gold}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14, // Slightly smaller label
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.backgroundElevated,
      minHeight: 48,
    },
    inputError: {
      borderColor: colors.error,
    },
    eyeIcon: {
      position: 'absolute',
      right: 12,
      top: 12,
      padding: 4,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      marginTop: 4,
      marginLeft: 4,
    },
  });
