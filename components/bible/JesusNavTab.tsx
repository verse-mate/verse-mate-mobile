/**
 * The Jesus tab inside the book selector.
 *
 * This is how the feature is reached — on web it sits between New Testament and
 * Topics in the same selector, and it is what the first mobile port replaced
 * with a hamburger-menu item. A reader looking for Jesus opens the same list
 * they open for a book.
 *
 * Two modes, mirroring `BookSelector`:
 *  - idle: browse rows — Follow His Life, then every kind, then every study,
 *    each with its count — ending in "Open the Jesus tab →" for the hub.
 *  - searching: facets, not events, because someone typing "born again" wants
 *    the saying rather than the scene that contains it. That is the entries
 *    family (`/jesus/entries`), a different endpoint from the hub's.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useJesusEntriesOverview, useJesusEntrySearch } from '@/hooks/jesus';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';

type Colors = ReturnType<typeof getColors>;

interface NavRow {
  label: string;
  count: number;
  to: string;
  testID: string;
}

export function JesusNavTab({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overview = useJesusEntriesOverview();
  const search = useJesusEntrySearch(query);
  const term = query.trim();

  const rows = useMemo<NavRow[]>(() => {
    const data = overview.data;
    if (!data) return [];
    const lifeCount = (data.periods ?? []).reduce((n, p) => n + (p.entry_count ?? 0), 0);
    return [
      {
        label: t('jesus.hub.life', 'Follow His Life'),
        count: lifeCount,
        to: '/jesus/life',
        testID: 'jesus-tab-follow-his-life',
      },
      ...(data.sections ?? []).flatMap((section) =>
        (section.kinds ?? []).map((kind) => ({
          label: kind.label,
          count: kind.entry_count,
          to: `/jesus/browse/${kind.slug}`,
          testID: `jesus-tab-kind-${kind.slug}`,
        }))
      ),
      ...(data.collections ?? []).map((collection) => ({
        label: collection.name,
        count: collection.entry_count,
        to: `/jesus/study/${collection.slug}`,
        testID: `jesus-tab-study-${collection.slug}`,
      })),
    ];
  }, [overview.data, t]);

  const go = (to: string) => {
    onNavigate();
    router.push(to as never);
  };

  if (term) {
    const entries = search.data ?? [];
    if (search.isPending) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      );
    }
    if (entries.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {t('jesus.hub.noResults', 'Nothing matches “{{query}}”', { query: term })}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView testID="jesus-tab-results" keyboardShouldPersistTaps="handled">
        {entries.map((entry) => (
          <Pressable
            key={entry.slug}
            onPress={() => go(`/jesus/entry/${entry.slug}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID={`jesus-tab-entry-${entry.slug}`}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.rowMeta}>
                {entry.kind_label}
                {entry.references?.[0] ? ` · ${entry.references[0].display}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  if (overview.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView testID="jesus-tab-list" keyboardShouldPersistTaps="handled">
      {rows.map((row) => (
        <Pressable
          key={row.to}
          onPress={() => go(row.to)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          testID={row.testID}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>{row.label}</Text>
          {row.count > 0 ? <Text style={styles.rowCount}>{row.count}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      ))}
      <Pressable
        onPress={() => go('/jesus')}
        style={({ pressed }) => [styles.hubRow, pressed && styles.pressed]}
        testID="jesus-tab-open-hub"
        accessibilityRole="button"
      >
        <Text style={styles.hubText}>{t('jesus.tab.openHub', 'Open the Jesus tab →')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    center: { padding: spacing.xxxl, alignItems: 'center' },
    empty: { fontSize: fontSizes.bodySmall, color: colors.textTertiary, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    pressed: { opacity: 0.7 },
    rowLabel: { flex: 1, fontSize: fontSizes.body, color: colors.textPrimary },
    rowMeta: { fontSize: fontSizes.caption, color: colors.textTertiary, marginTop: 2 },
    rowCount: { fontSize: fontSizes.bodySmall, color: colors.textTertiary },
    hubRow: { paddingVertical: spacing.lg, alignItems: 'center' },
    hubText: { fontSize: fontSizes.bodySmall, color: colors.gold, fontWeight: fontWeights.medium },
  });
}
