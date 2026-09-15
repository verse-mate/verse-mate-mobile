/**
 * One Gospel account of an event: the reference pill, then the scripture.
 *
 * The verses come down with the event — `passages[].verses` on
 * `GET /jesus/events/:slug` carries `verse_number` + `text`. The first port
 * recorded that this array was empty and built a metadata screen instead; it
 * is not empty, and rendering it is what makes an event read like a chapter
 * rather than like a database row.
 *
 * Every verse is TAPPABLE and opens that verse in the reader proper, which is
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/hooks/bible/use-font-size';
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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { fontSize } = useFontSize();
  const styles = useMemo(() => createStyles(colors, fontSize), [colors, fontSize]);
  const verses = passage.verses ?? [];

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
        <Text style={styles.scripture}>
          {verses.map((verse) => (
            <Text key={verse.verse_number}>
              {/*
                The verse NUMBER is the tap target, matching the reader — there
                a number opens Verse Insight, so the same glyph doing the same
                job here is one interaction to learn, not two. Tapping the body
                text is left alone so selection still works.
              */}
              <Text
                style={styles.verseNumber}
                onPress={() => (onOpenVerse ?? (() => onOpen()))(verse.verse_number)}
                accessibilityRole="button"
                accessibilityLabel={t(
                  'jesus.event.openVerse',
                  'Open verse {{number}} in the reader',
                  {
                    number: verse.verse_number,
                  }
                )}
                testID={`jesus-verse-${passage.book_id}-${passage.chapter}-${verse.verse_number}`}
                suppressHighlighting
              >
                {verse.verse_number}{' '}
              </Text>
              <Text>{verse.text} </Text>
            </Text>
          ))}
        </Text>
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
    scripture: {
      marginTop: spacing.sm,
      // The reader's size, not a fixed one — same source of truth as
      // ChapterReader, which styles verse text from useFontSize().
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
      color: colors.textPrimary,
    },
    // Superscript-ish, as in the reader: smaller than the body and gold.
    verseNumber: { fontSize: Math.round(fontSize * 0.7), color: colors.gold },
    placeholder: {
      marginTop: spacing.sm,
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
    },
  });
}
