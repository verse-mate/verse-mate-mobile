/**
 * ConfirmationModal Component
 *
 * Generic confirmation modal with customizable buttons.
 * Replaces native OS Alert.alert for confirmation dialogs.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

interface ConfirmationButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  buttons: ConfirmationButton[];
  onClose?: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  icon = 'help-circle-outline',
  buttons,
  onClose,
}: ConfirmationModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleButtonPress = (button: ConfirmationButton) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    button.onPress();
  };

  const handleBackdropPress = () => {
    if (onClose) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      hardwareAccelerated
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable style={styles.dialog} onPress={(e) => e?.stopPropagation?.()}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={64} color={colors.gold} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Actions */}
          <View style={buttons.length > 2 ? styles.actionsVertical : styles.actionsHorizontal}>
            {buttons.map((button) => (
              <Pressable
                key={button.text}
                onPress={() => handleButtonPress(button)}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.destructiveButton,
                  button.style === 'cancel' && styles.cancelButton,
                  button.style === 'default' && styles.defaultButton,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.destructiveButtonText,
                    button.style === 'cancel' && styles.cancelButtonText,
                    button.style === 'default' && styles.defaultButtonText,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
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
    actionsHorizontal: {
      flexDirection: 'row',
      width: '100%',
      gap: spacing.md,
    },
    actionsVertical: {
      flexDirection: 'column',
      width: '100%',
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      alignItems: 'center',
      minWidth: 100,
    },
    defaultButton: {
      backgroundColor: colors.gold,
    },
    cancelButton: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    buttonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    defaultButtonText: {
      color: colors.background,
    },
    cancelButtonText: {
      color: colors.textPrimary,
    },
    destructiveButtonText: {
      color: '#FFFFFF',
    },
  });
