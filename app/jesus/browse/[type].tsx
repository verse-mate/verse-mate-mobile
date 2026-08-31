/**
 * JesusBrowseScreen — one category, grouped by topic.
 *
 * Route: /jesus/browse/[type]   e.g. /jesus/browse/questions
 *
 * The backend has already done the grouping (`topics`), so this renders what it
 * was given rather than bucketing client-side. Questions alone is ~290 facets
 * across ~110 events; without the server's topics it would be an undifferentiated
 * wall, which is the failure the topic grouping exists to prevent.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow, JesusPlaceholder } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusBrowse } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import type { JesusEventCard } from '@/types/jesus';

type Colors = ReturnType<typeof getColors>;

export default function JesusBrowseScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading } = useJesusBrowse(type);

  const sections = useMemo(
    () =>
      (data?.topics ?? []).map((topic) => ({
        title: topic.name,
        description: topic.description,
        data: (topic.events ?? []) as JesusEventCard[],
      })),
    [data]
  );

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
          testID="jesus-browse-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data?.type?.label ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <JesusPlaceholder loading testID="jesus-browse-loading" />
      ) : !data || sections.length === 0 ? (
        <JesusPlaceholder
          message={t('jesus.browse.empty', 'Nothing here yet.')}
          testID="jesus-browse-empty"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.slug}-${index}`}
          stickySectionHeadersEnabled={false}
          testID="jesus-browse-list"
          ListHeaderComponent={
            data.type?.intro ? <Text style={styles.intro}>{data.type.intro}</Text> : null
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.topicHeader}>
              <Text style={styles.topicTitle}>{section.title}</Text>
              {section.description ? (
                <Text style={styles.topicDescription}>{section.description}</Text>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <EventRow event={item} onPress={(slug) => router.push(`/jesus/event/${slug}`)} />
          )}
          ListFooterComponent={
            data.truncated ? (
              <Text style={styles.truncated}>
                {t('jesus.browse.truncated', 'Showing the first results.')}
              </Text>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
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
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    topicHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
    },
    topicTitle: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    topicDescription: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    truncated: {
      padding: spacing.lg,
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });
}
