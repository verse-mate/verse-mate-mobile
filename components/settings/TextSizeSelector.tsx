/**
 * Text Size Selector Component
 *
 * Self-contained settings section for text size adjustment.
 * Follows the same UI pattern as ThemeSelector.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { getColors } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { TextSizeStepper } from './TextSizeStepper';

export function TextSizeSelector() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Text Size</Text>
      <TextSizeStepper />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
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
  });
