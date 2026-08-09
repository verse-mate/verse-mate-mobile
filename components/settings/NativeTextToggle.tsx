/**
 * Native Text Renderer Toggle — DEV BUILDS ONLY.
 *
 * Exists so the Phase 4 A/B can be driven on a device: legacy `<Text>` tree vs
 * the native renderer, flipped at runtime so **one build serves both arms**. Two
 * builds differ in more than the flag, and comparing them would measure the build
 * as much as the change.
 *
 * Renders nothing in release builds and nothing where the native module is
 * absent (web, Expo Go) — a switch that cannot change anything is worse than no
 * switch, because flipping it and seeing no difference reads as "the renderer
 * makes no difference".
 *
 * Remove this component once the native path is the only path.
 */

import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useGesturePager } from '@/hooks/bible/use-gesture-pager';
import { useNativeText } from '@/hooks/bible/use-native-text';
import { type getColors, spacing } from '@/theme/tokens';

export function NativeTextToggle() {
  const { colors } = useTheme();
  const { preference, setUseNativeText, isAvailable } = useNativeText();
  const { useGesturePager: gesturePager, setUseGesturePager } = useGesturePager();
  const styles = createStyles(colors);

  if (!__DEV__ || !isAvailable) return null;

  const handleToggle = async (value: boolean) => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
    await setUseNativeText(value);
  };

  const handlePagerToggle = async (value: boolean) => {
    if (Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
    await setUseGesturePager(value);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Developer</Text>
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.textColumn}>
            <Text style={styles.label}>Native text renderer</Text>
            <Text style={styles.helpText}>
              Render each paragraph as one native view instead of a Text node per word. Takes effect
              immediately — no restart needed.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Native text renderer"
            onValueChange={handleToggle}
            testID="native-text-toggle"
            thumbColor={colors.background}
            trackColor={{ false: colors.divider, true: colors.gold }}
            value={preference}
          />
        </View>
      </View>

      {/* Second arm of the paging A/B. ViewPager2 refuses a drag that begins while
          it is still settling — measured at 14 snap-backs in a 38-drag session —
          and refuses a programmatic page in the same state. The gesture pager owns
          the offset itself so a flick can interrupt the settle. */}
      <View style={[styles.container, styles.secondCard]}>
        <View style={styles.row}>
          <View style={styles.textColumn}>
            <Text style={styles.label}>Gesture chapter pager</Text>
            <Text style={styles.helpText}>
              Drive chapter swipes from a Reanimated gesture instead of ViewPager2, so a fast flick
              can interrupt the previous one. Takes effect on the next chapter screen.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Gesture chapter pager"
            onValueChange={handlePagerToggle}
            testID="gesture-pager-toggle"
            thumbColor={colors.background}
            trackColor={{ false: colors.divider, true: colors.gold }}
            value={gesturePager}
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
    secondCard: {
      marginTop: spacing.lg,
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
