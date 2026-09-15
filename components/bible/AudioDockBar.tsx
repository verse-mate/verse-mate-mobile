/**
 * TASK-017: persistent mini-player pinned to the bottom of the screen
 * (br-audio-011: cross-nav continuity — survives screen changes
 * because it's mounted above the navigator).
 *
 * It sits flush on whatever the current screen pins to `bottom: 0` — the
 * reader's progress bar, nothing elsewhere — reported through
 * BottomBarInsetContext. See the comment on `bottomBarInset` below.
 *
 * DELIBERATELY SPARSE. The first version carried the reference, the live
 * verse, the version name, a progress track, an elapsed/duration readout, a
 * speed control, play/pause and a close button — three rows of information and
 * three buttons, pinned over the text you were trying to read. The tester
 * asked to "make this a bit cleaner" and specified what survives:
 *
 *     Mark 8            ▶            1.25×
 *
 * with a hairline progress line along the TOP EDGE, and nothing else. Tap the
 * play button to play/pause, tap the speed to cycle it, tap anywhere else to
 * expand. Everything that was dropped — scrubber, timings, skip, voice, sleep
 * timer, close — lives in the expanded player, which is one tap away.
 */
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextSpeed, SPEED_OPTIONS } from '@/components/bible/AudioInlineEntry';
import { trackDisplayLabel, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useBottomBarInset } from '@/contexts/BottomBarInsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';

/** The bar's own height, before the safe-area inset. Tester asked for ~56–64. */
const BAR_HEIGHT = 56;

function formatSpeed(speed: number): string {
  return `${speed % 1 === 0 ? speed.toFixed(0) : speed}×`;
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
  const state = player.playbackState;

  /**
   * "Mark 8", not "MRK 8".
   *
   * `book_usfm` is the code the Bible Brain fileset is ADDRESSED by; it is not
   * a label, and shipping it put "JHN 19" under the reader. The books metadata
   * is already cached for the navigation modal, so resolving `book_id` through
   * it costs nothing and gives the same name the header shows. Falls back to
   * the code if the metadata has not landed — a slightly wrong label beats an
   * empty bar.
   */
  const { data: books = [] } = useBibleTestaments(undefined, {});
  const bookName = useMemo(
    () => books.find((b) => b.id === track?.book_id)?.name ?? null,
    [books, track?.book_id]
  );

  /**
   * Routes the dock stays out of.
   *
   * The dock is deliberately mounted above the navigator so playback survives
   * screen changes (br-audio-011), and that is right for the reader, the hub
   * and settings — you keep listening while you move around. The Jesus feature
   * is the exception: it is its OWN reader, with its own passages on screen, so
   * a bar reading "JHN 19" pinned under a Luke 2 event is a second reading
   * context contradicting the first. Reported as "audio should disappear".
   *
   * Hidden, not stopped — closing the track would punish someone who only
   * wanted to look something up mid-chapter, and nothing in the report asked
   * for playback to end. It reappears on the way back out.
   */
  const pathname = usePathname();
  const onJesusRoute = pathname?.startsWith('/jesus') ?? false;

  if (!track || !player.dockVisible || onJesusRoute) return null;

  const progress =
    player.durationSeconds > 0 ? Math.min(1, player.elapsedSeconds / player.durationSeconds) : 0;

  const label = trackDisplayLabel(track);
  const isPlaying = state === 'playing';
  const isBuffering = state === 'loading';

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Audio player" style={styles.container}>
      {/* Progress as a hairline on the top edge, not a track inside the bar —
          it reads as the bar's own boundary rather than as another control. */}
      <View style={styles.progressTrack} testID="audio-dock-progress">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.row}>
        {/* Tapping anywhere that is not a control expands the player. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open full audio player. ${label.primary}, ${label.secondary}`}
          style={styles.body}
          onPress={() => player.openFullScreen()}
          testID="audio-dock-expand"
        >
          {/* The reference alone. The version name is in the expanded player,
              where there is room for it — "English Standard Version®" was long
              enough to eat this whole line. */}
          <Text style={styles.title} numberOfLines={1}>
            {bookName ? `${bookName} ${track.chapter_number}` : label.secondary}
          </Text>
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
          accessibilityLabel={`Playback speed ${formatSpeed(player.speed)}, tap to change`}
          accessibilityHint={`Cycles through ${SPEED_OPTIONS.map(formatSpeed).join(', ')}`}
          style={styles.speedButton}
          onPress={() => player.setSpeed(nextSpeed(player.speed))}
          testID="audio-dock-speed"
        >
          <Text style={styles.speedText}>{formatSpeed(player.speed)}</Text>
        </Pressable>
      </View>
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
      paddingBottom: safeAreaPadding,
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
    row: {
      height: BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    progressTrack: {
      height: 2,
      backgroundColor: colors.gray200,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.gold,
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
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
}
