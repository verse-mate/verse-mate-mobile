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
 * the DOM. Image taps open a full-screen lightbox modal that unlocks
 * orientation so wide visuals can be rotated to landscape. The
 * BibleProject video card uses an inline YouTube WebView so playback
 * happens in-place (added 2026-05-21 from Andy's TF feedback, replacing
 * the previous `Linking.openURL` → YouTube app handoff).
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
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';
import { getBookSlug } from '@/utils/bookSlugs';

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

  // Inline-playback state for the BibleProject video card. When false,
  // we show the original thumbnail + play-button pressable; when true,
  // we render a WebView with the YouTube embed URL so playback happens
  // in-place (Andy's TF feedback was that opening the YouTube app or
  // bibleproject.com/videos/<book>/ broke the reading flow).
  const [videoPlaying, setVideoPlaying] = useState(false);
  const handleVideoPress = useCallback(() => {
    if (!video) return;
    setVideoPlaying(true);
  }, [video]);
  // Reset playback state when the user navigates to a different chapter —
  // a new chapter may have a different (or no) video.
  useEffect(() => {
    setVideoPlaying(false);
  }, [bookId, chapter]);

  // Bug #8 — unlock orientation while the fullscreen lightbox is open so
  // Andy can rotate the device to landscape for wide visuals (Genesis
  // chart etc.). Re-lock to portrait when the lightbox closes or the
  // component unmounts so the rest of the app behaves as before.
  useEffect(() => {
    if (openCard) {
      ScreenOrientation.unlockAsync().catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [openCard]);

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
          BibleProject overview. Default state shows a thumbnail + play
          button; tapping swaps to an inline YouTube WebView so playback
          happens in-app (Andy's TF feedback). */}
      {video ? (
        videoPlaying ? (
          <View style={styles.videoCard} testID={`${testID}-video-player`}>
            <WebView
              source={{
                uri: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`,
              }}
              style={styles.videoWebView}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
            />
            <View style={styles.attributionBadge} pointerEvents="none">
              <Text style={styles.attributionBadgeText}>BibleProject · CC BY-SA 4.0</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handleVideoPress}
            style={styles.videoCard}
            accessibilityRole="button"
            accessibilityLabel={`Play the BibleProject ${bookName} overview video`}
            testID={`${testID}-video-card`}
          >
            {/* Thumbnail backdrop — use the first card's thumb (typically
                the BibleProject poster) as a tinted backdrop. */}
            {cards[0] ? (
              <Image
                source={{ uri: absolutizeVisualUrl(cards[0].thumb) }}
                style={styles.videoBackdrop}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <View style={styles.videoOverlay} />
            <View style={styles.videoOverlayContent}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={28} color="#1B1B1B" />
              </View>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {video.title}
              </Text>
              <Text style={styles.videoSubtitle}>BibleProject overview · animated explainer</Text>
              <Text style={styles.videoRange}>
                Covers chapters {video.chapterStart}–{video.chapterEnd}
              </Text>
            </View>
            <View style={styles.attributionBadge}>
              <Text style={styles.attributionBadgeText}>BibleProject · CC BY-SA 4.0</Text>
            </View>
          </Pressable>
        )
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
      >
        <Pressable style={styles.lightboxBackdrop} onPress={closeLightbox}>
          {openCard ? (
            <View
              style={styles.lightboxFrame}
              // Stop the backdrop press from triggering when the user
              // taps the image itself.
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.lightboxTopBar}>
                <Text style={styles.lightboxTitle} numberOfLines={2}>
                  {openCard.title}
                </Text>
                {openCard.download ? (
                  <Pressable
                    style={styles.lightboxDownload}
                    onPress={() => {
                      // Downloads point at PDFs or source URLs — open
                      // them in the system browser so the user can save.
                      if (openCard.download) {
                        Linking.openURL(absolutizeVisualUrl(openCard.download.href)).catch(
                          () => {}
                        );
                      }
                    }}
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
              </View>
              <Image
                source={{ uri: absolutizeVisualUrl(openCard.full) }}
                style={styles.lightboxImage}
                contentFit="contain"
                transition={150}
                accessibilityLabel={openCard.title}
              />
              <View style={styles.lightboxAttribution}>
                <Text style={styles.lightboxAttributionText} numberOfLines={1}>
                  {openCard.attribution.label}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>
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
    videoWebView: {
      flex: 1,
      backgroundColor: '#000',
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
