/**
 * Theme Selector Component
 *
 * Provides a UI for selecting theme preference (Auto/Light/Dark).
 * Follows the same UI pattern as Bible Version picker in settings screen.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import type { ThemePreference } from '@/contexts/ThemeContext';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================================================
// Types
// ============================================================================

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const themeOptions: ThemeOption[] = [
  {
    value: 'auto',
    label: 'Auto (Follow System)',
    description: 'Matches your device settings',
  },
  {
    value: 'sunrise_sunset',
    label: 'Auto (Sunrise / Sunset)',
    description: 'Switch based on your location',
  },
  {
    value: 'ambient',
    label: 'Auto (Ambient Light)',
    description: 'Switch based on light levels',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Always use light theme',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use dark theme',
  },
];

// ============================================================================
// Component
// ============================================================================

export function ThemeSelector() {
  const { preference, setPreference, colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  // Filter options based on platform
  const visibleOptions = themeOptions.filter(
    (option) =>
      (option.value !== 'ambient' || Platform.OS === 'android') &&
      (option.value !== 'sunrise_sunset' || Platform.OS === 'android')
  );

  const handleThemeChange = async (newPreference: ThemePreference) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setPreference(newPreference);
    setShowPicker(false);
  };

  const selectedOption =
    visibleOptions.find((option) => option.value === preference) || visibleOptions[0];
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Theme</Text>
      <Pressable
        style={styles.selectButton}
        onPress={() => setShowPicker(!showPicker)}
        accessibilityLabel="Select theme preference"
        accessibilityRole="button"
      >
        <Text style={styles.selectButtonText}>{selectedOption?.label || 'Select Theme'}</Text>
        <Ionicons
          name={showPicker ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.gray700}
        />
      </Pressable>

      {showPicker && (
        <View style={styles.pickerContainer}>
          {visibleOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.pickerItem, option.value === preference && styles.pickerItemSelected]}
              onPress={() => handleThemeChange(option.value)}
              accessibilityLabel={`${option.label} theme`}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === preference }}
            >
              <View style={styles.pickerItemContent}>
                <Text
                  style={[
                    styles.pickerItemText,
                    option.value === preference && styles.pickerItemTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.pickerItemDescription}>{option.description}</Text>
              </View>
              {option.value === preference && (
                <Ionicons name="checkmark" size={20} color={colors.gold} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (
  colors: ReturnType<typeof import('@/constants/bible-design-tokens').getColors>
) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 12,
      marginLeft: 4,
    },
    selectButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      height: 48,
    },
    selectButtonText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
    },
    pickerContainer: {
      marginTop: 8,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      overflow: 'hidden',
    },
    pickerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSecondary,
    },
    pickerItemSelected: {
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    pickerItemContent: {
      flex: 1,
      marginRight: 16,
    },
    pickerItemText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    pickerItemTextSelected: {
      fontWeight: '500',
      color: colors.gold,
    },
    pickerItemDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
