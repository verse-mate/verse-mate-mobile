/**
 * Login Screen
 *
 * User login screen with email and password fields.
 * Includes form validation and navigation to signup.
 *
 * @see Task Group 6.4: Create app/auth/login.tsx
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/ui/TextInput';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useLogin } from '@/hooks/useLogin';

/**
 * Login Screen Component
 *
 * Features:
 * - Email field
 * - Password field with visibility toggle
 * - Form validation (email format, password required)
 * - Submit button disabled until all validations pass
 * - Navigation to signup screen
 * - "Continue without account" option
 */
export default function Login() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const { mutate: login, isPending, error, isSuccess } = useLogin();

  // Dismiss modal on successful login
  useEffect(() => {
    if (isSuccess) {
      router.dismiss();
    }
  }, [isSuccess]);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    return validateEmail(email) && password.length > 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    // Reset errors
    setErrors({
      email: '',
      password: '',
    });

    // Validate all fields
    const newErrors = {
      email: '',
      password: '',
    };

    if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password || password.length === 0) {
      newErrors.password = 'Password is required';
    }

    // If there are errors, set them and return
    if (Object.values(newErrors).some((error) => error !== '')) {
      setErrors(newErrors);
      return;
    }

    // Submit form
    login({
      body: {
        email,
        password,
      },
    });
  };

  // Handle navigation to signup (replace instead of push to avoid modal stacking)
  const handleSignupPress = () => {
    router.replace('/auth/signup');
  };

  // Handle continue without account
  const handleContinueWithout = () => {
    router.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subtitle}>Login into your account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              error={errors.email}
              testID="login-email"
            />

            {/* Password */}
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              error={errors.password}
              testID="login-password"
              autoComplete="off"
              textContentType="none"
            />

            {/* Network Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error?.message || 'An error occurred during login. Please try again.'}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Button
              title={isPending ? 'Logging in...' : 'Login'}
              onPress={handleSubmit}
              variant="auth"
              fullWidth
              disabled={!isFormValid() || isPending}
              testID="login-submit"
            />

            {/* Signup Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>{"Don't have account? "}</Text>
              <TouchableOpacity onPress={handleSignupPress} testID="login-signup-link">
                <Text style={styles.linkTextUnderlined}>Create New Account</Text>
              </TouchableOpacity>
            </View>

            {/* Continue Without Account */}
            <TouchableOpacity
              onPress={handleContinueWithout}
              testID="login-continue-without-account"
            >
              <Text style={styles.continueText}>Continue without an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 48,
      paddingBottom: 24,
    },
    header: {
      marginBottom: 32,
    },
    heading: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    form: {
      flex: 1,
    },
    errorContainer: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
    linkContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
      marginBottom: 16,
    },
    linkText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    linkTextUnderlined: {
      fontSize: 16,
      color: colors.textPrimary,
      textDecorationLine: 'underline',
    },
    continueText: {
      fontSize: 16,
      color: colors.gold,
      textAlign: 'center',
    },
  });
