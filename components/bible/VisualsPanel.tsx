/**
 * VisualsPanel Component
 *
 * Renders the curated per-book visual aids — BibleProject Read Scripture
 * poster, BibleProject animated overview video (chapter-aware), Precept
 * Austin commentary charts (book- and chapter-scoped), Insight for
 * Living's Swindoll structural chart, and any VerseMate originals.
 *
 * Data is bundled via the @versemate/visuals package — no API fetch, no
 * loading state, no offline concerns (image URLs still need network for
 * the actual bitmaps, but the manifest itself is in-bundle). Returns an
 * empty-state when the book has no curated visuals.
 *
 * Mirrors the web app's VisualsPanel.tsx — same content, ported to React
 * Native primitives (View / Text / StyleSheet / expo-image) instead of
 * the DOM. Image taps open a full-screen lightbox modal whose chrome
 * respects safe-area insets, supports pinch/double-tap zoom + pan via
 * react-native-gesture-handler, and auto-hides the top/bottom bars after
 * 3s of inactivity. The BibleProject video card swaps its thumbnail for
 * an inline `react-native-youtube-iframe` player so playback stays inside
 * verse-mate rather than handing off to the YouTube app. The raw
 * `youtube.com/embed` and `youtube-nocookie.com/embed` URLs both return
 * Error 153 for the BibleProject channel; the IFrame Player API
 * (negotiated via the iframe-player host page that lonelycpp's library
 * wraps) is the only embed surface that survives the channel-level
 * embed restriction. When YouTube still refuses (e.g. age-gated content
 * in the future) `onError` falls back to opening the watch URL.
 *
 * The whole Visuals tab unlocks ScreenOrientation on mount so users can
 * rotate to landscape for wide diagrams — not just inside the lightbox.
 */

import { Ionicons } from '@expo/vector-icons';
import {
  absolutizeVisualUrl,
  BOOKS_WITH_VISUALS,
  getCardsForChapter,
  getVideoForChapter,
  getVisualsForBook,
  type VideoEntry,
  type VisualCard,
} from '@versemate/visuals';
// `expo-file-system/legacy` exposes the classic file API (`downloadAsync`,
// `cacheDirectory`). The non-legacy module's top-level `downloadAsync` is
// flagged `@deprecated` and throws at runtime, so importing from `/legacy`
// is the supported path for this workflow until the project migrates to
// the new `File.downloadFileAsync` API end-to-end.
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  Pressable,
  Image as RNImage,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';
import { getBookSlug } from '@/utils/bookSlugs';

// expo-image's `Image` is fine for static use, but it does not always
// compose cleanly with reanimated's `useAnimatedStyle` (the prop merge
// path differs between SDKs). Use RN's `Animated.Image` wrapped with
// reanimated's createAnimatedComponent against the RN `Image`, which is
// well-supported. The visual result is identical for our PNG/JPEG
// visuals — expo-image's blurhash/disk cache wins don't apply once the
// image is in the lightbox.
const AnimatedImage = Reanimated.createAnimatedComponent(RNImage);

// How long the lightbox chrome (top bar + attribution) stays visible
// after the user interacts before fading away.
const CHROME_AUTO_HIDE_MS = 3000;

export interface VisualsPanelProps {
  /** Book ID (1-66). */
  bookId: number;
  /** Chapter number (1-based). */
  chapter: number;
  /** Display name ("Genesis", "Song of Solomon") — used in card titles
   *  and the empty-state copy. */
  bookName: string;
  testID?: string;
}

/**
 * Tab-visibility helper. Use from `ChapterContentTabs.tsx` /
 * `BibleExplanationsPanel.tsx` to decide whether to render the Visuals
 * tab at all for a given book. Re-exported from the data package; this
 * indirection keeps consumers from reaching past `components/bible/`.
 */
export function bookHasVisuals(bookId: number): boolean {
  const slug = getBookSlug(bookId);
  return !!slug && BOOKS_WITH_VISUALS.has(slug);
}

