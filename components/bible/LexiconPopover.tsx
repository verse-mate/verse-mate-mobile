/**
 * LexiconPopover Component
 *
 * Bottom-sheet modal showing the chapter-aligned Greek/Hebrew lexical
 * card for a verse word. Mirrors verse-mate-web/src/components/LexiconPopover.tsx
 * structure (six sections + loaded caveat strip).
 *
 * Triggered by tap on a dotted-underlined word in the Bible reader.
 *
 * Built on `@gorhom/bottom-sheet`. The earlier custom implementation
 * (RN <Modal> + RNGH Gesture.Pan + Reanimated translateY) could not
 * reliably co-exist with the inner ScrollView's native pan recognizer
 * on real iOS — fast finger flicks would lose the race and never
 * dismiss (Andy 2026-05-22/2026-05-23: "swipe down doesn't work, but
 * hold-and-press-then-drag does"). gorhom's library patches its inner
 * BottomSheetScrollView so the scroll handler reports up to the sheet
 * and the pan/scroll handoff is done in worklets, not at the RN-bridge
 * level. This is the same problem @gorhom/bottom-sheet was built to
 * solve — adopting it removes ~100 lines of bespoke gesture code we
 * were never going to make race-free in our own implementation.
 */

import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { AlignedToken, LexEntry, RelatedWord } from '@versemate/lexicon';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { type LemmaCard, useLemma } from '@/hooks/use-lemma';
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
  /**
   * When set, the popover treats `entry` as a stub (synthesized from the
   * chapter endpoint's `?tagged=1` tokens) and resolves the real card via
   * `useLemma()` against the backend `/lemma` endpoint in this language.
   * Used for non-English Bibles, where the bundled `@versemate/lexicon`
   * has no entries.
   */
  apiLang?: string;
  testID?: string;
}

/**
 * Adapt the backend's snake_case `LemmaCard` shape to the bundled
 * `@versemate/lexicon` `LexEntry` shape the popover renders. Field
 * mapping mirrors the typebox schema in
 * `packages/backend-base/src/lemmas/lemma.plugin.ts`.
 *
 * `LexEntry.related` requires a `lemma` field that the API doesn't
 * carry (the API only ships `translit` + `note`). Reuse `translit` as
 * the displayed lemma so the existing renderer (which surfaces
 * `lemma` as the main related-word heading) shows the translit form —
 * still readable, just no original-script form for non-English cards.
 */
function lemmaCardToLexEntry(card: LemmaCard): LexEntry {
  const related: RelatedWord[] = (card.related ?? []).map((r) => ({
    lemma: r.translit,
    translit: r.translit,
    note: r.note,
  }));
  return {
    lemma: card.lemma,
    translit: card.translit ?? '',
    pronunciation: card.pronunciation ?? undefined,
    strongs: card.strongs,
    pos: card.pos ?? '',
    basicGloss: card.basic_gloss ?? '',
    semanticRange: card.semantic_range ?? undefined,
    ntFrequency: card.nt_frequency ?? undefined,
    otFrequency: card.ot_frequency ?? undefined,
    loaded: card.loaded,
    related: related.length > 0 ? related : undefined,
    notes: card.notes ?? undefined,
  };
}

