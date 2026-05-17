/**
 * LexiconPopover Component
 *
 * Bottom sheet modal showing the chapter-aligned Greek/Hebrew lexical
 * card for a verse word. Mirrors verse-mate-web/src/components/LexiconPopover.tsx
 * structure: same six sections (header / in-this-verse / basic-sense /
 * semantic range / related / lexical note) plus a "loaded" caveat strip
 * for theologically-loaded words.
 *
 * Replaces the legacy long-press → WordDefinitionTooltip path for words
 * the lexicon covers. Falls back to WordDefinitionTooltip when there's
 * no lemma match — handled by ChapterReader, not here.
 */

import type { AlignedToken, LexEntry } from '@versemate/lexicon';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Modal from 'react-native-modal';
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
  /** The English surface form the user pressed (e.g. "loved"). */
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
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const contextual = token.contextual;
  const lemmaIsHebrew = isHebrew(entry.lemma);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe
      useNativeDriver
      hideModalContentWhileAnimating
      backdropOpacity={0.55}
      testID={testID}
    >
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header} testID={`${testID}-header`}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.lemma,
                  lemmaIsHebrew && styles.lemmaRtl,
                ]}
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

          {/* IN THIS VERSE (Layer 2 — contextual gloss) */}
          {contextual ? (
            <Section label="In this verse" highlight colors={colors} styles={styles} testID={`${testID}-contextual`}>
              <Text style={styles.bodyText}>{contextual}</Text>
            </Section>
          ) : null}

          {/* BASIC SENSE */}
          <Section label="Basic sense" colors={colors} styles={styles} testID={`${testID}-basic`}>
            <Text style={styles.bodyText}>{entry.basicGloss}</Text>
          </Section>

          {/* SEMANTIC RANGE */}
          {entry.semanticRange && entry.semanticRange.length > 0 ? (
            <Section label="Semantic range" colors={colors} styles={styles} testID={`${testID}-range`}>
              <View style={styles.listWrap}>
                {entry.semanticRange.map((s, i) => (
                  <View key={`${s}-${i}`} style={styles.listRow}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.listText}>{s}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* RELATED WORDS */}
          {entry.related && entry.related.length > 0 ? (
            <Section label="Related" colors={colors} styles={styles} testID={`${testID}-related`}>
              <View style={styles.relatedWrap}>
                {entry.related.map((r, i) => {
                  const rIsHebrew = isHebrew(r.lemma);
                  return (
                    <View key={`${r.lemma}-${i}`} style={styles.relatedItem}>
                      <View style={styles.relatedHeadRow}>
                        <Text
                          style={[
                            styles.relatedLemma,
                            rIsHebrew && styles.lemmaRtl,
                          ]}
                        >
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
            <Section label="Lexical note" colors={colors} styles={styles} testID={`${testID}-notes`}>
              <Text style={styles.notesText}>{entry.notes}</Text>
            </Section>
          ) : null}

          {/* LOADED CAVEAT — no border, last row */}
          {entry.loaded ? (
            <View style={styles.caveatBlock} testID={`${testID}-loaded`}>
              <Text style={styles.caveatText}>
                Context-sensitive: this word carries multiple senses across
                the NT. Meaning is governed by usage, not a single gloss.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close lexicon"
          testID={`${testID}-close`}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Section primitive ──────────────────────────────────────────────────

interface SectionProps {
  label: string;
  highlight?: boolean;
  colors: ReturnType<typeof getColors>;
  styles: ReturnType<typeof createStyles>;
  testID: string;
  children: React.ReactNode;
}

function Section({ label, highlight, styles, testID, children }: SectionProps) {
  return (
    <View
      style={[styles.section, highlight ? styles.sectionHighlight : null]}
      testID={testID}
    >
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const createStyles = (
  colors: ReturnType<typeof getColors>,
  insets: { bottom: number; top: number; left: number; right: number },
) =>
  StyleSheet.create({
    modal: {
      justifyContent: 'flex-end',
      margin: 0,
    },
    sheet: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: Math.max(insets.bottom, spacing.md),
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.gray100,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
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
      // Serif-like fonts aren't always present on RN; system font reads
      // cleanly enough for Greek/Hebrew at this size.
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
      // The web uses a subtle gold tint here. Mobile theme tokens vary
      // between light/dark, so a slight overlay via opacity is safer
      // than hard-coding a tint that breaks one mode.
      opacity: 1,
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

    // Close
    closeButton: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xs,
    },
    closeButtonText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
  });
