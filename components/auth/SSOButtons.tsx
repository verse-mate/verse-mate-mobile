/**
 * SSO Buttons Component
 *
 * Reusable component for Google and Apple Sign-In buttons.
 * Handles graceful degradation when SSO is not configured.
 *
 * @see Task Group 4: SSO Buttons Component
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { isAppleSignInEnabled } from '@/hooks/auth/useAppleSignIn';
import { isGoogleSignInConfigured } from '@/hooks/auth/useGoogleSignIn';

/**
 * Google "G" Logo SVG Component
 * Official Google brand colors and shape
 */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

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
              <View style={styles.googleLogo}>
                <GoogleLogo size={20} />
              </View>
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
              <Ionicons name="logo-apple" size={22} color="#ffffff" style={styles.appleLogo} />
              <Text style={styles.appleText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* "or" Divider - only show when at least one SSO button is visible */}
      {(showGoogleButton || showAppleButton) && (
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
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
