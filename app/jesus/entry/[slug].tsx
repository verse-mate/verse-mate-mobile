/**
 * JesusEntryScreen — one facet on its own.
 *
 * Route: /jesus/entry/[slug]
 *
 * What a search result from the selector's Jesus tab opens. An entry is a
 * single saying or deed rather than a whole scene, so it shows the saying, what
 * it means, where it is, and a way into the event that contains it.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  JesusPill,
  JesusPlaceholder,
  queryPhase,
  SectionHeading,
} from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusEntry } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, radii, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusEntryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const query = useJesusEntry(slug);
  const { data } = query;
  const phase = queryPhase(query);

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
          testID="jesus-entry-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} testID="jesus-entry-title">
          {data?.kind_label ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-entry-offline"
        />
      ) : phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-entry-loading" />
      ) : !data ? (
        <JesusPlaceholder
          message={t('jesus.entry.missing', "That entry doesn't exist.")}
          testID="jesus-entry-missing"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          testID="jesus-entry-body"
        >
          {data.period_name ? <Text style={styles.period}>{data.period_name}</Text> : null}
          <Text style={styles.title}>{data.title}</Text>

          {data.quote ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quote}>
                {t('jesus.event.quoted', '“{{text}}”', { text: data.quote })}
              </Text>
              {data.quote_reference ? (
                <Text style={styles.reference}>{data.quote_reference}</Text>
              ) : null}
            </View>
          ) : null}

          {data.summary ? <Text style={styles.summary}>{data.summary}</Text> : null}

          {data.references?.length ? (
            <>
              <SectionHeading title={t('jesus.entry.references', 'Where it is')} />
              <View style={styles.pillRow}>
                {data.references.map((ref) => (
                  <JesusPill
                    key={ref.display}
                    label={ref.display}
                    onPress={() => router.push(`/bible/${ref.book_id}/${ref.chapter}`)}
                    testID={`jesus-entry-reference-${ref.display}`}
                  />
                ))}
              </View>
            </>
          ) : null}

          {data.themes?.length ? (
            <>
              <SectionHeading title={t('jesus.event.themes', 'Themes')} />
              <View style={styles.pillRow}>
                {data.themes.map((theme) => (
                  <JesusPill
                    key={theme.slug}
                    label={theme.name}
                    onPress={() => router.push(`/jesus/theme/${theme.slug}`)}
                    testID={`jesus-entry-theme-${theme.slug}`}
                  />
                ))}
              </View>
            </>
          ) : null}
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
      flex: 1,
      textAlign: 'center',
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    period: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.gold,
    },
    title: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    quoteCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderLeftWidth: 2,
      borderLeftColor: colors.gold,
    },
    quote: { fontSize: fontSizes.bodyLarge, fontStyle: 'italic', color: colors.textPrimary },
    reference: { fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: spacing.xs },
    summary: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      fontSize: fontSizes.body,
      lineHeight: 24,
      color: colors.textSecondary,
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
