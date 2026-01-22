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
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconBookmarkFilled, IconTrash } from '@/components/ui/icons';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useActiveView } from '@/hooks/bible';
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { bookmarks, isFetchingBookmarks, removeBookmark } = useBookmarks();
  const { setActiveView } = useActiveView();

  /**
   * Handle bookmark item press
   *
   * Flow:
   * 1. Trigger haptic feedback
   * 2. Reset view to Bible (not explanations)
   * 3. Navigate to chapter using Expo Router
   */
  const handleBookmarkPress = async (bookId: number, chapterNumber: number) => {
    // Trigger haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Reset view to Bible before navigating
    // This ensures bookmarks always open in Bible view, not explanations
    await setActiveView('bible');

    // Navigate to chapter
    router.push(`/bible/${bookId}/${chapterNumber}`);
  };

  /**
   * Handle bookmark delete press
   */
  const handleDeletePress = (bookId: number, chapterNumber: number, bookName: string) => {
    Alert.alert(
      'Remove Bookmark',
      `Are you sure you want to remove the bookmark for ${bookName} ${chapterNumber}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await removeBookmark(bookId, chapterNumber);
          },
        },
      ]
    );
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
          <ActivityIndicator size="large" color={colors.gold} testID="bookmarks-loading" />
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
            testID="bookmarks-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <IconBookmarkFilled width={64} height={64} color={colors.textDisabled} />
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
      </View>
    );
  }

  // Show loading indicator while fetching bookmarks
  if (isFetchingBookmarks) {
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
      </View>
    );
  }

  // Show empty state if no bookmarks exist
  if (bookmarks.length === 0) {
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
            testID="bookmarks-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <IconBookmarkFilled width={64} height={64} color={colors.textDisabled} />
          <Text style={styles.emptyStateTitle}>No bookmarked chapters yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Tap the bookmark icon while reading to save chapters for later.
          </Text>
        </View>
      </View>
    );
  }

  // Render bookmarks list
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
          testID="bookmarks-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
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
              <View style={styles.bookmarkIconContainer}>
                <IconBookmarkFilled width={24} height={24} color={colors.gold} />
              </View>
              <Text style={styles.bookmarkText}>
                {bookmark.book_name} {bookmark.chapter_number}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                handleDeletePress(bookmark.book_id, bookmark.chapter_number, bookmark.book_name)
              }
              style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
              hitSlop={12}
            >
              <IconTrash width={24} height={24} color="#B03A42" />
            </Pressable>
          </Pressable>
        ))}
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
      marginBottom: 8,
    },
    backButton: {
      padding: spacing.xs,
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300', // Light weight per Figma
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40, // Same width as back button for centering
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
      gap: 16, // Spacing between items per Figma
    },
    bookmarkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10, // Reduced padding
      paddingHorizontal: 16,
      marginHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    bookmarkItemPressed: {
      opacity: 0.7,
    },
    bookmarkItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bookmarkIconContainer: {
      marginRight: 16,
    },
    bookmarkText: {
      fontSize: 16, // Keeping established bigger font
      fontWeight: '400', // Regular weight
      color: colors.textPrimary,
    },
    deleteButton: {
      width: 40, // Reduced size
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 10,
    },
  });
