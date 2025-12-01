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
 * - Text highlighting with character-level precision
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 * @see Task Group 5: Chapter View Highlight Integration
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { HighlightEditMenu } from '@/components/bible/HighlightEditMenu';
import type { TextSelection } from '@/components/bible/HighlightedText';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HighlightSelectionSheet } from '@/components/bible/HighlightSelectionSheet';
import { NotesButton } from '@/components/bible/NotesButton';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { HIGHLIGHT_COLORS } from '@/constants/highlight-colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';
import { useAuth } from '@/hooks/use-auth';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';

// TODO: This will be replaced by a user setting
const PARAGRAPH_VIEW_ENABLED = true;

/**
 * Convert a number to Unicode superscript characters
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
  const cleanWord = firstWord.replace(/[.,;:!?'"]/g, '');
  return transitions.includes(cleanWord);
}

/**
 * Calculate intelligent paragraph break points for a section
 */
function calculateBreakPoints(verses: { verseNumber: number; text: string }[]): number[] {
  const breakAfter: number[] = [];

  if (verses.length <= 3) return [];

  let versesSinceLastBreak = 0;

  for (let i = 0; i < verses.length - 1; i++) {
    const currentVerse = verses[i];
    const nextVerse = verses[i + 1];
    versesSinceLastBreak++;

    if (versesSinceLastBreak >= 5) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
      continue;
    }

    const endsWithPeriod = currentVerse.text.trim().endsWith('.');
    const nextStartsWithTransition = startsWithTransitionWord(nextVerse.text);

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
  /** Callback to report Y-position of verse sections for scrolling */
  onContentLayout?: (sectionPositions: Record<number, number>) => void;
  /** Callback to open notes modal */
  onOpenNotes?: () => void;
}

/**
 * Check if a verse number separator should be highlighted
 */
function getVerseNumberHighlight(
  verseNumber: number,
  highlights: Highlight[],
  autoHighlights: AutoHighlight[]
): { color: string; isAuto: boolean } | null {
  const multiVerseHighlight = highlights.find(
    (h) =>
      h.start_verse < verseNumber && h.end_verse >= verseNumber && h.start_verse !== h.end_verse
  );

  if (multiVerseHighlight) {
    return { color: multiVerseHighlight.color, isAuto: false };
  }

  const multiVerseAutoHighlight = autoHighlights.find(
    (h) =>
      h.start_verse < verseNumber && h.end_verse >= verseNumber && h.start_verse !== h.end_verse
  );

  if (multiVerseAutoHighlight) {
    return { color: multiVerseAutoHighlight.theme_color, isAuto: true };
  }

  return null;
}

interface SelectionContext {
  verseNumber: number;
  selection: TextSelection;
}

