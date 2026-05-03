/**
 * OfflineIndicator Component
 *
 * Small icon badge in header that appears when device is offline.
 * Displays a cloud with slash icon to indicate no network connection.
 * Pressing it shows sync status info (pending actions, last sync time).
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOfflineStatus } from '@/hooks/bible/use-offline-status';
import { getPendingSyncActions } from '@/services/offline';
import { fontSizes, getHeaderSpecs, spacing } from '@/theme/tokens';

export function OfflineIndicator() {
  const { colors, mode } = useTheme();
  const { isOffline } = useOfflineStatus();
  const { lastSyncTime, isSyncing } = useOfflineContext();
  const specs = getHeaderSpecs(mode);
  const [showInfo, setShowInfo] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const handlePress = useCallback(async () => {
    try {
      const actions = await getPendingSyncActions();
      setPendingCount(actions.length);
    } catch {
      setPendingCount(0);
    }
    setShowInfo(true);
  }, []);

  // Hide indicator when online
  if (!isOffline) {
    return null;
  }

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never synced';
    const diff = Date.now() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <Pressable
        style={styles.container}
        testID="offline-indicator"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Offline mode - tap for details"
      >
        <Ionicons name="cloud-offline-outline" size={specs.iconSize} color={colors.textTertiary} />
      </Pressable>

      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowInfo(false)}>
          <View style={[styles.tooltip, { backgroundColor: colors.backgroundElevated }]}>
            <View style={styles.tooltipRow}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.textTertiary} />
              <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>
                You&apos;re offline
              </Text>
            </View>

            <View style={styles.tooltipDivider} />

            <View style={styles.tooltipRow}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.tooltipText, { color: colors.textSecondary }]}>
                Last sync: {formatLastSync()}
              </Text>
            </View>

            {pendingCount > 0 && (
              <View style={styles.tooltipRow}>
                <Ionicons name="sync-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tooltipText, { color: colors.textSecondary }]}>
                  {pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'} to sync
                </Text>
              </View>
            )}

            {isSyncing && (
              <View style={styles.tooltipRow}>
                <Ionicons name="refresh-outline" size={16} color={colors.gold} />
                <Text style={[styles.tooltipText, { color: colors.gold }]}>Syncing...</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  tooltip: {
    borderRadius: 12,
    padding: spacing.lg,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  tooltipTitle: {
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  tooltipText: {
    fontSize: fontSizes.caption,
  },
  tooltipDivider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginVertical: spacing.sm,
  },
});
