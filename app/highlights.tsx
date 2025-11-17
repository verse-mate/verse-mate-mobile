/**
 * Highlights List Screen
 *
 * Displays user's highlights grouped by book and chapter in collapsible sections.
 * Each group shows book name, chapter number, and highlight count.
 *
 * Features:
 * - Collapsible chapter groups (collapsed by default)
 * - Group header format: "{Book Name} {Chapter Number} ({count} highlights)"
 * - Chevron icon rotates on expand/collapse
 * - Individual highlight items within expanded groups
 * - Tap highlight to navigate to chapter
 * - Pull-to-refresh functionality
 * - Empty state for no highlights
 * - Authentication guard
 * - Loading state handling
 *
 * @see Task Group 6: My Highlights List Screen
 * @see Spec: .agent-os/specs/2025-11-06-highlight-feature/spec.md (lines 87-99)
 * @see Reference: app/notes.tsx
 *
 * @example
 * Navigation: router.push('/highlights')
 * Accessible from hamburger menu
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';

/**
 * Bible book names mapping
 * Maps book ID to book name for display
 */
const BOOK_NAMES: Record<number, string> = {
  1: 'Genesis',
  2: 'Exodus',
  3: 'Leviticus',
  4: 'Numbers',
  5: 'Deuteronomy',
  6: 'Joshua',
  7: 'Judges',
  8: 'Ruth',
  9: '1 Samuel',
  10: '2 Samuel',
  11: '1 Kings',
  12: '2 Kings',
  13: '1 Chronicles',
  14: '2 Chronicles',
  15: 'Ezra',
  16: 'Nehemiah',
  17: 'Esther',
  18: 'Job',
  19: 'Psalms',
  20: 'Proverbs',
  21: 'Ecclesiastes',
  22: 'Song of Solomon',
  23: 'Isaiah',
  24: 'Jeremiah',
  25: 'Lamentations',
  26: 'Ezekiel',
  27: 'Daniel',
  28: 'Hosea',
  29: 'Joel',
  30: 'Amos',
  31: 'Obadiah',
  32: 'Jonah',
  33: 'Micah',
  34: 'Nahum',
  35: 'Habakkuk',
  36: 'Zephaniah',
  37: 'Haggai',
  38: 'Zechariah',
  39: 'Malachi',
  40: 'Matthew',
  41: 'Mark',
  42: 'Luke',
  43: 'John',
  44: 'Acts',
  45: 'Romans',
  46: '1 Corinthians',
  47: '2 Corinthians',
  48: 'Galatians',
  49: 'Ephesians',
  50: 'Philippians',
  51: 'Colossians',
  52: '1 Thessalonians',
  53: '2 Thessalonians',
  54: '1 Timothy',
  55: '2 Timothy',
  56: 'Titus',
  57: 'Philemon',
  58: 'Hebrews',
  59: 'James',
  60: '1 Peter',
  61: '2 Peter',
  62: '1 John',
  63: '2 John',
  64: '3 John',
  65: 'Jude',
  66: 'Revelation',
};

/**
 * Type for grouped highlights by chapter
 */
interface ChapterGroup {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  highlights: Highlight[];
}

/**
 * Helper function to group highlights by chapter
 */
function groupHighlightsByChapter(highlights: Highlight[]): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();

  for (const highlight of highlights) {
    // Use book_id and chapter_number directly from the highlight
    const bookId = highlight.book_id;
    const chapterNumber = highlight.chapter_number;
    const key = `${bookId}-${chapterNumber}`;

    if (!groups.has(key)) {
      groups.set(key, {
        bookId,
        chapterNumber,
        bookName: BOOK_NAMES[bookId] || `Book ${bookId}`,
        highlights: [],
      });
    }

    groups.get(key)?.highlights.push(highlight);
  }

  // Convert to array and sort by book/chapter
  return Array.from(groups.values()).sort((a, b) => {
    if (a.bookId !== b.bookId) {
      return a.bookId - b.bookId;
    }
    return a.chapterNumber - b.chapterNumber;
  });
}

/**
 * Highlights List Screen Component
 *
 * Layout:
 * - SafeAreaView for proper screen padding
 * - Header with "Highlights" title and back button
 * - ScrollView list of collapsible chapter groups
 * - Empty state when no highlights
 * - Login prompt when not authenticated
 * - Loading indicator during fetch
 *
 * Chapter Group Format:
 * - Header: "{Book Name} {Chapter Number} ({count} highlights)" with chevron
 * - Expanded: Shows individual highlight items
 * - Collapsed: Only shows header
 */
