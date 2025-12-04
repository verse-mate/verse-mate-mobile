/**
 * SSO Buttons Component
 *
 * Reusable component for Google and Apple Sign-In buttons.
 * Handles graceful degradation when SSO is not configured.
 *
 * @see Task Group 4: SSO Buttons Component
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { isAppleSignInEnabled } from '@/hooks/auth/useAppleSignIn';
import { isGoogleSignInConfigured } from '@/hooks/auth/useGoogleSignIn';

/**
 * SSO Buttons component props
 */
export interface SSOButtonsProps {
  /** Callback when Google Sign-In button is pressed */
  onGooglePress?: () => void;
  /** Callback when Apple Sign-In button is pressed */
  onApplePress?: () => void;
  /** Whether Google Sign-In is in progress */
  isGoogleLoading?: boolean;
  /** Whether Apple Sign-In is in progress */
  isAppleLoading?: boolean;
  /** Error message to display */
  error?: string | null;
}

/**
 * SSO Buttons Component
 *
 * Renders Google and/or Apple Sign-In buttons based on configuration.
 * Returns null if no SSO provider is configured (graceful degradation).
 *
 * @example
 * ```tsx
 * <SSOButtons
 *   onGooglePress={handleGoogleSignIn}
 *   onApplePress={handleAppleSignIn}
 *   isGoogleLoading={googleLoading}
 *   isAppleLoading={appleLoading}
 *   error={ssoError}
 * />
 * ```
 */
export function SSOButtons({
  onGooglePress,
  onApplePress,
  isGoogleLoading = false,
  isAppleLoading = false,
  error,
}: SSOButtonsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Check which SSO providers are available
  const showGoogleButton = isGoogleSignInConfigured();
  const showAppleButton = Platform.OS === 'ios' && isAppleSignInEnabled();

  // If no SSO provider is configured, return null (graceful degradation)
  if (!showGoogleButton && !showAppleButton) {
    return null;
  }

  const isAnyLoading = isGoogleLoading || isAppleLoading;

  return (
    <View style={styles.container}>
      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Google Sign-In Button */}
      {showGoogleButton && (
        <TouchableOpacity
          style={[styles.button, styles.googleButton, isAnyLoading && styles.buttonDisabled]}
          onPress={onGooglePress}
          disabled={isAnyLoading}
          testID="sso-google-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isGoogleLoading ? 'Signing in with Google' : 'Continue with Google'}
          accessibilityState={{ disabled: isAnyLoading }}
        >
          {isGoogleLoading ? (
            <>
              <ActivityIndicator size="small" color="#4285F4" style={styles.loader} />
              <Text style={styles.googleText}>Signing in with Google...</Text>
            </>
          ) : (
            <>
              <Text style={styles.googleLogo}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Apple Sign-In Button */}
      {showAppleButton && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton, isAnyLoading && styles.buttonDisabled]}
          onPress={onApplePress}
          disabled={isAnyLoading}
          testID="sso-apple-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isAppleLoading ? 'Signing in with Apple' : 'Continue with Apple'}
          accessibilityState={{ disabled: isAnyLoading }}
        >
          {isAppleLoading ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" style={styles.loader} />
              <Text style={styles.appleText}>Signing in with Apple...</Text>
            </>
          ) : (
            <>
              <Text style={styles.appleLogo}></Text>
              <Text style={styles.appleText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* "or" Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: 24,
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
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      minHeight: 48,
      marginBottom: 12,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    googleButton: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
    },
    googleLogo: {
      fontSize: 20,
      fontWeight: '700',
      color: '#4285F4',
      marginRight: 12,
    },
    googleText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1f1f1f',
    },
    appleButton: {
      backgroundColor: '#000000',
    },
    appleLogo: {
      fontSize: 20,
      color: '#ffffff',
      marginRight: 8,
    },
    appleText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    loader: {
      marginRight: 12,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
