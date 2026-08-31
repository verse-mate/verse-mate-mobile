/**
 * Picks a narrated Bible version, and offers a download for the ones the
 * licence allows.
 *
 * Bible Brain decides per fileset whether audio may be persisted, so versions
 * arrive already split: `offlineCapable` get a download control, everything else
 * with audio is labelled streaming-only and needs a connection. Both are
 * playable — the distinction is only about keeping a copy.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { pickAudioFileset, useScriptureVersions } from '@/hooks/bible-brain/use-scripture-versions';
import type { ScriptureVersion } from '@/lib/bible-brain/api';
import type { ChapterRef } from '@/lib/bible-brain/scripture-storage';
import { fontSizes, spacing } from '@/theme/tokens';

export interface ScriptureVersionPickerProps {
  /** ISO-639-3 language, e.g. `eng`. */
  language: string;
  /** Currently selected audio fileset id, if any. */
  selectedFilesetId?: string | null;
  onSelect: (version: ScriptureVersion, filesetId: string) => void;
  /** Chapters to fetch when the user downloads a version. */
  chaptersForDownload: (filesetId: string) => ChapterRef[];
  testament?: 'NT' | 'OT';
}

export function ScriptureVersionPicker({
  language,
  selectedFilesetId,
  onSelect,
  chaptersForDownload,
  testament = 'NT',
}: ScriptureVersionPickerProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { offlineCapable, streamOnly, isLoading, isError, refetch } =
    useScriptureVersions(language);
  const downloader = useScriptureDownload();
  const [busyFileset, setBusyFileset] = useState<string | null>(null);

  const handleDownload = async (version: ScriptureVersion, filesetId: string) => {
    setBusyFileset(filesetId);
    try {
      const outcome = await downloader.download(chaptersForDownload(filesetId));
      if (!outcome) return;
      if (outcome.notLicensed.length > 0 && outcome.downloaded === 0) {
        // Should not happen for a version in the offline bucket, but the
        // licence is the server's call — report it rather than silently no-op.
        showToast(`${version.abbr} can only be streamed`);
        return;
      }
      if (outcome.failed.length > 0) {
        showToast(`Downloaded ${outcome.downloaded}, ${outcome.failed.length} failed`);
        return;
      }
      showToast(`${version.abbr} ready to listen offline`);
    } finally {
      setBusyFileset(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered} testID="scripture-versions-loading">
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.error, { color: colors.textSecondary }]}>
          Could not load narrated versions.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => refetch()}
          testID="scripture-versions-retry"
        >
          <Text style={[styles.retry, { color: colors.gold }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const renderRow = (version: ScriptureVersion, downloadable: boolean) => {
    const filesetId = pickAudioFileset(version, testament);
    if (!filesetId) return null;
    const isSelected = selectedFilesetId === filesetId;
    const isBusy = busyFileset === filesetId && downloader.isDownloading;

    return (
      <View
        key={version.abbr}
        style={[styles.row, { borderBottomColor: colors.divider }]}
        testID={`scripture-version-${version.abbr}`}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`${version.name}${downloadable ? '' : ', streaming only'}`}
          style={styles.info}
          onPress={() => onSelect(version, filesetId)}
        >
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {version.name}
          </Text>
          <View style={styles.badges}>
            {version.has_verse_timing ? (
              <Text style={[styles.badge, { color: colors.textSecondary }]}>follows along</Text>
            ) : null}
            <Text style={[styles.badge, { color: colors.textSecondary }]}>
              {downloadable ? 'available offline' : 'streaming only'}
            </Text>
          </View>
        </Pressable>

        {downloadable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Download ${version.name} for offline listening`}
            testID={`scripture-download-${version.abbr}`}
            disabled={isBusy}
            onPress={() => handleDownload(version, filesetId)}
            style={styles.action}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Ionicons name="download-outline" size={22} color={colors.gold} />
            )}
          </Pressable>
        ) : (
          <Ionicons
            name="cloud-outline"
            size={22}
            color={colors.textSecondary}
            style={styles.action}
          />
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} testID="scripture-version-picker">
      {offlineCapable.length > 0 ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            Download for offline
          </Text>
          {offlineCapable.map((version) => renderRow(version, true))}
        </>
      ) : null}

      {streamOnly.length > 0 ? (
        <>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
            Streaming only
          </Text>
          {streamOnly.map((version) => renderRow(version, false))}
        </>
      ) : null}

      {downloader.isDownloading ? (
        <Text
          style={[styles.progress, { color: colors.textSecondary }]}
          testID="scripture-download-progress"
        >
          Downloading {downloader.currentLabel ?? ''} ({downloader.completed}/{downloader.total})
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  error: { fontSize: fontSizes.bodySmall, textAlign: 'center' },
  retry: { fontSize: fontSizes.bodySmall, fontWeight: '600' },
  sectionHeader: {
    fontSize: fontSizes.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fontSizes.body },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: { fontSize: fontSizes.caption },
  action: { paddingLeft: spacing.md, minWidth: 38, alignItems: 'flex-end' },
  progress: {
    fontSize: fontSizes.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
