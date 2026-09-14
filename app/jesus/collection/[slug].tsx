/**
 * JesusCollectionScreen — a curated study.
 *
 * Route: /jesus/collection/[slug]
 *
 * A collection's event count can be lower than its member count: two entries in
 * one harmony cluster resolve to a single event. That is the event model
 * working, not members being dropped, so the count shown is the resolved one.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow, JesusPlaceholder, queryPhase } from '@/components/jesus/JesusParts';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusCollection } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

export default function JesusCollectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const collection = useJesusCollection(slug);
  const { data } = collection;
  const phase = queryPhase(collection);

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
          testID="jesus-collection-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data?.collection?.name ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {phase === 'offline' ? (
        <JesusPlaceholder
          message={t('jesus.offline.message', "You're offline — this needs a connection.")}
          testID="jesus-collection-offline"
        />
      ) : phase === 'loading' ? (
        <JesusPlaceholder loading testID="jesus-collection-loading" />
      ) : !data || (data.events?.length ?? 0) === 0 ? (
        <JesusPlaceholder
          message={t('jesus.collection.empty', 'Nothing here yet.')}
          testID="jesus-collection-empty"
        />
      ) : (
        <FlatList
          data={data.events}
          keyExtractor={(item, index) => `${item.slug}-${index}`}
          testID="jesus-collection-list"
          ListHeaderComponent={
            data.collection?.description ? (
              <Text style={styles.description}>{data.collection.description}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <EventRow event={item} onPress={(s) => router.push(`/jesus/event/${s}`)} />
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
      flex: 1,
      textAlign: 'center',
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    description: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      lineHeight: 21,
    },
  });
}
