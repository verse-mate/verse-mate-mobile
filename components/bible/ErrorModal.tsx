/**
 * ErrorModal Component
 *
 * Custom modal for displaying error messages.
 * Replaces native OS Alert.alert for a more integrated look.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

interface ErrorModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export function ErrorModal({
  visible,
  title = 'Error',
  message,
  onClose,
  buttonText = 'OK',
}: ErrorModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      hardwareAccelerated
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e?.stopPropagation?.()}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.button, styles.errorButton]}>
              <Text style={styles.errorButtonText}>{buttonText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    dialog: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: spacing.xxl,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    message: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: fontSizes.body * 1.5,
    },
    actions: {
      width: '100%',
    },
    button: {
      width: '100%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
    },
    errorButton: {
      backgroundColor: colors.error,
    },
    errorButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FFFFFF', // White text on error red
    },
  });
