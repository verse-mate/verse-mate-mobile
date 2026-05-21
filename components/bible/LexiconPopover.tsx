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
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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

  // Reanimated SharedValues — single sheet-position SV so the open/close
  // animations AND the pan gesture all drive the same translateY. The pan
  // gesture sets translateY directly during drag; on release it either
  // springs back to 0 or animates out to screenHeight and fires onClose.
  const sheetTranslateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  // scrollY mirrored as a SharedValue so the worklet-based pan gesture can
  // read the latest scroll offset without crossing the JS<->UI boundary.
  // Updated from the ScrollView's onScroll via the UI thread (cheap).
  const scrollY = useSharedValue(0);

  // Internal visibility flag so we can play the close animation before the
  // Modal actually unmounts. Toggled by the visible-prop watcher below.
  const internalVisibleRef = useRef(false);

  // closeRef so gesture callbacks always see the latest onClose prop without
  // re-binding the gesture (Gesture.Pan is rebuilt each render, but a ref is
  // still safer for the runOnJS call site).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  const triggerClose = () => {
    closeRef.current();
  };

  const animateOpen = () => {
    internalVisibleRef.current = true;
    backdropOpacity.value = withTiming(1, { duration: 200 });
    sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
  };

  const animateClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    sheetTranslateY.value = withSpring(screenHeight, {
      damping: 20,
      stiffness: 90,
      overshootClamping: true,
    });
    setTimeout(() => {
      internalVisibleRef.current = false;
    }, 150);
  };

  // Drive animations off the `visible` prop. Open on mount, close on
  // visible → false. The close path calls onClose synchronously so the
  // parent (ChapterReader) can clear its activeLexicon state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: animateOpen/animateClose/sheetTranslateY/backdropOpacity/screenHeight are stable refs and closure-captured constants
  useEffect(() => {
    if (visible) {
      sheetTranslateY.value = screenHeight;
      backdropOpacity.value = 0;
      animateOpen();
    } else if (internalVisibleRef.current) {
      animateClose();
    }
  }, [visible]);

  // ─── Gesture composition ─────────────────────────────────────────────
  //
  // Problem we're solving: when the user swipes down inside the ScrollView
  // body, the ScrollView's native gesture grabs the touch first and the
  // outer PanResponder never fires. RNGH v2 fixes this with
  // `Gesture.Native()` (the ScrollView's native pan, represented as an RNGH
  // gesture) composed with our Pan via `simultaneousWithExternalGesture`.
  // Both gestures activate together; our Pan only translates the sheet
  // when scroll is at the top + drag direction is downward, so normal
  // scrolling still works.
  //
  // Activation thresholds (worklet-side):
  //   dy > 5 AND |dy| > |dx| * 1.2 AND scrollY <= 0 → drag the sheet
  // Release thresholds:
  //   dy > 100 OR velocityY > 600 → dismiss
  //   otherwise → spring back to 0
  //
  // The handle (4×40 grey pill at the very top) gets its OWN Pan gesture
  // without the scrollY check so the user can always grab it to dismiss.

  const scrollNativeGesture = Gesture.Native();

  const bodyPanGesture = Gesture.Pan()
    .activeOffsetY(5)
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0 && scrollY.value <= 0) {
        sheetTranslateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 100 || e.velocityY > 600) {
        sheetTranslateY.value = withSpring(screenHeight, {
          damping: 20,
          stiffness: 90,
          overshootClamping: true,
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(triggerClose)();
      } else {
        sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
      }
    })
    .simultaneousWithExternalGesture(scrollNativeGesture);

  // Handle + header drag region: always-on, no scrollY check. Same
  // dismiss/snap behavior as bodyPanGesture but it never has to fight a
  // ScrollView, so no simultaneous composition needed.
  const headerPanGesture = Gesture.Pan()
    .activeOffsetY(5)
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        sheetTranslateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 100 || e.velocityY > 600) {
        sheetTranslateY.value = withSpring(screenHeight, {
          damping: 20,
          stiffness: 90,
          overshootClamping: true,
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(triggerClose)();
      } else {
        sheetTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
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
      <View style={styles.overlay} pointerEvents="box-none" testID={testID}>
        {/* Backdrop with fade */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sliding sheet — the inner ScrollView is wrapped in a composed
            Gesture.Simultaneous(bodyPan, scrollNative) so swipe-down at the
            top of scroll dismisses the sheet, but normal scrolling works
            everywhere else. The handle + header use their own headerPan
            gesture (no scroll-at-top check). */}
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]} pointerEvents="auto">
          {/* Always-on drag region: handle + header. Anywhere in this strip
              the user can pull down to dismiss without needing the
              scroll-position check the body uses. */}
          <GestureDetector gesture={headerPanGesture}>
            <View>
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
            </View>
          </GestureDetector>

          <GestureDetector gesture={Gesture.Simultaneous(bodyPanGesture, scrollNativeGesture)}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                scrollY.value = e.nativeEvent.contentOffset.y;
              }}
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
                    Context-sensitive: this word carries multiple senses across the NT. Meaning is
                    governed by usage, not a single gloss.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </GestureDetector>
        </Animated.View>
      </View>
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

    // Drag area + handle
    dragArea: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
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
