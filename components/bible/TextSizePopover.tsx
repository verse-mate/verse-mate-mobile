/**
 * Text Size Popover Component
 *
 * Compact inline strip triggered from ChapterHeader's "Aa" button.
 * Shows a tight [- Label +] control anchored below the header.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type getColors, spacing } from '@/constants/bible-design-tokens';
import { PRESET_LABELS, PRESET_ORDER, useTextSize } from '@/contexts/TextSizeContext';
import { useTheme } from '@/contexts/ThemeContext';

interface TextSizePopoverProps {
  visible: boolean;
  onClose: () => void;
}

export function TextSizePopover({ visible, onClose }: TextSizePopoverProps) {
  const { colors } = useTheme();
  const { preset, setPreset } = useTextSize();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.top);

  const currentIndex = PRESET_ORDER.indexOf(preset);
  const isAtMin = currentIndex <= 0;
  const isAtMax = currentIndex >= PRESET_ORDER.length - 1;

  const handleDecrease = async () => {
    if (isAtMin) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setPreset(PRESET_ORDER[currentIndex - 1]);
  };

  const handleIncrease = async () => {
    if (isAtMax) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setPreset(PRESET_ORDER[currentIndex + 1]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.pill} onStartShouldSetResponder={() => true} testID="text-size-stepper">
          <Pressable
            onPress={handleDecrease}
            disabled={isAtMin}
            style={[styles.btn, isAtMin && styles.btnDisabled]}
            accessibilityLabel="Decrease text size"
            accessibilityRole="button"
            accessibilityState={{ disabled: isAtMin }}
            testID="text-size-decrease"
          >
            <Ionicons
              name="remove"
              size={22}
              color={isAtMin ? colors.textDisabled : colors.textPrimary}
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.borderSecondary }]} />

          <Text style={styles.label} testID="text-size-label">
            {PRESET_LABELS[preset]}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.borderSecondary }]} />

          <Pressable
            onPress={handleIncrease}
            disabled={isAtMax}
            style={[styles.btn, isAtMax && styles.btnDisabled]}
            accessibilityLabel="Increase text size"
            accessibilityRole="button"
            accessibilityState={{ disabled: isAtMax }}
            testID="text-size-increase"
          >
            <Ionicons
              name="add"
              size={22}
              color={isAtMax ? colors.textDisabled : colors.textPrimary}
            />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, topInset: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
    },
    pill: {
      position: 'absolute',
      top: topInset + 56 + spacing.xs,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    btn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnDisabled: {
      opacity: 0.35,
    },
    divider: {
      width: 1,
      height: 24,
    },
    label: {
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      minWidth: 84,
    },
  });
