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
import { colors, headerSpecs } from '@/constants/bible-design-tokens';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';

export function OfflineIndicator() {
  const { isOffline } = useOfflineStatus();

  // Hide indicator when online
  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.container} testID="offline-indicator">
      <Ionicons
        name="cloud-offline-outline"
        size={headerSpecs.iconSize}
        color={colors.gray500}
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
