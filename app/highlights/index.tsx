import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AutoHighlightSettings } from '@/components/settings/AutoHighlightSettings';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
 */
export default function HighlightsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { allHighlights, isFetchingHighlights, refetchHighlights } = useHighlights();

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
   * Handle chapter group press
   * Opens screen with highlights for that chapter
   */
  const handleChapterPress = async (group: ChapterGroup) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/highlights/[bookId]/[chapterNumber]',
      params: {
        bookId: String(group.bookId),
        chapterNumber: String(group.chapterNumber),
        bookName: group.bookName,
      },
    });
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
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="highlights-loading" />
        </View>
      </View>
    );
  }

  // Show login prompt if user is not authenticated
  if (!isAuthenticated || !user) {
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
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="color-wand-outline" size={64} color={colors.textDisabled} />
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
      </View>
    );
  }

  // Show loading indicator while fetching highlights
  if (isFetchingHighlights && allHighlights.length === 0) {
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
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Highlights</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="highlights-loading" />
        </View>
      </View>
    );
  }

  // Group highlights by chapter
  const chapterGroups = groupHighlightsByChapter(allHighlights);

  // Show empty state if no highlights exist (but still show auto-highlight settings)
  if (chapterGroups.length === 0) {
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
            testID="highlights-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
        >
          {/* My Highlights Section Header */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>My Highlights</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Empty State */}
          <View style={styles.emptyStateContainer}>
            <Ionicons name="color-wand-outline" size={64} color={colors.textDisabled} />
            <Text style={styles.emptyStateTitle}>No highlights yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start highlighting verses to see them here.
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Auto-Highlights</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Auto-Highlight Settings Section */}
          <View style={styles.autoHighlightSection}>
            <View style={styles.autoHighlightContainer}>
              <AutoHighlightSettings isLoggedIn={isAuthenticated} alwaysExpanded={true} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Render highlights list with collapsible groups
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
          testID="highlights-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Highlights</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.gold]}
          />
        }
        testID="highlights-list"
      >
        {/* My Highlights Section Header */}
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>My Highlights</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* User Highlights */}
        {chapterGroups.map((group) => (
          <View key={`${group.bookId}-${group.chapterNumber}`} style={styles.chapterGroup}>
            {/* Chapter Group Header */}
            <Pressable
              style={({ pressed }) => [styles.groupHeader, pressed && styles.groupHeaderPressed]}
              onPress={() => handleChapterPress(group)}
              testID={`chapter-group-${group.bookId}-${group.chapterNumber}`}
            >
              <View style={styles.groupInfo}>
                <Text style={styles.groupTitle}>
                  {group.bookName} {group.chapterNumber}
                </Text>
                <Text style={styles.groupSubtitle}>
                  {group.highlights.length}{' '}
                  {group.highlights.length === 1 ? 'highlight' : 'highlights'}
                </Text>
              </View>
              <View style={styles.groupIconContainer}>
                <Ionicons name="chevron-forward" size={20} color={colors.gold} />
              </View>
            </Pressable>
          </View>
        ))}

        {/* Divider */}
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Auto-Highlights</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Auto-Highlight Settings Section */}
        <View style={styles.autoHighlightSection}>
          <View style={styles.autoHighlightContainer}>
            <AutoHighlightSettings isLoggedIn={isAuthenticated} alwaysExpanded={true} />
          </View>
        </View>
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
      fontSize: fontSizes.displayMedium * 0.88,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 32,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl * 2,
    },
    emptyStateTitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
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
      color: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: spacing.sm,
    },
    autoHighlightSection: {
      marginBottom: spacing.lg,
    },
    sectionHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.background,
    },
    sectionIcon: {
      marginRight: spacing.sm,
    },
    sectionHeader: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    autoHighlightContainer: {
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
    },
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      paddingHorizontal: spacing.md,
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Updated Card Styles
    chapterGroup: {
      marginBottom: spacing.md,
      marginHorizontal: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      overflow: 'hidden',
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
    },
    groupHeaderPressed: {
      backgroundColor: `${colors.divider}20`, // Subtle press effect
    },
    groupInfo: {
      flex: 1,
    },
    groupTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    groupSubtitle: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      fontWeight: fontWeights.medium,
    },
    groupIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupContent: {
      backgroundColor: colors.background,
      paddingVertical: spacing.sm,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      minHeight: 60,
    },
    highlightItemPressed: {
      backgroundColor: colors.backgroundElevated,
    },
    highlightText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
      lineHeight: 20,
      marginRight: spacing.md,
    },
  });
