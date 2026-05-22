/**
 * LexiconPopover Component
 *
 * Bottom-sheet modal showing the chapter-aligned Greek/Hebrew lexical
 * card for a verse word. Mirrors verse-mate-web/src/components/LexiconPopover.tsx
 * structure (six sections + loaded caveat strip) and matches the UX of
 * verse-mate-mobile/components/bible/VerseMateTooltip.tsx — same slide-up
 * spring, backdrop fade, drag-handle, swipe-down-to-dismiss.
 *
 * Triggered by tap on a dotted-underlined word in the Bible reader.
 */

import type { AlignedToken, LexEntry } from '@versemate/lexicon';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, lineHeights, spacing } from '@/theme/tokens';

// Hebrew + Aramaic Unicode block — RTL render for `<Text>` containing
// these characters. Greek lemmas have no Hebrew chars so detection is
// unambiguous. Lemma slugs (transliterated Latin) never trigger RTL.
const HEBREW_RE = /[֐-׿]/;
const isHebrew = (text: string): boolean => HEBREW_RE.test(text);

export interface LexiconPopoverProps {
  visible: boolean;
  onClose: () => void;
  /** The English surface form the user tapped (e.g. "loved"). */
  surface: string;
  /** Lexicon entry for the matched lemma. */
  entry: LexEntry;
  /** Token data including optional per-verse contextual gloss. */
  token: AlignedToken;
  /** Whether this lemma is in the chapter's themeLemmas list. */
  isTheme?: boolean;
  testID?: string;
}

