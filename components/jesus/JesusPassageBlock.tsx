/**
 * One Gospel account of an event: the reference pill, then the scripture.
 *
 * The verses come down with the event — `passages[].verses` on
 * `GET /jesus/events/:slug` carries `verse_number` + `text`. The first port
 * recorded that this array was empty and built a metadata screen instead; it
 * is not empty, and rendering it is what makes an event read like a chapter
 * rather than like a database row.
 *
 * Every verse is TAPPABLE — by its number, exactly as in the reader (the
 * native renderer hit-tests the glyphs) — and opens Verse Insight, which is
 * where highlighting, notes, the lexicon and Verse Insight live — this block
 * deliberately does not reimplement any of that. Reported as "these verses
 * aren't clickable in Jesus feature": scripture that reads like the reader but
 * does nothing when touched is worse than scripture that plainly isn't the
 * reader, because the affordance is implied and then withheld.
 *
 * The text also honours the reader's own font-size preference rather than a
 * fixed size, which is the other half of the same report ("font size
 * changed") — a reader who has scaled scripture up gets it everywhere or the
 * setting is a lie.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useOptionalBibleInteraction } from '@/contexts/BibleInteractionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/hooks/bible/use-font-size';
import { useNativeText } from '@/hooks/bible/use-native-text';
import { verseNumberGapPaddingDp } from '@/lib/text/compile-paragraph';
import { ParagraphText } from '@/lib/text/ParagraphText';
import { groupIntoParagraphs } from '@/lib/text/paragraph-breaks';
import type { CompileTheme } from '@/lib/text/types';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';
import type { JesusEventPassage } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

export function JesusPassageBlock({
  passage,
  onOpen,
  onOpenVerse,
}: {
  passage: JesusEventPassage;
  onOpen: () => void;
  /** Open one verse in the reader. Falls back to the passage when absent. */
  onOpenVerse?: (verseNumber: number) => void;
}) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const { fontSize } = useFontSize();
  const { useNativeText: nativeText } = useNativeText();
  const [width, setWidth] = useState(0);
  /**
   * Verse Insight, opened IN PLACE.
   *
   * The first version routed to the reader instead, and the tester's words
   * were: "clicking on the verse definitions now send you to the book instead
   * of just the popup and staying in Jesus feature." Being thrown into Matthew
   * mid-event is a context switch nobody asked for — the popup IS the
   * interaction.
   *
   * The event screen wraps each passage in its OWN BibleInteractionProvider:
   * an event told by two Gospels is two different chapters, and highlights,
   * notes and insight are all per-chapter. Optional so the block still renders
   * unprovided, where it degrades to opening the reader.
   */
  const interaction = useOptionalBibleInteraction();
  const styles = useMemo(() => createStyles(colors, fontSize), [colors, fontSize]);
  const verses = passage.verses ?? [];

  /**
   * Paragraphs and verse numbers exactly as the reader draws them.
   *
   * This used to be one flowing <Text> per account with its own number style
   * (0.7x, on the baseline, no breaks), which the tester noticed next to the
   * reader: "the verse #s in Jesus aren't in the same place as the main
   * bible". Now it is the reader's own pieces: the same paragraph breaks
   * (`groupIntoParagraphs`), the same native renderer (`ParagraphText`) with
   * the same raised 0.85x gold numbers and the same line height.
   */
  const paragraphs = useMemo(
    () => groupIntoParagraphs(verses.map((v) => ({ verseNumber: v.verse_number, text: v.text }))),
    [verses]
  );
  const textTheme = useMemo<CompileTheme>(
    () => ({
      mode,
      lexUnderlineColor: 'rgba(176,154,109,0.55)',
      lexUnderlineThemeColor: 'rgba(199,176,116,0.75)',
      lexUnderlineThickness: 1,
      lexUnderlineStyle: 'dotted',
      redLetterColor: mode === 'dark' ? '#ff6b6b' : '#c1121f',
      selectionColor: '#3390FF40',
      verseNumberColor: colors.gold,
      baseFontSize: fontSize,
    }),
    [mode, colors.gold, fontSize]
  );
  const openVerse = (verseNumber: number) => {
    if (interaction) {
      const verse = verses.find((v) => v.verse_number === verseNumber);
      interaction.openVerseTooltip(verseNumber, null, verse?.text, 'verse_number');
      return;
    }
    (onOpenVerse ?? (() => onOpen()))(verseNumber);
  };

  return (
    <View style={styles.section} testID={`jesus-passage-${passage.display}`}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        testID={`jesus-passage-reference-${passage.display}`}
        accessibilityRole="button"
        accessibilityLabel={passage.display}
      >
        <Ionicons name="book-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.pillText}>{passage.display}</Text>
      </Pressable>

      {verses.length > 0 ? (
        nativeText ? (
          <View
            style={styles.scriptureBlock}
            onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
            testID={`jesus-scripture-${passage.display}`}
          >
            {width > 0
              ? paragraphs.map((group, index) => (
                  <View key={group[0].verseNumber}>
                    <ParagraphText
                      onVerseTap={openVerse}
                      style={styles.paragraph}
                      theme={textTheme}
                      verses={group}
                      width={width}
                      testID={`jesus-paragraph-${passage.book_id}-${passage.chapter}-${group[0].verseNumber}`}
                    />
                    {index < paragraphs.length - 1 && <View style={styles.paragraphGap} />}
                  </View>
                ))
              : null}
          </View>
        ) : (
          <View style={styles.scriptureBlock} testID={`jesus-scripture-${passage.display}`}>
            {paragraphs.map((group, index) => (
              <Text
                key={group[0].verseNumber}
                style={[styles.paragraph, index < paragraphs.length - 1 && styles.paragraphGapText]}
                testID={`jesus-paragraph-${passage.book_id}-${passage.chapter}-${group[0].verseNumber}`}
              >
                {group.map((verse) => (
                  /*
                    Fallback renderer (web, or native text switched off). The
                    whole verse is the tap target here: RN <Text onPress> on the
                    number alone looked pressable and did nothing on device.
                  */
                  <Text
                    key={verse.verseNumber}
                    onPress={() => openVerse(verse.verseNumber)}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'jesus.event.openVerse',
                      'Open verse {{number}} in the reader',
                      { number: verse.verseNumber }
                    )}
                    testID={`jesus-verse-${passage.book_id}-${passage.chapter}-${verse.verseNumber}`}
                    suppressHighlighting
                  >
                    <Text style={styles.verseNumber}>{verse.verseNumber} </Text>
                    {verse.text}{' '}
                  </Text>
                ))}
              </Text>
            ))}
          </View>
        )
      ) : (
        <Text style={styles.placeholder}>
          {t('jesus.event.openInReader', 'Open in the reader to view this passage.')}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: Colors, fontSize: number) {
  return StyleSheet.create({
    section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: colors.backgroundSecondary,
    },
    pressed: { opacity: 0.7 },
    pillText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
    },
    scriptureBlock: { marginTop: spacing.sm },
    // ChapterReader `verseTextParagraph`, minus its marginBottom (the gap is
    // drawn between paragraphs instead, as the reader does).
    paragraph: {
      fontSize,
      fontWeight: fontWeights.regular,
      lineHeight: fontSize * 2.0,
      color: colors.textPrimary,
    },
    paragraphGap: { height: spacing.md },
    paragraphGapText: { marginBottom: spacing.md },
    // Fallback path only — the reader's `verseNumberSuperscript`.
    verseNumber: {
      fontSize: fontSize * 0.85,
      fontWeight: fontWeights.bold,
      color: colors.gold,
      paddingHorizontal: verseNumberGapPaddingDp(1, fontSize),
    },
    placeholder: {
      marginTop: spacing.sm,
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
    },
  });
}
