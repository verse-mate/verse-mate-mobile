/**
 * JesusHubScreen — the landing screen of the Jesus tab.
 *
 * Route: /jesus
 *
 * Rendered entirely from `GET /jesus/events/overview`: sections, types, counts,
 * periods, themes and featured studies all come off the wire, so adding a type
 * or renaming a section on the backend reaches this screen without a release.
 * Mirrors verse-mate-web's `JesusHubScreen` — same order, same copy, same
 * affordances.
 *
 * Searching swaps the browse layout for a flat result list, which is the same
 * thing the Bible and Topics searches do, so the interaction is already
 * familiar by the time a reader gets here.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EventRow,
  JesusNavCard,
  JesusPill,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusOverview, useJesusSearch } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusHubScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overview = useJesusOverview();
  const { data } = overview;
  const phase = queryPhase(overview);

  const [query, setQuery] = useState('');
  const search = useJesusSearch(query);
  const searching = query.trim().length > 0;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // The chronological way in is one row per period, so its count is the sum
  // rather than a field of its own.
  const lifeCount = (data?.periods ?? []).reduce((n, p) => n + (p.event_count ?? 0), 0);

  // A kind with nothing behind it is a dead end, so it is not offered — and the
  // empty check uses the same predicate, or a section renders a heading with no
  // rows under it.
  const sections = (data?.sections ?? [])
    .map((s) => ({ ...s, types: (s.types ?? []).filter((ty) => (ty.facet_count ?? 0) > 0) }))
    .filter((s) => s.types.length > 0);

  const hasContent =
    sections.length > 0 || (data?.themes?.length ?? 0) > 0 || (data?.collections?.length ?? 0) > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="jesus-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} testID="jesus-screen-title">
          {t('jesus.hub.title', 'Jesus')}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
        testID="jesus-hub-scroll"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.tagline} testID="jesus-hub-tagline">
          {t('jesus.hub.intro', 'Explore His life, words, and actions')}
          {data?.total_events ? (
            <Text style={styles.taglineCount}>
              {t('jesus.hub.eventCountSuffix', ' · {{count}} events', {
                count: data.total_events,
              })}
            </Text>
          ) : null}
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('jesus.hub.searchPlaceholder', 'Search His words and actions…')}
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            testID="jesus-search-input"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} testID="jesus-search-clear" hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <SearchResults query={query} search={search} styles={styles} />
        ) : phase === 'loading' ? (
          <JesusPlaceholder loading testID="jesus-hub-loading" />
        ) : phase === 'offline' ? (
          <JesusPlaceholder
            message={t('jesus.offline.message', "You're offline — this needs a connection.")}
            testID="jesus-hub-offline"
          />
        ) : !hasContent ? (
          <JesusPlaceholder
            message={t('jesus.hub.empty', 'Nothing here yet.')}
            testID="jesus-hub-empty"
          />
        ) : (
          <>
            <View style={{ marginTop: spacing.md }}>
              <JesusNavCard
                title={t('jesus.hub.life', 'Follow His Life')}
                blurb={t('jesus.hub.lifeBlurb', 'A chronological journey through His ministry')}
                count={lifeCount}
                emphasis
                icon={<Ionicons name="calendar-outline" size={20} color={colors.gold} />}
                onPress={() => router.push('/jesus/life')}
                testID="jesus-follow-his-life"
              />
            </View>

            {sections.map((section) => (
              <View key={section.section}>
                <SectionHeading
                  title={section.label ?? section.section}
                  count={section.facet_count}
                  testID={`jesus-section-${section.section}`}
                />
                {section.blurb ? <Text style={styles.sectionBlurb}>{section.blurb}</Text> : null}
                {section.types.map((type) => (
                  <JesusNavCard
                    key={type.slug}
                    title={type.label}
                    blurb={type.blurb}
                    count={type.facet_count}
                    onPress={() => router.push(`/jesus/browse/${type.slug}`)}
                    testID={`jesus-kind-${type.slug}`}
                  />
                ))}
              </View>
            ))}

            {(data?.themes?.length ?? 0) > 0 ? (
              <>
                <SectionHeading title={t('jesus.hub.themes', 'Explore by Topic')} />
                <View style={styles.pillRow} testID="jesus-theme-row">
                  {data?.themes.map((theme) => (
                    <JesusPill
                      key={theme.slug}
                      label={theme.name}
                      count={theme.event_count}
                      onPress={() => router.push(`/jesus/theme/${theme.slug}`)}
                      testID={`jesus-theme-${theme.slug}`}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {(data?.collections?.length ?? 0) > 0 ? (
              <>
                <SectionHeading title={t('jesus.hub.studies', 'Popular Studies')} />
                <View testID="jesus-studies-list">
                  {data?.collections.map((c) => (
                    <JesusNavCard
                      key={c.slug}
                      title={c.name}
                      blurb={c.subtitle}
                      count={c.event_count}
                      onPress={() => router.push(`/jesus/study/${c.slug}`)}
                      testID={`jesus-study-${c.slug}`}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SearchResults({
  query,
  search,
  styles,
}: {
  query: string;
  search: ReturnType<typeof useJesusSearch>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { t } = useTranslation();
  const events = search.data?.events ?? [];

  if (search.isPending) return <JesusPlaceholder loading testID="jesus-search-loading" />;
  if (events.length === 0) {
    return (
      <JesusPlaceholder
        message={t('jesus.hub.noResults', 'Nothing matches “{{query}}”', { query: query.trim() })}
        testID="jesus-search-empty"
      />
    );
  }

  return (
    <>
      <SectionHeading title={t('jesus.hub.results', 'Results')} count={events.length} />
      <View testID="jesus-search-results">
        {events.map((event) => (
          <EventRow
            key={event.slug}
            event={event}
            onPress={(slug) => router.push(`/jesus/event/${slug}`)}
          />
        ))}
      </View>
      <Text style={styles.sectionBlurb} />
    </>
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
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    tagline: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    taglineCount: { color: colors.textTertiary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      backgroundColor: colors.backgroundSecondary,
    },
    searchInput: { flex: 1, fontSize: fontSizes.bodySmall, color: colors.textPrimary },
    sectionBlurb: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
  });
}
