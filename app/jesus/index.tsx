/**
 * JesusHubScreen — the entry point for the Jesus tab.
 *
 * Route: /jesus
 *
 * Rendered from `GET /jesus/events/overview` rather than a hardcoded list, so a
 * taxonomy change on the backend reaches the app without a release. That is the
 * same decision the web hub makes, and it is why categories that are currently
 * empty simply do not appear.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JesusPlaceholder, SectionHeading } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusOverview } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusHubScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading } = useJesusOverview();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (isLoading) {
    return <JesusPlaceholder loading testID="jesus-hub-loading" />;
  }

  const sections = data?.sections ?? [];
  const hasContent = sections.some((s) => (s.types?.length ?? 0) > 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="jesus-hub-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('jesus.hub.title', 'Jesus')}</Text>
        <View style={styles.backButton} />
      </View>

      {!hasContent ? (
        <JesusPlaceholder
          message={t('jesus.hub.empty', 'Nothing here yet.')}
          testID="jesus-hub-empty"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          testID="jesus-hub-scroll"
        >
          <Text style={styles.intro}>
            {t('jesus.hub.intro', 'Everything He said and did, gathered from the four Gospels.')}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.lifeCard, pressed && styles.pressed]}
            onPress={() => router.push('/jesus/life')}
            testID="jesus-hub-life"
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.lifeTitle}>{t('jesus.hub.life', 'Follow His Life')}</Text>
              <Text style={styles.lifeBlurb}>
                {t('jesus.hub.lifeBlurb', 'From the hidden years to the resurrection, in order.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gold} />
          </Pressable>

          {sections.map((section) => (
            <View key={section.section}>
              <SectionHeading
                title={section.label ?? section.section}
                testID={`jesus-section-${section.section}`}
              />
              {section.blurb ? <Text style={styles.sectionBlurb}>{section.blurb}</Text> : null}
              <View style={styles.grid}>
                {(section.types ?? [])
                  // A category with nothing behind it is a dead end, so it is
                  // not offered. Six were empty before the corpus was filled.
                  .filter((type) => (type.facet_count ?? 0) > 0)
                  .map((type) => (
                    <Pressable
                      key={type.slug}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                      onPress={() => router.push(`/jesus/browse/${type.slug}`)}
                      testID={`jesus-category-${type.slug}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${type.label}, ${type.facet_count}`}
                    >
                      <Text style={styles.tileCount}>{type.facet_count}</Text>
                      <Text style={styles.tileLabel} numberOfLines={2}>
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          ))}

          {(data?.collections?.length ?? 0) > 0 && (
            <>
              <SectionHeading
                title={t('jesus.hub.studies', 'Popular studies')}
                testID="jesus-section-collections"
              />
              {data?.collections.map((c) => (
                <Pressable
                  key={c.slug}
                  style={({ pressed }) => [styles.collectionRow, pressed && styles.pressed]}
                  onPress={() => router.push(`/jesus/collection/${c.slug}`)}
                  testID={`jesus-collection-${c.slug}`}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.collectionTitle}>{c.name}</Text>
                    {c.subtitle ? (
                      <Text style={styles.collectionSubtitle}>{c.subtitle}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
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
    intro: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    lifeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.gold,
      gap: spacing.md,
    },
    lifeTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    lifeBlurb: { fontSize: fontSizes.bodySmall, color: colors.textSecondary, marginTop: 2 },
    sectionBlurb: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    tile: {
      minWidth: 100,
      flexGrow: 1,
      flexBasis: '30%',
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
    },
    tileCount: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.gold,
    },
    tileLabel: { fontSize: fontSizes.bodySmall, color: colors.textPrimary },
    collectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    collectionTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    collectionSubtitle: { fontSize: fontSizes.bodySmall, color: colors.textSecondary },
    pressed: { opacity: 0.7 },
  });
}
