/**
 * "Narrated Bible" on the Manage Downloads screen.
 *
 * Scoped to the language of the translation the user reads — there is no
 * audio-language picker, the same way there isn't one in YouVersion. The
 * voice matching their translation is marked so the default is legible rather
 * than arbitrary, and the rest of that language's voices are offered below it.
 *
 * Downloads are per book: the New Testament alone is ~260 chapters at roughly
 * 2MB each, which is not a sensible single tap on a phone.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BIBLE_BOOKS } from '@/constants/bible-books';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { useScriptureForVersion } from '@/hooks/bible-brain/use-scripture-for-version';
import { pickAudioFileset } from '@/hooks/bible-brain/use-scripture-versions';
import type { ScriptureVersion } from '@/lib/bible-brain/api';
import { isSameTranslation } from '@/lib/bible-brain/language';
import { estimateChapterBytes } from '@/lib/bible-brain/scripture-storage';
import { chaptersForBook } from '@/lib/bible-brain/usfm-books';
import { fontSizes, spacing } from '@/theme/tokens';
import { ScriptureCopyright } from './ScriptureCopyright';

/** Bible Brain chapters average ~4 minutes; used only for a pre-download hint. */
const AVERAGE_CHAPTER_SECONDS = 240;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function ScriptureAudioSection() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const {
    offlineCapable,
    streamOnly,
    isLoading,
    language,
    readingVersionKey,
    unavailableForLanguage,
  } = useScriptureForVersion();
  const downloader = useScriptureDownload();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloadedBooks, setDownloadedBooks] = useState<Set<number>>(new Set());
  const [busyBookId, setBusyBookId] = useState<number | null>(null);

  const selected = useMemo(
    () => offlineCapable.find((v) => v.abbr === expanded) ?? null,
    [offlineCapable, expanded]
  );
  const selectedFilesetId = selected ? pickAudioFileset(selected, 'NT') : null;

  // Re-read what is on disk whenever the selection changes or a run finishes,
  // so the list reflects reality rather than optimistic state.
  useEffect(() => {
    if (!selected || !selectedFilesetId) {
      setDownloadedBooks(new Set());
      return;
    }
    let cancelled = false;
    downloader.downloadedChapters(selectedFilesetId).then((chapters) => {
      if (cancelled) return;
      const byBook = new Map<string, number>();
      for (const chapter of chapters) {
        byBook.set(chapter.book, (byBook.get(chapter.book) ?? 0) + 1);
      }
      const complete = new Set<number>();
      for (const book of BIBLE_BOOKS) {
        const refs = chaptersForBook(selectedFilesetId, book.id);
        if (refs.length === 0) continue;
        if (byBook.get(refs[0].book) === book.chapterCount) complete.add(book.id);
      }
      setDownloadedBooks(complete);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, selectedFilesetId, downloader.outcome, downloader.downloadedChapters]);

  const handleDownloadBook = async (bookId: number, bookName: string) => {
    if (!selectedFilesetId || !selected) return;
    setBusyBookId(bookId);
    try {
      const outcome = await downloader.download(chaptersForBook(selectedFilesetId, bookId));
      if (!outcome) return;
      if (outcome.notLicensed.length > 0 && outcome.downloaded === 0) {
        showToast(`${selected.abbr} can only be streamed`);
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
      <View style={styles.stateBlock} testID="scripture-audio-loading">
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!language || unavailableForLanguage) {
    return (
      <View style={styles.stateBlock}>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          {language
            ? 'No narrated audio is available for this language yet.'
            : 'Narration is not offered for the language of your Bible version.'}
        </Text>
      </View>
    );
  }

  const renderVersion = (version: ScriptureVersion, downloadable: boolean) => {
    const isMatch = readingVersionKey ? isSameTranslation(version.abbr, readingVersionKey) : false;
    const isOpen = expanded === version.abbr;
    const filesetId = pickAudioFileset(version, 'NT');

    return (
      <View key={version.abbr}>
        <Pressable
          accessibilityRole={downloadable ? 'button' : 'text'}
          accessibilityState={{ expanded: isOpen }}
          // testID lives on the pressable, not the wrapper, so a tap in a test
          // or a Maestro flow actually reaches the handler.
          testID={`scripture-audio-version-${version.abbr}`}
          disabled={!downloadable}
          onPress={() => setExpanded(isOpen ? null : version.abbr)}
          style={({ pressed }) => [
            styles.versionRow,
            { borderBottomColor: colors.divider },
            pressed && downloadable && { opacity: 0.6 },
          ]}
        >
          <View style={styles.versionInfo}>
            <Text style={[styles.versionName, { color: colors.textPrimary }]} numberOfLines={2}>
              {version.name}
            </Text>
            <View style={styles.badgeRow}>
              {isMatch ? (
                <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.badgeTextOn}>your version</Text>
                </View>
              ) : null}
              {version.has_verse_timing ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>follows along</Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {downloadable ? 'can be downloaded' : 'streaming only'}
              </Text>
            </View>
          </View>
          {downloadable ? (
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          ) : (
            <Ionicons name="cloud-outline" size={18} color={colors.textTertiary} />
          )}
        </Pressable>

        {isOpen && filesetId ? (
          <View style={styles.bookPanel} testID={`scripture-audio-books-${version.abbr}`}>
            <ScriptureCopyright bibleId={version.abbr} />
            {BIBLE_BOOKS.map((book) => {
              const isDone = downloadedBooks.has(book.id);
              const isBusy = busyBookId === book.id && downloader.isDownloading;
              const estimate = formatBytes(
                book.chapterCount * estimateChapterBytes(AVERAGE_CHAPTER_SECONDS, filesetId)
              );
              return (
                <View key={book.id} style={[styles.bookRow, { borderBottomColor: colors.divider }]}>
                  <View style={styles.bookInfo}>
                    <Text style={[styles.bookName, { color: colors.textPrimary }]}>
                      {book.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {book.chapterCount} chapters · ~{estimate}
                    </Text>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator color={colors.gold} />
                  ) : isDone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${book.name} narration`}
                      testID={`scripture-audio-delete-${book.id}`}
                      hitSlop={8}
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
                      hitSlop={8}
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
  };

  return (
    <View style={styles.container} testID="scripture-audio-section">
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Listen to the Bible read aloud. Pick a voice, then download the books you want offline.
      </Text>

      {offlineCapable.map((v) => renderVersion(v, true))}

      {streamOnly.length > 0 ? (
        <View style={styles.streamBlock}>
          <Text style={[styles.groupLabel, { color: colors.textTertiary }]}>Streaming only</Text>
          {streamOnly.map((v) => renderVersion(v, false))}
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
  // The screen's card gives horizontal padding; vertical was missing entirely,
  // so the first row sat flush against the section heading.
  container: { paddingVertical: spacing.sm },
  stateBlock: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  stateText: { fontSize: fontSizes.bodySmall, textAlign: 'center', lineHeight: 20 },
  hint: {
    fontSize: fontSizes.caption,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  versionInfo: { flex: 1, gap: spacing.xs },
  versionName: { fontSize: fontSizes.body, lineHeight: 22 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  badgeTextOn: { fontSize: fontSizes.caption, color: '#FFFFFF', fontWeight: '600' },
  meta: { fontSize: fontSizes.caption },
  bookPanel: { paddingBottom: spacing.sm },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookInfo: { flex: 1, gap: 2 },
  bookName: { fontSize: fontSizes.bodySmall },
  streamBlock: { paddingTop: spacing.md },
  groupLabel: {
    fontSize: fontSizes.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  progress: {
    fontSize: fontSizes.caption,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
