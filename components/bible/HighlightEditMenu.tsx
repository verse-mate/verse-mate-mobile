/**
 * HighlightEditMenu Component
 *
 * Dark overlay menu for editing existing highlights.
 * Appears when user taps on highlighted text.
 *
 * Features:
 * - Dark charcoal background with white text
 * - "CHANGE COLOR" section with 6-color picker
 * - Current highlight color pre-selected
 * - Red "Delete Highlight" option with trash icon
 * - Floating overlay appearance (not full-screen)
 * - Haptic feedback on color change and delete
 * - Closes on backdrop tap or after action completes
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 65-75)
 * @see Visual: .agent-os/specs/2025-11-06-highlight-feature/planning/visuals/highlight-clicked.png
 *
 * @example
 * ```tsx
 * <HighlightEditMenu
 *   visible={isVisible}
 *   currentColor="green"
 *   onColorChange={(color) => handleUpdateColor(color)}
 *   onDelete={handleDeleteHighlight}
 *   onClose={handleClose}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HighlightColorPicker } from '@/components/bible/HighlightColorPicker';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeviceInfo } from '@/hooks/use-device-info';

/**
 * Props for HighlightEditMenu component
 */
export interface HighlightEditMenuProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Current highlight color */
  currentColor: HighlightColor;
  /** Callback when color is changed */
  onColorChange: (color: HighlightColor) => void;
  /** Callback when delete is requested */
  onDelete: () => void;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Whether to use a system Modal (true) or a View overlay (false) */
  useModal?: boolean;
}

/**
 * HighlightEditMenu Component
 *
 * Dark overlay menu for editing existing highlights with color picker and delete option.
 */
export function HighlightEditMenu({
  visible,
  currentColor,
  onColorChange,
  onDelete,
  onClose,
  useModal = true,
}: HighlightEditMenuProps) {
  const { colors, mode } = useTheme();
  const { useSplitView, splitRatio, splitViewMode } = useDeviceInfo();
  const { width: windowWidth } = useWindowDimensions();

  // Calculate left padding to center over right panel in split view
  const leftPadding = useSplitView && splitViewMode !== 'left-full' ? windowWidth * splitRatio : 0;

  const styles = useMemo(() => createStyles(colors, leftPadding), [colors, leftPadding]);

  /**
   * Handle color change with haptic feedback
   */
  const handleColorChange = async (color: HighlightColor) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onColorChange(color);
  };

  /**
   * Handle delete with haptic feedback
   */
  const handleDelete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete();
  };

  /**
   * Handle backdrop press with haptic feedback
   */
  const handleBackdropPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.modalContainer}
      pointerEvents="box-none"
    >
      <Pressable
        style={[
          styles.backdrop,
          // Constrain backdrop to right panel in split view mode
          !useModal && leftPadding > 0
            ? {
                left: leftPadding,
                width: windowWidth - leftPadding,
              }
            : undefined,
        ]}
        onPress={handleBackdropPress}
        testID="backdrop"
        pointerEvents="auto"
      />

      <SafeAreaView style={styles.centerContainer} pointerEvents="box-none">
        <View style={styles.menuContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>CHANGE COLOR</Text>
          </View>

          {/* Color Picker */}
          <View style={styles.colorPickerContainer}>
            <HighlightColorPicker
              selectedColor={currentColor}
              onColorSelect={handleColorChange}
              variant={mode === 'dark' ? 'dark' : 'light'}
            />
          </View>

          {/* Delete Button */}
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete highlight"
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteButtonText}>Delete Highlight</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  if (useModal) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Non-modal rendering (Overlay)
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {content}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, leftPadding: number) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: leftPadding, // Push content to the right panel area
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    centerContainer: {
      width: '100%',
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    menuContent: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 16,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 340,
      // Shadow for floating effect
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      marginBottom: spacing.lg,
    },
    headerTitle: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      letterSpacing: 1,
      textAlign: 'center',
    },
    colorPickerContainer: {
      marginBottom: spacing.lg,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      marginTop: spacing.sm,
    },
    deleteButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.error,
    },
  });