export function VisualsPanel({
  bookId,
  chapter,
  bookName,
  testID = 'visuals-panel',
}: VisualsPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const slug = getBookSlug(bookId);
  const manifest = useMemo(() => (slug ? getVisualsForBook(slug) : null), [slug]);
  const cards: VisualCard[] = useMemo(
    () => getCardsForChapter(manifest, chapter),
    [manifest, chapter]
  );
  const video: VideoEntry | null = useMemo(
    () => getVideoForChapter(manifest, chapter),
    [manifest, chapter]
  );

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const openCard = cards.find((c) => c.id === openCardId) ?? null;
  const closeLightbox = useCallback(() => setOpenCardId(null), []);

  // ─── Bug #3 — actually download the PDF instead of handing the URL to
  // the system browser. The previous `Linking.openURL` flow opened the
  // PDF in-browser, which on iOS would route through Safari and on
  // Android through Chrome — neither saves the file locally, and on
  // return-to-app it can leave the Modal in a stale state that bug #2
  // reproduces from. We download to the cache directory and hand the
  // local file URI to expo-sharing so the user gets the proper
  // "Save to Files / Save to Drive / Print" sheet.
  //
  // The lightbox is closed BEFORE invoking the share sheet because
  // presenting a system UIActivityViewController/ChooserActivity from
  // inside an open RN `Modal` is the exact stack-up that bug #2's crash
  // reproduces from. Closing first → small delay → share is the
  // documented safe pattern for expo-sharing on iOS.
  const handlePdfDownload = useCallback(async () => {
    if (!openCard?.download) return;
    const url = absolutizeVisualUrl(openCard.download.href);
    // The visual card download object only carries { label, href }, so
    // derive a filename from the URL path. Fall back to a generic name
    // if the URL has no useful trailing segment (shouldn't happen for
    // any of today's PDFs but keeps the type narrow).
    const filename = url.split('/').pop()?.split('?')[0] || 'visual.pdf';
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    try {
      const { uri } = await FileSystem.downloadAsync(url, dest);
      // Close the lightbox before presenting the share sheet — see
      // comment above for the bug #2 interaction.
      closeLightbox();
      setTimeout(async () => {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
          } else {
            // Last-resort fallback: hand the local file URI to the OS.
            Linking.openURL(uri).catch(() => {});
          }
        } catch (shareErr) {
          console.warn('[VisualsPanel] PDF share failed', shareErr);
        }
      }, 250);
    } catch (e) {
      console.warn('[VisualsPanel] PDF download failed', e);
    }
  }, [openCard, closeLightbox]);

  // Inline-playback state for the BibleProject video card. Playback stays
  // in-app via `react-native-youtube-iframe` (YouTube IFrame Player API)
  // instead of handing off to the YouTube app. When YouTube hard-refuses
  // the embed (channel-level block, age gate, etc.) `onError` flips
  // `videoError = true` and we surface an "Open in YouTube" fallback.
  //
  // No in-app play overlay: `YoutubePlayer` mounts directly with its own
  // play button as the first interaction so playback starts on a single
  // tap of YouTube's button.
  const [videoError, setVideoError] = useState(false);
  // Reset playback state on chapter change — a new chapter may have a
  // different (or no) video.
  useEffect(() => {
    setVideoError(false);
  }, [bookId, chapter]);

  // The whole Visuals tab is landscape-capable, not just the lightbox
  // modal — wide diagrams (Genesis poster) are easier to read rotated.
  // Unlock at mount and re-lock to portrait at unmount so other tabs /
  // screens stay portrait. One mount/unmount effect (vs per-`openCard`)
  // avoids rapid lock/unlock churn that previously crashed on background
  // → resume of the PDF flow.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // ─── Bug #8 — pinch/zoom + pan SharedValues for the lightbox image ───
  // Held at module-scope-equivalent (component scope) so the same animated
  // style is reused across re-renders without re-creating the gesture.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ─── Bug #8 part 2 — chrome auto-hide ────────────────────────────────
  // RN Animated.Value for opacity so we can drive both bars from one
  // value. Could be a SharedValue too, but RN Animated.timing is
  // sufficient and avoids mixing animation libraries on the same node.
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const chromeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showChrome = useCallback(() => {
    Animated.timing(chromeOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    if (chromeTimeoutRef.current) {
      clearTimeout(chromeTimeoutRef.current);
    }
    chromeTimeoutRef.current = setTimeout(() => {
      Animated.timing(chromeOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }, CHROME_AUTO_HIDE_MS);
  }, [chromeOpacity]);

  // Reset zoom + chrome whenever the lightbox opens (or switches cards).
  // Closing the lightbox also clears any pending hide-timer.
  useEffect(() => {
    if (openCard) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      showChrome();
    } else {
      if (chromeTimeoutRef.current) {
        clearTimeout(chromeTimeoutRef.current);
        chromeTimeoutRef.current = null;
      }
      // Snap chrome back to visible so the next open starts fresh; the
      // open-effect above will kick off another auto-hide cycle.
      chromeOpacity.setValue(1);
    }
    return () => {
      if (chromeTimeoutRef.current) {
        clearTimeout(chromeTimeoutRef.current);
        chromeTimeoutRef.current = null;
      }
    };
  }, [
    openCard,
    showChrome,
    chromeOpacity,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
  ]);

  // ─── Gestures ────────────────────────────────────────────────────────
  // Min/max zoom — 1 = fit, 6 = "I want to read this tiny label" deep
  // zoom. Reanimated worklets run on the UI thread, so the clamp must be
  // expressed inline (no JS-side Math.min closure).
  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // If the user pinched back to ~1, snap translations to 0 too so the
      // next double-tap re-zooms from center.
      if (scale.value <= MIN_SCALE + 0.01) {
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan only meaningfully applies once zoomed in — at scale 1 a
  // vertical swipe should still feel "calm" and not move the image.
  // Gesture.Enabled toggling would require imperative work; instead we
  // gate the update inside onUpdate so the gesture is always recognized
  // but is a no-op at scale 1. Translation is clamped so the image edge
  // can't be dragged fully off-screen.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return;
      // Allow movement up to (scale - 1) * half-viewport in each axis.
      // We don't know the exact image dimensions on the worklet thread,
      // so we use a generous viewport-derived bound — the user can still
      // see edges, just not fling the image into the void.
      const maxOffset = (scale.value - 1) * 400; // ~half a 800px-tall viewport
      const nextX = savedTranslateX.value + e.translationX;
      const nextY = savedTranslateY.value + e.translationY;
      translateX.value = Math.min(Math.max(nextX, -maxOffset), maxOffset);
      translateY.value = Math.min(Math.max(nextY, -maxOffset), maxOffset);
    });

  // Double-tap: toggle between fit (1) and a meaningful zoom (2.5).
  // We use withTiming for the snap so the user perceives the zoom rather
  // than seeing an instant jump.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > MIN_SCALE + 0.01) {
        scale.value = withTiming(1, { duration: 220 });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5, { duration: 220 });
        savedScale.value = 2.5;
      }
    });

  // Single tap: toggle chrome. Must be made Exclusive with the double-tap
  // so the single doesn't fire while RNGH is still deciding if a second
  // tap is incoming.
  //
  // **runOnJS is mandatory here.** RNGH v2 gesture callbacks run on the
  // UI worklet thread whenever `react-native-reanimated` is present in
  // the project (which it is — useAnimatedStyle/useSharedValue above
  // pull it in). Calling `showChrome` directly from the worklet triggers
  // SIGABRT in Hermes because `Animated.timing` is a JS function that
  // can't run on the worklet thread. `runOnJS` bridges back safely.
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(showChrome)();
    });

  const composedGesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // YouTube playback uses `react-native-youtube-iframe` (see Task 1) —
  // no manual embed URL needed here. The library negotiates the IFrame
  // Player API behind the scenes and exposes `onChangeState` / `onError`
  // for status. When the channel hard-blocks the embed, `onError` flips
  // `videoError` and we render an "Open in YouTube" fallback.
  const youtubeWatchUrl = video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : null;
  const handleVideoFallback = useCallback(() => {
    if (!youtubeWatchUrl) return;
    Linking.openURL(youtubeWatchUrl).catch(() => {});
  }, [youtubeWatchUrl]);

  // The youtube-iframe player needs an explicit `height`. The video card
  // itself is `aspectRatio: 16/9`, but RN measures children by absolute
  // height — pull it from screen width. A fixed 220 is a safe minimum
  // (matches a ~390pt iPhone width); the WebView inside will fit-to-
  // container with `width: '100%'` automatically.
  const videoPlayerHeight = 220;

  if (!manifest) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyTitle}>
          Visuals for {bookName} {chapter}
        </Text>
        <Text style={styles.emptyText}>No curated visuals for this book yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Title — mirrors the web header. Copy/share live on the parent
          chrome (ShareButton) on mobile, so we don't duplicate them here. */}
      <Text style={styles.title} testID={`${testID}-title`} accessibilityRole="header">
        Visuals for {bookName} {chapter}
      </Text>

      {/* Video card — only rendered when this chapter is covered by a
          BibleProject overview. Tapping the thumbnail swaps it for an
          inline `react-native-youtube-iframe` player, so playback stays
          inside verse-mate rather than handing off to the YouTube app.
          If YouTube refuses the embed (channel block / age gate /
          country restriction) the `onError` handler trips and we render
          an "Open in YouTube" fallback button. The "×" overlay returns
          to the thumbnail in either case. */}
      {video ? (
        <View style={styles.videoCard} testID={`${testID}-video-card`}>
          {videoError ? (
            <View style={styles.videoErrorOverlay}>
              <Ionicons name="alert-circle-outline" size={32} color="#FAF6EA" />
              <Text style={styles.videoErrorTitle}>Video can&apos;t play in-app</Text>
              <Pressable
                onPress={handleVideoFallback}
                style={styles.videoErrorButton}
                accessibilityRole="button"
                accessibilityLabel="Open video in YouTube"
                testID={`${testID}-video-open-external`}
              >
                <Text style={styles.videoErrorButtonText}>Open in YouTube</Text>
              </Pressable>
            </View>
          ) : (
            // YoutubePlayer mounts directly with `play={false}` so the
            // first tap on YouTube's own iframe play button starts
            // playback. We don't render our own thumbnail+play overlay
            // because that would require a second tap to start.
            <YoutubePlayer
              videoId={video.youtubeId}
              height={videoPlayerHeight}
              play={false}
              webViewStyle={styles.videoWebView}
              viewContainerStyle={StyleSheet.absoluteFillObject}
              onChangeState={(state: string) => {
                if (__DEV__) {
                  console.debug('[VisualsPanel] yt state:', state);
                }
              }}
              onError={(err: string) => {
                console.warn('[VisualsPanel] yt embed error:', err);
                setVideoError(true);
              }}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
                androidLayerType: 'hardware',
              }}
            />
          )}
        </View>
      ) : null}

      {/* Image grid — two columns. Mobile bandwidth is precious, so the
          card uses the `thumb` URL (typically identical to `full` for us
          today, but kept distinct in the registry for future-proofing). */}
      <View style={styles.grid}>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => setOpenCardId(card.id)}
            style={styles.cardWrapper}
            accessibilityRole="button"
            accessibilityLabel={`Expand ${card.title}`}
            testID={`${testID}-card-${card.id}`}
          >
            <View style={styles.cardThumbBox}>
              <Image
                source={{ uri: absolutizeVisualUrl(card.thumb) }}
                style={styles.cardThumb}
                contentFit="contain"
                transition={150}
                accessibilityLabel={card.title}
              />
              <View style={styles.cardAttributionBadge}>
                <Text style={styles.cardAttributionText} numberOfLines={1}>
                  {card.attribution.label}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {card.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Catch-all CC BY-SA credit — the per-card attribution badge
          handles the specific source. */}
      <Text style={styles.credits}>
        Credits: BibleProject (CC BY-SA 4.0) · Insight for Living · VerseMate originals
      </Text>

      {/* === Image lightbox === */}
      <Modal
        visible={openCard !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLightbox}
        statusBarTranslucent
        // iOS-only: without this, the Modal defaults its
        // UISupportedInterfaceOrientations to portrait, which overrides the
        // app-level Info.plist declaration and snaps the device back to
        // portrait when the lightbox opens — even when the Visuals tab
        // was already rotated to landscape. Allowing both lets the user
        // keep landscape on tap-to-open (Andy iOS-only repro 2026-05-22).
        supportedOrientations={['portrait', 'landscape']}
      >
        {/* GestureHandlerRootView is REQUIRED inside RN's <Modal> for any
            react-native-gesture-handler gestures to fire — Modal creates
            a separate native window the app-level root doesn't reach
            into. Without this, pinch/double-tap/single-tap all silently
            fail and a multi-touch pinch falls through to the backdrop
            Pressable, closing the lightbox. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable style={styles.lightboxBackdrop} onPress={closeLightbox}>
            {openCard ? (
              <View
                style={styles.lightboxFrame}
                // Stop the backdrop press from triggering when the user
                // taps the image itself.
                onStartShouldSetResponder={() => true}
              >
                <Animated.View
                  style={[styles.lightboxTopBar, { opacity: chromeOpacity }]}
                  // When the bars are faded out we don't want to swallow
                  // touches — let them pass through to the image so the
                  // user can keep panning/zooming. `pointerEvents` is
                  // driven off the same Animated.Value via interpolate.
                  pointerEvents="box-none"
                >
                  <Text style={styles.lightboxTitle} numberOfLines={2}>
                    {openCard.title}
                  </Text>
                  {openCard.download ? (
                    <Pressable
                      style={styles.lightboxDownload}
                      onPress={handlePdfDownload}
                      accessibilityRole="button"
                      accessibilityLabel="Download original"
                      testID={`${testID}-lightbox-download`}
                    >
                      <Text style={styles.lightboxDownloadText}>PDF ↓</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.lightboxClose}
                    onPress={closeLightbox}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    testID={`${testID}-lightbox-close`}
                    hitSlop={12}
                  >
                    <Ionicons name="close" size={22} color="#FAF6EA" />
                  </Pressable>
                </Animated.View>
                <GestureDetector gesture={composedGesture}>
                  <AnimatedImage
                    source={{ uri: absolutizeVisualUrl(openCard.full) }}
                    // resizeMode="contain" matches expo-image's
                    // contentFit="contain". `style` carries the transform
                    // from useAnimatedStyle.
                    resizeMode="contain"
                    style={[styles.lightboxImage, animatedImageStyle]}
                    accessibilityLabel={openCard.title}
                  />
                </GestureDetector>
                <Animated.View
                  style={[styles.lightboxAttribution, { opacity: chromeOpacity }]}
                  pointerEvents="box-none"
                >
                  <Text style={styles.lightboxAttributionText} numberOfLines={1}>
                    {openCard.attribution.label}
                  </Text>
                </Animated.View>
              </View>
            ) : null}
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const createStyles = (
  colors: ReturnType<typeof getColors>,
  insets: { bottom: number; top: number; left: number; right: number }
) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    emptyContainer: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    title: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },

    // ─── Video card ─────────────────────────────────────────────────────
    videoCard: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.gray100,
    },
    videoBackdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.55,
    },
    videoOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    videoOverlayContent: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
    },
    playButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      // 2px nudge so the triangle is optically centered.
      paddingLeft: 4,
    },
    videoTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: '#FAF6EA',
      textAlign: 'center',
      marginBottom: 2,
    },
    videoSubtitle: {
      fontSize: fontSizes.bodySmall,
      color: 'rgba(250,246,234,0.85)',
      textAlign: 'center',
    },
    videoRange: {
      fontSize: fontSizes.caption,
      color: 'rgba(250,246,234,0.75)',
      textAlign: 'center',
      marginTop: 2,
    },
    attributionBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    videoWebView: {
      flex: 1,
      backgroundColor: '#000',
    },
    videoCloseButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.65)',
      zIndex: 2,
    },
    videoErrorOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1B1B1B',
      padding: spacing.md,
    },
    videoErrorTitle: {
      marginTop: spacing.sm,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FAF6EA',
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    videoErrorButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 6,
      backgroundColor: colors.gold,
    },
    videoErrorButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#1B1B1B',
    },
    attributionBadgeText: {
      fontSize: 10,
      color: 'rgba(250,246,234,0.9)',
      fontWeight: fontWeights.semibold,
      letterSpacing: 0.2,
    },

    // ─── Image grid ─────────────────────────────────────────────────────
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // -spacing/2 so the outer container hugs the panel edge while
      // each card still has spacing/2 of horizontal breathing room.
      marginHorizontal: -spacing.xs,
    },
    cardWrapper: {
      width: '50%',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.md,
    },
    cardThumbBox: {
      position: 'relative',
      aspectRatio: 16 / 9,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.gray100,
      overflow: 'hidden',
    },
    cardThumb: {
      width: '100%',
      height: '100%',
    },
    cardAttributionBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      maxWidth: '70%',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    cardAttributionText: {
      fontSize: 10,
      fontWeight: fontWeights.semibold,
      color: 'rgba(250,246,234,0.9)',
      letterSpacing: 0.2,
    },
    cardTitle: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      lineHeight: fontSizes.caption * lineHeights.body,
      marginTop: spacing.xs,
    },

    credits: {
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      fontSize: 10.5,
      color: colors.textSecondary,
      opacity: 0.75,
    },

    // ─── Lightbox ───────────────────────────────────────────────────────
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: '#0a0a0a',
      // The image fills the viewport; chrome floats on top.
    },
    lightboxFrame: {
      flex: 1,
      position: 'relative',
    },
    lightboxTopBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'center',
      // Top padding must clear the status bar / notch on every device. The
      // Modal is `statusBarTranslucent` so the system bar overlays our chrome
      // unless we account for it ourselves.
      paddingTop: Math.max(insets.top, spacing.md) + spacing.xs,
      paddingLeft: Math.max(insets.left, spacing.md),
      paddingRight: Math.max(insets.right, spacing.md),
      paddingBottom: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    lightboxTitle: {
      flex: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: '#FAF6EA',
      marginRight: spacing.md,
    },
    lightboxDownload: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: 'rgba(0,0,0,0.55)',
      marginRight: spacing.sm,
    },
    lightboxDownloadText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: '#FAF6EA',
    },
    lightboxClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    lightboxImage: {
      flex: 1,
      width: '100%',
      backgroundColor: '#0a0a0a',
    },
    lightboxAttribution: {
      position: 'absolute',
      bottom: spacing.lg,
      left: spacing.md,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    lightboxAttributionText: {
      fontSize: 10,
      color: 'rgba(250,246,234,0.85)',
      fontWeight: fontWeights.semibold,
    },
  });
