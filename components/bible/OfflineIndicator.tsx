/**
 * OfflineIndicator Component
 *
 * Small icon badge in header that appears when device is offline.
 * Displays a cloud with slash icon to indicate no network connection.
 *
 * Features:
 * - Only visible when offline (hidden when connected)
 * - Gray cloud-slash icon (24px)
 * - Positioned in header (right side, before hamburger menu)
 * - Uses NetInfo for real-time network detection
 *
 * @see Spec lines 76-81, 849-869 (Offline indicator)
 * @see Task Group 8.6
 *
 * @example
 * <OfflineIndicator />
 * // Renders: Cloud-slash icon when offline, nothing when online
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { getHeaderSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';

export function OfflineIndicator() {
  const { colors, mode } = useTheme();
  const { isOffline } = useOfflineStatus();
  const specs = getHeaderSpecs(mode);

  // Hide indicator when online
  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.container} testID="offline-indicator">
      <Ionicons
        name="cloud-offline-outline"
        size={specs.iconSize}
        color={colors.textTertiary}
        accessibilityLabel="Offline mode"
        accessibilityRole="image"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
