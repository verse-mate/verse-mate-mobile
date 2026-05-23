/**
 * NameDetailScreen
 *
 * Full detail view for a single divine name. Shows the name's original-script
 * form, transliteration, language, meaning, testament badge, and a paginated
 * list of every verse where it appears. Tapping a verse row opens the Bible
 * reader at that verse in the user's preferred Bible version.
 *
 * Route: /names-of-god/[nameId]
 * Example: /names-of-god/yahweh
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useVerseTexts } from '@/hooks/names-of-god/use-verse-texts';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { getNameById } from '@/services/names-of-god-use-case';
import { fontSizes, fontWeights, type getColors, spacing } from '@/theme/tokens';
import { type ParsedVerseRef, parseSortVerseRefs } from '@/utils/names-of-god/parse-verse-ref';

const PAGE_SIZE = 30;
const SNIPPET_LENGTH = 80;

export default function NameDetailScreen() {
  const { nameId } = useLocalSearchParams<{ nameId: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const name = useMemo(() => getNameById(nameId ?? ''), [nameId]);
  const sortedRefs = useMemo(() => (name ? parseSortVerseRefs(name.verseRefs) : []), [name]);
  const totalPages = Math.max(1, Math.ceil(sortedRefs.length / PAGE_SIZE));
  const [page, setPage] = useState(0);

  const pageRefs = useMemo(
    () => sortedRefs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRefs, page]
  );

  const { bibleVersion } = useBibleVersion();
  const verseTexts = useVerseTexts(pageRefs, bibleVersion);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleVersePress = (ref: ParsedVerseRef) => {
    router.push(`/bible/${ref.bookId}/${ref.chapter}?verse=${ref.verse}`);
  };

  if (!name) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton} testID="name-detail-back">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.centeredMessage}>
          <Text style={styles.errorTitle}>{t('names_of_god.error_name_not_found')}</Text>
          <Text style={styles.errorBody}>{t('names_of_god.error_name_not_found_detail')}</Text>
          <Pressable onPress={handleBack} style={styles.backButtonPill}>
            <Text style={styles.backButtonPillText}>{t('names_of_god.go_back')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const testamentLabel = (() => {
    switch (name.testament) {
      case 'OT':
        return t('names_of_god.testament_ot');
      case 'NT':
        return t('names_of_god.testament_nt');
      default:
        return t('names_of_god.testament_both');
    }
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="name-detail-screen">
      {/* Sticky header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} testID="name-detail-back">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name.nameEn}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Header block ────────────────────────────────────────────── */}
        <View style={styles.nameBlock} testID="name-detail-header">
          <Text style={styles.nameEn} testID="name-detail-english">
            {name.nameEn}
          </Text>
          <Text style={styles.nameOriginal} testID="name-detail-original">
            {name.nameOriginal}
          </Text>
          <Text style={styles.transliteration} testID="name-detail-transliteration">
            {name.transliteration}
          </Text>
          <View style={styles.badges}>
            <View style={styles.languageBadge}>
              <Text style={styles.languageBadgeText}>{name.language}</Text>
            </View>
            <View style={styles.testamentBadge}>
              <Text style={styles.testamentBadgeText}>{testamentLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Meaning block ───────────────────────────────────────────── */}
        <View style={styles.meaningBlock} testID="name-detail-meaning">
          <Text style={styles.meaningText}>{name.meaning}</Text>
        </View>

        {/* ── Verse list ──────────────────────────────────────────────── */}
        <View style={styles.verseSection}>
          <Text style={styles.versesHeader}>
            {t('names_of_god.verses_count', { count: sortedRefs.length })}
          </Text>

          {verseTexts.map(({ ref, text, isLoading, hasError }) => (
            <Pressable
              key={ref.raw}
              onPress={() => handleVersePress(ref)}
              style={({ pressed }) => [styles.verseRow, pressed && styles.verseRowPressed]}
              testID={`verse-row-${ref.bookId}-${ref.chapter}-${ref.verse}`}
              accessibilityRole="button"
              accessibilityLabel={`${ref.bookName} ${ref.chapter}:${ref.verse}`}
            >
              <Text style={styles.verseRef}>
                {ref.bookName} {ref.chapter}:{ref.verse}
              </Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.gold} style={styles.verseLoader} />
              ) : hasError ? (
                <Text style={styles.verseError}>{t('names_of_god.verse_error')}</Text>
              ) : text ? (
                <Text style={styles.verseSnippet} numberOfLines={2}>
                  {text.length > SNIPPET_LENGTH
                    ? `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…`
                    : text}
                </Text>
              ) : (
                <Text style={styles.verseError}>{t('names_of_god.verse_error')}</Text>
              )}
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textSecondary}
                style={styles.verseChevron}
              />
            </Pressable>
          ))}

          {/* ── Pagination controls ─────────────────────────────────────── */}
          {totalPages > 1 && (
            <View style={styles.paginationRow} testID="name-detail-pagination">
              <Pressable
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
                accessibilityLabel={t('names_of_god.previous_page')}
                testID="page-prev-button"
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={page === 0 ? colors.textSecondary : colors.gold}
                />
              </Pressable>

              <Text style={styles.pageLabel}>
                {t('names_of_god.page_label', { current: page + 1, total: totalPages })}
              </Text>

              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={[styles.pageButton, page === totalPages - 1 && styles.pageButtonDisabled]}
                accessibilityLabel={t('names_of_god.next_page')}
                testID="page-next-button"
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={page === totalPages - 1 ? colors.textSecondary : colors.gold}
                />
              </Pressable>
            </View>
          )}
        </View>

        {/* Bottom safe area padding */}
        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
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
      backgroundColor: colors.background,
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
    scrollContent: {
      paddingHorizontal: spacing.lg,
    },
    // Name block
    nameBlock: {
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      gap: spacing.xs,
    },
    nameEn: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    nameOriginal: {
      fontSize: 32,
      color: colors.gold,
      lineHeight: 44,
    },
    transliteration: {
      fontSize: fontSizes.bodyLarge,
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    languageBadge: {
      backgroundColor: colors.gold,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 100,
    },
    languageBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.medium,
      color: colors.black,
    },
    testamentBadge: {
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 100,
    },
    testamentBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
    },
    // Meaning block
    meaningBlock: {
      paddingVertical: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.gray200,
    },
    meaningText: {
      fontSize: fontSizes.body,
      lineHeight: fontSizes.body * 1.6,
      color: colors.textPrimary,
    },
    // Verse list
    verseSection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.gray200,
      paddingTop: spacing.md,
    },
    versesHeader: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    verseRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.gray100,
      flexDirection: 'column',
      gap: spacing.xs,
    },
    verseRowPressed: {
      backgroundColor: colors.backgroundSecondary,
      marginHorizontal: -spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    verseRef: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.gold,
    },
    verseSnippet: {
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: fontSizes.body * 1.5,
    },
    verseLoader: {
      alignSelf: 'flex-start',
      marginVertical: spacing.xs,
    },
    verseError: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    verseChevron: {
      alignSelf: 'flex-end',
    },
    // Pagination
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.xl,
    },
    pageButton: {
      padding: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    pageButtonDisabled: {
      opacity: 0.4,
    },
    pageLabel: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    // Error / not-found
    centeredMessage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      gap: spacing.md,
    },
    errorTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    errorBody: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    backButtonPill: {
      backgroundColor: colors.gold,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 8,
      marginTop: spacing.sm,
    },
    backButtonPillText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.black,
    },
  });
