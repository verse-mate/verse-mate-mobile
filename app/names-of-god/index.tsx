/**
 * NamesOfGodListScreen
 *
 * Browsable, searchable list of all divine names with language-filter chips.
 * Tapping a name navigates to the NameDetailScreen (/names-of-god/[nameId]).
 *
 * Route: /names-of-god
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { filterByCategory, searchNames } from '@/services/names-of-god-use-case';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import type { LanguageFilter, NameOfGod } from '@/types/names-of-god';

const LANGUAGE_FILTERS: LanguageFilter[] = ['All', 'Hebrew', 'Greek', 'Aramaic', 'English'];

export default function NamesOfGodListScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('All');

  const names = useMemo<NameOfGod[]>(() => {
    const byLanguage = filterByCategory(languageFilter);
    if (!query.trim()) return byLanguage;
    const bySearch = searchNames(query);
    const searchIds = new Set(bySearch.map((n) => n.id));
    return byLanguage.filter((n) => searchIds.has(n.id));
  }, [query, languageFilter]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleNamePress = (name: NameOfGod) => {
    router.push(`/names-of-god/${name.id}`);
  };

  const renderItem = ({ item }: { item: NameOfGod }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => handleNamePress(item)}
      testID={`name-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.nameEn}
    >
      <View style={styles.rowContent}>
        <Text style={styles.nameEn}>{item.nameEn}</Text>
        <Text style={styles.transliteration}>{item.transliteration}</Text>
        <Text style={styles.meaning} numberOfLines={1}>
          {item.meaning}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <View style={styles.langBadge}>
          <Text style={styles.langBadgeText}>{item.language}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="names-of-god-list-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} testID="names-list-back">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('names_of_god.title')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('names_of_god.search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          testID="names-search-input"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} testID="names-search-clear">
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Language filter chips */}
      <View style={styles.filterRow}>
        {LANGUAGE_FILTERS.map((lang) => (
          <Pressable
            key={lang}
            style={[styles.chip, languageFilter === lang && styles.chipActive]}
            onPress={() => setLanguageFilter(lang)}
            testID={`filter-chip-${lang}`}
          >
            <Text style={[styles.chipText, languageFilter === lang && styles.chipTextActive]}>
              {lang === 'All'
                ? t('names_of_god.filter_all')
                : t(`names_of_god.language_${lang.toLowerCase()}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Count */}
      <Text style={styles.countLabel}>
        {t('names_of_god.names_count', { count: names.length })}
      </Text>

      {/* List */}
      <FlatList
        data={names}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        testID="names-list"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('names_of_god.no_results')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.gray200,
    },
    backButton: {
      padding: spacing.xs,
      marginRight: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      flex: 1,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 100,
      backgroundColor: colors.backgroundSecondary,
    },
    chipActive: {
      backgroundColor: colors.gold,
    },
    chipText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.black,
    },
    countLabel: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    listContent: {
      paddingHorizontal: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.gray100,
    },
    rowPressed: {
      backgroundColor: colors.backgroundSecondary,
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    nameEn: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    transliteration: {
      fontSize: fontSizes.bodySmall,
      fontStyle: 'italic',
      color: colors.gold,
    },
    meaning: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    langBadge: {
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 100,
    },
    langBadgeText: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
    },
    empty: {
      paddingTop: spacing.xxl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
  });
