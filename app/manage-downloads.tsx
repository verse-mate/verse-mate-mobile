/**
 * Manage Downloads Screen
 *
 * Allows users to manage offline content downloads.
 * Features:
 * - View available Bible versions, commentaries, and topics
 * - Download/delete individual items
 * - View storage usage
 * - Check for updates
 * - Toggle offline mode and auto-sync
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type getColors, spacing } from '@/constants/bible-design-tokens';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { DownloadInfo, DownloadStatus } from '@/services/offline';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusColor(status: DownloadStatus, colors: ReturnType<typeof getColors>): string {
  switch (status) {
    case 'downloaded':
      return colors.success || '#22c55e';
    case 'update_available':
      return colors.warning || '#f59e0b';
    case 'downloading':
      return colors.gold;
    default:
      return colors.textTertiary;
  }
}

function getStatusText(status: DownloadStatus): string {
  switch (status) {
    case 'downloaded':
      return 'Downloaded';
    case 'update_available':
      return 'Update Available';
    case 'downloading':
      return 'Downloading...';
    default:
      return 'Not Downloaded';
  }
}

interface DownloadItemProps {
  item: DownloadInfo;
  onDownload: () => void;
  onDelete: () => void;
  isProcessing: boolean;
  colors: ReturnType<typeof getColors>;
}

function DownloadItem({ item, onDownload, onDelete, isProcessing, colors }: DownloadItemProps) {
  const styles = createStyles(colors);
  const isDownloaded = item.status === 'downloaded' || item.status === 'update_available';

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isDownloaded) {
      Alert.alert(
        'Delete Download',
        `Are you sure you want to delete "${item.name}"? You can always download it again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]
      );
    } else {
      onDownload();
    }
  };

  return (
    <Pressable
      style={styles.downloadItem}
      onPress={handlePress}
      disabled={isProcessing}
      accessibilityLabel={`${item.name}, ${getStatusText(item.status)}, ${formatBytes(item.size_bytes)}`}
      accessibilityRole="button"
    >
      <View style={styles.downloadItemInfo}>
        <Text style={styles.downloadItemName}>{item.name}</Text>
        <View style={styles.downloadItemMeta}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status, colors)}20` },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor(item.status, colors) }]}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status, colors) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          <Text style={styles.sizeText}>{formatBytes(item.size_bytes)}</Text>
        </View>
        {item.downloaded_at && (
          <Text style={styles.dateText}>Downloaded: {formatDate(item.downloaded_at)}</Text>
        )}
      </View>
      <View style={styles.downloadItemAction}>
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : isDownloaded ? (
          <Ionicons name="trash-outline" size={22} color={colors.error || '#ef4444'} />
        ) : (
          <Ionicons name="cloud-download-outline" size={22} color={colors.gold} />
        )}
      </View>
    </Pressable>
  );
}

export default function ManageDownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const {
    isInitialized,
    isOfflineModeEnabled,
    setOfflineModeEnabled,
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    bibleVersionsInfo,
    commentaryInfo,
    topicsInfo,
    isSyncing,
    syncProgress,
    lastSyncTime,
    totalStorageUsed,
    refreshManifest,
    downloadBibleVersion,
    downloadCommentaries,
    downloadTopics,
    deleteBibleVersion,
    deleteCommentaries,
    deleteTopics,
    deleteAllData,
    checkForUpdates,
  } = useOfflineContext();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingItem, setProcessingItem] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    bible: true,
    commentary: false,
    topics: false,
  });

  // Refresh manifest on mount
  useEffect(() => {
    if (isInitialized) {
      refreshManifest().catch(console.warn);
    }
  }, [isInitialized, refreshManifest]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshManifest();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      await checkForUpdates();
      Alert.alert('Success', 'Content is up to date!');
    } catch {
      Alert.alert('Error', 'Failed to check for updates. Please try again.');
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Offline Data',
      'Are you sure you want to delete all downloaded content? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllData();
              Alert.alert('Success', 'All offline data has been deleted.');
            } catch {
              Alert.alert('Error', 'Failed to delete offline data.');
            }
          },
        },
      ]
    );
  };

  const handleDownloadBible = async (versionKey: string) => {
    setProcessingItem(`bible:${versionKey}`);
    try {
      await downloadBibleVersion(versionKey);
    } catch {
      Alert.alert('Error', 'Failed to download Bible version. Please try again.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDeleteBible = async (versionKey: string) => {
    setProcessingItem(`bible:${versionKey}`);
    try {
      await deleteBibleVersion(versionKey);
    } catch {
      Alert.alert('Error', 'Failed to delete Bible version.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDownloadCommentary = async (languageCode: string) => {
    setProcessingItem(`commentary:${languageCode}`);
    try {
      await downloadCommentaries(languageCode);
    } catch {
      Alert.alert('Error', 'Failed to download commentaries. Please try again.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDeleteCommentary = async (languageCode: string) => {
    setProcessingItem(`commentary:${languageCode}`);
    try {
      await deleteCommentaries(languageCode);
    } catch {
      Alert.alert('Error', 'Failed to delete commentaries.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDownloadTopics = async (languageCode: string) => {
    setProcessingItem(`topics:${languageCode}`);
    try {
      await downloadTopics(languageCode);
    } catch {
      Alert.alert('Error', 'Failed to download topics. Please try again.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDeleteTopics = async (languageCode: string) => {
    setProcessingItem(`topics:${languageCode}`);
    try {
      await deleteTopics(languageCode);
    } catch {
      Alert.alert('Error', 'Failed to delete topics.');
    } finally {
      setProcessingItem(null);
    }
  };

  const toggleSection = (section: 'bible' | 'commentary' | 'topics') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }]}
      >
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Downloads</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Sync Progress */}
        {isSyncing && syncProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(syncProgress.current / syncProgress.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{syncProgress.message}</Text>
          </View>
        )}

        {/* Storage Summary */}
        <View style={styles.section}>
          <View style={styles.storageCard}>
            <View style={styles.storageInfo}>
              <Ionicons name="folder-outline" size={24} color={colors.gold} />
              <View style={styles.storageText}>
                <Text style={styles.storageLabel}>Storage Used</Text>
                <Text style={styles.storageValue}>{formatBytes(totalStorageUsed)}</Text>
              </View>
            </View>
            {lastSyncTime && (
              <Text style={styles.lastSyncText}>
                Last sync: {formatDate(lastSyncTime.toISOString())}
              </Text>
            )}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Offline Mode</Text>
                <Text style={styles.settingDescription}>Use downloaded content when available</Text>
              </View>
              <Switch
                value={isOfflineModeEnabled}
                onValueChange={setOfflineModeEnabled}
                trackColor={{ false: colors.borderSecondary, true: colors.gold }}
                thumbColor={colors.textPrimary}
              />
            </View>
            <View style={styles.settingDivider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-Sync</Text>
                <Text style={styles.settingDescription}>Automatically check for updates daily</Text>
              </View>
              <Switch
                value={isAutoSyncEnabled}
                onValueChange={setAutoSyncEnabled}
                trackColor={{ false: colors.borderSecondary, true: colors.gold }}
                thumbColor={colors.textPrimary}
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Pressable
            style={styles.actionButton}
            onPress={handleCheckForUpdates}
            disabled={isSyncing}
          >
            <Ionicons name="sync-outline" size={20} color={colors.gold} />
            <Text style={styles.actionButtonText}>Check for Updates</Text>
          </Pressable>
        </View>

        {/* Bible Versions */}
        <View style={styles.section}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('bible')}>
            <Text style={styles.sectionLabel}>Bible Versions</Text>
            <Ionicons
              name={expandedSections.bible ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
          {expandedSections.bible && (
            <View style={styles.downloadList}>
              {bibleVersionsInfo.length === 0 ? (
                <Text style={styles.emptyText}>No Bible versions available</Text>
              ) : (
                bibleVersionsInfo.map((item) => (
                  <DownloadItem
                    key={item.key}
                    item={item}
                    onDownload={() => handleDownloadBible(item.key)}
                    onDelete={() => handleDeleteBible(item.key)}
                    isProcessing={processingItem === `bible:${item.key}`}
                    colors={colors}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Commentaries */}
        <View style={styles.section}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('commentary')}>
            <Text style={styles.sectionLabel}>Commentaries</Text>
            <Ionicons
              name={expandedSections.commentary ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
          {expandedSections.commentary && (
            <View style={styles.downloadList}>
              {commentaryInfo.length === 0 ? (
                <Text style={styles.emptyText}>No commentaries available</Text>
              ) : (
                commentaryInfo.map((item) => (
                  <DownloadItem
                    key={item.key}
                    item={item}
                    onDownload={() => handleDownloadCommentary(item.key)}
                    onDelete={() => handleDeleteCommentary(item.key)}
                    isProcessing={processingItem === `commentary:${item.key}`}
                    colors={colors}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Topics */}
        <View style={styles.section}>
          <Pressable style={styles.sectionHeader} onPress={() => toggleSection('topics')}>
            <Text style={styles.sectionLabel}>Topics</Text>
            <Ionicons
              name={expandedSections.topics ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
          {expandedSections.topics && (
            <View style={styles.downloadList}>
              {topicsInfo.length === 0 ? (
                <Text style={styles.emptyText}>No topics available</Text>
              ) : (
                topicsInfo.map((item) => (
                  <DownloadItem
                    key={item.key}
                    item={item}
                    onDownload={() => handleDownloadTopics(item.key)}
                    onDelete={() => handleDeleteTopics(item.key)}
                    isProcessing={processingItem === `topics:${item.key}`}
                    colors={colors}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Danger Zone */}
        {totalStorageUsed > 0 && (
          <View style={[styles.section, styles.dangerSection]}>
            <Pressable style={styles.deleteAllButton} onPress={handleDeleteAll}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
              <Text style={styles.deleteAllText}>Delete All Offline Data</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    backButton: {
      padding: spacing.xs,
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingVertical: spacing.lg,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: 4,
    },
    progressContainer: {
      marginHorizontal: 16,
      marginBottom: 24,
      padding: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.borderSecondary,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.gold,
      borderRadius: 4,
    },
    progressText: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    storageCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      padding: 16,
    },
    storageInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    storageText: {
      marginLeft: 12,
    },
    storageLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    storageValue: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    lastSyncText: {
      marginTop: 12,
      fontSize: 12,
      color: colors.textTertiary,
    },
    settingsCard: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    settingInfo: {
      flex: 1,
      marginRight: 12,
    },
    settingLabel: {
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    settingDivider: {
      height: 1,
      backgroundColor: colors.borderSecondary,
      marginHorizontal: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.gold,
      padding: 14,
      gap: 8,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.gold,
    },
    downloadList: {
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      overflow: 'hidden',
    },
    downloadItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSecondary,
    },
    downloadItemInfo: {
      flex: 1,
    },
    downloadItemName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    downloadItemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
    },
    sizeText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    dateText: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    downloadItemAction: {
      marginLeft: 12,
      width: 32,
      alignItems: 'center',
    },
    emptyText: {
      padding: 16,
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    dangerSection: {
      marginTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 24,
    },
    deleteAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#dc2626',
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    deleteAllText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#dc2626',
    },
  });
