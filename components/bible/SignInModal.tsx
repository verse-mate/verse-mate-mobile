import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useSSOLogin } from '@/hooks/auth/useSSOLogin';
import { useLogin } from '@/hooks/useLogin';

interface SignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignUp: () => void;
  onAuthSuccess?: () => void;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
  /** Controlled state for email */
  email: string;
  /** Setter for email */
  setEmail: (value: string) => void;
  /** Controlled state for password */
  password: string;
  /** Setter for password */
  setPassword: (value: string) => void;
}

/**
 * SignInModal Component
 *
 * Modal for user authentication with email/password and SSO options.
 * Appears when users try to save highlights while logged out.
 */
export default function SignInModal({
  visible,
  onClose,
  onSwitchToSignUp,
  onAuthSuccess,
  useModal = true,
  email,
  setEmail,
  password,
  setPassword,
}: SignInModalProps) {
  const { colors } = useTheme();
  // Local UI state
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isPending, error: loginError } = useLogin();
  const {
    signInWithGoogle,
    signInWithApple,
    isGoogleLoading,
    isAppleLoading,
    isGoogleAvailable,
    isAppleAvailable,
    error: ssoError,
    resetError: resetSSOError,
  } = useSSOLogin();

  const handleSignIn = () => {
    if (!email || !password) {
      return;
    }

    login(
      {
        body: {
          email,
          password,
        },
      },
      {
        onSuccess: () => {
          // Clear form
          setEmail('');
          setPassword('');
          // Close modal and notify parent of successful auth
          onClose();
          onAuthSuccess?.();
        },
      }
    );
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleAppleSignIn = async () => {
    await signInWithApple();
  };

  // Close and notify on SSO success (if not handled by AuthContext state)
  // Since useSSOLogin completes the backend login, we can close if it succeeds
  useEffect(() => {
    if (visible && !isGoogleLoading && !isAppleLoading && !ssoError && !isPending) {
      // We don't have a direct 'success' flag from useSSOLogin, but we can assume
      // if it was loading and now isn't, and there's no error, it might have worked.
      // However, AuthContext provides the true state.
    }
  }, [isGoogleLoading, isAppleLoading, ssoError, visible, isPending]);

  // Combined error display
  const displayError = loginError?.message || ssoError;

  const styles = createStyles(colors);

  if (!visible) return null;

  const content = (
    <View style={styles.modalContainer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Pressable
            onPress={() => {
              resetSSOError();
              onClose();
            }}
            hitSlop={10}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Email/Password Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isPending && !isGoogleLoading && !isAppleLoading}
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!isPending && !isGoogleLoading && !isAppleLoading}
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Error Message */}
          {displayError && <Text style={styles.errorText}>{displayError}</Text>}

          {/* Sign In Button */}
          <Pressable
            style={[
              styles.signInButton,
              (isPending || !email || !password || isGoogleLoading || isAppleLoading) &&
                styles.signInButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={isPending || !email || !password || isGoogleLoading || isAppleLoading}
          >
            {isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        {(isGoogleAvailable || isAppleAvailable) && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* SSO Options */}
        <View style={styles.ssoContainer}>
          {/* Google Sign-In */}
          {isGoogleAvailable && (
            <Pressable
              style={[
                styles.ssoButton,
                (isPending || isGoogleLoading || isAppleLoading) && styles.ssoButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isPending || isGoogleLoading || isAppleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                  <Text style={styles.ssoButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>
          )}

          {/* Apple Sign-In */}
          {isAppleAvailable && (
            <Pressable
              style={[
                styles.ssoButton,
                (isPending || isGoogleLoading || isAppleLoading) && styles.ssoButtonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={isPending || isGoogleLoading || isAppleLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color={colors.textPrimary} />
                  <Text style={styles.ssoButtonText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* Switch to Sign Up */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>Don&apos;t have an account? </Text>
          <Pressable
            onPress={() => {
              resetSSOError();
              onSwitchToSignUp();
            }}
            hitSlop={10}
          >
            <Text style={styles.switchLink}>Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Conditional rendering based on useModal prop
  if (useModal) {
    return (
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Non-modal rendering (absolute positioned View)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

/**
 * Creates styles for SignInModal
 */
function createStyles(
  colors: ReturnType<typeof import('@/constants/bible-design-tokens').getColors>
) {
  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: spacing.lg,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.backgroundOverlay,
      borderRadius: 12,
      padding: spacing.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    form: {
      marginBottom: spacing.lg,
    },
    input: {
      height: 48,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      backgroundColor: colors.background,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: spacing.md,
      backgroundColor: colors.background,
    },
    passwordInput: {
      flex: 1,
      height: '100%',
      paddingHorizontal: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
    },
    eyeIcon: {
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: colors.error,
      fontSize: fontSizes.bodySmall,
      marginBottom: spacing.sm,
    },
    signInButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    signInButtonDisabled: {
      opacity: 0.6,
    },
    signInButtonText: {
      color: colors.white,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      marginHorizontal: spacing.md,
      color: colors.textSecondary,
      fontSize: fontSizes.bodySmall,
    },
    ssoContainer: {
      gap: spacing.md,
    },
    ssoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      minHeight: 48,
    },
    ssoButtonDisabled: {
      opacity: 0.5,
    },
    ssoButtonText: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    ssoButtonTextDisabled: {
      color: colors.textSecondary,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    switchText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    switchLink: {
      fontSize: fontSizes.body,
      color: colors.gold,
      fontWeight: fontWeights.semibold,
    },
  });
}
