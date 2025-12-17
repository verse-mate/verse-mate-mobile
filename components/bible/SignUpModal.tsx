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
import { useSignup } from '@/hooks/useSignup';

interface SignUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignIn: () => void;
  onAuthSuccess?: () => void;
}

/**
 * SignUpModal Component
 *
 * Modal for user registration with email/password.
 * Appears as the default when users try to save highlights while logged out.
 */
export default function SignUpModal({
  visible,
  onClose,
  onSwitchToSignIn,
  onAuthSuccess,
}: SignUpModalProps) {
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { mutate: signup, isPending, error } = useSignup();

  const handleSignUp = () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setValidationError('');
    signup(
      {
        body: {
          firstName,
          lastName,
          email,
          password,
        },
      },
      {
        onSuccess: () => {
          // Clear form
          setFirstName('');
          setLastName('');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setValidationError('');
          // Close modal and notify parent of successful auth
          onClose();
          onAuthSuccess?.();
        },
      }
    );
  };

  const styles = createStyles(colors);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Sign Up</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Sign Up Form */}
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="First Name"
                placeholderTextColor={colors.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!isPending}
              />
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="Last Name"
                placeholderTextColor={colors.textSecondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!isPending}
              />
            </View>
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
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
            {(error || validationError) && (
              <Text style={styles.errorText}>
                {validationError || error?.message || 'Sign up failed. Please try again.'}
              </Text>
            )}

            {/* Sign Up Button */}
            <Pressable
              style={[styles.signUpButton, isPending && styles.signUpButtonDisabled]}
              onPress={handleSignUp}
              disabled={
                isPending || !firstName || !lastName || !email || !password || !confirmPassword
              }
            >
              {isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.signUpButtonText}>Sign Up</Text>
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
            {/* Google Sign-Up (Placeholder) */}
            <Pressable style={[styles.ssoButton, styles.ssoButtonDisabled]} disabled>
              <Ionicons name="logo-google" size={20} color={colors.textSecondary} />
              <Text style={[styles.ssoButtonText, styles.ssoButtonTextDisabled]}>
                Continue with Google (Coming Soon)
              </Text>
            </Pressable>

            {/* Apple Sign-Up (Placeholder) */}
            <Pressable style={[styles.ssoButton, styles.ssoButtonDisabled]} disabled>
              <Ionicons name="logo-apple" size={20} color={colors.textSecondary} />
              <Text style={[styles.ssoButtonText, styles.ssoButtonTextDisabled]}>
                Continue with Apple (Coming Soon)
              </Text>
            </Pressable>
          </View>

          {/* Switch to Sign In */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Pressable onPress={onSwitchToSignIn} hitSlop={10}>
              <Text style={styles.switchLink}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Creates styles for SignUpModal
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
    nameRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    nameInput: {
      flex: 1,
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
    signUpButton: {
      backgroundColor: colors.gold,
      paddingVertical: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    signUpButtonDisabled: {
      opacity: 0.6,
    },
    signUpButtonText: {
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
      marginBottom: spacing.lg,
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
