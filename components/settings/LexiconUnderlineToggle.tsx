/**
 * Lexicon Underline Toggle
 *
 * Lets the reader turn the gold underline under definable (lexicon) words on
 * or off (MOBILE-1001 #7). Words stay tappable for definitions either way —
 * this only controls the visual hint.
 *
 * Follows the same section pattern as FontSizeSelector / ThemeSelector.
 * Persists via the useLexiconUnderlines hook (AsyncStorage).
 */

import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLexiconUnderlines } from '@/hooks/bible/use-lexicon-underlines';
import { type getColors, spacing } from '@/theme/tokens';

export function LexiconUnderlineToggle() {
  const { colors } = useTheme();
  const { showUnderlines, setShowUnderlines } = useLexiconUnderlines();
  const styles = createStyles(colors);

  const handleToggle = async (value: boolean) => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
    await setShowUnderlines(value);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Reading</Text>
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.textColumn}>
            <Text style={styles.label}>Underline definable words</Text>
            <Text style={styles.helpText}>
              Show the gold underline under words with a dictionary entry. Words stay tappable
              either way.
            </Text>
          </View>
          <Switch
            value={showUnderlines}
            onValueChange={handleToggle}
            trackColor={{ false: colors.divider, true: colors.gold }}
            thumbColor={colors.background}
            accessibilityLabel="Underline definable words"
            testID="lexicon-underline-toggle"
          />
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    textColumn: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    helpText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