export function ChapterReader({
  chapter,
  explanation,
  explanationsOnly = false,
  onContentLayout,
  onOpenNotes,
}: ChapterReaderProps) {
  const { colors, mode } = useTheme();
  const specs = getHeaderSpecs(mode);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Store verse layouts: map startVerse -> Y position
  const sectionPositions = useRef<Record<number, number>>({});
  const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, []);

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

  // Highlight modal state
  const [selectionSheetVisible, setSelectionSheetVisible] = useState(false);
  const [editMenuVisible, setEditMenuVisible] = useState(false);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<number | null>(null);

  // Auto-highlight modal state
  const [autoHighlightTooltipVisible, setAutoHighlightTooltipVisible] = useState(false);
  const [selectedAutoHighlight, setSelectedAutoHighlight] = useState<AutoHighlight | null>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  /**
   * Handle layout of a verse/paragraph
   */
  const handleVerseLayout = (startVerse: number, y: number) => {
    sectionPositions.current[startVerse] = y;

    // Debounce layout updates to prevent excessive updates and premature scrolling
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }

    layoutTimeoutRef.current = setTimeout(() => {
      onContentLayout?.(sectionPositions.current);
    }, 100);
  };

  /**
   * Handle notes button press
   */
  const handleNotesPress = () => {
    onOpenNotes?.();
  };

  /**
   * Handle long-press on verse for creating new highlight
   */
  const handleVerseLongPress = (verseNumber: number) => {
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);

    if (!verse) return;

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
   */
  const handleCreateHighlight = async (color: HighlightColor) => {
    if (!selectionContext) return;

    const { verseNumber, selection } = selectionContext;

    try {
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseNumber,
        endVerse: verseNumber,
        color,
        startChar: selection.start,
        endChar: selection.end,
        selectedText: selection.text,
      });

      setSelectionSheetVisible(false);
      setSelectionContext(null);
    } catch (error) {
      console.error('Failed to create highlight:', error);

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
    }
  };

  /**
   * Handle tap on highlighted text
   */
  const handleHighlightPress = (highlightId: number) => {
    setSelectedHighlightId(highlightId);
    setEditMenuVisible(true);
  };

  /**
   * Handle tap on auto-highlighted text
   */
  const handleAutoHighlightPress = (autoHighlight: AutoHighlight) => {
    setSelectedAutoHighlight(autoHighlight);
    setAutoHighlightTooltipVisible(true);
  };

  /**
   * Handle save auto-highlight as user highlight
   */
  const handleSaveAutoHighlightAsUserHighlight = async (
    color: HighlightColor,
    verseRange: { start: number; end: number },
    selectedText?: string
  ) => {
    try {
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseRange.start,
        endVerse: verseRange.end,
        color,
        selectedText,
      });
      showToast('Highlight saved to your collection!');
    } catch (error) {
      console.error('Failed to save auto-highlight as user highlight:', error);
      setErrorModalVisible(true);
    }
  };

  /**
   * Handle color change from HighlightEditMenu
   */
  const handleUpdateHighlightColor = async (color: HighlightColor) => {
    if (!selectedHighlightId) return;

    try {
      await updateHighlightColor(selectedHighlightId, color);
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
   */
  const handleDeleteHighlight = async () => {
    if (!selectedHighlightId) return;

    try {
      await deleteHighlight(selectedHighlightId);
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
            size={specs.iconSize}
            color={colors.textPrimary}
          />
          <NotesButton
            bookId={chapter.bookId}
            chapterNumber={chapter.chapterNumber}
            onPress={handleNotesPress}
            size={specs.iconSize}
            color={colors.textPrimary}
          />
        </View>
      </View>

      {/* Render Bible verses (only in Bible view) */}
      {!explanationsOnly &&
        chapter.sections.map((section) => (
          <Fragment key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}>
            {/* Section Subtitle (if present) */}
            {section.subtitle ? (
              <Text style={styles.sectionSubtitle} accessibilityRole="header">
                {section.subtitle}
              </Text>
            ) : null}
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
                const breakPoints = new Set(calculateBreakPoints(section.verses));
                const groups: (typeof section.verses)[] = [];
                let currentGroup: typeof section.verses = [];

                section.verses.forEach((verse, index) => {
                  currentGroup.push(verse);
                  if (breakPoints.has(verse.verseNumber) || index === section.verses.length - 1) {
                    groups.push([...currentGroup]);
                    currentGroup = [];
                  }
                });

                return groups.map((group, groupIndex) => {
                  const groupKey = `group-${group[0].verseNumber}-${group[group.length - 1].verseNumber}`;
                  return (
                    <View
                      key={groupKey}
                      onLayout={(e) =>
                        handleVerseLayout(group[0].verseNumber, e.nativeEvent.layout.y)
                      }
                    >
                      <Text style={styles.verseTextParagraph}>
                        {group.map((verse, verseIndex) => {
                          const verseNumberHighlight = getVerseNumberHighlight(
                            verse.verseNumber,
                            chapterHighlights,
                            autoHighlights
                          );

                          let backgroundColor: string | undefined;
                          if (verseNumberHighlight) {
                            const baseColor =
                              HIGHLIGHT_COLORS[
                                verseNumberHighlight.color as keyof typeof HIGHLIGHT_COLORS
                              ];
                            const opacity = verseNumberHighlight.isAuto ? 0.2 : 0.35;
                            const opacityHex = Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0');
                            backgroundColor = baseColor + opacityHex;
                          }

                          return (
                            <Text key={verse.verseNumber}>
                              <Text
                                style={[
                                  styles.verseNumberSuperscript,
                                  backgroundColor && {
                                    backgroundColor,
                                  },
                                ]}
                              >
                                {verseIndex > 0 ? ' \u2009' : ''}
                                {toSuperscript(verse.verseNumber)}
                                {'\u2009'}
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
                          );
                        })}
                      </Text>
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
            <View style={{ height: spacing.xxxl }} />
          </Fragment>
        ))}

      {/* Explanation Content */}
      {explanation && (
        <View style={styles.explanationContainer} collapsable={false}>
          <Markdown style={markdownStyles}>
            {explanation.content.replace(/#{1,6}\s*Summary\s*\n/gi, '\n')}
          </Markdown>
        </View>
      )}

      {/* Highlight Selection Sheet */}
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

      {/* Highlight Edit Menu */}
      {selectedHighlightId && (
        <HighlightEditMenu
          visible={editMenuVisible}
          currentColor={currentHighlightColor}
          onColorChange={handleUpdateHighlightColor}
          onDelete={handleDeleteHighlight}
          onClose={handleEditMenuClose}
        />
      )}

      {/* Auto-Highlight Tooltip */}
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

      {/* Error Modal */}
      <ErrorModal
        visible={errorModalVisible}
        message="Failed to save highlight. Please try again."
        onClose={() => setErrorModalVisible(false)}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
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
      color: colors.textPrimary,
      marginRight: spacing.md,
    },
    iconButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sectionSubtitle: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    verseRange: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.regular,
      lineHeight: fontSizes.caption * lineHeights.ui,
      color: colors.textTertiary,
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
      color: colors.textTertiary,
      marginRight: spacing.xs,
      marginTop: -4,
    },
    verseNumberSuperscript: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.bold,
      color: colors.textTertiary,
    },
    verseText: {
      flex: 1,
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.regular,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
    },
    verseTextParagraph: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: fontWeights.regular,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    explanationContainer: {
      marginTop: spacing.xxxl,
      paddingTop: spacing.xxl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

const createMarkdownStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    body: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      lineHeight: fontSizes.heading1 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    heading2: {
      fontSize: fontSizes.heading2,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading2 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    heading3: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      lineHeight: fontSizes.heading3 * lineHeights.heading,
      color: colors.textPrimary,
      marginTop: 64,
      marginBottom: spacing.sm,
    },
    paragraph: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    strong: {
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    em: {
      fontStyle: 'italic',
      color: colors.textPrimary,
    },
    list_item: {
      fontSize: fontSizes.bodyLarge,
      lineHeight: fontSizes.bodyLarge * 2.0,
      color: colors.textPrimary,
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
      backgroundColor: colors.backgroundElevated,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 3,
      color: colors.textPrimary,
    },
    fence: {
      fontFamily: 'monospace',
      fontSize: fontSizes.bodySmall,
      backgroundColor: colors.backgroundElevated,
      padding: spacing.md,
      borderRadius: 4,
      marginBottom: spacing.lg,
      color: colors.textPrimary,
    },
    blockquote: {
      backgroundColor: colors.backgroundElevated,
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
      backgroundColor: colors.border,
      height: 1,
      marginVertical: spacing.xl,
    },
  });
