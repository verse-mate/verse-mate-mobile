/**
 * Signup Screen
 *
 * User registration screen with first name, last name, email, and password fields.
 * Includes SSO buttons for Google and Apple Sign-In.
 * Includes real-time password requirements validation and navigation to login.
 *
 * @see Task Group 6.3: Create app/auth/signup.tsx
 * @see Task Group 5: SSO Integration
 */

import { router, useLocalSearchParams } from 'expo-router';
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
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { SSOButtons } from '@/components/auth/SSOButtons';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/ui/TextInput';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useSSOLogin } from '@/hooks/auth/useSSOLogin';
import { useSignup } from '@/hooks/useSignup';
import { validatePassword } from '@/lib/auth/password-validation';

/**
 * Signup Screen Component
 *
 * Features:
 * - SSO buttons (Google, Apple on iOS)
 * - First name and last name fields (side-by-side on tablet/desktop, stacked on mobile)
 * - Email field
 * - Password field with visibility toggle
 * - Real-time password requirements validation
 * - Form validation (all fields required, email format, password requirements)
 * - Submit button disabled until all validations pass
 * - Navigation to login screen
 * - "Continue without account" option
 */
export default function Signup() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ fromOnboarding?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const { mutate: signup, isPending, error, isSuccess } = useSignup();
  const {
    signInWithGoogle,
    signInWithApple,
    isGoogleLoading,
    isAppleLoading,
    error: ssoError,
    resetError: resetSsoError,
    isSuccess: isSSOSuccess,
  } = useSSOLogin();

  // Navigate after successful signup (email/password or SSO)
  useEffect(() => {
    if (isSuccess || isSSOSuccess) {
      // If coming from onboarding, navigate to Genesis 1
      if (params.fromOnboarding === 'true') {
        router.replace('/bible/1/1');
      } else {
        // Otherwise just dismiss the modal (return to previous screen)
        router.dismiss();
      }
    }
  }, [isSuccess, isSSOSuccess, params.fromOnboarding]);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    return (
      firstName.length >= 1 &&
      firstName.length <= 100 &&
      lastName.length >= 1 &&
      lastName.length <= 100 &&
      validateEmail(email) &&
      validatePassword(password) &&
      password.length <= 20
    );
  };

  // Handle form submission
  const handleSubmit = () => {
    // Reset errors
    setErrors({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    });
    resetSsoError();

    // Validate all fields
    const newErrors = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    };

    if (!firstName || firstName.length < 1 || firstName.length > 100) {
      newErrors.firstName = 'First name must be between 1 and 100 characters';
    }

    if (!lastName || lastName.length < 1 || lastName.length > 100) {
      newErrors.lastName = 'Last name must be between 1 and 100 characters';
    }

    if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!validatePassword(password)) {
      newErrors.password = 'Password does not meet requirements';
    }

    if (password.length > 20) {
      newErrors.password = 'Password must be 20 characters or less';
    }

    // If there are errors, set them and return
    if (Object.values(newErrors).some((error) => error !== '')) {
      setErrors(newErrors);
      return;
    }

    // Submit form
    signup({
      body: {
        firstName,
        lastName,
        email,
        password,
      },
    });
  };

  // Handle navigation to login (replace instead of push to avoid modal stacking)
  const handleLoginPress = () => {
    // Preserve fromOnboarding parameter when navigating to login
    if (params.fromOnboarding === 'true') {
      router.replace('/auth/login?fromOnboarding=true');
    } else {
      router.replace('/auth/login');
    }
  };

  // Handle continue without account
  const handleContinueWithout = () => {
    if (router.canGoBack()) {
      router.dismiss();
    } else {
      router.replace('/bible/1/1');
    }
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
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subtitle}>
              Please provide the following information to set up your account.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* SSO Buttons */}
            <SSOButtons
              onGooglePress={signInWithGoogle}
              onApplePress={signInWithApple}
              isGoogleLoading={isGoogleLoading}
              isAppleLoading={isAppleLoading}
              error={ssoError}
            />

            {/* First Name and Last Name Row */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <TextInput
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  error={errors.firstName}
                  testID="signup-first-name"
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.nameField}>
                <TextInput
                  label="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  error={errors.lastName}
                  testID="signup-last-name"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email */}
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCorrect={false}
              spellCheck={false}
              error={errors.email}
              testID="signup-email"
            />

            {/* Password */}
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoCorrect={false}
              spellCheck={false}
              error={errors.password}
              testID="signup-password"
              autoComplete="off"
              textContentType="none"
            />

            {/* Password Requirements */}
            <PasswordRequirements password={password} />

            {/* Network Error Display */}
            {error && !ssoError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error?.message || 'An error occurred during signup. Please try again.'}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Button
              title={isPending ? 'Creating account...' : 'Create account'}
              onPress={handleSubmit}
              variant="auth"
              fullWidth
              disabled={!isFormValid() || isPending || isGoogleLoading || isAppleLoading}
              testID="signup-submit"
            />

            {/* Login Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleLoginPress} testID="signup-login-link">
                <Text style={styles.linkTextUnderlined}>Login</Text>
              </TouchableOpacity>
            </View>

            {/* Continue Without Account */}
            <TouchableOpacity
              onPress={handleContinueWithout}
              testID="signup-continue-without-account"
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
    nameRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 0,
    },
    nameField: {
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
