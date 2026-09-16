/**
 * Reader bridge — "this passage is part of an event".
 *
 * Sits under a chapter in the reader and offers the Jesus events that touch it.
 * Without something like this the Jesus tab is a destination a reader has to
 * already know about; this is what makes the corpus discoverable from the text
 * they are actually reading, which is the point of having built it.
 *
 * Renders nothing at all when the chapter carries no events — most of the Old
 * Testament — so it costs an absent component rather than an empty heading.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { uniqueGospels } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusForPassage } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

/** Two fit above the fold on a phone alongside the chapter footer; three does not. */
const MAX_EVENTS = 3;

export function JesusPassageLink({
  bookId,
  chapter,
  verse,
}: {
  bookId: number | undefined;
  chapter: number | undefined;
  verse?: number;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useJesusForPassage({ bookId, chapter, verse });

  if (!data?.length) return null;

  // One chapter can hold several events (Mark 5 alone has three). This is a
  // pointer out of the text, not a table of contents, so it shows a couple and
  // leaves the rest to the browse screen rather than pushing the chapter footer
  // off the bottom of a phone.
  const shown = data.slice(0, MAX_EVENTS);
  const hidden = data.length - shown.length;

  return (
    <View style={styles.wrap} testID="jesus-passage-link">
      <Text style={styles.heading}>{t('jesus.passage.heading', 'In the life of Jesus')}</Text>
      {shown.map((event) => (
        <Pressable
          key={event.slug}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push(`/jesus/event/${event.slug}`)}
          testID={`jesus-passage-event-${event.slug}`}
          accessibilityRole="button"
          accessibilityLabel={event.title}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{event.title}</Text>
            {uniqueGospels(event.gospels).length ? (
              <Text style={styles.gospels}>{uniqueGospels(event.gospels).join(' · ')}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
      ))}
      {hidden > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/jesus')}
          testID="jesus-passage-more"
          accessibilityRole="button"
        >
          <Text style={styles.more}>
            {t('jesus.passage.more', '{{count}} more in this chapter', { count: hidden })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.lg,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
      gap: spacing.xs,
    },
    heading: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    pressed: { opacity: 0.7 },
    title: { fontSize: fontSizes.body, color: colors.textPrimary },
    more: {
      flex: 1,
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: colors.gold,
    },
    gospels: { fontSize: fontSizes.caption, color: colors.textTertiary },
  });
}