export default function HighlightsScreen() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { allHighlights, isFetchingHighlights, refetchHighlights } = useHighlights();

  // Expanded chapter groups state
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Handle refresh action
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchHighlights();
    setRefreshing(false);
  };

  /**
   * Toggle chapter group expand/collapse
   */
  const toggleChapter = async (bookId: number, chapterNumber: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const key = `${bookId}-${chapterNumber}`;
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /**
   * Check if chapter group is expanded
   */
  const isChapterExpanded = (bookId: number, chapterNumber: number): boolean => {
    const key = `${bookId}-${chapterNumber}`;
    return expandedChapters.has(key);
  };

  /**
   * Handle highlight item press
   * Navigates to chapter with highlight visible
   */
  const handleHighlightPress = async (bookId: number, chapterNumber: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/bible/${bookId}/${chapterNumber}`);
  };

  /**
   * Handle login button press
   * Navigate to login screen
   */
  const handleLoginPress = () => {
    router.push('/auth/login');
  };

  /**
   * Handle back button press
   * Navigate back to previous screen
   */
  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // Show loading indicator while auth state is being determined
  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="highlights-loading" />
        </View>
      </SafeAreaView>
    );
  }

  // Show login prompt if user is not authenticated
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="color-wand-outline" size={64} color={colors.gray300} />
          <Text style={styles.emptyStateTitle}>Please login to view your highlights</Text>
          <Text style={styles.emptyStateSubtitle}>
            Sign in to save and access your highlighted verses
          </Text>
          <Pressable
            style={styles.loginButton}
            onPress={handleLoginPress}
            testID="highlights-login-button"
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading indicator while fetching highlights
  if (isFetchingHighlights && allHighlights.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="highlights-loading" />
        </View>
      </SafeAreaView>
    );
  }

  // Group highlights by chapter
  const chapterGroups = groupHighlightsByChapter(allHighlights);

  // Show empty state if no highlights exist
  if (chapterGroups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="color-wand-outline" size={64} color={colors.gray300} />
          <Text style={styles.emptyStateTitle}>No highlights yet</Text>
          <Text style={styles.emptyStateSubtitle}>Start highlighting verses to see them here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render highlights list with collapsible groups
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="highlights-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Highlights</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.gold]}
          />
        }
        testID="highlights-list"
      >
        {chapterGroups.map((group) => {
          const isExpanded = isChapterExpanded(group.bookId, group.chapterNumber);
          const chevronIcon = isExpanded ? 'chevron-down' : 'chevron-forward';

          return (
            <View key={`${group.bookId}-${group.chapterNumber}`} style={styles.chapterGroup}>
              {/* Chapter Group Header */}
              <Pressable
                style={({ pressed }) => [styles.groupHeader, pressed && styles.groupHeaderPressed]}
                onPress={() => toggleChapter(group.bookId, group.chapterNumber)}
                testID={`chapter-group-${group.bookId}-${group.chapterNumber}`}
              >
                <Text style={styles.groupTitle}>
                  {group.bookName} {group.chapterNumber} ({group.highlights.length}{' '}
                  {group.highlights.length === 1 ? 'highlight' : 'highlights'})
                </Text>
                <Ionicons name={chevronIcon} size={20} color={colors.gray500} />
              </Pressable>

              {/* Chapter Group Content (Expanded) */}
              {isExpanded && (
                <View style={styles.groupContent}>
                  {group.highlights.map((highlight) => (
                    <Pressable
                      key={highlight.highlight_id}
                      style={({ pressed }) => [
                        styles.highlightItem,
                        pressed && styles.highlightItemPressed,
                      ]}
                      onPress={() => handleHighlightPress(group.bookId, group.chapterNumber)}
                      testID={`highlight-item-${highlight.highlight_id}`}
                    >
                      <Text style={styles.highlightText} numberOfLines={2} ellipsizeMode="tail">
                        {(highlight.selected_text as string) || ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    color: colors.gray900,
  },
  headerSpacer: {
    width: 32, // Same width as back button for centering
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: fontSizes.body,
    color: colors.gray500,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 24,
  },
  loginButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
  },
  chapterGroup: {
    marginBottom: spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  groupHeaderPressed: {
    backgroundColor: colors.gray100,
  },
  groupTitle: {
    flex: 1,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
  },
  groupContent: {
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    minHeight: 60,
  },
  highlightItemPressed: {
    backgroundColor: colors.gray50,
  },
  highlightText: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.gray900,
    lineHeight: 20,
    marginRight: spacing.md,
  },
});
