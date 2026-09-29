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
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextSpeed, SPEED_OPTIONS } from '@/components/bible/AudioInlineEntry';
import { trackDisplayLabel, useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useBottomBarInset } from '@/contexts/BottomBarInsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleTestaments } from '@/src/api';

/** The bar's own height, before the safe-area inset. Tester asked for ~56–64. */
const BAR_HEIGHT = 56;

/** How far (dp) or how fast a downward drag must go to dismiss the bar. */
const DISMISS_DISTANCE = 40;
const DISMISS_VELOCITY = 0.5;

/** Whether a released drag is a dismissal: far enough, or flicked fast enough, downward. */
export function isDismissDrag(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
}

/** Whether a move is ours to claim: clearly vertical and downward, so taps still land. */
export function claimsDrag(dx: number, dy: number): boolean {
  return dy > 8 && Math.abs(dy) > Math.abs(dx);
}

/**
 * Screens the dock stays out of. Playback PAUSES there (see below).
 *
 * - `/jesus`: its own reader, with its own passages on screen.
 * - Settings and the pages opened from it: "the audio bottom prob shouldn't
 *   transfer over to settings" (Andy, build 119) — it sat over the bottom of
 *   the page, and a settings screen is not somewhere you are listening.
 */
const HIDDEN_ROUTE_PREFIXES = ['/jesus', '/settings', '/manage-downloads', '/widget-info'];

export function dockHiddenOn(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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
   * screen changes (br-audio-011), and that is right for the reader and the
   * hub — you keep listening while you move around. `HIDDEN_ROUTE_PREFIXES`
   * lists the exceptions: the Jesus feature (its OWN reader — a bar reading
   * "JHN 19" pinned under a Luke 2 event contradicts it) and settings.
   *
   * Paused, not stopped. Audio playing on with no control on screen was the
   * wrong half of "hidden": you could not pause it from where you were. So
   * entering one of these screens pauses playback and keeps the track; back
   * in the reader the bar is there again, paused where it left off, one tap
   * from resuming. Ending the track entirely is the swipe-down, below.
   */
  const pathname = usePathname();
  const hiddenHere = dockHiddenOn(pathname);
  const pauseRef = useRef(player.pause);
  pauseRef.current = player.pause;
  const isPlayingNow = state === 'playing' || state === 'loading';
  useEffect(() => {
    if (hiddenHere && isPlayingNow) void pauseRef.current();
  }, [hiddenHere, isPlayingNow]);

  /**
   * Swipe down to dismiss — stops playback and removes the bar.
   *
   * "No way to swipe it away to make it disappear (even on bible page)" /
   * "swipe down to eliminate". Until now the only way out was the full player.
   * Claimed only on a clearly vertical downward drag, so a tap still reaches
   * play, speed and expand; a short or sideways drag springs back.
   */
  const dragY = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(player.close);
  closeRef.current = player.close;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => claimsDrag(g.dx, g.dy),
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (isDismissDrag(g.dy, g.vy)) {
            Animated.timing(dragY, {
              toValue: BAR_HEIGHT * 3,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              void closeRef.current();
              dragY.setValue(0);
            });
          } else {
            Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dragY]
  );

  if (!track || !player.dockVisible || hiddenHere) return null;

  const progress =
    player.durationSeconds > 0 ? Math.min(1, player.elapsedSeconds / player.durationSeconds) : 0;

  const label = trackDisplayLabel(track);
  const isPlaying = state === 'playing';
  const isBuffering = state === 'loading';

  return (
    <Animated.View
      accessibilityRole="toolbar"
      accessibilityLabel="Audio player"
      accessibilityHint="Swipe down to stop and close the player"
      style={[styles.container, { transform: [{ translateY: dragY }] }]}
      testID="audio-dock"
      {...panResponder.panHandlers}
    >
      {/* Progress as a hairline on the top edge, not a track inside the bar —
          it reads as the bar's own boundary rather than as another control. */}
      <View style={styles.progressTrack} testID="audio-dock-progress">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/*
        Three columns of EQUAL width, so play sits on the true centre line of
        the bar rather than wherever the reference happens to end. Asked for as
        "let's just put play in middle" — speed deliberately stays on the right,
        which is the half of that question the tester answered explicitly.
      */}
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

        <View style={styles.centreSlot}>
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
        </View>

        <View style={styles.endSlot}>
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
    </Animated.View>
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
      // Clear of the home indicator AND the screen's bottom curve: the safe
      // area alone still left the controls sitting on the curve on a phone
      // with rounded corners ("raise up a bit so it's not on the curve of
      // phones"). The extra only applies where there IS a curve — a device
      // reporting no bottom inset is flat-edged and needs none.
      paddingBottom: safeAreaPadding > 0 ? safeAreaPadding + 8 : 8,
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
      paddingHorizontal: 12,
    },
    // Equal thirds: the play button lands on the bar's centre line no matter
    // how long the reference is.
    body: {
      flex: 1,
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
    centreSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    endSlot: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
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