export function LexiconPopover({
  visible,
  onClose,
  surface: _surface,
  entry: stubEntry,
  token,
  isTheme: _isTheme,
  apiLang,
  testID = 'lexicon-popover',
}: LexiconPopoverProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Non-English: resolve the real card from the API on tap. The hook is
  // disabled when apiLang isn't set (English path uses the bundled entry
  // directly) and when the popover isn't visible (avoids fetches on
  // every render). React Query caches by (strongs, lang) so repeat taps
  // of the same word, or the same word in another chapter, hit cache.
  const enableApi = Boolean(apiLang) && visible && Boolean(stubEntry.strongs);
  const { data: card, isLoading: isApiLoading } = useLemma(
    enableApi ? stubEntry.strongs : null,
    apiLang,
    { enabled: enableApi }
  );

  // Resolve the entry the body renders: prefer API card when present,
  // fall back to the stub (which has at least strongs + lemma slug for
  // English, or the same for non-English while the request is pending).
  const entry: LexEntry = useMemo(
    () => (card ? lemmaCardToLexEntry(card) : stubEntry),
    [card, stubEntry]
  );
  const isApiFetching = enableApi && !card && isApiLoading;

  // gorhom uses an imperative ref API for show/dismiss. Bridge it to our
  // declarative `visible` prop so the call sites in ChapterReader don't
  // have to change.
  const sheetRef = useRef<BottomSheetModal>(null);

  // Single snap point at 85% of the available area. The sheet collapses
  // to that height regardless of content size, matching the previous
  // custom modal's `maxHeight: 85%`.
  const snapPoints = useMemo(() => ['85%'], []);

  // In landscape the full-width 85% sheet swallows nearly the whole screen
  // (#3). Constrain it to a centred column so the reader stays visible on
  // either side. Portrait keeps the default full-width bottom sheet.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const landscapeSheetStyle = useMemo(() => {
    if (!isLandscape) return undefined;
    const width = Math.min(560, windowWidth * 0.62);
    // gorhom's sheet container is absolutely positioned (left:0), so alignSelf
    // can't centre it — offset it manually to sit centred with the reader
    // visible on both sides.
    return { width, marginLeft: Math.max(0, (windowWidth - width) / 2) };
  }, [isLandscape, windowWidth]);

  // Open + close spring physics that match AutoHighlightTooltip (the
  // verse-insight modal). User explicitly asked for parity on both
  // directions; AutoHighlightTooltip's snap-back/close uses
  // damping=20, stiffness=90 — same numbers here, with overshoot
  // clamping so the sheet doesn't bounce past its rest position on
  // open.
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 20,
    stiffness: 90,
    mass: 1,
    overshootClamping: true,
  });

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  // Fired when the modal is dismissed (backdrop tap or downward pan
  // past close threshold). Forward to the consumer's `onClose` so the
  // parent (ChapterReader) can clear its `activeLexicon` state.
  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    []
  );

  const contextual = token.contextual;
  const lemmaIsHebrew = isHebrew(entry.lemma);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      enablePanDownToClose
      enableDynamicSizing={false}
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      style={landscapeSheetStyle}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      // gorhom's native gesture handlers handle drag-to-dismiss from
      // anywhere on the sheet — including over the ScrollView body —
      // because it patches the inner scroll handler to coordinate with
      // the pan worklet on the UI thread.
      accessibilityLabel="Lexicon entry"
    >
      {/* Header lives INSIDE the BottomSheetScrollView as its first
          child, with stickyHeaderIndices={[0]} to keep it pinned while
          the body scrolls. Earlier attempt with a flex wrapper around
          BottomSheetView + BottomSheetScrollView broke gorhom's
          internal scroll/pan worklet coordination — the ScrollView
          stopped scrolling. Direct-child placement is what the library
          expects. */}
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[0]}>
        {/* HEADER — pinned via stickyHeaderIndices */}
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

        {/* IN THIS VERSE (Layer 2 — contextual gloss) */}
        {contextual ? (
          <Section label="In this verse" highlight styles={styles} testID={`${testID}-contextual`}>
            <Text style={styles.bodyText}>{contextual}</Text>
          </Section>
        ) : null}

        {/* BASIC SENSE — show spinner while API card is still loading for
            the non-English path. Pre-API stub has an empty basicGloss, so
            without this we'd briefly render an empty section.
            When the API returns a bare card (`loaded=false` AND no
            basicGloss), surface that explicitly instead of an empty
            section — the underline is still present because the Strong's
            token tagged this word, but our lexicon doesn't yet have rich
            data for this lemma (~16k bare entries in the seed). */}
        <Section label="Basic sense" styles={styles} testID={`${testID}-basic`}>
          {isApiFetching && !entry.basicGloss ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : entry.basicGloss ? (
            <Text style={styles.bodyText}>{entry.basicGloss}</Text>
          ) : (
            <Text style={[styles.bodyText, { fontStyle: 'italic', opacity: 0.6 }]}>
              No detailed lexicon entry yet for this word.
            </Text>
          )}
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
      </BottomSheetScrollView>
    </BottomSheetModal>
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

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    // BottomSheet background — replaces our old `sheet` style. Color +
    // top corner radius mirror the previous custom modal.
    background: {
      backgroundColor: colors.backgroundElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    // Drag indicator (the notch). 48×5 matches Andy's "make the top
    // bigger to grab" feedback — same as the previous custom handle.
    handleIndicator: {
      width: 48,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.gray100,
    },
    // The handle container that gorhom renders above the body. Extra
    // padding here makes the touch target larger (the whole top strip
    // is draggable).
    handle: {
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },

    scrollContent: {
      paddingBottom: spacing.lg,
    },

    // Header — `stickyHeaderIndices={[0]}` on the ScrollView pins this
    // at the top while body content scrolls beneath. backgroundColor is
    // required so the scrolling sections don't show through.
    header: {
      backgroundColor: colors.backgroundElevated,
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
