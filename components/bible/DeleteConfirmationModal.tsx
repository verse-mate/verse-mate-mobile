/**
 * DeleteConfirmationModal Component
 *
 * Custom confirmation modal for deleting notes.
 * Replaces native OS Alert.alert with themed modal.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Modal from 'react-native-modal';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  title: string;
  message: string;
}

export function DeleteConfirmationModal({
  visible,
  onCancel,
  onConfirm,
  isDeleting = false,
  title,
  message,
}: DeleteConfirmationModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleCancel}
      onBackButtonPress={handleCancel}
      backdropOpacity={0.8}
      backdropColor="#FF00FF"
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriver
      hideModalContentWhileAnimating
    >
      <View style={styles.dialog}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="trash-outline" size={48} color={colors.error} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.submessage}>This action cannot be undone.</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleCancel}
            style={[styles.button, styles.cancelButton]}
            disabled={isDeleting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            style={[styles.button, styles.deleteButton]}
            disabled={isDeleting}
          >
            <Text style={styles.deleteButtonText}>{isDeleting ? 'Deleting...' : 'Delete'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    dialog: {
      backgroundColor: '#FF0000', // BRIGHT RED for debugging
      borderRadius: 16,
      padding: spacing.xxl,
      marginHorizontal: spacing.xl,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 5,
      borderColor: '#00FF00', // GREEN border
      alignSelf: 'center',
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
      marginBottom: spacing.xs,
    },
    submessage: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
    },
    button: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
    deleteButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FFFFFF',
    },
  });
