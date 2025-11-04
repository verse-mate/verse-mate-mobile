import { Ionicons } from '@expo/vector-icons';
import type React from 'react';
import { useState } from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
              color="#B4956B" // Tan/gold brand color
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937', // Dark text color
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB', // Gray border
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputError: {
    borderColor: '#EF4444', // Red border for error state
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444', // Red error text
    marginTop: 4,
    marginLeft: 4,
  },
});
