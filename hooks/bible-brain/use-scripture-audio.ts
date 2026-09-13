/**
 * Loads a narrated chapter into the shared audio player.
 *
 * Prefers a downloaded copy over the network: `resolveScriptureAudioUrl` checks
 * the local file first, so a user who downloaded ESV keeps working narration on
 * a plane. When there is no local copy we mint a fresh signed streaming URL —
 * those expire in under a day, so one is requested per play rather than cached.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { type ScriptureAudioTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { fetchChapterAudio } from '@/lib/bible-brain/api';
import { getExpoScriptureStorage } from '@/lib/bible-brain/expo-scripture-storage';
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
  /** Injectable for tests; defaults to the shared expo-backed port. */
  storageOverride?: ScriptureStoragePort
): UseScriptureAudioResult {
  // Memoized so the callbacks below keep a stable identity across renders.
  const storage = useMemo(() => storageOverride ?? getExpoScriptureStorage(), [storageOverride]);
  // Held in a ref rather than listed as a dependency. The player context value
  // is rebuilt on every playback tick (~4x/second), and its `load`/`play`
  // callbacks depend on the provider's whole props object, so depending on
  // either would churn `playChapter`'s identity constantly and defeat memoized
  // consumers. Same ref pattern the provider itself uses for currentTrack.
  const player = useAudioPlayer();
  const playerRef = useRef(player);
  playerRef.current = player;
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * True from the first tap until the track is loaded and playing. `isPreparing`
   * is state and so lags a synchronous second tap by a render; a ref does not.
   * Without it, tapping the speaker repeatedly starts one player per tap —
   * `currentTrack` is still null while the signed URL is being fetched, so
   * every caller thinks it is the first.
   */
  const inFlight = useRef(false);

  const playChapter = useCallback(
    async (args: PlayScriptureArgs) => {
      if (inFlight.current) return;
      inFlight.current = true;
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
        await playerRef.current.load(track);
        await playerRef.current.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        inFlight.current = false;
        setIsPreparing(false);
      }
    },
    [storage]
  );

  return { playChapter, isPreparing, error };
}
