/**
 * TASK-017: mobile inline "Listen · 3:47" chip rendered above the
 * explanation Markdown. Mirrors web AudioInlineEntry.
 *
 * 5 states (br-audio-014 surface alignment):
 *   - LOADING / GENERATING — spinner + "Generating… ~Xs"
 *   - ERROR                — danger color, tap to retry (invalidates query)
 *   - POPULATED            — Play icon + "Listen · mm:ss"
 *   - PLAYING              — primary color + "Playing…"
 *   - EMPTY (no explanationId) — render nothing
 *
 * br-audio-005: tap explicitly loads + plays. Never auto-plays.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
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

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
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
        style={[styles.chip, styles.chipReady]}
        onPress={() => {
          // Surface a sign-in prompt by re-emitting via the existing
          // auth flow. Mobile guest users land here without a session,
          // so the global auth gate will route them appropriately.
          queryClient.invalidateQueries({
            queryKey: ['explanation-audio', props.explanationId, props.voice, props.language],
          });
        }}
      >
        <Ionicons name="lock-closed" size={16} color={colors.textPrimary} />
        <Text style={styles.chipText}>Sign in to listen to other chapters</Text>
      </Pressable>
    );
  }

  if (error) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Audio unavailable — retry (${error.message})`}
        style={[styles.chip, styles.chipError]}
        onPress={() =>
          queryClient.invalidateQueries({
            queryKey: ['explanation-audio', props.explanationId, props.voice, props.language],
          })
        }
      >
        <Text style={[styles.chipText, styles.chipTextError]}>Audio unavailable — Retry</Text>
      </Pressable>
    );
  }

  if (isGenerating || !audio) {
    return (
      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true, busy: true }}
        accessibilityLabel="Audio generating"
        style={[styles.chip, styles.chipLoading]}
      >
        <ActivityIndicator size="small" color={colors.gold} />
        <Text style={styles.chipText}>Generating… ~{estimatedReadySeconds ?? 8}s</Text>
      </Pressable>
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
    await player.play();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playingThis ? 'Playing audio explanation' : 'Play audio explanation'}
      style={[styles.chip, playingThis ? styles.chipPlaying : styles.chipReady]}
      onPress={startTrack}
    >
      <Ionicons
        name={playingThis ? 'musical-notes' : 'play'}
        size={16}
        color={playingThis ? colors.gold : colors.textPrimary}
      />
      <Text style={styles.chipText}>
        {playingThis ? 'Playing…' : `Listen · ${formatDuration(audio.duration_seconds)}`}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.gray200,
      backgroundColor: colors.backgroundElevated,
      marginBottom: 12,
    },
    chipText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    chipTextError: {
      color: colors.error,
    },
    chipLoading: {
      opacity: 0.7,
    },
    chipReady: {
      // default
    },
    chipPlaying: {
      borderColor: colors.gold,
    },
    chipError: {
      borderColor: colors.error,
    },
  });
}
