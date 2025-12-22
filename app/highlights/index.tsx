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
import { IconHighlight } from '@/components/ui/icons';
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
          <IconHighlight width={64} height={64} color={colors.textDisabled} />
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
            <IconHighlight width={64} height={64} color={colors.textDisabled} />
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
        {/* User Highlights */}
        {chapterGroups.map((group) => (
          <Pressable
            key={`${group.bookId}-${group.chapterNumber}`}
            style={({ pressed }) => [styles.highlightItem, pressed && styles.highlightItemPressed]}
            onPress={() => handleChapterPress(group)}
            testID={`chapter-group-${group.bookId}-${group.chapterNumber}`}
          >
            <View style={styles.highlightItemContent}>
              <View style={styles.highlightIconContainer}>
                <IconHighlight width={24} height={24} color={colors.gold} />
              </View>
              <Text style={styles.highlightText}>
                {group.bookName} {group.chapterNumber}
              </Text>
            </View>

            <View style={styles.rightContent}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{group.highlights.length}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
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
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      // No background or border for header
    },
    backButton: {
      padding: spacing.xs,
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
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
      paddingVertical: spacing.xxl,
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
      paddingTop: 16,
      paddingBottom: spacing.sm,
      gap: 16, // Spacing between items
    },
    autoHighlightSection: {
      marginBottom: spacing.lg,
    },
    autoHighlightContainer: {
      paddingHorizontal: 0, // Container handles padding
    },
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
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
    // Updated Highlight Item Styles (Card)
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    highlightItemPressed: {
      opacity: 0.7,
    },
    highlightItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    highlightIconContainer: {
      marginRight: 8, // 8px gap
    },
    highlightText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    countBadge: {
      backgroundColor: 'rgba(176, 154, 109, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      minWidth: 24,
      alignItems: 'center',
    },
    countText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
