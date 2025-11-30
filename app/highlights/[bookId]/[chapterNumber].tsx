/**
 * Chapter Highlights Screen
 *
 * Displays all user highlights for a specific Bible chapter.
 * Navigated to from the main Highlights list.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';

/**
 * Convert a number to Unicode superscript characters
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

/**
 * Format highlight text with verse numbers
 */
function formatHighlightWithVerseNumbers(highlight: Highlight): string {
  const { start_verse, end_verse, selected_text } = highlight;

  if (!selected_text) {
    if (start_verse === end_verse) {
      return `Verse ${start_verse}`;
    }
    return `Verses ${start_verse}-${end_verse}`;
  }

  if (start_verse === end_verse) {
    return `${toSuperscript(start_verse)}\u2009${selected_text}`;
  }

  return `${toSuperscript(start_verse)}-${toSuperscript(end_verse)}\u2009${selected_text}`;
}

export default function ChapterHighlightsScreen() {
  const { bookId, chapterNumber, bookName } = useLocalSearchParams<{
    bookId: string;
    chapterNumber: string;
    bookName: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const parsedBookId = parseInt(bookId || '0', 10);
  const parsedChapterNumber = parseInt(chapterNumber || '0', 10);

  const { chapterHighlights, isFetchingHighlights } = useHighlights({
    bookId: parsedBookId,
    chapterNumber: parsedChapterNumber,
  });

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleHighlightPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to the chapter reading view
    // We can go back to highlights list then to bible, OR replace?
    // Usually "push" to bible is fine.
    router.push(`/bible/${parsedBookId}/${parsedChapterNumber}`);
  };

  if (isFetchingHighlights && chapterHighlights.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md },
          ]}
        >
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="activity-indicator" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }]}
      >
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {bookName} {chapterNumber}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {chapterHighlights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No highlights found</Text>
          </View>
        ) : (
          <View style={styles.highlightsList}>
            {chapterHighlights.map((highlight) => (
              <Pressable
                key={highlight.highlight_id}
                style={({ pressed }) => [
                  styles.highlightItem,
                  pressed && styles.highlightItemPressed,
                ]}
                onPress={handleHighlightPress}
              >
                <Text style={styles.highlightText} numberOfLines={3} ellipsizeMode="tail">
                  {formatHighlightWithVerseNumbers(highlight)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
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
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.xs,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 32,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    highlightsList: {
      gap: spacing.sm,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      minHeight: 60,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    highlightItemPressed: {
      backgroundColor: colors.backgroundElevated,
    },
    highlightText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 24,
      marginRight: spacing.md,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyStateText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
  });
