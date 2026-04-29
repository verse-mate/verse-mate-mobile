/**
 * TASK-017: persistent mini-player rendered just above the tab bar
 * (br-audio-011: cross-nav continuity — survives screen changes
 * because it's mounted above the navigator).
 *
 * Tapping the body opens AudioFullScreen. Tapping the icons toggles
 * play/pause or closes the player.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';

const TAB_BAR_OFFSET = 60;

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function AudioDockBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const player = useAudioPlayer();
  const track = player.currentTrack;
  const state = player.playbackState;

  if (!track || !player.dockVisible) return null;

  const progress =
    player.durationSeconds > 0 ? Math.min(1, player.elapsedSeconds / player.durationSeconds) : 0;

  const isPlaying = state === 'playing';

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Audio player" style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open full audio player. Chapter ${track.chapter_number}, ${track.explanation_type}`}
        style={styles.body}
        onPress={() => player.openFullScreen()}
      >
        <Text style={styles.title} numberOfLines={1}>
          {track.explanation_type} · Chapter {track.chapter_number}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.times}>
          {formatTime(player.elapsedSeconds)} / {formatTime(player.durationSeconds)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={styles.iconButton}
        onPress={() => (isPlaying ? player.pause() : player.play())}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close audio player"
        style={styles.iconButton}
        onPress={() => player.close()}
      >
        <Ionicons name="close" size={22} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors'], bottomInset: number) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: bottomInset + TAB_BAR_OFFSET,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.backgroundElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.gray200,
      // shadow for elevation feel
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 8,
    },
    body: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    progressTrack: {
      height: 3,
      backgroundColor: colors.gray200,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.gold,
    },
    times: {
      fontSize: 11,
      color: colors.gray500,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
