/**
 * JesusLifeScreen — Follow His Life.
 *
 * Route: /jesus/life
 *
 * Events grouped by period in chronological order. The order is the corpus's
 * own curation (`LIFE_TIMELINE`), not something computed here, because placing
 * an event in the ministry is an editorial judgement rather than a sort.
 *
 * One entry is deliberately absent from the timeline upstream — a recurring
 * formula with no single moment — so a period's `event_count` is the honest
 * number rather than a total that pretends everything has a place.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow, JesusPlaceholder, queryPhase } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusLife } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusLifeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const life = useJesusLife();
  const { data } = life;
  const phase = queryPhase(life);

  const sections = useMemo(
    () =>
      (data ?? [])
        .map((period) => ({
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
          testID="jesus-life-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('jesus.life.title', 'Follow His Life')}</Text>
        <View style={styles.backButton} />
      </View>

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
          sections={sections}
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
