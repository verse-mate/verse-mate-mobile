/**
 * Text Size Stepper Component
 *
 * Shared stepper control for adjusting text size presets.
 * Uses small "A" / large "A" buttons to visually communicate font scaling.
 * Used in both the popover (compact mode) and settings screen.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSizes, type getColors, spacing } from '@/constants/bible-design-tokens';
import { PRESET_LABELS, PRESET_ORDER, useTextSize } from '@/contexts/TextSizeContext';
import { useTheme } from '@/contexts/ThemeContext';

interface TextSizeStepperProps {
  compact?: boolean;
}

export function TextSizeStepper({ compact = false }: TextSizeStepperProps) {
  const { preset, setPreset, scaledFontSize } = useTextSize();
  const { colors } = useTheme();
  const styles = createStyles(colors, compact);

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
    <View
      style={styles.container}
      accessibilityLabel={`Text size: ${PRESET_LABELS[preset]}`}
      testID="text-size-stepper"
    >
      <View style={styles.stepperRow}>
        <Pressable
          onPress={handleDecrease}
          disabled={isAtMin}
          style={[styles.stepperButton, isAtMin && styles.stepperButtonDisabled]}
          accessibilityLabel="Decrease text size"
          accessibilityRole="button"
          accessibilityState={{ disabled: isAtMin }}
          testID="text-size-decrease"
        >
          <Ionicons
            name="remove"
            size={20}
            color={isAtMin ? colors.textDisabled : colors.textPrimary}
          />
        </Pressable>

        <View style={styles.labelContainer}>
          <Text style={styles.presetLabel} testID="text-size-label">
            {PRESET_LABELS[preset]}
          </Text>
        </View>

        <Pressable
          onPress={handleIncrease}
          disabled={isAtMax}
          style={[styles.stepperButton, isAtMax && styles.stepperButtonDisabled]}
          accessibilityLabel="Increase text size"
          accessibilityRole="button"
          accessibilityState={{ disabled: isAtMax }}
          testID="text-size-increase"
        >
          <Ionicons
            name="add"
            size={20}
            color={isAtMax ? colors.textDisabled : colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* Preview text */}
      {!compact && (
        <Text style={[styles.previewText, { fontSize: scaledFontSize(fontSizes.bodyLarge) }]}>
          The Lord is my shepherd; I shall not want.
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, compact: boolean) =>
  StyleSheet.create({
    container: {
      gap: compact ? spacing.sm : spacing.md,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    stepperButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperButtonDisabled: {
      opacity: 0.4,
    },
    labelContainer: {
      minWidth: 100,
      alignItems: 'center',
    },
    presetLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    previewText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
      lineHeight: fontSizes.bodyLarge * 1.6,
      paddingHorizontal: spacing.lg,
    },
  });
