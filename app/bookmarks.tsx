/**
 * Bookmarks List Screen
 *
 * Displays user's bookmarked Bible chapters in a scrollable list.
 * Each item shows "Book Name Chapter#" format and navigates to the chapter on press.
 *
 * Features:
 * - ScrollView list of bookmarked chapters
 * - Navigation to chapter on item press
 * - Haptic feedback on press
 * - Empty state for no bookmarks
 * - Authentication guard
 * - Loading state handling
 * - Error state handling
 *
 * @see Task Group 5: Bookmarks List View
 * @see Spec: .agent-os/specs/2025-11-05-bookmark-chapters/spec.md (lines 30-36)
 *
 * @example
 * Navigation: router.push('/bookmarks')
 * Accessible from hamburger menu
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBookmarks } from '@/hooks/bible/use-bookmarks';

/**
 * Bookmarks Screen Component
 *
 * Layout:
 * - SafeAreaView for proper screen padding
 * - Header with "Bookmarks" title
 * - ScrollView list of bookmarked chapters
 * - Empty state when no bookmarks
 * - Login prompt when not authenticated
 * - Loading indicator during fetch
 *
 * List Item Format:
 * - "Book Name Chapter#" (e.g., "Genesis 1", "John 3")
 * - Pressable with visual feedback
 * - Navigates to /bible/{bookId}/{chapterNumber}
 */
export default function Bookmarks() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { bookmarks, isFetchingBookmarks } = useBookmarks();

  /**
   * Handle bookmark item press
   *
   * Flow:
   * 1. Trigger haptic feedback
   * 2. Navigate to chapter using Expo Router
   */
  const handleBookmarkPress = async (bookId: number, chapterNumber: number) => {
    // Trigger haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Navigate to chapter
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
          <ActivityIndicator size="large" color={colors.gold} testID="bookmarks-loading" />
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
            testID="bookmarks-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="bookmark-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.emptyStateTitle}>Please login to view your bookmarks</Text>
          <Text style={styles.emptyStateSubtitle}>
            Sign in to save and access your favorite Bible chapters
          </Text>
          <Pressable
            style={styles.loginButton}
            onPress={handleLoginPress}
            testID="bookmarks-login-button"
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading indicator while fetching bookmarks
  if (isFetchingBookmarks) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="bookmarks-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="bookmarks-loading" />
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state if no bookmarks exist
  if (bookmarks.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackPress}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="bookmarks-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="bookmark-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.emptyStateTitle}>No bookmarked chapters yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Tap the bookmark icon while reading to save chapters for later.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render bookmarks list
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="bookmarks-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="bookmarks-list"
      >
        {bookmarks.map((bookmark) => (
          <Pressable
            key={bookmark.favorite_id}
            style={({ pressed }) => [styles.bookmarkItem, pressed && styles.bookmarkItemPressed]}
            onPress={() => handleBookmarkPress(bookmark.book_id, bookmark.chapter_number)}
            testID={`bookmark-item-${bookmark.book_id}-${bookmark.chapter_number}`}
          >
            <View style={styles.bookmarkItemContent}>
              <Ionicons name="bookmark" size={20} color={colors.gold} style={styles.bookmarkIcon} />
              <Text style={styles.bookmarkText}>
                {bookmark.book_name} {bookmark.chapter_number}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
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
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.xs,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
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
      color: colors.background, // Contrast on gold
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: spacing.sm,
    },
    bookmarkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      minHeight: 60,
    },
    bookmarkItemPressed: {
      backgroundColor: colors.backgroundElevated,
    },
    bookmarkItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bookmarkIcon: {
      marginRight: spacing.md,
    },
    bookmarkText: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
  });
