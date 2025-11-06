/**
 * ChapterReader Component
 *
 * Renders Bible chapter content with sections, subtitles, verses, and explanations.
 * Supports three reading modes via activeTab prop: summary, byline, detailed.
 *
 * Features:
 * - Chapter title (displayMedium: 32px, bold) with bookmark and notes buttons on the right
 * - Section subtitles (heading2: 20px, semibold)
 * - Verse range captions (caption: 12px, gray500)
 * - Bible text with superscript verse numbers
 * - Markdown rendering for explanation content
 * - Notes management via modals
 * - Text highlighting with character-level precision
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 * @see Task Group 6: Screen Integration - NotesButton and Modals
 * @see Task Group 5: Chapter View Highlight Integration
 */

import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { HighlightEditMenu } from '@/components/bible/HighlightEditMenu';
import type { TextSelection } from '@/components/bible/HighlightedText';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HighlightSelectionSheet } from '@/components/bible/HighlightSelectionSheet';
import { NoteEditModal } from '@/components/bible/NoteEditModal';
import { NotesButton } from '@/components/bible/NotesButton';
import { NotesModal } from '@/components/bible/NotesModal';
import { NoteViewModal } from '@/components/bible/NoteViewModal';
import {
  colors,
  fontSizes,
  fontWeights,
  headerSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { useNotes } from '@/hooks/bible/use-notes';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import type { Note } from '@/types/notes';

// TODO: This will be replaced by a user setting
const PARAGRAPH_VIEW_ENABLED = true;

interface ChapterReaderProps {
  /** Chapter content with verses and sections */
  chapter: ChapterContent;
  /** Active reading mode tab */
  activeTab: ContentTabType;
  /** Optional explanation content (summary/byline/detailed) */
  explanation?: ExplanationContent;
  /** Show only explanations, hide Bible verses (for Explanations view) */
  explanationsOnly?: boolean;
}

/**
 * Selection context for creating highlights
 * Stores the full selection details needed for the API
 */
interface SelectionContext {
  verseNumber: number;
  selection: TextSelection;
}

/**
 * ChapterReader Component
 *
 * Renders the chapter content in the selected reading mode.
 * - When explanationsOnly is false: Shows Bible text with highlights
 * - When explanationsOnly is true: Shows only explanation content
 */
export function ChapterReader({
  chapter,
  explanation,
  explanationsOnly = false,
}: ChapterReaderProps) {
  const { deleteNote } = useNotes();

  // Fetch highlights for this chapter
  const { chapterHighlights, addHighlight, updateHighlightColor, deleteHighlight } = useHighlights({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
  });

  // Notes modal state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Highlight modal state
  const [selectionSheetVisible, setSelectionSheetVisible] = useState(false);
  const [editMenuVisible, setEditMenuVisible] = useState(false);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<number | null>(null);

  /**
   * Handle notes button press
   * Opens the notes modal
   */
  const handleNotesPress = () => {
    setNotesModalVisible(true);
  };

  /**
   * Handle note card press from NotesModal
   * Opens view modal with selected note, closes notes modal
   */
  const handleNotePress = (note: Note) => {
    setSelectedNote(note);
    setNotesModalVisible(false);
    // Small delay to allow modal close animation before opening view modal
    setTimeout(() => {
      setViewModalVisible(true);
    }, 100);
  };

  /**
   * Handle edit button press from NotesModal
   * Opens edit modal with selected note, closes notes modal
   */
  const handleEditNoteFromList = (note: Note) => {
    setSelectedNote(note);
    setNotesModalVisible(false);
    // Small delay to allow modal close animation before opening edit modal
    setTimeout(() => {
      setEditModalVisible(true);
    }, 100);
  };

  /**
   * Handle edit button press from NoteViewModal
   * Opens edit modal with selected note, closes view modal
   */
  const handleEditNoteFromView = (note: Note) => {
    setSelectedNote(note);
    setViewModalVisible(false);
    // Small delay to allow modal close animation before opening edit modal
    setTimeout(() => {
      setEditModalVisible(true);
    }, 100);
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
   * Handle close NotesModal
   */
  const handleNotesModalClose = () => {
    setNotesModalVisible(false);
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
    // Close edit modal and return to notes modal
    setEditModalVisible(false);
    setSelectedNote(null);
  };

  /**
   * Handle long-press on verse for creating new highlight
   * Opens HighlightSelectionSheet for entire verse
   */
  const handleVerseLongPress = (verseNumber: number) => {
    // Find the verse to get its full text
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);

    if (!verse) return;

    // Store selection context for entire verse
    setSelectionContext({
      verseNumber,
      selection: {
        start: 0,
        end: verse.text.length,
        text: verse.text,
      },
    });
    setSelectionSheetVisible(true);
  };

  /**
   * Handle color selection from HighlightSelectionSheet
   * Creates new highlight with optimistic update
   */
  const handleCreateHighlight = async (color: HighlightColor) => {
    if (!selectionContext) return;

    const { verseNumber, selection } = selectionContext;

    try {
      // Create highlight with character-level precision
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseNumber,
        endVerse: verseNumber, // Single verse for now
        color,
        startChar: selection.start,
        endChar: selection.end,
        selectedText: selection.text,
      });

      // Close sheet on success
      setSelectionSheetVisible(false);
      setSelectionContext(null);
    } catch (error) {
      console.error('Failed to create highlight:', error);

      // Check if it's an overlap error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('overlap')) {
        Alert.alert(
          'Highlight Overlap',
          'This text overlaps with an existing highlight. Please delete the existing highlight first or select different text.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert('Error', 'Failed to create highlight. Please try again.', [
          { text: 'OK', style: 'default' },
        ]);
      }

      // Keep sheet open so user can try again or cancel
    }
  };

  /**
   * Handle tap on highlighted text
   * Opens HighlightEditMenu with current color
   */
  const handleHighlightPress = (highlightId: number) => {
    setSelectedHighlightId(highlightId);
    setEditMenuVisible(true);
  };

  /**
   * Handle color change from HighlightEditMenu
   * Updates highlight color with optimistic update
   */
  const handleUpdateHighlightColor = async (color: HighlightColor) => {
    if (!selectedHighlightId) return;

    try {
      await updateHighlightColor(selectedHighlightId, color);

      // Close menu on success
      setEditMenuVisible(false);
      setSelectedHighlightId(null);
    } catch (error) {
      console.error('Failed to update highlight color:', error);
      Alert.alert('Error', 'Failed to update highlight color. Please try again.', [
        { text: 'OK', style: 'default' },
      ]);
    }
  };

  /**
   * Handle delete from HighlightEditMenu
   * Deletes highlight with optimistic update
   */
  const handleDeleteHighlight = async () => {
    if (!selectedHighlightId) return;

    try {
      await deleteHighlight(selectedHighlightId);

      // Close menu on success
      setEditMenuVisible(false);
      setSelectedHighlightId(null);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      Alert.alert('Error', 'Failed to delete highlight. Please try again.', [
        { text: 'OK', style: 'default' },
      ]);
    }
  };

  /**
   * Handle close HighlightSelectionSheet
   */
  const handleSelectionSheetClose = () => {
    setSelectionSheetVisible(false);
    setSelectionContext(null);
  };

  /**
   * Handle close HighlightEditMenu
   */
  const handleEditMenuClose = () => {
    setEditMenuVisible(false);
    setSelectedHighlightId(null);
  };

  // Get current highlight color for edit menu
  const currentHighlight = chapterHighlights.find((h) => h.highlight_id === selectedHighlightId);
  const currentHighlightColor = currentHighlight?.color || 'yellow';

  return (
    <View style={styles.container} collapsable={false}>
      {/* Chapter Title Row with Bookmark and Notes buttons */}
      <View style={styles.titleRow} collapsable={false}>
        <Text style={styles.chapterTitle} accessibilityRole="header">
          {chapter.title}
        </Text>
        <View style={styles.iconButtons}>
          <BookmarkToggle
            bookId={chapter.bookId}
            chapterNumber={chapter.chapterNumber}
            size={headerSpecs.iconSize}
            color={colors.gray900}
          />
          <NotesButton
            bookId={chapter.bookId}
            chapterNumber={chapter.chapterNumber}
            onPress={handleNotesPress}
            size={headerSpecs.iconSize}
            color={colors.gray900}
          />
        </View>
      </View>

      {/* Render Bible verses (only in Bible view) */}
      {!explanationsOnly &&
        chapter.sections.map((section) => (
          <View
            key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}
            style={styles.section}
            testID={`chapter-section-${section.startVerse}`}
            collapsable={false}
          >
            {/* Section Subtitle (if present) */}
            {section.subtitle && (
              <Text style={styles.sectionSubtitle} accessibilityRole="header">
                {section.subtitle}
              </Text>
            )}

            {/* Verse Range Caption */}
            <Text
              style={styles.verseRange}
              accessibilityLabel={`Verses ${section.startVerse}-${section.endVerse}`}
            >
              {section.startVerse}-{section.endVerse}
            </Text>

            {/* Verses with Highlighting */}
            {PARAGRAPH_VIEW_ENABLED ? (
              <Text style={styles.verseTextParagraph}>
                {section.verses.map((verse) => (
                  <Text key={verse.verseNumber}>
                    <Text style={styles.verseNumber}>{verse.verseNumber}</Text>
                    <HighlightedText
                      text={` ${verse.text}`}
                      verseNumber={verse.verseNumber}
                      highlights={chapterHighlights}
                      onHighlightPress={handleHighlightPress}
                      onVerseLongPress={handleVerseLongPress}
                      style={styles.verseText}
                    />
                  </Text>
                ))}
              </Text>
            ) : (
              <View style={styles.versesContainer}>
                {section.verses.map((verse) => (
                  <View key={verse.verseNumber} style={styles.verseRow}>
                    <Text
                      style={styles.verseNumber}
                      accessibilityLabel={`Verse ${verse.verseNumber}`}
                    >
                      {verse.verseNumber}
                    </Text>
                    <HighlightedText
                      text={verse.text}
                      verseNumber={verse.verseNumber}
                      highlights={chapterHighlights}
                      onHighlightPress={handleHighlightPress}
                      onVerseLongPress={handleVerseLongPress}
                      style={styles.verseText}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

      {/* Explanation Content (Markdown) - shown in Explanations view */}
      {explanation && (
        <View style={styles.explanationContainer} collapsable={false}>
          <Markdown style={markdownStyles}>{explanation.content}</Markdown>
        </View>
      )}

      {/* Notes Modal - Chapter notes view */}
      <NotesModal
        visible={notesModalVisible}
        bookId={chapter.bookId}
        chapterNumber={chapter.chapterNumber}
        bookName={chapter.title.split(' ')[0]} // Extract book name from title
        onClose={handleNotesModalClose}
        onNotePress={handleNotePress}
        onEditNote={handleEditNoteFromList}
        onDeleteNote={handleDeleteNote}
      />

      {/* Note View Modal - Read-only view */}
      {selectedNote && (
        <NoteViewModal
          visible={viewModalVisible}
          note={selectedNote}
          bookName={chapter.title.split(' ')[0]}
          chapterNumber={chapter.chapterNumber}
          onClose={handleViewModalClose}
          onEdit={handleEditNoteFromView}
          onDelete={handleDeleteNote}
        />
      )}

      {/* Note Edit Modal - Edit mode */}
      {selectedNote && (
        <NoteEditModal
          visible={editModalVisible}
          note={selectedNote}
          bookName={chapter.title.split(' ')[0]}
          chapterNumber={chapter.chapterNumber}
          onClose={handleEditModalClose}
          onSave={handleNoteSave}
        />
      )}

      {/* Highlight Selection Sheet - Create new highlight */}
      {selectionContext && (
        <HighlightSelectionSheet
          visible={selectionSheetVisible}
          verseRange={{
            start: selectionContext.verseNumber,
            end: selectionContext.verseNumber,
          }}
          onColorSelect={handleCreateHighlight}
          onClose={handleSelectionSheetClose}
        />
      )}

      {/* Highlight Edit Menu - Edit/delete existing highlight */}
      {selectedHighlightId && (
        <HighlightEditMenu
          visible={editMenuVisible}
          currentColor={currentHighlightColor}
          onColorChange={handleUpdateHighlightColor}
          onDelete={handleDeleteHighlight}
          onClose={handleEditMenuClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Title row with bookmark and notes buttons on the right
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  chapterTitle: {
    flex: 1,
    fontSize: fontSizes.displayMedium,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.displayMedium * lineHeights.display,
    color: colors.gray900,
    marginRight: spacing.md, // Space between title and icons
  },
  // Container for icon buttons
  iconButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    marginBottom: spacing.xxxl,
  },
  sectionSubtitle: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  verseRange: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.caption * lineHeights.ui,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  versesContainer: {
    flexDirection: 'column',
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  verseNumber: {
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    color: colors.gray500,
    marginRight: spacing.xs,
    marginTop: -4, // Superscript positioning
  },
  verseText: {
    flex: 1,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    color: colors.gray900,
  },
  verseTextParagraph: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  explanationContainer: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
});

/**
 * Markdown Styles
 *
 * Custom styling for react-native-markdown-display
 * Ensures explanation content follows design system
 *
 * @see Spec lines 778-821 (Markdown rendering)
 */
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
  },
  heading1: {
    fontSize: fontSizes.heading1,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.heading1 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  heading2: {
    fontSize: fontSizes.heading2,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading2 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading3: {
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.heading3 * lineHeights.heading,
    color: colors.gray900,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  strong: {
    fontWeight: fontWeights.bold,
    color: colors.gray900,
  },
  em: {
    fontStyle: 'italic',
    color: colors.gray900,
  },
  list_item: {
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  bullet_list: {
    marginBottom: spacing.lg,
  },
  ordered_list: {
    marginBottom: spacing.lg,
  },
  code_inline: {
    fontFamily: 'monospace',
    fontSize: fontSizes.bodySmall,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
    color: colors.gray900,
  },
  fence: {
    fontFamily: 'monospace',
    fontSize: fontSizes.bodySmall,
    backgroundColor: colors.gray50,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.lg,
    color: colors.gray900,
  },
  blockquote: {
    backgroundColor: colors.gray50,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },
  hr: {
    backgroundColor: colors.gray200,
    height: 1,
    marginVertical: spacing.xl,
  },
});
