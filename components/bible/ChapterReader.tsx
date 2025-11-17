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
import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
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
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { useNotes } from '@/hooks/bible/use-notes';
import { useAuth } from '@/hooks/use-auth';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import type { Note } from '@/types/notes';

// TODO: This will be replaced by a user setting
const PARAGRAPH_VIEW_ENABLED = true;

/**
 * Convert a number to Unicode superscript characters
 * Maps each digit to its Unicode superscript equivalent
 * Works for any combination of digits (e.g., 1 → ¹, 42 → ⁴², 150 → ¹⁵⁰)
 */
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return num
    .toString()
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('');
}

/**
 * Check if a verse text starts with a Biblical transition word
 * Used to detect natural paragraph break points
 */
function startsWithTransitionWord(text: string): boolean {
  const transitions = [
    'Then',
    'After',
    'Meanwhile',
    'Now',
    'When',
    'While',
    'But',
    'Yet',
    'However',
    'Nevertheless',
    'Therefore',
    'Thus',
    'So',
    'Accordingly',
    'Moreover',
    'Furthermore',
    'Also',
    'And',
  ];

  const firstWord = text.trim().split(/\s+/)[0];
  // Remove punctuation for comparison
  const cleanWord = firstWord.replace(/[.,;:!?'"]/g, '');
  return transitions.includes(cleanWord);
}

/**
 * Calculate intelligent paragraph break points for a section
 * Returns array of verse numbers after which to insert breaks
 */
function calculateBreakPoints(verses: { verseNumber: number; text: string }[]): number[] {
  const breakAfter: number[] = [];

  // Don't break short sections (3 verses or fewer)
  if (verses.length <= 3) return [];

  let versesSinceLastBreak = 0;

  for (let i = 0; i < verses.length - 1; i++) {
    const currentVerse = verses[i];
    const nextVerse = verses[i + 1];
    versesSinceLastBreak++;

    // Force break after 5 verses maximum
    if (versesSinceLastBreak >= 5) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
      continue;
    }

    // Check for natural break: ends with period + next starts with transition
    const endsWithPeriod = currentVerse.text.trim().endsWith('.');
    const nextStartsWithTransition = startsWithTransitionWord(nextVerse.text);

    // Break if: ends with period + next has transition + at least 2 verses in group
    if (endsWithPeriod && nextStartsWithTransition && versesSinceLastBreak >= 2) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
    }
  }

  return breakAfter;
}

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
  const { user } = useAuth();

  // Fetch highlights for this chapter
  const { chapterHighlights, addHighlight, updateHighlightColor, deleteHighlight } = useHighlights({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
  });

  // Fetch auto-highlights for this chapter
  const { autoHighlights } = useAutoHighlights({
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

  // Auto-highlight modal state
  const [autoHighlightTooltipVisible, setAutoHighlightTooltipVisible] = useState(false);
  const [selectedAutoHighlight, setSelectedAutoHighlight] = useState<AutoHighlight | null>(null);

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
   * Handle tap on auto-highlighted text
   * Opens AutoHighlightTooltip with theme info
   */
  const handleAutoHighlightPress = (autoHighlight: AutoHighlight) => {
    setSelectedAutoHighlight(autoHighlight);
    setAutoHighlightTooltipVisible(true);
  };

  /**
   * Handle save auto-highlight as user highlight
   * Creates a new user highlight with the same verse range and color
   */
  const handleSaveAutoHighlightAsUserHighlight = async (
    color: HighlightColor,
    verseRange: { start: number; end: number }
  ) => {
    try {
      // Create new user highlight with the auto-highlight's verse range and color
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseRange.start,
        endVerse: verseRange.end,
        color,
      });
      Alert.alert('Success', 'Highlight saved to your collection!');
    } catch (error) {
      console.error('Failed to save auto-highlight as user highlight:', error);
      Alert.alert('Error', 'Failed to save highlight. Please try again.');
    }
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
              (() => {
                // Calculate smart break points for this section
                const breakPoints = new Set(calculateBreakPoints(section.verses));
                const groups: (typeof section.verses)[] = [];
                let currentGroup: typeof section.verses = [];

                // Group verses based on break points
                section.verses.forEach((verse, index) => {
                  currentGroup.push(verse);

                  // Check if we should break after this verse
                  if (breakPoints.has(verse.verseNumber) || index === section.verses.length - 1) {
                    groups.push([...currentGroup]);
                    currentGroup = [];
                  }
                });

                // Render verse groups with spacing between them
                return groups.map((group, groupIndex) => {
                  // Create stable key from first and last verse numbers in group
                  const groupKey = `group-${group[0].verseNumber}-${group[group.length - 1].verseNumber}`;
                  return (
                    <View key={groupKey}>
                      <Text style={styles.verseTextParagraph}>
                        {group.map((verse, verseIndex) => (
                          <Text key={verse.verseNumber}>
                            <Text style={styles.verseNumberSuperscript}>
                              {verseIndex > 0 ? ' \u2009' : ''}
                              {/* Regular space + thin space before verse number */}
                              {toSuperscript(verse.verseNumber)}
                              {'\u2009'}
                              {/* Thin space after verse number */}
                            </Text>
                            <HighlightedText
                              text={verse.text}
                              verseNumber={verse.verseNumber}
                              highlights={chapterHighlights}
                              autoHighlights={autoHighlights}
                              onHighlightPress={handleHighlightPress}
                              onAutoHighlightPress={handleAutoHighlightPress}
                              onVerseLongPress={handleVerseLongPress}
                              style={styles.verseText}
                            />
                          </Text>
                        ))}
                      </Text>
                      {/* Add spacing between paragraph groups */}
                      {groupIndex < groups.length - 1 && <View style={{ height: spacing.md }} />}
                    </View>
                  );
                });
              })()
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
                      autoHighlights={autoHighlights}
                      onHighlightPress={handleHighlightPress}
                      onAutoHighlightPress={handleAutoHighlightPress}
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
          <Markdown style={markdownStyles}>
            {explanation.content.replace(/###\s*Summary\s*\n/gi, '')}
          </Markdown>
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

      {/* Auto-Highlight Tooltip - Show AI-generated highlight info */}
      <AutoHighlightTooltip
        autoHighlight={selectedAutoHighlight}
        visible={autoHighlightTooltipVisible}
        onClose={() => {
          setAutoHighlightTooltipVisible(false);
          setSelectedAutoHighlight(null);
        }}
        onSaveAsUserHighlight={handleSaveAutoHighlightAsUserHighlight}
        isLoggedIn={!!user}
      />
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
    marginTop: -4, // Superscript positioning (for verse row mode)
  },
  verseNumberSuperscript: {
    fontSize: fontSizes.bodyLarge, // Same as body text - Unicode chars are already small
    fontWeight: fontWeights.bold,
    color: colors.gray500,
    // Spacing handled by thin space Unicode characters (\u2009) in JSX
  },
  verseText: {
    flex: 1,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * 2.0,
    color: colors.gray900,
  },
  verseTextParagraph: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.bodyLarge * 2.0,
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
    fontSize: fontSizes.bodyLarge,
    lineHeight: fontSizes.bodyLarge * 2.0,
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
    fontSize: fontSizes.bodyLarge,
    lineHeight: fontSizes.bodyLarge * 2.0,
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
    fontSize: fontSizes.bodyLarge,
    lineHeight: fontSizes.bodyLarge * 2.0,
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
