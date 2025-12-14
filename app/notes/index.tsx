/**
 * Notes List Screen
 *
 * Displays user's notes grouped by chapter in card-style list.
 * Tapping a chapter card navigates to the chapter notes detail screen.
 *
 * Features:
 * - Card-style chapter groups
 * - Group header format: "{Book Name} {Chapter Number}" with note count subtitle
 * - Navigation to detail view
 * - Pull-to-refresh functionality
 * - Empty state for no notes
 * - Authentication guard
 * - Loading state handling
 *
 * @see Task Group 6: Screen Integration - Notes List Screen
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md
 */

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
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

/**
 * Type for grouped notes by chapter
 */
interface ChapterGroup {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  notes: Note[];
}

/**
 * Helper function to group notes by chapter
 */
function groupNotesByChapter(notes: Note[]): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();

  for (const note of notes) {
    const key = `${note.book_id}-${note.chapter_number}`;

    if (!groups.has(key)) {
      groups.set(key, {
        bookId: note.book_id,
        chapterNumber: note.chapter_number,
        bookName: note.book_name,
        notes: [],
      });
    }

    groups.get(key)?.notes.push(note);
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
 * Notes List Screen Component
 */
export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { notes, isFetchingNotes, refetchNotes } = useNotes();

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Handle refresh action
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchNotes();
    setRefreshing(false);
  };

  /**
   * Handle chapter group press
   * Navigates to detail screen
   */
  const handleChapterPress = async (group: ChapterGroup) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/notes/[bookId]/[chapterNumber]',
      params: {
        bookId: group.bookId,
        chapterNumber: group.chapterNumber,
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
          <ActivityIndicator size="large" color={colors.gold} testID="notes-loading" />
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
            testID="notes-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notes</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.emptyStateTitle}>Please login to view your notes</Text>
          <Text style={styles.emptyStateSubtitle}>
            Sign in to create and access your Bible study notes
          </Text>
          <Pressable
            style={styles.loginButton}
            onPress={handleLoginPress}
            testID="notes-login-button"
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Show loading indicator while fetching notes
  if (isFetchingNotes && notes.length === 0) {
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
            testID="notes-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notes</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} testID="notes-loading" />
        </View>
      </View>
    );
  }

  // Group notes by chapter
  const chapterGroups = groupNotesByChapter(notes);

  // Show empty state if no notes exist
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
            testID="notes-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notes</Text>
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
          <View style={styles.emptyStateContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.textDisabled} />
            <Text style={styles.emptyStateTitle}>No notes yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start taking notes while reading chapters to see them here.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Render notes list with card groups
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
          testID="notes-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notes</Text>
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
        testID="notes-list"
      >
        {chapterGroups.map((group) => (
          <View key={`${group.bookId}-${group.chapterNumber}`} style={styles.chapterGroup}>
            {/* Chapter Group Card */}
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
                  {group.notes.length} {group.notes.length === 1 ? 'note' : 'notes'}
                </Text>
              </View>
              <View style={styles.groupIconContainer}>
                <Ionicons name="chevron-forward" size={20} color={colors.gold} />
              </View>
            </Pressable>
          </View>
        ))}
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
      width: 32, // Same width as back button for centering
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
    // Card Styles matched to HighlightsScreen
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
  });
