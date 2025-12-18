import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import { useLogin } from '@/hooks/useLogin';

interface SignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignUp: () => void;
  onAuthSuccess?: () => void;
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
}: SignInModalProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isPending, error } = useLogin();

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

  const handleGoogleSignIn = () => {
    // TODO: Implement Google SSO
    // Will integrate with Google OAuth flow
    console.log('Google Sign-In clicked');
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple Sign In
    // Will integrate with Apple Sign In service
    console.log('Apple Sign-In clicked');
  };

  const styles = createStyles(colors);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Sign In</Text>
            <Pressable onPress={onClose} hitSlop={10}>
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
              editable={!isPending}
            />
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!isPending}
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
            {error && (
              <Text style={styles.errorText}>
                {error.message || 'Login failed. Please check your credentials.'}
              </Text>
            )}

            {/* Sign In Button */}
            <Pressable
              style={[styles.signInButton, isPending && styles.signInButtonDisabled]}
              onPress={handleSignIn}
              disabled={isPending || !email || !password}
            >
              {isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* SSO Options */}
          <View style={styles.ssoContainer}>
            {/* Google Sign-In (Placeholder) */}
            <Pressable
              style={[styles.ssoButton, styles.ssoButtonDisabled]}
              onPress={handleGoogleSignIn}
              disabled
            >
              <Ionicons name="logo-google" size={20} color={colors.textSecondary} />
              <Text style={[styles.ssoButtonText, styles.ssoButtonTextDisabled]}>
                Continue with Google (Coming Soon)
              </Text>
            </Pressable>

            {/* Apple Sign-In (Placeholder) */}
            <Pressable
              style={[styles.ssoButton, styles.ssoButtonDisabled]}
              onPress={handleAppleSignIn}
              disabled
            >
              <Ionicons name="logo-apple" size={20} color={colors.textSecondary} />
              <Text style={[styles.ssoButtonText, styles.ssoButtonTextDisabled]}>
                Continue with Apple (Coming Soon)
              </Text>
            </Pressable>
          </View>

          {/* Switch to Sign Up */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>Don&apos;t have an account? </Text>
            <Pressable onPress={onSwitchToSignUp} hitSlop={10}>
              <Text style={styles.switchLink}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
