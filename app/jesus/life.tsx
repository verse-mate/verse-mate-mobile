/**
 * JesusLifeScreen — Follow His Life.
 *
 * Route: /jesus/life[?period=<slug>] — the period an event's heading links to
 * is scrolled into view.
 *
 * Events grouped by period in chronological order. The order is the corpus's
 * own curation (`LIFE_TIMELINE`), not something computed here, because placing
 * an event in the ministry is an editorial judgement rather than a sort.
 *
 * One entry is deliberately absent from the timeline upstream — a recurring
 * formula with no single moment — so a period's `event_count` is the honest
 * number rather than a total that pretends everything has a place.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, type SectionListScrollParams, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JesusChrome } from '@/components/jesus/JesusChrome';
import { EventRow, JesusPlaceholder, queryPhase } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusLife } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import type { JesusEventCard } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

interface LifeSection {
  slug: string;
  title: string;
  subtitle: string | null;
  data: JesusEventCard[];
}

export default function JesusLifeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const life = useJesusLife();
  const { data } = life;
  const phase = queryPhase(life);

  const { period } = useLocalSearchParams<{ period?: string }>();
  const listRef = useRef<SectionList<JesusEventCard, LifeSection>>(null);

  const sections = useMemo(
    () =>
      (data ?? [])
        .map((period) => ({
          slug: period.slug,
          title: period.name,
          subtitle: period.subtitle,
          data: period.events ?? [],
        }))
        // A SectionList still draws the header of an empty section, so a period
        // with nothing catalogued in it would read as a heading the app forgot
        // to fill. Dropping it keeps the timeline to what actually exists.
        .filter((section) => section.data.length > 0),
    [data]
  );

  /**
   * Land on the period an event's heading was tapped from, once the timeline
   * is on screen. Sections are not measured up front, so a far one can fail
   * the first scroll; `onScrollToIndexFailed` below jumps near it and retries.
   */
  const target = useMemo<SectionListScrollParams | null>(() => {
    const sectionIndex = period ? sections.findIndex((s) => s.slug === period) : -1;
    return sectionIndex > 0
      ? { sectionIndex, itemIndex: 0, viewPosition: 0, animated: false }
      : null;
  }, [period, sections]);
  /**
   * Render everything up to the target on the first pass, so the scroll lands
   * on a measured row rather than on an estimate. A SectionList counts a
   * header and a footer per section as rows. Only on a linked arrival; a plain
   * open keeps the default first batch.
   */
  const initialRows = useMemo(() => {
    if (!target) return undefined;
    const before = sections
      .slice(0, target.sectionIndex)
      .reduce((n, section) => n + section.data.length + 2, 0);
    return before + 12;
  }, [target, sections]);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!target || scrolledFor.current === period) return;
    scrolledFor.current = period ?? null;
    const timer = setTimeout(() => listRef.current?.scrollToLocation(target), 50);
    return () => clearTimeout(timer);
  }, [target, period]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusChrome title={t('jesus.life.title', 'Follow His Life')} backTestID="jesus-life-back" />

      {phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-life-loading" />
      ) : phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-life-offline"
        />
      ) : sections.length === 0 ? (
        <JesusPlaceholder
          message={t('jesus.life.empty', 'Nothing here yet.')}
          testID="jesus-life-empty"
        />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          initialNumToRender={initialRows}
          onScrollToIndexFailed={(info) => {
            listRef.current
              ?.getScrollResponder()
              ?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
            if (target) setTimeout(() => listRef.current?.scrollToLocation(target), 100);
          }}
          keyExtractor={(item, index) => `${item.slug}-${index}`}
          stickySectionHeadersEnabled={false}
          testID="jesus-life-list"
          renderSectionHeader={({ section }) => (
            <View style={styles.periodHeader}>
              <Text style={styles.periodTitle}>{section.title}</Text>
              {section.subtitle ? (
                <Text style={styles.periodSubtitle}>{section.subtitle}</Text>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <EventRow event={item} onPress={(slug) => router.push(`/jesus/event/${slug}`)} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
        />
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    periodHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    periodTitle: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    periodSubtitle: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}
