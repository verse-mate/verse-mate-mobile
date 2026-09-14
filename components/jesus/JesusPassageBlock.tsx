/**
 * One Gospel account of an event: the reference pill, then the scripture.
 *
 * The verses come down with the event — `passages[].verses` on
 * `GET /jesus/events/:slug` carries `verse_number` + `text`. The first port
 * recorded that this array was empty and built a metadata screen instead; it
 * is not empty, and rendering it is what makes an event read like a chapter
 * rather than like a database row.
 *
 * Tapping the pill opens the passage in the reader proper, which is where
 * highlighting, notes and the lexicon live — this block deliberately does not
 * reimplement any of that.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';
import type { JesusEventPassage } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

export function JesusPassageBlock({
  passage,
  onOpen,
}: {
  passage: JesusEventPassage;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
              <Text style={styles.verseNumber}>{verse.verse_number} </Text>
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

function createStyles(colors: Colors) {
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
      fontSize: fontSizes.bodyLarge,
      lineHeight: 30,
      color: colors.textPrimary,
    },
    verseNumber: { fontSize: fontSizes.caption, color: colors.gold },
    placeholder: {
      marginTop: spacing.sm,
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
    },
  });
}
