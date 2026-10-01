/**
 * TASK-017: full-screen audio sheet (mobile equivalent of web's
 * AudioFullSheet). Opens from the dock bar tap. Provides ±15s skip,
 * speed menu, scrubber, and resume chip when applicable.
 *
 * Implemented as a Modal with `presentationStyle="formSheet"` so the
 * native back button / swipe-down dismiss works automatically.
 *
 * Wires AUDIO_PLAYBACK_SEEK + AUDIO_SPEED_CHANGED analytics events
 * (br-audio-014).
 */
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { trackDisplayLabel, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { trackAudioSeek, trackAudioSpeedChanged } from '@/lib/analytics/audio-events';
import type { ResumeProgress } from '@/lib/audio/audioApi';
import { useBibleTestaments } from '@/src/api';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export interface AudioFullScreenProps {
  /** Resume position from the AudioPlayerRoot wrapper, may be null. */
  resumeProgress: ResumeProgress | null;
  consumeResume: () => ResumeProgress | null;
  dismissResume: () => void;
}

export function AudioFullScreen(props: AudioFullScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const player = useAudioPlayer();
  const track = player.currentTrack;
  const isOpen = player.fullScreenOpen;
  const label = track ? trackDisplayLabel(track) : null;
  /**
   * "Mark 8", not "MRK 8". `book_usfm` is the code the Bible Brain fileset is
   * addressed by, not a label. Falls back to the code so a slow catalogue
   * never leaves the headline blank.
   */
  const { data: books = [] } = useBibleTestaments(undefined, {});
  const headline = useMemo(() => {
    const name = books.find((b) => b.id === track?.book_id)?.name;
    return name && track ? `${name} ${track.chapter_number}` : (label?.secondary ?? '');
  }, [books, track, label?.secondary]);
  /**
   * Audio analytics events are keyed on an explanation id. Scripture narration
   * (Bible Brain) has no explanation row, so these events are emitted only for
   * explanation playback rather than invented for scripture.
   */
  const explanationId = track?.kind === 'explanation' ? track.explanation_id : null;
  const seekAnalytics = (args: Omit<Parameters<typeof trackAudioSeek>[0], 'explanationId'>) => {
    if (explanationId === null) return;
    trackAudioSeek({ explanationId, ...args });
  };
  const speedAnalytics = (
    args: Omit<Parameters<typeof trackAudioSpeedChanged>[0], 'explanationId'>
  ) => {
    if (explanationId === null) return;
    trackAudioSpeedChanged({ explanationId, ...args });
  };

  return (
    <Modal
      visible={isOpen && !!track}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={() => player.closeFullScreen()}
    >
      {track ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close full audio player"
              style={styles.iconButton}
              onPress={() => player.closeFullScreen()}
            >
              <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
            </Pressable>
          </View>
          {/* Reference first, version second — "Mark 8" then the version. The
              reference is what the listener is tracking; the version is
              provenance, and leading with it made the big line read as the
              least specific thing on screen.

              The book NAME, not the USFM code: `label.secondary` is
              "<book_usfm> <chapter>", which rendered "MRK 8" here exactly as it
              rendered "JHN 19" in the dock. Same catalogue lookup, same
              fallback when it has not landed. */}
          <View style={styles.titleBlock}>
            <Text style={styles.type}>{headline}</Text>
            <Text style={styles.chapter}>{label?.primary ?? ''}</Text>
          </View>

          <Slider
            style={styles.scrubber}
            minimumValue={0}
            maximumValue={player.durationSeconds || 0}
            step={0.1}
            value={player.elapsedSeconds}
            minimumTrackTintColor={colors.gold}
            maximumTrackTintColor={colors.gray200}
            onSlidingComplete={(to) => {
              const from = player.elapsedSeconds;
              player.seek(to);
              seekAnalytics({
                fromSeconds: from,
                toSeconds: to,
                direction: to >= from ? 'forward' : 'backward',
              });
            }}
            accessibilityLabel="Playback position"
          />

          <View style={styles.controlsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rewind 15 seconds"
              style={styles.iconButton}
              onPress={() => {
                const from = player.elapsedSeconds;
                player.seekRelative(-15).then(() => {
                  seekAnalytics({
                    fromSeconds: from,
                    toSeconds: Math.max(0, from - 15),
                    direction: 'backward',
                  });
                });
              }}
            >
              <Text style={styles.skipText}>−15s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={player.playbackState === 'playing' ? 'Pause' : 'Play'}
              style={[styles.iconButton, styles.playLarge]}
              onPress={() => (player.playbackState === 'playing' ? player.pause() : player.play())}
            >
              <Ionicons
                name={player.playbackState === 'playing' ? 'pause' : 'play'}
                size={36}
                color={colors.textPrimary}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forward 15 seconds"
              style={styles.iconButton}
              onPress={() => {
                const from = player.elapsedSeconds;
                player.seekRelative(15).then(() => {
                  seekAnalytics({
                    fromSeconds: from,
                    toSeconds: Math.min(player.durationSeconds, from + 15),
                    direction: 'forward',
                  });
                });
              }}
            >
              <Text style={styles.skipText}>+15s</Text>
            </Pressable>
          </View>

          {props.resumeProgress && player.playbackState !== 'playing' ? (
            <View style={styles.resumeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Resume at ${formatTime(props.resumeProgress.position_seconds)}`}
                style={[styles.button, styles.buttonPrimary]}
                onPress={async () => {
                  const r = props.consumeResume();
                  if (!r) return;
                  await player.seek(r.position_seconds);
                  await player.play();
                }}
              >
                <Text style={styles.buttonPrimaryText}>
                  Resume at {formatTime(props.resumeProgress.position_seconds)}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restart from beginning"
                style={styles.button}
                onPress={async () => {
                  props.dismissResume();
                  await player.seek(0);
                  await player.play();
                }}
              >
                <Text style={styles.buttonText}>Restart</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.speedRow}>
            {SPEEDS.map((s) => {
              const active = player.speed === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Set playback speed to ${s} times`}
                  accessibilityState={{ selected: active }}
                  style={[styles.speedButton, active && styles.speedButtonActive]}
                  onPress={() => {
                    const from = player.speed;
                    if (from === s) return;
                    player.setSpeed(s);
                    speedAnalytics({
                      fromSpeed: from,
                      toSpeed: s,
                    });
                  }}
                >
                  <Text style={[styles.speedText, active && styles.speedTextActive]}>{s}×</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.times}>
            {formatTime(player.elapsedSeconds)} / {formatTime(player.durationSeconds)}
          </Text>
        </View>
      ) : null}
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      backgroundColor: colors.background,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    titleBlock: {
      alignItems: 'center',
      marginTop: 16,
    },
    type: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    chapter: {
      fontSize: 16,
      color: colors.gray500,
      marginTop: 4,
    },
    scrubber: {
      width: '100%',
      height: 40,
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 32,
    },
    skipText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    playLarge: {
      minWidth: 64,
      minHeight: 64,
      borderRadius: 32,
      backgroundColor: colors.backgroundElevated,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 8,
    },
    speedButton: {
      minHeight: 44,
      minWidth: 56,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.gray200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedButtonActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    speedText: {
      color: colors.textPrimary,
      fontSize: 14,
    },
    speedTextActive: {
      color: colors.background,
      fontWeight: '700',
    },
    resumeRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
    },
    button: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.gray200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    buttonPrimary: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    buttonPrimaryText: {
      color: colors.background,
      fontSize: 14,
      fontWeight: '700',
    },
    times: {
      textAlign: 'center',
      color: colors.gray500,
      fontSize: 13,
      marginTop: 4,
    },
  });
}
