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
import { useState } from 'react';
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
import { IconDocument } from '@/components/ui/icons';
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
  const styles = createStyles(colors);
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
          <IconDocument width={64} height={64} color={colors.textDisabled} />
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
            <IconDocument width={64} height={64} color={colors.textDisabled} />
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
          <Pressable
            key={`${group.bookId}-${group.chapterNumber}`}
            style={({ pressed }) => [styles.noteItem, pressed && styles.noteItemPressed]}
            onPress={() => handleChapterPress(group)}
            testID={`chapter-group-${group.bookId}-${group.chapterNumber}`}
          >
            <View style={styles.noteItemContent}>
              <View style={styles.noteIconContainer}>
                <IconDocument width={24} height={24} color={colors.gold} />
              </View>
              <Text style={styles.noteText}>
                {group.bookName} {group.chapterNumber}
              </Text>
            </View>

            <View style={styles.rightContent}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{group.notes.length}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
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
      gap: 16, // Spacing between items
    },
    noteItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12, // Achieve ~48px total height
      paddingHorizontal: 16,
      marginHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    noteItemPressed: {
      opacity: 0.7,
    },
    noteItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    noteIconContainer: {
      marginRight: 8, // 8px gap between icon and text
    },
    noteText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // 8px gap between badge and chevron
    },
    countBadge: {
      backgroundColor: 'rgba(176, 154, 109, 0.1)', // Gold with 10% opacity
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      minWidth: 24,
      alignItems: 'center',
    },
    countText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary, // Or colors.gold if text should be gold
    },
  });
