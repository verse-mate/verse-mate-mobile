/**
 * TASK-017: persistent mini-player pinned to the bottom of the screen
 * (br-audio-011: cross-nav continuity — survives screen changes
 * because it's mounted above the navigator).
 *
 * It sits flush on whatever the current screen pins to `bottom: 0` — the
 * reader's progress bar, nothing elsewhere — reported through
 * BottomBarInsetContext. See the comment on `bottomBarInset` below.
 *
 * Tapping the body opens AudioFullScreen. Tapping the icons toggles
 * play/pause or closes the player.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextSpeed, SPEED_OPTIONS } from '@/components/bible/AudioInlineEntry';
import { isScriptureTrack, trackDisplayLabel, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useBottomBarInset } from '@/contexts/BottomBarInsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useVerseSync } from '@/hooks/bible-brain/use-verse-sync';

function formatSpeed(speed: number): string {
  return `${speed % 1 === 0 ? speed.toFixed(0) : speed}×`;
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function AudioDockBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  /**
   * Sit flush on whatever the screen pins to its bottom edge — the reader's
   * progress bar, or nothing at all elsewhere — so no strip of the page shows
   * through underneath the player. The safe-area inset becomes padding inside
   * the bar instead of a gap below it, for the same reason.
   */
  const bottomBarInset = useBottomBarInset();
  const styles = useMemo(
    () => createStyles(colors, bottomBarInset, bottomBarInset > 0 ? 0 : insets.bottom),
    [colors, bottomBarInset, insets.bottom]
  );
  const player = useAudioPlayer();
  const track = player.currentTrack;
  // Follow-along readout lives here, not in the header — the header only
  // toggles playback. Inert for explanation audio.
  const { activeVerse } = useVerseSync();
  const state = player.playbackState;

  if (!track || !player.dockVisible) return null;

  const progress =
    player.durationSeconds > 0 ? Math.min(1, player.elapsedSeconds / player.durationSeconds) : 0;

  const label = trackDisplayLabel(track);
  const isPlaying = state === 'playing';
  const isBuffering = state === 'loading';

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Audio player" style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open full audio player. ${label.primary}, ${label.secondary}`}
        style={styles.body}
        onPress={() => player.openFullScreen()}
      >
        {/* Reference and live verse first, version name last. One line is all
            there is, and "English Standard Version®" is long enough to eat it
            whole — which hid the verse readout entirely. The part that changes
            as you listen is the part that must survive the truncation. */}
        <Text style={styles.title} numberOfLines={1}>
          {label.secondary}
          {isScriptureTrack(track) && activeVerse !== null ? ` · v${activeVerse}` : ''} ·{' '}
          <Text style={styles.titleSecondary}>{label.primary}</Text>
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
        accessibilityLabel={`Playback speed ${formatSpeed(player.speed)}, tap to change`}
        accessibilityHint={`Cycles through ${SPEED_OPTIONS.map(formatSpeed).join(', ')}`}
        style={styles.speedButton}
        onPress={() => player.setSpeed(nextSpeed(player.speed))}
      >
        <Text style={styles.speedText}>{formatSpeed(player.speed)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBuffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}
        accessibilityState={{ busy: isBuffering }}
        style={styles.iconButton}
        disabled={isBuffering}
        onPress={() => (isPlaying ? player.pause() : player.play())}
        testID="audio-dock-play-toggle"
      >
        {isBuffering ? (
          <ActivityIndicator
            size="small"
            color={colors.textPrimary}
            testID="audio-dock-buffering-indicator"
          />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.textPrimary} />
        )}
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

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  bottomOffset: number,
  safeAreaPadding: number
) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: bottomOffset,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8 + safeAreaPadding,
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
    titleSecondary: {
      color: colors.gray500,
      fontWeight: '400',
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
    speedButton: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 8,
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
