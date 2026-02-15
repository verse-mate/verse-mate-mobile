/**
 * Manage Downloads Screen
 *
 * Allows users to manage offline content downloads organized by language.
 * Features:
 * - View available languages with bundled content (Bible, commentaries, topics)
 * - Download/delete all content for a language with one button
 * - User data auto-sync status
 * - View storage usage
 * - Check for updates
 * - Toggle offline mode and auto-sync
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { DownloadInfo, DownloadStatus } from '@/services/offline';

export function formatBytes(bytes: number): string {
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

// Merged commentary + topic language bundle for display
interface CommentaryTopicBundle {
  languageCode: string;
  languageName: string;
  hasCommentaries: boolean;
  hasTopics: boolean;
  commentaryStatus: DownloadStatus;
  topicStatus: DownloadStatus;
  totalSizeBytes: number;
  overallStatus: DownloadStatus;
}

function deriveOverallStatus(
  s1: DownloadStatus = 'not_downloaded',
  s2: DownloadStatus = 'not_downloaded'
): DownloadStatus {
  const a = s1;
  const b = s2;
  if (a === 'downloading' || b === 'downloading') return 'downloading';
  if (a === 'downloaded' && b === 'downloaded') return 'downloaded';
  if (a === 'update_available' || b === 'update_available') return 'update_available';
  if (a === 'downloaded' || b === 'downloaded') return 'update_available'; // partial
  return 'not_downloaded';
}

function buildCommentaryTopicBundles(
  commentaryInfo: DownloadInfo[],
  topicsInfo: DownloadInfo[]
): CommentaryTopicBundle[] {
  const bundleMap = new Map<string, CommentaryTopicBundle>();

  for (const c of commentaryInfo) {
    bundleMap.set(c.key, {
      languageCode: c.key,
      languageName: c.name,
      hasCommentaries: true,
      hasTopics: false,
      commentaryStatus: c.status,
      topicStatus: 'not_downloaded',
      totalSizeBytes: c.size_bytes,
      overallStatus: c.status,
    });
  }

  for (const t of topicsInfo) {
    const existing = bundleMap.get(t.key);
    if (existing) {
      existing.hasTopics = true;
      existing.topicStatus = t.status;
      existing.totalSizeBytes += t.size_bytes;
      existing.overallStatus = deriveOverallStatus(existing.commentaryStatus, t.status);
    } else {
      bundleMap.set(t.key, {
        languageCode: t.key,
        languageName: t.name,
        hasCommentaries: false,
        hasTopics: true,
        commentaryStatus: 'not_downloaded',
        topicStatus: t.status,
        totalSizeBytes: t.size_bytes,
        overallStatus: t.status,
      });
    }
  }

  return Array.from(bundleMap.values());
}

function getContentDescription(bundle: CommentaryTopicBundle): string {
  const parts: string[] = [];
  if (bundle.hasCommentaries) parts.push('Commentaries');
  if (bundle.hasTopics) parts.push('Topics');
  return parts.join(' & ');
}

// --- Item Components ---

interface DownloadItemProps {
  name: string;
  description?: string;
  status: DownloadStatus;
  sizeBytes: number;
  onDownload: () => void;
  onDelete: () => void;
  isProcessing: boolean;
  colors: ReturnType<typeof getColors>;
  deleteConfirmMessage: string;
}

function DownloadItem({
  name,
  description,
  status,
  sizeBytes,
  onDownload,
  onDelete,
  isProcessing,
  colors,
  deleteConfirmMessage,
}: Readonly<DownloadItemProps>) {
  const styles = createStyles(colors);
  const isDownloaded = status === 'downloaded' || status === 'update_available';

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isDownloaded) {
      Alert.alert('Delete Download', deleteConfirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    } else {
      onDownload();
    }
  };

  return (
    <Pressable
      style={styles.downloadItem}
      onPress={handlePress}
      disabled={isProcessing}
      accessibilityLabel={`${name}, ${getStatusText(status)}, ${formatBytes(sizeBytes)}`}
      accessibilityRole="button"
    >
      <View style={styles.downloadItemInfo}>
        <Text style={styles.downloadItemName}>{name}</Text>
        {description ? <Text style={styles.bundleDescription}>{description}</Text> : null}
        <View style={styles.downloadItemMeta}>
          <View
            style={[styles.statusBadge, { backgroundColor: `${getStatusColor(status, colors)}20` }]}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status, colors) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(status, colors) }]}>
              {getStatusText(status)}
            </Text>
          </View>
          <Text style={styles.sizeText}>{formatBytes(sizeBytes)}</Text>
        </View>
      </View>
      <View style={styles.downloadItemAction}>
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : (
          <Ionicons
            name={isDownloaded ? 'trash-outline' : 'cloud-download-outline'}
            size={22}
            color={isDownloaded ? colors.error || '#ef4444' : colors.gold}
          />
        )}
      </View>
    </Pressable>
  );
}

export default function ManageDownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const styles = createStyles(colors);

  const {
    isInitialized,
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    bibleVersionsInfo,
    commentaryInfo,
    topicsInfo,
    isUserDataSynced,
    isSyncing,
    syncProgress,
    lastSyncTime,
    totalStorageUsed,
    refreshManifest,
    downloadBibleVersion,
    deleteBibleVersion,
    downloadCommentaries,
    deleteCommentaries,
    downloadTopics,
    deleteTopics,
    syncUserData,
    deleteAllData,
    checkForUpdates,
  } = useOfflineContext();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingItem, setProcessingItem] = useState<string | null>(null);

  // Build merged commentary + topic bundles for display
  const commentaryTopicBundles = useMemo(
    () => buildCommentaryTopicBundles(commentaryInfo, topicsInfo),
    [commentaryInfo, topicsInfo]
  );

  // Refresh manifest on mount (only once when initialized)
  useEffect(() => {
    if (isInitialized) {
      refreshManifest().catch(console.warn);
    }
  }, [isInitialized]);

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

  const handleDownloadBibleVersion = async (versionKey: string) => {
    setProcessingItem(`bible:${versionKey}`);
    try {
      await downloadBibleVersion(versionKey);
    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert(
        'Error',
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDeleteBibleVersion = async (versionKey: string) => {
    setProcessingItem(`bible:${versionKey}`);
    try {
      await deleteBibleVersion(versionKey);
    } catch {
      Alert.alert('Error', 'Failed to delete Bible version.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDownloadCommentaryTopics = async (bundle: CommentaryTopicBundle) => {
    setProcessingItem(`ct:${bundle.languageCode}`);
    try {
      const promises: Promise<void>[] = [];
      if (bundle.hasCommentaries && bundle.commentaryStatus !== 'downloaded') {
        promises.push(downloadCommentaries(bundle.languageCode));
      }
      if (bundle.hasTopics && bundle.topicStatus !== 'downloaded') {
        promises.push(downloadTopics(bundle.languageCode));
      }
      await Promise.all(promises);
    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert(
        'Error',
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setProcessingItem(null);
    }
  };

  const handleDeleteCommentaryTopics = async (bundle: CommentaryTopicBundle) => {
    setProcessingItem(`ct:${bundle.languageCode}`);
    try {
      const promises: Promise<void>[] = [];
      if (bundle.hasCommentaries) promises.push(deleteCommentaries(bundle.languageCode));
      if (bundle.hasTopics) promises.push(deleteTopics(bundle.languageCode));
      await Promise.all(promises);
    } catch {
      Alert.alert('Error', 'Failed to delete content.');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleSyncUserData = async () => {
    setProcessingItem('user-data');
    try {
      await syncUserData();
      Alert.alert('Success', 'User data synced successfully!');
    } catch {
      Alert.alert('Error', 'Failed to sync user data. Please try again.');
    } finally {
      setProcessingItem(null);
    }
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

        {/* User Data Sync (authenticated users only) */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>User Data</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Notes, Highlights & Bookmarks</Text>
                  <Text style={styles.settingDescription}>
                    {isUserDataSynced
                      ? 'Synced and available offline'
                      : 'Not yet synced for offline use'}
                  </Text>
                </View>
                <Pressable
                  onPress={handleSyncUserData}
                  disabled={processingItem === 'user-data' || isSyncing}
                  style={styles.syncButton}
                >
                  {processingItem === 'user-data' ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Ionicons
                      name={isUserDataSynced ? 'checkmark-circle' : 'sync-outline'}
                      size={24}
                      color={isUserDataSynced ? colors.success || '#22c55e' : colors.gold}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Bible Versions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bible Versions</Text>
          <View style={styles.downloadList}>
            {bibleVersionsInfo.length === 0 ? (
              <Text style={styles.emptyText}>No Bible versions available. Pull to refresh.</Text>
            ) : (
              bibleVersionsInfo.map((version) => (
                <DownloadItem
                  key={version.key}
                  name={version.name}
                  status={version.status}
                  sizeBytes={version.size_bytes}
                  onDownload={() => handleDownloadBibleVersion(version.key)}
                  onDelete={() => handleDeleteBibleVersion(version.key)}
                  isProcessing={processingItem === `bible:${version.key}`}
                  colors={colors}
                  deleteConfirmMessage={`Are you sure you want to delete ${version.name}? You can always download it again.`}
                />
              ))
            )}
          </View>
        </View>

        {/* Commentaries & Topics */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Commentaries & Topics</Text>
          <View style={styles.downloadList}>
            {commentaryTopicBundles.length === 0 ? (
              <Text style={styles.emptyText}>No content available. Pull to refresh.</Text>
            ) : (
              commentaryTopicBundles.map((bundle) => (
                <DownloadItem
                  key={bundle.languageCode}
                  name={bundle.languageName}
                  description={getContentDescription(bundle)}
                  status={bundle.overallStatus}
                  sizeBytes={bundle.totalSizeBytes}
                  onDownload={() => handleDownloadCommentaryTopics(bundle)}
                  onDelete={() => handleDeleteCommentaryTopics(bundle)}
                  isProcessing={processingItem === `ct:${bundle.languageCode}`}
                  colors={colors}
                  deleteConfirmMessage={`Are you sure you want to delete all commentaries and topics for ${bundle.languageName}? You can always download them again.`}
                />
              ))
            )}
          </View>
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
    sectionLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: 4,
      marginBottom: 12,
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
    syncButton: {
      padding: 4,
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
      marginBottom: 2,
    },
    bundleDescription: {
      fontSize: 12,
      color: colors.textTertiary,
      marginBottom: 6,
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
