/**
 * JesusBrowseScreen — one kind, grouped by topic.
 *
 * Route: /jesus/browse/[type]   e.g. /jesus/browse/parables
 *
 * Mirrors verse-mate-web's `JesusListScreen` in `kind` mode, which renders
 * `GET /jesus/events/browse/:type` through `JesusTopicBrowse`: an intro, a
 * stats line, topic chips, then one section per topic carrying the sayings
 * themselves — not just a list of event titles.
 *
 * The chips jump to their section rather than filtering, as they do on web. A
 * SectionList is what makes that work on a phone: `scrollToLocation` needs the
 * list to own the sections, so the whole screen is the list rather than a
 * ScrollView with a list inside it.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow, JesusPill, JesusPlaceholder, queryPhase } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusBrowse } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';
import type { JesusEventCard, JesusTopicPoint } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

type Row = { kind: 'point'; point: JesusTopicPoint } | { kind: 'event'; event: JesusEventCard };

export default function JesusBrowseScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const listRef = useRef<SectionList<Row>>(null);

  const browse = useJesusBrowse(type);
  const { data } = browse;
  const phase = queryPhase(browse);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jesus');
  };

  // A topic leads with the sayings it is built from, then the remaining events
  // that carry no quoted point of their own — that ordering is what makes the
  // screen read as "what this set is about" rather than as a directory.
  const sections = useMemo(() => {
    return (data?.topics ?? []).map((topic) => {
      const quoted = new Set((topic.points ?? []).map((p) => p.slug));
      const rows: Row[] = [
        ...(topic.points ?? []).map((point) => ({ kind: 'point' as const, point })),
        ...(topic.events ?? [])
          .filter((e) => !quoted.has(e.slug))
          .map((event) => ({ kind: 'event' as const, event })),
      ];
      return { key: topic.slug ?? 'other', topic, data: rows };
    });
  }, [data]);

  const jumpTo = (index: number) => {
    listRef.current?.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      viewPosition: 0,
      animated: true,
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="jesus-list-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} testID="jesus-list-title">
          {data?.type?.label ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-browse-offline"
        />
      ) : phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-browse-loading" />
      ) : sections.length === 0 ? (
        <JesusPlaceholder
          message={t('jesus.browse.empty', 'Nothing here yet.')}
          testID="jesus-browse-empty"
        />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(row, i) =>
            row.kind === 'point' ? `p-${row.point.slug}-${i}` : `e-${row.event.slug}-${i}`
          }
          stickySectionHeadersEnabled={false}
          testID="jesus-topic-list"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          // scrollToLocation needs a height estimate for sections it has not
          // measured; without it a chip jump to a far topic lands short.
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToLocation({
              sectionIndex: Math.max(0, index),
              itemIndex: 0,
              animated: false,
            });
          }}
          ListHeaderComponent={
            <View>
              {data?.type?.intro ? (
                <Text style={styles.intro} testID="jesus-category-intro">
                  {data.type.intro}
                </Text>
              ) : null}
              <Text style={styles.stats} testID="jesus-category-stats">
                {t('jesus.browse.stats', '{{events}} {{plural}} · {{topics}} topics', {
                  events: data?.total_events ?? 0,
                  plural: data?.type?.plural ?? '',
                  topics: sections.length,
                })}
              </Text>
              {sections.length > 1 ? (
                <View style={styles.pillRow} testID="jesus-topic-nav">
                  {sections.map((s, i) => (
                    <JesusPill
                      key={s.key}
                      label={s.topic.name}
                      count={s.topic.facet_count || s.topic.event_count}
                      onPress={() => jumpTo(i)}
                      testID={`jesus-topic-chip-${s.key}`}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.topicHeader} testID={`jesus-topic-section-${section.key}`}>
              <View style={styles.topicTitleRow}>
                <Text style={styles.topicName} testID={`jesus-topic-name-${section.key}`}>
                  {section.topic.name}
                </Text>
                <Text style={styles.topicCount}>
                  {section.topic.facet_count || section.topic.event_count}
                </Text>
              </View>
              {section.topic.description ? (
                <Text style={styles.topicDescription}>{section.topic.description}</Text>
              ) : null}
              {section.topic.gospels?.length ? (
                <Text style={styles.topicGospels}>
                  {[...new Set(section.topic.gospels)].join(' · ')}
                </Text>
              ) : null}
            </View>
          )}
          renderItem={({ item }) =>
            item.kind === 'point' ? (
              <View style={styles.pointCard} testID={`jesus-point-${item.point.slug}`}>
                <Text style={styles.pointText}>“{item.point.text}”</Text>
                {item.point.summary ? (
                  <Text style={styles.pointSummary}>{item.point.summary}</Text>
                ) : null}
                {item.point.reference ? (
                  <Text style={styles.pointReference}>{item.point.reference}</Text>
                ) : null}
              </View>
            ) : (
              <EventRow
                event={item.event}
                onPress={(slug) => router.push(`/jesus/event/${slug}`)}
              />
            )
          }
          ListFooterComponent={
            data?.truncated ? (
              <Text style={styles.truncated} testID="jesus-topic-truncated">
                {t(
                  'jesus.browse.truncated',
                  'Showing the first {{count}} — this category is larger than one page.',
                  {
                    count: data.total_events,
                  }
                )}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    intro: {
      fontSize: fontSizes.body,
      lineHeight: 22,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    stats: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    topicHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    topicTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topicName: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    topicCount: { fontSize: fontSizes.bodySmall, color: colors.textTertiary },
    topicDescription: {
      fontSize: fontSizes.bodySmall,
      lineHeight: 20,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    topicGospels: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
      marginTop: spacing.xs,
    },
    pointCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderLeftWidth: 2,
      borderLeftColor: colors.gold,
    },
    pointText: { fontSize: fontSizes.body, color: colors.textPrimary, fontStyle: 'italic' },
    pointSummary: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    pointReference: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
      marginTop: spacing.xs,
    },
    truncated: {
      fontSize: fontSizes.caption,
      fontStyle: 'italic',
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
  });
}