export function LexiconPopover({
  visible,
  onClose,
  surface: _surface,
  entry,
  token,
  isTheme: _isTheme,
  testID = 'lexicon-popover',
}: LexiconPopoverProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  // Backdrop fade stays on the old Animated API (no gesture coupling).
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Sheet position lives in a Reanimated SharedValue so the pan gesture
  // (which runs on the UI thread via react-native-gesture-handler) can
  // drive it without round-tripping to JS every frame.
  const translateY = useSharedValue(screenHeight);

  // ScrollView offset — used to gate the dismiss-pan to "only when
  // scrolled to top", same pattern @gorhom/bottom-sheet uses internally.
  const scrollOffset = useSharedValue(0);

  // Internal visibility flag so we can play the close animation before the
  // Modal actually unmounts. Toggled by the visible-prop watcher below.
  const internalVisibleRef = useRef(false);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Spring config that matches AutoHighlightTooltip (the verse-insight
  // modal) for a consistent feel across both bottom sheets.
  const SPRING_CONFIG = {
    damping: 20,
    stiffness: 90,
    overshootClamping: true,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 0.5,
  };

  const animateOpen = () => {
    internalVisibleRef.current = true;
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    translateY.value = withSpring(0, SPRING_CONFIG);
  };

  const animateClose = () => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    translateY.value = withSpring(screenHeight, SPRING_CONFIG);
    setTimeout(() => {
      internalVisibleRef.current = false;
    }, 250);
  };

  // Drive animations off the `visible` prop. Open on mount, close on
  // visible → false. The close path calls onClose synchronously so the
  // parent (ChapterReader) can clear its activeLexicon state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: animateOpen/animateClose/translateY/backdropOpacity/screenHeight are stable refs and closure-captured constants
  useEffect(() => {
    if (visible) {
      translateY.value = screenHeight;
      backdropOpacity.setValue(0);
      animateOpen();
    } else if (internalVisibleRef.current) {
      animateClose();
    }
  }, [visible]);

  // ── Drag-to-dismiss ────────────────────────────────────────────────
  // The standard "bottom sheet over a ScrollView" recipe from
  // react-native-gesture-handler:
  //
  //   • `scrollNativeGesture` represents the ScrollView's own native
  //     scroll handler — we acknowledge it explicitly so the pan can
  //     coexist with vertical scrolling.
  //   • `panGesture.activeOffsetY([3, Infinity])` activates the pan as
  //     soon as the finger moves DOWN 3px. Below that the ScrollView
  //     keeps its touches; above it the pan takes over with minimal
  //     visible jump.
  //   • Inside `onUpdate`, drag-translate is gated on `scrollOffset <= 0`
  //     so dragging down while mid-scroll just scrolls (the modal
  //     stays put). Once you're back at the top, drag-down dismisses
  //     from anywhere on the sheet.
  //
  // Gestures + animated styles are memoized so they're stable across
  // renders — recreating them every render causes RNGH to re-initialize
  // each frame, which on a 120Hz Android display reads as choppy drag.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollOffset/translateY are stable Reanimated SharedValue refs (their identity never changes across renders); closeRef.current is read inside the worklet via the local `close` closure; the empty-dep array is intentional so the gesture instance stays stable across renders.
  const { panGesture, scrollNativeGesture } = useMemo(() => {
    const close = () => closeRef.current();
    const scrollNative = Gesture.Native();
    const pan = Gesture.Pan()
      .activeOffsetY([3, Infinity])
      .simultaneousWithExternalGesture(scrollNative)
      .onUpdate((e) => {
        'worklet';
        if (scrollOffset.value <= 0 && e.translationY > 0) {
          translateY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (scrollOffset.value <= 0 && (e.translationY > 50 || e.velocityY > 800)) {
          runOnJS(close)();
        } else {
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
      });
    return { panGesture: pan, scrollNativeGesture: scrollNative };
  }, []);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const contextual = token.contextual;
  const lemmaIsHebrew = isHebrew(entry.lemma);

  return (
    <Modal
      visible={visible || internalVisibleRef.current}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* GestureHandlerRootView is REQUIRED inside RN's <Modal> for any
          react-native-gesture-handler gestures to fire — Modal creates a
          separate native window that the outer GestureHandlerRootView
          (in _layout.tsx) doesn't reach into. Same pattern is used by
          BibleNavigationModal. */}
      <GestureHandlerRootView style={styles.overlay}>
        <View style={styles.overlay} pointerEvents="box-none" testID={testID}>
          {/* Backdrop with fade */}
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents="auto"
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          </Animated.View>

          {/* Sliding sheet — the outer GestureDetector applies the
              drag-to-dismiss pan to the ENTIRE sheet (handle, header,
              AND the ScrollView body). The pan only activates after
              10px of downward motion (so taps and short scrolls pass
              through to the ScrollView), and drag-translate is gated
              on `scrollOffset <= 0` so it doesn't interfere mid-scroll. */}
          <GestureDetector gesture={panGesture}>
            <Reanimated.View style={[styles.sheet, sheetAnimatedStyle]} pointerEvents="auto">
              <View style={styles.dragArea}>
                <View style={styles.handle} />
              </View>

              {/* HEADER */}
              <View style={styles.header} testID={`${testID}-header`}>
                <View style={styles.headerRow}>
                  <Text
                    style={[styles.lemma, lemmaIsHebrew && styles.lemmaRtl]}
                    accessibilityRole="header"
                  >
                    {entry.lemma}
                  </Text>
                  <Text style={styles.translit}>{entry.translit}</Text>
                </View>
                <Text style={styles.metaLine}>
                  {entry.pos} • {entry.strongs}
                  {entry.pronunciation ? ` • ${entry.pronunciation}` : ''}
                  {typeof entry.otFrequency === 'number' && entry.otFrequency > 0
                    ? ` • ${entry.otFrequency}× in OT`
                    : ''}
                  {typeof entry.ntFrequency === 'number' && entry.ntFrequency > 0
                    ? ` • ${entry.ntFrequency}× in NT`
                    : ''}
                </Text>
              </View>

              <GestureDetector gesture={scrollNativeGesture}>
                <Reanimated.ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                >
                  {/* IN THIS VERSE (Layer 2 — contextual gloss) */}
                  {contextual ? (
                    <Section
                      label="In this verse"
                      highlight
                      styles={styles}
                      testID={`${testID}-contextual`}
                    >
                      <Text style={styles.bodyText}>{contextual}</Text>
                    </Section>
                  ) : null}

                  {/* BASIC SENSE */}
                  <Section label="Basic sense" styles={styles} testID={`${testID}-basic`}>
                    <Text style={styles.bodyText}>{entry.basicGloss}</Text>
                  </Section>

                  {/* SEMANTIC RANGE */}
                  {entry.semanticRange && entry.semanticRange.length > 0 ? (
                    <Section label="Semantic range" styles={styles} testID={`${testID}-range`}>
                      <View style={styles.listWrap}>
                        {entry.semanticRange.map((s) => (
                          <View key={s} style={styles.listRow}>
                            <Text style={styles.listBullet}>•</Text>
                            <Text style={styles.listText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    </Section>
                  ) : null}

                  {/* RELATED WORDS */}
                  {entry.related && entry.related.length > 0 ? (
                    <Section label="Related" styles={styles} testID={`${testID}-related`}>
                      <View style={styles.relatedWrap}>
                        {entry.related.map((r, i) => {
                          const rIsHebrew = isHebrew(r.lemma);
                          return (
                            <View key={`${r.lemma}-${i}`} style={styles.relatedItem}>
                              <View style={styles.relatedHeadRow}>
                                <Text style={[styles.relatedLemma, rIsHebrew && styles.lemmaRtl]}>
                                  {r.lemma}
                                </Text>
                                <Text style={styles.relatedTranslit}>{r.translit}</Text>
                              </View>
                              <Text style={styles.relatedNote}>{r.note}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </Section>
                  ) : null}

                  {/* LEXICAL NOTE */}
                  {entry.notes ? (
                    <Section label="Lexical note" styles={styles} testID={`${testID}-notes`}>
                      <Text style={styles.notesText}>{entry.notes}</Text>
                    </Section>
                  ) : null}

                  {/* LOADED CAVEAT — no border, last row */}
                  {entry.loaded ? (
                    <View style={styles.caveatBlock} testID={`${testID}-loaded`}>
                      <Text style={styles.caveatText}>
                        Context-sensitive: this word carries multiple senses across the NT. Meaning
                        is governed by usage, not a single gloss.
                      </Text>
                    </View>
                  ) : null}
                </Reanimated.ScrollView>
              </GestureDetector>
            </Reanimated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Section primitive ──────────────────────────────────────────────────

interface SectionProps {
  label: string;
  highlight?: boolean;
  styles: ReturnType<typeof createStyles>;
  testID: string;
  children: React.ReactNode;
}

function Section({ label, highlight, styles, testID, children }: SectionProps) {
  return (
    <View style={[styles.section, highlight ? styles.sectionHighlight : null]} testID={testID}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const createStyles = (
  colors: ReturnType<typeof getColors>,
  insets: { bottom: number; top: number; left: number; right: number }
) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '85%',
      paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md,
    },

    // Drag area + handle — the visual notch is the obvious affordance, so
    // we keep the touch target generous (lg/md padding) and bump the notch
    // to 48×5 so it reads as "grab here" from arm's length. The whole
    // sheet is draggable too via the RNGH pan, but Andy 2026-05-22
    // signalled most users still aim for the notch — so make THAT a
    // forgiving target.
    dragArea: {
      alignItems: 'center',
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    handle: {
      width: 48,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.gray100,
    },

    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingBottom: spacing.md,
    },

    // Header
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    lemma: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    lemmaRtl: {
      writingDirection: 'rtl',
    },
    translit: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
    metaLine: {
      marginTop: spacing.xs,
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
    },

    // Section
    section: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
    },
    sectionHighlight: {
      backgroundColor: colors.backgroundElevated,
    },
    sectionLabel: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    bodyText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Semantic range list
    listWrap: {
      gap: spacing.xs,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    listBullet: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },
    listText: {
      flex: 1,
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Related
    relatedWrap: {
      gap: spacing.sm,
    },
    relatedItem: {
      gap: 2,
    },
    relatedHeadRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    relatedLemma: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    relatedTranslit: {
      fontSize: fontSizes.caption,
      color: colors.gold,
    },
    relatedNote: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      lineHeight: fontSizes.caption * lineHeights.body,
    },

    // Notes
    notesText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textPrimary,
      lineHeight: fontSizes.bodySmall * lineHeights.body,
    },

    // Caveat (loaded)
    caveatBlock: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    caveatText: {
      fontSize: fontSizes.caption,
      fontStyle: 'italic',
      color: colors.textSecondary,
      lineHeight: fontSizes.caption * lineHeights.body,
    },
  });
