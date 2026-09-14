/**
 * JesusThemeScreen — every event under one theme.
 *
 * Route: /jesus/theme/[slug]   e.g. /jesus/theme/kingdom
 *
 * The other half of verse-mate-web's `JesusListScreen`: where browse-by-kind
 * groups into topics, a theme is a flat list off `GET /jesus/events?theme=`.
 * Reached from the hub's Explore-by-Topic chips and from an event's own theme
 * pills, which is the route that was missing entirely from the first port.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EventRow,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusEvents, useJesusOverview } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusThemeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const list = useJesusEvents({ theme: slug });
  const phase = queryPhase(list);
  // The name and description live on the overview, not on the list response —
  // the same place web reads them from.
  const overview = useJesusOverview();
  const theme = overview.data?.themes?.find((th) => th.slug === slug);

  const events = list.data?.events ?? [];
  const total = list.data?.total ?? 0;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jesus');
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
          {theme?.name ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-theme-offline"
        />
      ) : phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-theme-loading" />
      ) : events.length === 0 ? (
        <JesusPlaceholder
          message={t('jesus.browse.empty', 'Nothing here yet.')}
          testID="jesus-theme-empty"
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.slug}
          testID="jesus-entry-list"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          ListHeaderComponent={
            <View>
              {theme?.description ? (
                <Text style={styles.description} testID="jesus-list-description">
                  {theme.description}
                </Text>
              ) : null}
              <SectionHeading
                title={t('jesus.browse.eventCount', '{{count}} events', { count: total })}
                count={total}
              />
            </View>
          }
          renderItem={({ item }) => (
            <EventRow event={item} onPress={(s) => router.push(`/jesus/event/${s}`)} />
          )}
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
    description: {
      fontSize: fontSizes.body,
      lineHeight: 22,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
  });
}
