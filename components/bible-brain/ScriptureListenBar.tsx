/**
 * "Listen" control for narrated scripture, mounted in the Bible reading view.
 *
 * Picks the best narrated version available for the language — preferring one
 * with verse timing so the reader can follow along — and plays the chapter
 * currently on screen. Playback itself is owned by the shared AudioPlayer, so
 * the dock bar and full-screen player come for free; this is only the entry
 * point plus the follow-along readout.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getBookById } from '@/constants/bible-books';
import { isScriptureTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useScriptureAudio } from '@/hooks/bible-brain/use-scripture-audio';
import { pickAudioFileset, useScriptureVersions } from '@/hooks/bible-brain/use-scripture-versions';
import { useVerseSync } from '@/hooks/bible-brain/use-verse-sync';
import { fetchVerseTimestamps, type ScriptureVersion } from '@/lib/bible-brain/api';
import { usfmForBookId } from '@/lib/bible-brain/usfm-books';
import { fontSizes, spacing } from '@/theme/tokens';

export interface ScriptureListenBarProps {
  bookId: number;
  chapterNumber: number;
  /** ISO-639-3 language to source narration for. */
  language?: string;
}

export function ScriptureListenBar({
  bookId,
  chapterNumber,
  language = 'eng',
}: ScriptureListenBarProps) {
  const { colors } = useTheme();
  const player = useAudioPlayer();
  const { playChapter, isPreparing, error } = useScriptureAudio();
  const { activeVerse, hasTiming } = useVerseSync();
  const { bestForReader, offlineCapable, streamOnly } = useScriptureVersions(language);

  const book = getBookById(bookId);
  const usfm = usfmForBookId(bookId);

  /**
   * Candidates in preference order. `has_verse_timing` is a *version*-level
   * flag, but timing actually lives per fileset — EN1ESV reports timing
   * (its NT fileset has it) while its OT fileset `ENGESHO1DA` returns zero
   * timestamps for Genesis, so picking purely on the version flag silently
   * loses follow-along for half the Bible. `resolveTimedFileset` below settles
   * it against the chapter actually being played.
   */
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: { version: ScriptureVersion; filesetId: string }[] = [];
    if (!book) return out;
    for (const version of [...bestForReader, ...offlineCapable, ...streamOnly]) {
      const filesetId = pickAudioFileset(version, book.testament);
      if (!filesetId || seen.has(filesetId)) continue;
      seen.add(filesetId);
      out.push({ version, filesetId });
    }
    return out;
  }, [bestForReader, offlineCapable, streamOnly, book]);

  const chosen = candidates[0] ?? null;

  /**
   * First candidate whose fileset actually has timestamps for this chapter, so
   * follow-along works where it can. Results are memoised per
   * fileset/book/chapter for the component's lifetime — one probe, not one per
   * tap — and any probe failure just falls through to the next candidate.
   *
   * Declared before the early return below: hooks cannot sit after a
   * conditional return, or the hook order changes between renders.
   */
  const timedCache = useRef(new Map<string, boolean>());
  const resolveTimedFileset = useCallback(async () => {
    if (!usfm) return null;
    for (const candidate of candidates) {
      const key = `${candidate.filesetId}:${usfm}:${chapterNumber}`;
      let timed = timedCache.current.get(key);
      if (timed === undefined) {
        try {
          const stamps = await fetchVerseTimestamps({
            filesetId: candidate.filesetId,
            book: usfm,
            chapter: chapterNumber,
          });
          timed = stamps.length > 0;
        } catch {
          timed = false;
        }
        timedCache.current.set(key, timed);
      }
      if (timed) return candidate;
    }
    // Nothing timed for this chapter — still play, just without follow-along.
    return candidates[0] ?? null;
  }, [candidates, usfm, chapterNumber]);

  if (!book || !usfm || !chosen) return null;

  const track = player.currentTrack;
  const isThisChapter =
    isScriptureTrack(track) && track.book_usfm === usfm && track.chapter_number === chapterNumber;
  const isPlaying = isThisChapter && player.playbackState === 'playing';

  const onPress = async () => {
    if (isPlaying) {
      await player.pause();
      return;
    }
    if (isThisChapter) {
      await player.play();
      return;
    }
    const pick = await resolveTimedFileset();
    if (!pick) return;
    await playChapter({
      filesetId: pick.filesetId,
      book: usfm,
      chapter: chapterNumber,
      bookId,
      versionAbbr: pick.version.abbr,
      versionName: pick.version.name,
      languageCode: language,
      sourceHref: `/bible/${bookId}/${chapterNumber}`,
    });
  };

  return (
    <View style={styles.container} testID="scripture-listen-bar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying
            ? `Pause narration of ${book.name} ${chapterNumber}`
            : `Listen to ${book.name} ${chapterNumber} narrated`
        }
        testID="scripture-listen-toggle"
        onPress={onPress}
        style={[styles.button, { borderColor: colors.gold }]}
      >
        {isPreparing ? (
          <ActivityIndicator color={colors.gold} size="small" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={colors.gold} />
        )}
        <Text style={[styles.label, { color: colors.gold }]} numberOfLines={1}>
          {isPlaying ? 'Pause' : 'Listen'}
        </Text>
      </Pressable>

      <View style={styles.meta}>
        <Text style={[styles.version, { color: colors.textSecondary }]} numberOfLines={1}>
          {isThisChapter && track?.kind === 'scripture' ? track.version_abbr : chosen.version.abbr}
          {isThisChapter && track?.kind === 'scripture' && track.is_offline ? ' · offline' : ''}
        </Text>
        {isThisChapter && hasTiming && activeVerse !== null ? (
          <Text style={[styles.verse, { color: colors.gold }]} testID="scripture-active-verse">
            verse {activeVerse}
          </Text>
        ) : null}
        {error ? (
          <Text style={[styles.error, { color: colors.textSecondary }]} numberOfLines={1}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 96,
    justifyContent: 'center',
  },
  label: { fontSize: fontSizes.bodySmall, fontWeight: '600' },
  meta: { flex: 1, gap: 1 },
  version: { fontSize: fontSizes.caption },
  verse: { fontSize: fontSizes.caption, fontWeight: '600' },
  error: { fontSize: fontSizes.caption },
});
