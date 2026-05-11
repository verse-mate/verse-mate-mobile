/**
 * Font Size Selector Component
 *
 * Provides a UI for adjusting Bible text font size with minus/plus buttons
 * and a visual size indicator. No external dependencies — uses only
 * React Native built-ins.
 *
 * Follows the same section pattern as ThemeSelector.
 * Persists preference via useFontSize hook (AsyncStorage).
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/hooks/bible/use-font-size';
import { type getColors, spacing } from '@/theme/tokens';

export function FontSizeSelector() {
  const { colors } = useTheme();
  const { fontSize, setFontSize, minFontSize, maxFontSize } = useFontSize();
  const styles = createStyles(colors);

  const handleChange = async (delta: number) => {
    const next = fontSize + delta;
    if (next >= minFontSize && next <= maxFontSize) {
      if (Platform.OS !== 'web') {
        await Haptics.selectionAsync();
      }
      await setFontSize(next);
    }
  };

  // Visual indicator width (0-100%)
  const progress = ((fontSize - minFontSize) / (maxFontSize - minFontSize)) * 100;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Display</Text>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>Font size</Text>
          <Text style={styles.valueText}>{fontSize}px</Text>
        </View>

        <View style={styles.controlRow}>
          <Pressable
            onPress={() => handleChange(-1)}
            disabled={fontSize <= minFontSize}
            style={[styles.button, fontSize <= minFontSize && styles.buttonDisabled]}
          >
            <Ionicons
              name="remove"
              size={20}
              color={fontSize <= minFontSize ? colors.textDisabled : colors.textPrimary}
            />
          </Pressable>

          <View style={styles.trackContainer}>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Pressable
            onPress={() => handleChange(1)}
            disabled={fontSize >= maxFontSize}
            style={[styles.button, fontSize >= maxFontSize && styles.buttonDisabled]}
          >
            <Ionicons
              name="add"
              size={20}
              color={fontSize >= maxFontSize ? colors.textDisabled : colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.rangeLabels}>
          <Text style={styles.rangeText}>Small</Text>
          <Text style={styles.rangeText}>Large</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xxxl,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    container: {
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 8,
      padding: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    valueText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    button: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.borderSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    trackContainer: {
      flex: 1,
      height: 36,
      justifyContent: 'center',
    },
    track: {
      height: 6,
      backgroundColor: colors.divider,
      borderRadius: 3,
      overflow: 'hidden',
    },
    trackFill: {
      height: '100%',
      backgroundColor: colors.gold,
      borderRadius: 3,
    },
    rangeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    rangeText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
  });
