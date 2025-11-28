/**
 * Notes List Screen
 *
 * Displays user's notes grouped by chapter in collapsible sections.
 * Each group shows book name, chapter number, and note count.
 *
 * Features:
 * - Collapsible chapter groups (collapsed by default)
 * - Group header format: "{Book Name} {Chapter Number} ({count} notes)"
 * - Chevron icon rotates on expand/collapse
 * - Individual note cards within expanded groups
 * - Tap note to view full content in modal
 * - Edit and delete actions from modal
 * - Pull-to-refresh functionality
 * - Empty state for no notes
 * - Authentication guard
 * - Loading state handling
 *
 * @see Task Group 6: Screen Integration - Notes List Screen
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 80-92)
 * @see Reference: app/bookmarks.tsx
 *
 * @example
 * Navigation: router.push('/notes')
 * Accessible from hamburger menu
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '@/components/bible/NoteCard';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { NoteViewModal } from '@/components/bible/NoteViewModal';
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
 *
 * Layout:
 * - View for proper screen padding
 * - Header with "Notes" title and back button
 * - ScrollView list of collapsible chapter groups
 * - Empty state when no notes
 * - Login prompt when not authenticated
 * - Loading indicator during fetch
 *
 * Chapter Group Format:
 * - Header: "{Book Name} {Chapter Number} ({count} notes)" with chevron
 * - Expanded: Shows individual note cards
 * - Collapsed: Only shows header
 */
export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { notes, isFetchingNotes, refetchNotes, deleteNote } = useNotes();

  // Expanded chapter groups state
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

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
   * Handle note card press
   * Opens view modal with selected note
   */
  const handleNotePress = (note: Note) => {
    setSelectedNote(note);
    setViewModalVisible(true);
  };

  /**
   * Handle edit button press from NoteViewModal
   * Opens edit modal with selected note
   */
  const handleEditNote = (note: Note) => {
    setViewModalVisible(false);
    setSelectedNote(note);
    setEditModalVisible(true);
  };

  /**
   * Handle delete button press from NoteViewModal
   * Shows confirmation dialog and deletes note
   */
  const handleDeleteNote = (note: Note) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(note.note_id);
            // Close view modal after successful deletion
            setViewModalVisible(false);
            setSelectedNote(null);
          } catch (error) {
            console.error('Failed to delete note:', error);
            Alert.alert('Error', 'Failed to delete note. Please try again.');
          }
        },
      },
    ]);
  };

  /**
   * Handle close NoteViewModal
   */
  const handleViewModalClose = () => {
    setViewModalVisible(false);
    setSelectedNote(null);
  };

  /**
   * Handle close NoteEditModal
   */
  const handleEditModalClose = () => {
    setEditModalVisible(false);
    setSelectedNote(null);
  };

  /**
   * Handle successful note save from NoteEditModal
   */
  const handleNoteSave = () => {
    // Close edit modal
    setEditModalVisible(false);
    setSelectedNote(null);
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
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.emptyStateTitle}>No notes yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Start taking notes while reading chapters to see them here.
          </Text>
        </View>
      </View>
    );
  }

  // Render notes list with collapsible groups
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
                  {group.bookName} {group.chapterNumber} ({group.notes.length}{' '}
                  {group.notes.length === 1 ? 'note' : 'notes'})
                </Text>
                <Ionicons name={chevronIcon} size={20} color={colors.textSecondary} />
              </Pressable>

              {/* Chapter Group Content (Expanded) */}
              {isExpanded && (
                <View style={styles.groupContent}>
                  {group.notes.map((note) => (
                    <NoteCard
                      key={note.note_id}
                      note={note}
                      onPress={handleNotePress}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Note View Modal - Read-only view */}
      {selectedNote && (
        <NoteViewModal
          visible={viewModalVisible}
          note={selectedNote}
          bookName={selectedNote.book_name}
          chapterNumber={selectedNote.chapter_number}
          onClose={handleViewModalClose}
          onEdit={handleEditNote}
          onDelete={handleDeleteNote}
        />
      )}

      {/* Note Edit Modal - Edit mode */}
      {selectedNote && (
        <NoteEditModal
          visible={editModalVisible}
          note={selectedNote}
          bookName={selectedNote.book_name}
          chapterNumber={selectedNote.chapter_number}
          onClose={handleEditModalClose}
          onSave={handleNoteSave}
        />
      )}
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
      color: colors.background,
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
      backgroundColor: colors.backgroundElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    groupHeaderPressed: {
      backgroundColor: colors.divider,
    },
    groupTitle: {
      flex: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    groupContent: {
      backgroundColor: colors.background,
      paddingVertical: spacing.sm,
    },
  });
