/**
 * Login Screen
 *
 * User login screen with email and password fields.
 * Includes SSO buttons for Google and Apple Sign-In.
 * Includes form validation and navigation to signup.
 *
 * @see Task Group 6.4: Create app/auth/login.tsx
 * @see Task Group 5: SSO Integration
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SSOButtons } from '@/components/auth/SSOButtons';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useSSOLogin } from '@/hooks/auth/useSSOLogin';
import { useLogin } from '@/hooks/useLogin';
import type { getColors } from '@/theme/tokens';

/**
 * Login Screen Component
 *
 * Features:
 * - SSO buttons (Google, Apple on iOS)
 * - Email field
 * - Password field with visibility toggle
 * - Form validation (email format, password required)
 * - Submit button disabled until all validations pass
 * - Navigation to signup screen
 * - "Continue without account" option
 */
export default function Login() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const params = useLocalSearchParams<{ fromOnboarding?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const { mutate: login, isPending, error, isSuccess } = useLogin();
  const {
    signInWithGoogle,
    signInWithApple,
    isGoogleLoading,
    isAppleLoading,
    error: ssoError,
    resetError: resetSsoError,
    isSuccess: isSSOSuccess,
  } = useSSOLogin();

  // Navigate after successful login (email/password or SSO)
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
    return validateEmail(email) && password.length > 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    // Reset errors
    setErrors({
      email: '',
      password: '',
    });
    resetSsoError();

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
    // Preserve fromOnboarding parameter when navigating to signup
    if (params.fromOnboarding === 'true') {
      router.replace('/auth/signup?fromOnboarding=true');
    } else {
      router.replace('/auth/signup');
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
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subtitle}>Login into your account</Text>
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

            {/* Email */}
            <TextInput
              label={t('auth.login.email_label')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.login.email_label')}
              keyboardType="email-address"
              autoCorrect={false}
              spellCheck={false}
              error={errors.email}
              testID="login-email"
            />

            {/* Password */}
            <TextInput
              label={t('auth.login.password_label')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.login.password_label')}
              secureTextEntry
              autoCorrect={false}
              spellCheck={false}
              error={errors.password}
              testID="login-password"
              autoComplete="off"
              textContentType="none"
            />

            {/* Network Error Display */}
            {error && !ssoError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error?.message || t('auth.errors.network_error')}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Button
              title={isPending ? t('common.loading') : t('auth.login.submit')}
              onPress={handleSubmit}
              variant="auth"
              fullWidth
              disabled={!isFormValid() || isPending || isGoogleLoading || isAppleLoading}
              testID="login-submit"
            />

            {/* Signup Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>{t('auth.login.no_account')} </Text>
              <TouchableOpacity onPress={handleSignupPress} testID="login-signup-link">
                <Text style={styles.linkTextUnderlined}>{t('auth.login.create_account')}</Text>
              </TouchableOpacity>
            </View>

            {/* Continue Without Account */}
            <TouchableOpacity
              onPress={handleContinueWithout}
              testID="login-continue-without-account"
            >
              <Text style={styles.continueText}>{t('auth.login.continue_without')}</Text>
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
