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
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

  // Animated values — same shape as VerseMateTooltip.
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Internal visibility flag so we can play the close animation before the
  // Modal actually unmounts. Toggled by the visible-prop watcher below.
  const internalVisibleRef = useRef(false);

  const animateOpen = () => {
    internalVisibleRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Plain timing (no spring) so the sheet slides up without a bounce
      // — matches the verse-insight modal's open animation.
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateClose = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
        overshootClamping: true,
        restDisplacementThreshold: 40,
        restSpeedThreshold: 40,
      }),
    ]).start();
    setTimeout(() => {
      internalVisibleRef.current = false;
      cb?.();
    }, 150);
  };

  // Drive animations off the `visible` prop. Open on mount, close on
  // visible → false. The close path calls onClose synchronously so the
  // parent (ChapterReader) can clear its activeLexicon state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: animateOpen/animateClose/slideAnim/backdropOpacity/screenHeight are stable refs and closure-captured constants
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(screenHeight);
      backdropOpacity.setValue(0);
      animateOpen();
    } else if (internalVisibleRef.current) {
      animateClose();
    }
  }, [visible]);

  // Single swipe-to-dismiss PanResponder applied to the whole sheet.
  //
  // Capture-phase return-true on ANY downward gesture so the inner
  // ScrollView never steals the touch when the user drags the sheet down.
  // Upward gestures (`g.dy < 0`) bubble through to the ScrollView so
  // long lex entries can still be scrolled to reveal content below the
  // fold. Reading lex entries top-to-bottom is the normal flow; reading
  // back upward is rare, so trading scroll-up-after-scroll-down for
  // reliable drag-anywhere-dismiss is the right call.
  //
  // Capture at `dy > 3` (snappy) and dismiss at `dy > 50` (low effort).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        return g.dy > 3 && Math.abs(g.dy) > Math.abs(g.dx);
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 50) {
          closeRef.current();
        } else if (g.dy > 0) {
          // Snap-back uses plain timing (not spring) to match the
          // bounce-less open animation.
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

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
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sliding sheet — panResponder wraps the entire sheet so a
            downward drag from any point (handle, header, OR body)
            dismisses, while upward scrolling within the body still works
            because the responder only captures `dy > 3` downward motion. */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          pointerEvents="auto"
          {...panResponder.panHandlers}
        >
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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
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
