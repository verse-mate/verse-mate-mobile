/**
 * JesusSermonsScreen — His major sermons.
 *
 * Route: /jesus/sermons
 *
 * Each sermon is shown with every Gospel account of it as a chip that opens
 * the reader at that chapter (where the sermon is read straight through), then
 * the events of the Life timeline told inside it. See lib/jesus/sermons for
 * why sermons are defined by reference rather than by event.
 *
 * The sermons and their chips render without the network: only the event rows
 * wait on the Life timeline, so a reader offline can still open the Sermon on
 * the Mount in the Bible.
 */
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JesusChrome } from '@/components/jesus/JesusChrome';
import { EventRow, JesusPill } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusLife } from '@/hooks/jesus';
import { eventsForSermon, rangeLabel, SERMONS } from '@/lib/jesus/sermons';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusSermonsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const life = useJesusLife();

  // The timeline's own order is chronological, so matching against it
  // flattened keeps each sermon's events in the order they happen.
  const sermons = useMemo(() => {
    const events = (life.data ?? []).flatMap((period) => period.events ?? []);
    return SERMONS.map((sermon) => ({ sermon, events: eventsForSermon(events, sermon) }));
  }, [life.data]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusChrome title={t('jesus.sermons.title', 'Sermons')} backTestID="jesus-sermons-back" />
      <ScrollView
        testID="jesus-sermons-list"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      >
        <Text style={styles.intro}>
          {t(
            'jesus.sermons.intro',
            'His longest teachings. Open an account to read the whole sermon in the Bible.'
          )}
        </Text>
        {sermons.map(({ sermon, events }) => (
          <View key={sermon.slug} testID={`jesus-sermon-${sermon.slug}`}>
            <View style={styles.header}>
              <Text style={styles.title}>{t(`jesus.sermons.${sermon.key}Name`, sermon.name)}</Text>
              <Text style={styles.blurb}>
                {t(`jesus.sermons.${sermon.key}Blurb`, sermon.blurb)}
              </Text>
              <View style={styles.accounts}>
                {sermon.accounts.map((range) => (
                  <JesusPill
                    key={rangeLabel(range)}
                    label={rangeLabel(range)}
                    onPress={() => router.push(`/bible/${range.bookId}/${range.from[0]}`)}
                    testID={`jesus-sermon-read-${sermon.slug}-${range.bookId}`}
                  />
                ))}
              </View>
            </View>
            {events.map((event) => (
              <EventRow
                key={event.slug}
                event={event}
                onPress={(slug) => router.push(`/jesus/event/${slug}`)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    intro: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    blurb: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    accounts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
}
