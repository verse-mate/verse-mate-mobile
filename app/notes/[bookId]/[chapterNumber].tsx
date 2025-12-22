import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteCard } from '@/components/bible/NoteCard';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { NoteOptionsModal } from '@/components/bible/NoteOptionsModal';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useNotes } from '@/hooks/bible/use-notes';
import type { Note } from '@/types/notes';

export default function ChapterNotesScreen() {
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

  const { getNotesByChapter, isFetchingNotes, deleteNote } = useNotes();
  const { showToast } = useToast();

  // Get notes for this chapter
  const chapterNotes = useMemo(
    () => getNotesByChapter(parsedBookId, parsedChapterNumber),
    [getNotesByChapter, parsedBookId, parsedChapterNumber]
  );

  // Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleNotePress = async (note: Note) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedNoteId((prevId) => (prevId === note.note_id ? null : note.note_id));
  };

  const handleMenuPress = async (note: Note) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNote(note);
    setOptionsModalVisible(true);
  };

  // Passed to Options Modal -> triggers Edit Modal
  const handleEditNote = () => {
    // Options modal closes itself before calling this
    setEditModalVisible(true);
  };

  const handleNoteSave = () => {
    setEditModalVisible(false);
    setSelectedNote(null);
  };

  const handleActionComplete = (action: string) => {
    if (action === 'copy') {
      showToast('Note copied to clipboard');
    }
  };

  // Track if we've loaded data at least once
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isFetchingNotes && chapterNotes.length > 0) {
      hasLoadedRef.current = true;
    }
  }, [isFetchingNotes, chapterNotes.length]);

  // Navigate back if all notes are deleted
  useEffect(() => {
    if (hasLoadedRef.current && !isFetchingNotes && chapterNotes.length === 0) {
      // All notes deleted, navigate back to main notes page
      router.back();
    }
  }, [chapterNotes.length, isFetchingNotes]);

  if (isFetchingNotes && chapterNotes.length === 0) {
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
          <ActivityIndicator size="large" color={colors.gold} />
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
        {chapterNotes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No notes found</Text>
          </View>
        ) : (
          <View style={styles.notesList}>
            {chapterNotes.map((note) => (
              <NoteCard
                key={note.note_id}
                note={note}
                onPress={handleNotePress}
                onEdit={(n) => {
                  setSelectedNote(n);
                  setEditModalVisible(true);
                }}
                onMenuPress={handleMenuPress}
                isExpanded={expandedNoteId === note.note_id}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Note Options Modal (kept for menu button) */}
      <NoteOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        note={selectedNote}
        deleteNote={deleteNote}
        onEdit={handleEditNote}
        onActionComplete={handleActionComplete}
      />

      {/* Edit Modal */}
      {selectedNote && (
        <NoteEditModal
          visible={editModalVisible}
          note={selectedNote}
          bookName={selectedNote.book_name}
          chapterNumber={selectedNote.chapter_number}
          onClose={() => {
            setEditModalVisible(false);
            setSelectedNote(null);
          }}
          onSave={handleNoteSave}
          onDelete={deleteNote}
        />
      )}
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
      // No background or border for header in new design
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
      width: 40,
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
      paddingVertical: spacing.sm,
      paddingHorizontal: 0, // Cards have margins
    },
    notesList: {
      gap: 8, // 8px spacing
      paddingHorizontal: 16, // Padding for list content
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
