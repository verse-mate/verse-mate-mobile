/**
 * TASK-017: mobile counterpart of frontend-base's useAudioProgress.
 *
 * Fetches a saved resume position when a track loads and persists
 * progress on:
 *   - 15-second intervals while playing
 *   - PAUSE transitions
 *   - app-state changes (background / inactive) — mobile equivalent
 *     of web's beforeunload + sendBeacon
 *   - "ended" (terminal save with reason="complete")
 *
 * Server-side rules in br-audio-004 gate save validity (>30s elapsed,
 * <95% of duration). Client just reports.
 *
 * Hosted by AudioPlayerProvider's outer component so save lifecycle
 * is independent of which UI surface (inline / dock / full-screen) is
 * mounted at any moment.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { fetchProgress, type ResumeProgress, saveProgress } from '@/lib/audio/audioApi';

const SAVE_INTERVAL_MS = 15_000;

export interface UseAudioProgressArgs {
  /** Disable for guests (br-audio-013 prevents progress writes anyway). */
  disabled?: boolean;
}

export interface UseAudioProgressResult {
  resumeProgress: ResumeProgress | null;
  isLoading: boolean;
  consumeResume: () => ResumeProgress | null;
  dismissResume: () => void;
}

export function useAudioProgress(args: UseAudioProgressArgs = {}): UseAudioProgressResult {
  const { disabled = false } = args;
  const player = useAudioPlayer();
  const track = player.currentTrack;
  const playbackState = player.playbackState;

  const [resumeProgress, setResumeProgress] = useState<ResumeProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dismissedForIdRef = useRef<number | null>(null);

  // Fetch resume on track change (br-audio-004 validate-on-read).
  useEffect(() => {
    if (disabled || !track) {
      setResumeProgress(null);
      return;
    }
    const explanationId = track.explanation_id;
    if (dismissedForIdRef.current === explanationId) return;

    let cancelled = false;
    setIsLoading(true);
    fetchProgress(explanationId)
      .then((data) => {
        if (cancelled) return;
        setResumeProgress(data);
      })
      .catch(() => {
        if (!cancelled) setResumeProgress(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track, disabled]);

  // Periodic save while playing.
  useEffect(() => {
    if (disabled || !track || playbackState !== 'playing') return;
    const interval = setInterval(() => {
      saveProgress({
        explanationId: track.explanation_id,
        positionSeconds: player.elapsedSeconds,
        durationSeconds: track.duration_seconds,
        reason: 'pause',
      });
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [playbackState, track, disabled, player.elapsedSeconds]);

  // Save on pause + complete.
  const prevStateRef = useRef(playbackState);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = playbackState;
    if (disabled || !track) return;
    if (prev === 'playing' && playbackState === 'paused') {
      saveProgress({
        explanationId: track.explanation_id,
        positionSeconds: player.elapsedSeconds,
        durationSeconds: track.duration_seconds,
        reason: 'pause',
      });
    } else if (playbackState === 'ended') {
      saveProgress({
        explanationId: track.explanation_id,
        positionSeconds: player.elapsedSeconds,
        durationSeconds: track.duration_seconds,
        reason: 'complete',
      });
    }
  }, [playbackState, track, disabled, player.elapsedSeconds]);

  // Save on app background (mobile equivalent of web's beforeunload).
  useEffect(() => {
    if (disabled || !track) return;
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (player.playbackState !== 'playing' && player.playbackState !== 'paused') {
          return;
        }
        saveProgress({
          explanationId: track.explanation_id,
          positionSeconds: player.elapsedSeconds,
          durationSeconds: track.duration_seconds,
          reason: 'background',
        });
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [track, disabled, player.elapsedSeconds, player.playbackState]);

  return {
    resumeProgress,
    isLoading,
    consumeResume: () => {
      const r = resumeProgress;
      setResumeProgress(null);
      return r;
    },
    dismissResume: () => {
      if (track) dismissedForIdRef.current = track.explanation_id;
      setResumeProgress(null);
    },
  };
}
