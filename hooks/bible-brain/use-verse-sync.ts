/**
 * Drives highlight-as-it-reads for scripture narration.
 *
 * Reads the player's elapsed time and reports the verse currently being read.
 * Returns null whenever the loaded track is not scripture, so the reader can
 * mount this unconditionally without caring what kind of audio is playing.
 */
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { isScriptureTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { fetchVerseTimestamps } from '@/lib/bible-brain/api';
import {
  findActiveVerse,
  seekSecondsForVerse,
  type VerseTimestamp,
} from '@/lib/bible-brain/verse-sync';

/** Timings are immutable per fileset+chapter, so never re-fetch them. */
const TIMESTAMPS_STALE_MS = Number.POSITIVE_INFINITY;

export interface UseVerseSyncResult {
  /** Verse being read right now, or null before verse 1 / when not scripture. */
  activeVerse: number | null;
  timestamps: VerseTimestamp[];
  /** True when this chapter has verse timing available at all. */
  hasTiming: boolean;
  /** Jump playback to a verse. No-op when that verse has no timing. */
  seekToVerse: (verse: number) => Promise<void>;
  isLoading: boolean;
}

export function useVerseSync(): UseVerseSyncResult {
  const player = useAudioPlayer();
  const track = player.currentTrack;
  const scripture = isScriptureTrack(track) ? track : null;

  const query = useQuery({
    queryKey: [
      'scripture-timestamps',
      scripture?.fileset_id ?? null,
      scripture?.book_usfm ?? null,
      scripture?.chapter_number ?? null,
    ],
    queryFn: () =>
      fetchVerseTimestamps({
        filesetId: scripture?.fileset_id ?? '',
        book: scripture?.book_usfm ?? '',
        chapter: scripture?.chapter_number ?? 0,
      }),
    enabled: scripture !== null,
    staleTime: TIMESTAMPS_STALE_MS,
    gcTime: TIMESTAMPS_STALE_MS,
  });

  const timestamps = query.data ?? [];

  const activeVerse = useMemo(
    () => (scripture ? findActiveVerse(timestamps, player.elapsedSeconds) : null),
    [scripture, timestamps, player.elapsedSeconds]
  );

  const seekToVerse = useCallback(
    async (verse: number) => {
      const seconds = seekSecondsForVerse(timestamps, verse);
      if (seconds === null) return;
      await player.seek(seconds);
    },
    [timestamps, player]
  );

  return {
    activeVerse,
    timestamps,
    hasTiming: timestamps.length > 0,
    seekToVerse,
    isLoading: query.isLoading,
  };
}
