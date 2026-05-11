/**
 * TASK-017: mobile inline audio entry rendered above the explanation Markdown.
 * Mirrors web AudioInlineEntry.
 *
 * 5 states (br-audio-014 surface alignment):
 *   - LOADING / GENERATING — spinner + "Generating… ~Xs"
 *   - ERROR                — danger color, tap to retry (invalidates query)
 *   - POPULATED            — Play icon + "Listen · mm:ss"
 *   - PLAYING              — primary color + "Playing…"
 *   - EMPTY (no explanationId) — render nothing
 *
 * br-audio-005: tap explicitly loads + plays. Never auto-plays.
 *
 * 2026-05-02 redesign (Andy BUG-006 + BUG-007): YouVersion-style circular
 * play button + adjacent label, plus a speed cycler chip that's visible
 * once audio is loaded. Cycles through SPEED_OPTIONS on tap.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { type AudioTrack, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useExplanationAudio } from '@/hooks/audio/useExplanationAudio';
import { GuestScopeExceededError } from '@/lib/audio/audioApi';

export interface AudioInlineEntryProps {
  explanationId: number | null;
  explanationType: string;
  bookId: number;
  chapterNumber: number;
  language?: string;
  voice?: string;
  /** Deep link back to this explanation, used by the dock/full-screen "Go to source" affordance. */
  sourceHref: string;
}

/**
 * Available playback speeds. Tapping the speed cycler advances to the
 * next option, wrapping at the end. Mirrors AudioFullScreen's speedRow
 * options for consistency.
 */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

/** Compute the next speed in the cycle from the current value. */
export function nextSpeed(current: number): number {
  const idx = SPEED_OPTIONS.findIndex((s) => Math.abs(s - current) < 0.01);
  const next = idx === -1 ? 1 : SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
  return next;
}

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function formatSpeed(speed: number): string {
  // Drop trailing zero on whole-number speeds (1× rather than 1.0×).
  return `${speed % 1 === 0 ? speed.toFixed(0) : speed}×`;
}

export function AudioInlineEntry(props: AudioInlineEntryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const player = useAudioPlayer();

  const { audio, isGenerating, estimatedReadySeconds, error } = useExplanationAudio({
    explanationId: props.explanationId,
    voice: props.voice,
    language: props.language,
  });

  if (props.explanationId === null) return null;

  // br-audio-013: guest tried to access a chapter outside Genesis 1.
  if (error instanceof GuestScopeExceededError) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in to listen to other chapters"
        style={[styles.row, styles.rowReady]}
        onPress={() => {
          queryClient.invalidateQueries({
            queryKey: ['explanation-audio', props.explanationId, props.voice, props.language],
          });
        }}
      >
        <View style={[styles.playButton, styles.playButtonLocked]}>
          <Ionicons name="lock-closed" size={18} color={colors.background} />
        </View>
        <Text style={styles.label}>Sign in to listen to other chapters</Text>
      </Pressable>
    );
  }

  if (error) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Audio unavailable — retry (${error.message})`}
        style={[styles.row, styles.rowError]}
        onPress={() =>
          queryClient.invalidateQueries({
            queryKey: ['explanation-audio', props.explanationId, props.voice, props.language],
          })
        }
      >
        <View style={[styles.playButton, styles.playButtonError]}>
          <Ionicons name="refresh" size={18} color={colors.background} />
        </View>
        <Text style={[styles.label, styles.labelError]}>Audio unavailable — Retry</Text>
      </Pressable>
    );
  }

  if (isGenerating || !audio) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessibilityLabel="Audio generating"
        style={[styles.row, styles.rowLoading]}
      >
        <View style={[styles.playButton, styles.playButtonLoading]}>
          <ActivityIndicator size="small" color={colors.background} />
        </View>
        <Text style={styles.label}>Generating… ~{estimatedReadySeconds ?? 8}s</Text>
      </View>
    );
  }

  const isThisTrack = player.currentTrack?.explanation_id === props.explanationId;
  const playingThis = isThisTrack && player.playbackState === 'playing';

  const startTrack = async () => {
    if (!isThisTrack) {
      const track: AudioTrack = {
        audio_id: `exp-${props.explanationId}`,
        explanation_id: props.explanationId as number,
        url: audio.url,
        duration_seconds: audio.duration_seconds,
        voice: audio.voice,
        language_code: audio.language_code,
        explanation_type: props.explanationType,
        book_id: props.bookId,
        chapter_number: props.chapterNumber,
        // br-audio-007: Reader DTO does not expose provider; analytics
        // surfaces "unknown" rather than misreporting.
        tts_provider: 'unknown',
        source_href: props.sourceHref,
      };
      await player.load(track);
    }
    if (playingThis) {
      await player.pause();
    } else {
      await player.play();
    }
  };

  const cyclePlaybackSpeed = () => player.setSpeed(nextSpeed(player.speed));

  return (
    <View style={styles.row}>
      {/* Circular play button — primary affordance, mirrors YouVersion pattern. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playingThis ? 'Pause audio explanation' : 'Play audio explanation'}
        style={[styles.playButton, playingThis ? styles.playButtonActive : styles.playButtonReady]}
        onPress={startTrack}
      >
        <Ionicons name={playingThis ? 'pause' : 'play'} size={18} color={colors.background} />
      </Pressable>

      {/* Title + duration label, non-interactive. */}
      <Text style={styles.label} numberOfLines={1}>
        {playingThis ? 'Playing…' : `Listen · ${formatDuration(audio.duration_seconds)}`}
      </Text>

      {/* Speed cycler — only visible once audio is loaded; tap to advance. */}
      {isThisTrack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${formatSpeed(player.speed)}, tap to change`}
          accessibilityHint={`Cycles through ${SPEED_OPTIONS.map(formatSpeed).join(', ')}`}
          style={styles.speedChip}
          onPress={cyclePlaybackSpeed}
        >
          <Text style={styles.speedText}>{formatSpeed(player.speed)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      alignSelf: 'flex-start',
      minHeight: 44,
      marginBottom: 12,
    },
    rowReady: {
      // default
    },
    rowLoading: {
      opacity: 0.7,
    },
    rowError: {
      // styling carried by playButton + label
    },
    playButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButtonReady: {
      backgroundColor: colors.gold,
    },
    playButtonActive: {
      backgroundColor: colors.gold,
    },
    playButtonLoading: {
      backgroundColor: colors.gray500,
    },
    playButtonLocked: {
      backgroundColor: colors.gray500,
    },
    playButtonError: {
      backgroundColor: colors.error,
    },
    label: {
      fontSize: 14,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    labelError: {
      color: colors.error,
    },
    speedChip: {
      minWidth: 44,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.gray200,
      backgroundColor: colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
}
