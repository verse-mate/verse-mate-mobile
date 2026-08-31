/**
 * Loads a narrated chapter into the shared audio player.
 *
 * Prefers a downloaded copy over the network: `resolveScriptureAudioUrl` checks
 * the local file first, so a user who downloaded ESV keeps working narration on
 * a plane. When there is no local copy we mint a fresh signed streaming URL —
 * those expire in under a day, so one is requested per play rather than cached.
 */
import { useCallback, useState } from 'react';
import { type ScriptureAudioTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { fetchChapterAudio } from '@/lib/bible-brain/api';
import { createExpoScriptureStorage } from '@/lib/bible-brain/expo-scripture-storage';
import {
  type ChapterRef,
  resolveScriptureAudioUrl,
  type ScriptureStoragePort,
} from '@/lib/bible-brain/scripture-storage';

export interface PlayScriptureArgs extends ChapterRef {
  /** Numeric book id used by the rest of the app's reader state. */
  bookId: number;
  /** Bible id for copyright lookup + display, e.g. `ENGESV`. */
  versionAbbr: string;
  versionName: string;
  languageCode: string;
  sourceHref: string;
}

export interface UseScriptureAudioResult {
  playChapter: (args: PlayScriptureArgs) => Promise<void>;
  isPreparing: boolean;
  error: string | null;
}

export function useScriptureAudio(
  storage: ScriptureStoragePort = createExpoScriptureStorage()
): UseScriptureAudioResult {
  const player = useAudioPlayer();
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playChapter = useCallback(
    async (args: PlayScriptureArgs) => {
      setIsPreparing(true);
      setError(null);
      try {
        const ref: ChapterRef = {
          filesetId: args.filesetId,
          book: args.book,
          chapter: args.chapter,
        };
        const audio = await fetchChapterAudio(ref);
        if (!audio) {
          setError('This chapter has no narration in the selected version.');
          return;
        }
        const { url, isOffline } = await resolveScriptureAudioUrl(ref, audio.url, storage);
        const track: ScriptureAudioTrack = {
          kind: 'scripture',
          url,
          duration_seconds: audio.duration_seconds ?? 0,
          language_code: args.languageCode,
          book_id: args.bookId,
          chapter_number: args.chapter,
          source_href: args.sourceHref,
          fileset_id: args.filesetId,
          book_usfm: args.book,
          version_abbr: args.versionAbbr,
          version_name: args.versionName,
          is_offline: isOffline,
        };
        await player.load(track);
        await player.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsPreparing(false);
      }
    },
    [player, storage]
  );

  return { playChapter, isPreparing, error };
}
