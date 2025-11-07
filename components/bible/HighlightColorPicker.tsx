/**
 * HighlightColorPicker Component
 *
 * Displays a 2x3 grid of color buttons for selecting highlight color.
 * Used in both creation (light variant) and edit (dark variant) contexts.
 *
 * Features:
 * - 6 color buttons in 2 rows of 3 columns
 * - Selected color shows checkmark icon overlay
 * - Border color adapts to variant (blue for light, white for dark)
 * - Haptic feedback on color selection
 * - Minimum 44x44pt touch targets
 *
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 54-75)
 * @see Visual: .agent-os/specs/2025-11-06-highlight-feature/planning/visuals/selected-text-popup.png
 *
 * @example
 * ```tsx
 * <HighlightColorPicker
 *   selectedColor="yellow"
 *   onColorSelect={(color) => console.log(color)}
 *   variant="light"
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/bible-design-tokens';
import {
  HIGHLIGHT_COLOR_ORDER,
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from '@/constants/highlight-colors';

/**
 * Props for HighlightColorPicker component
 */
export interface HighlightColorPickerProps {
  /** Currently selected color */
  selectedColor: HighlightColor;
  /** Callback when color is selected */
  onColorSelect: (color: HighlightColor) => void;
  /** Visual variant - light for creation sheet, dark for edit menu */
  variant: 'light' | 'dark';
}

/**
 * Color picker component for highlight selection
 *
 * Renders 6 color buttons in 2x3 grid layout.
 * Selected color shows checkmark icon and border.
 */
export function HighlightColorPicker({
  selectedColor,
  onColorSelect,
  variant,
}: HighlightColorPickerProps) {
  /**
   * Handle color button press
   */
  const handleColorPress = async (color: HighlightColor) => {
    // Haptic feedback on press
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onColorSelect(color);
  };

  // Border color based on variant
  const borderColor = variant === 'light' ? colors.info : colors.white;

  return (
    <View style={styles.container}>
      {/* Row 1: Yellow, Green, Blue */}
      <View style={styles.row}>
        {HIGHLIGHT_COLOR_ORDER.slice(0, 3).map((color) => (
          <Pressable
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: HIGHLIGHT_COLORS[color] },
              selectedColor === color && { borderColor, borderWidth: 3 },
            ]}
            onPress={() => handleColorPress(color)}
            testID={`color-button-${color}`}
            accessibilityRole="button"
            accessibilityLabel={`${color} highlight color`}
            accessibilityState={{ selected: selectedColor === color }}
          >
            {selectedColor === color && (
              <Ionicons
                name="checkmark"
                size={28}
                color={variant === 'light' ? colors.info : colors.white}
                testID={`checkmark-${color}`}
              />
            )}
          </Pressable>
        ))}
      </View>

      {/* Row 2: Pink, Purple, Orange */}
      <View style={styles.row}>
        {HIGHLIGHT_COLOR_ORDER.slice(3, 6).map((color) => (
          <Pressable
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: HIGHLIGHT_COLORS[color] },
              selectedColor === color && { borderColor, borderWidth: 3 },
            ]}
            onPress={() => handleColorPress(color)}
            testID={`color-button-${color}`}
            accessibilityRole="button"
            accessibilityLabel={`${color} highlight color`}
            accessibilityState={{ selected: selectedColor === color }}
          >
            {selectedColor === color && (
              <Ionicons
                name="checkmark"
                size={28}
                color={variant === 'light' ? colors.info : colors.white}
                testID={`checkmark-${color}`}
              />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  colorButton: {
    width: 50,
    height: 50,
    minWidth: 44, // Minimum touch target
    minHeight: 44, // Minimum touch target
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    // Default transparent border to maintain layout when selected
    borderWidth: 3,
    borderColor: 'transparent',
  },
});
