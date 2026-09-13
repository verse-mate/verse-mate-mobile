/**
 * Narration toggle in the reader header, beside the Bible/Insight pill.
 *
 * Deliberately just an icon: which version is playing, the verse being read
 * and the scrubber all live in the player dock at the bottom of the screen.
 * Putting that detail up here would crowd a header that already carries the
 * book, chapter, translation, offline state and menu.
 *
 * Renders nothing when the language being read has no narration at all
 * (German, for one) — an always-present dead control is worse than absence.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { getBookById } from '@/constants/bible-books';
import { isScriptureTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useScriptureAudio } from '@/hooks/bible-brain/use-scripture-audio';
import { filesetFor, useScriptureForVersion } from '@/hooks/bible-brain/use-scripture-for-version';
import { pickAudioFileset } from '@/hooks/bible-brain/use-scripture-versions';
import { fetchVerseTimestamps } from '@/lib/bible-brain/api';
import { usfmForBookId } from '@/lib/bible-brain/usfm-books';
import { spacing } from '@/theme/tokens';

export interface ScriptureAudioButtonProps {
  bookId: number;
  chapterNumber: number;
}

export function ScriptureAudioButton({ bookId, chapterNumber }: ScriptureAudioButtonProps) {
  const { colors } = useTheme();
  const player = useAudioPlayer();
  const { playChapter, isPreparing } = useScriptureAudio();
  const { preferred, versions, language } = useScriptureForVersion();

  const book = getBookById(bookId);
  const usfm = usfmForBookId(bookId);

  /**
   * `has_verse_timing` is a *version* flag but timing lives per fileset — a
   * version can be timed for its NT and silent for its OT. Probe the chapter
   * actually being played and fall through to the next candidate, memoised so
   * it costs one request, not one per tap.
   */
  const timedCache = useRef(new Map<string, boolean>());
  const resolveFileset = useCallback(async () => {
    if (!usfm || !book) return null;
    const ordered = [
      ...(preferred ? [preferred] : []),
      ...versions.filter((v) => v !== preferred && v.audio_filesets.length > 0),
    ];
    for (const version of ordered) {
      const filesetId = pickAudioFileset(version, book.testament);
      if (!filesetId) continue;
      const key = `${filesetId}:${usfm}:${chapterNumber}`;
      let timed = timedCache.current.get(key);
      if (timed === undefined) {
        try {
          const stamps = await fetchVerseTimestamps({
            filesetId,
            book: usfm,
            chapter: chapterNumber,
          });
          timed = stamps.length > 0;
        } catch {
          timed = false;
        }
        timedCache.current.set(key, timed);
      }
      if (timed) return { version, filesetId };
    }
    // Nothing timed for this chapter — still play, just without follow-along.
    const fallback = filesetFor(preferred, book.testament);
    return preferred && fallback ? { version: preferred, filesetId: fallback } : null;
  }, [preferred, versions, book, usfm, chapterNumber]);

  if (!book || !usfm || !language || !preferred) return null;

  const track = player.currentTrack;
  const isThisChapter =
    isScriptureTrack(track) && track.book_usfm === usfm && track.chapter_number === chapterNumber;
  const isPlaying = isThisChapter && player.playbackState === 'playing';

  const onPress = async () => {
    if (isPlaying) return player.pause();
    if (isThisChapter) return player.play();
    const pick = await resolveFileset();
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isPlaying
          ? `Pause narration of ${book.name} ${chapterNumber}`
          : `Listen to ${book.name} ${chapterNumber}`
      }
      accessibilityState={{ selected: isPlaying }}
      testID="scripture-audio-button"
      onPress={onPress}
      hitSlop={8}
      style={styles.button}
    >
      {isPreparing ? (
        <ActivityIndicator size="small" color={colors.gold} />
      ) : (
        <Ionicons
          name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
          size={22}
          color={isPlaying ? colors.gold : colors.textPrimary}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
