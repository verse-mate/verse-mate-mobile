import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { fontSizes, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Small inline badge rendered above explanation content when that specific
 * item is persisted to SQLite and therefore survives being offline.
 */
export function AvailableOfflineBadge() {
  const { colors } = useTheme();
  return (
    <View style={styles.badge}>
      <Ionicons name="cloud-done-outline" size={14} color={colors.textTertiary} />
      <Text style={[styles.text, { color: colors.textTertiary }]}>Available offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: fontSizes.overline,
  },
});
