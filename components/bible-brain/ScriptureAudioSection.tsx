/**
 * "Narrated Bible" section for the Manage Downloads screen.
 *
 * Pick a narrated version, then download it a book at a time. Whole-testament
 * downloads are deliberately not offered here: the New Testament is ~260
 * chapters at roughly 2MB each, which is not a sensible single tap on a phone.
 *
 * Only versions Bible Brain licenses for download get a download control; the
 * rest are listed as streaming-only, because they are still playable and the
 * user should know they exist.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BIBLE_BOOKS } from '@/constants/bible-books';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { pickAudioFileset, useScriptureVersions } from '@/hooks/bible-brain/use-scripture-versions';
import type { ScriptureVersion } from '@/lib/bible-brain/api';
import { estimateChapterBytes } from '@/lib/bible-brain/scripture-storage';
import { chaptersForBook } from '@/lib/bible-brain/usfm-books';
import { fontSizes, spacing } from '@/theme/tokens';
import { ScriptureCopyright } from './ScriptureCopyright';

/** Bible Brain audio is a constant 64 kbps, so ~8KB/s; chapters average ~4min. */
const AVERAGE_CHAPTER_SECONDS = 240;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export interface ScriptureAudioSectionProps {
  /** ISO-639-3 language to offer narration for. */
  language?: string;
}

export function ScriptureAudioSection({ language = 'eng' }: ScriptureAudioSectionProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { offlineCapable, streamOnly, isLoading } = useScriptureVersions(language);
  const downloader = useScriptureDownload();

  const [selected, setSelected] = useState<{
    version: ScriptureVersion;
    filesetId: string;
  } | null>(null);
  const [downloadedBooks, setDownloadedBooks] = useState<Set<number>>(new Set());
  const [busyBookId, setBusyBookId] = useState<number | null>(null);

  // Refresh the on-disk picture whenever the selection changes or a download
  // finishes, so the list reflects reality rather than optimistic state.
  useEffect(() => {
    if (!selected) {
      setDownloadedBooks(new Set());
      return;
    }
    let cancelled = false;
    downloader.downloadedChapters(selected.filesetId).then((chapters) => {
      if (cancelled) return;
      const byBook = new Map<string, number>();
      for (const chapter of chapters) {
        byBook.set(chapter.book, (byBook.get(chapter.book) ?? 0) + 1);
      }
      const complete = new Set<number>();
      for (const book of BIBLE_BOOKS) {
        const refs = chaptersForBook(selected.filesetId, book.id);
        if (refs.length === 0) continue;
        if (byBook.get(refs[0].book) === book.chapterCount) complete.add(book.id);
      }
      setDownloadedBooks(complete);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, downloader.outcome, downloader.downloadedChapters]);

  const handleDownloadBook = async (bookId: number, bookName: string) => {
    if (!selected) return;
    setBusyBookId(bookId);
    try {
      const refs = chaptersForBook(selected.filesetId, bookId);
      const outcome = await downloader.download(refs);
      if (!outcome) return;
      if (outcome.notLicensed.length > 0 && outcome.downloaded === 0) {
        showToast(`${selected.version.abbr} can only be streamed`);
        return;
      }
      if (outcome.failed.length > 0) {
        showToast(`${bookName}: ${outcome.failed.length} chapter(s) failed`);
        return;
      }
      showToast(`${bookName} available offline`);
    } finally {
      setBusyBookId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered} testID="scripture-audio-loading">
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (offlineCapable.length === 0 && streamOnly.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textSecondary }]}>
        No narrated versions available for this language.
      </Text>
    );
  }

  return (
    <View testID="scripture-audio-section">
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Choose a narrated version, then download the books you want to listen to offline.
      </Text>

      {offlineCapable.map((version) => {
        const filesetId = pickAudioFileset(version, 'NT');
        if (!filesetId) return null;
        const isSelected = selected?.version.abbr === version.abbr;
        return (
          <View key={version.abbr}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              testID={`scripture-audio-version-${version.abbr}`}
              style={[styles.versionRow, { borderBottomColor: colors.divider }]}
              onPress={() => setSelected(isSelected ? null : { version, filesetId })}
            >
              <View style={styles.versionInfo}>
                <Text style={[styles.versionName, { color: colors.textPrimary }]}>
                  {version.name}
                </Text>
                <Text style={[styles.versionMeta, { color: colors.textSecondary }]}>
                  {version.has_verse_timing ? 'follows along · ' : ''}available offline
                </Text>
              </View>
              <Ionicons
                name={isSelected ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {isSelected ? (
              <View testID={`scripture-audio-books-${version.abbr}`}>
                <ScriptureCopyright bibleId={version.abbr} />
                {BIBLE_BOOKS.map((book) => {
                  const isDone = downloadedBooks.has(book.id);
                  const isBusy = busyBookId === book.id && downloader.isDownloading;
                  const estimate = formatBytes(
                    book.chapterCount * estimateChapterBytes(AVERAGE_CHAPTER_SECONDS, filesetId)
                  );
                  return (
                    <View
                      key={book.id}
                      style={[styles.bookRow, { borderBottomColor: colors.divider }]}
                    >
                      <View style={styles.bookInfo}>
                        <Text style={[styles.bookName, { color: colors.textPrimary }]}>
                          {book.name}
                        </Text>
                        <Text style={[styles.bookMeta, { color: colors.textSecondary }]}>
                          {book.chapterCount} chapters · ~{estimate}
                        </Text>
                      </View>
                      {isBusy ? (
                        <ActivityIndicator color={colors.gold} />
                      ) : isDone ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${book.name} narration`}
                          testID={`scripture-audio-delete-${book.id}`}
                          onPress={async () => {
                            await downloader.removeFileset(filesetId);
                            showToast(`${version.abbr} narration removed`);
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
                        </Pressable>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Download ${book.name} narration`}
                          testID={`scripture-audio-download-${book.id}`}
                          onPress={() => handleDownloadBook(book.id, book.name)}
                        >
                          <Ionicons name="download-outline" size={22} color={colors.gold} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      {streamOnly.length > 0 ? (
        <View style={styles.streamBlock}>
          <Text style={[styles.streamHeader, { color: colors.textSecondary }]}>
            Streaming only — needs a connection
          </Text>
          {streamOnly.map((version) => (
            <Text
              key={version.abbr}
              testID={`scripture-audio-streamonly-${version.abbr}`}
              style={[styles.streamName, { color: colors.textSecondary }]}
            >
              {version.name}
            </Text>
          ))}
        </View>
      ) : null}

      {downloader.isDownloading ? (
        <Text
          testID="scripture-audio-progress"
          style={[styles.progress, { color: colors.textSecondary }]}
        >
          Downloading {downloader.currentLabel ?? ''} ({downloader.completed}/{downloader.total})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { padding: spacing.lg, alignItems: 'center' },
  empty: { fontSize: fontSizes.bodySmall, padding: spacing.md },
  hint: { fontSize: fontSizes.caption, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  versionInfo: { flex: 1, gap: 2 },
  versionName: { fontSize: fontSizes.body },
  versionMeta: { fontSize: fontSizes.caption },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookInfo: { flex: 1, gap: 2 },
  bookName: { fontSize: fontSizes.bodySmall },
  bookMeta: { fontSize: fontSizes.caption },
  streamBlock: { paddingTop: spacing.md },
  streamHeader: {
    fontSize: fontSizes.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  streamName: {
    fontSize: fontSizes.bodySmall,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  progress: {
    fontSize: fontSizes.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
