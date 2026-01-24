/**
 * ChapterReader Component
 *
 * Renders Bible chapter content with sections, subtitles, verses, and explanations.
 * Supports three reading modes via activeTab prop: summary, byline, detailed.
 *
 * Features:
 * - Chapter title (displayMedium: 32px, bold) with bookmark, notes, and share buttons on the right
 * - Section subtitles (heading2: 20px, semibold)
 * - Verse range captions (caption: 12px, gray500)
 * - Bible text with superscript verse numbers
 * - Markdown rendering for explanation content
 * - Text highlighting with character-level precision
 * - Notes management via modals
 * - Share functionality for chapter links
 *
 * @see Spec lines 778-821 (Markdown rendering)
 * @see Task Group 4: Add Bookmark Toggle to Chapter Reading Screen
 * @see Task Group 5: Chapter View Highlight Integration
 * @see Task Group 6: Screen Integration - NotesButton and Modals
 * @see Task Group 3: Share Button and UI Integration
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { HighlightedText, type WordSelection } from '@/components/bible/HighlightedText';
import { NotesButton } from '@/components/bible/NotesButton';
import { ShareButton } from '@/components/bible/ShareButton';
import { WordDefinitionTooltip } from '@/components/bible/WordDefinitionTooltip';
import {
  fontSizes,
  fontWeights,
  type getColors,
  getHeaderSpecs,
  lineHeights,
  spacing,
} from '@/constants/bible-design-tokens';
import type { HighlightColor } from '@/constants/highlight-colors';
import { getHighlightColor } from '@/constants/highlight-colors';
import { useBibleInteraction } from '@/contexts/BibleInteractionContext';
import { isElementVisible, useTextVisibility } from '@/contexts/TextVisibilityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import type { Highlight } from '@/hooks/bible/use-highlights';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import {
  findGroupByHighlightId,
  groupConsecutiveHighlights,
} from '@/utils/bible/groupConsecutiveHighlights';

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
  const cleanWord = firstWord.replace(/[.,;:!?"']/g, '');
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
  /** Optional filtered highlights (overrides context highlights) */
  filteredHighlights?: Highlight[];
  /** Optional filtered auto-highlights (overrides context auto-highlights) */
  filteredAutoHighlights?: AutoHighlight[];
}

/**
 * Check if the end of a verse is highlighted
 */
function getEndHighlight(
  verseNumber: number,
  textLength: number,
  highlights: Highlight[],
  autoHighlights: AutoHighlight[]
): { color: string; isAuto: boolean } | null {
  // Check user highlights
  const highlight = highlights.find((h) => {
    // Highlight strictly after this verse -> irrelevant
    if (h.start_verse > verseNumber) return false;
    // Highlight strictly before this verse -> irrelevant
    if (h.end_verse < verseNumber) return false;

    // If highlight ends after this verse, it definitely covers the end
    if (h.end_verse > verseNumber) return true;

    // If highlight ends on this verse, check char
    // Assuming null end_char means end of verse
    const endChar = (h.end_char as number | null) ?? textLength;
    return endChar >= textLength;
  });

  if (highlight) {
    return { color: highlight.color, isAuto: false };
  }

  // Check auto-highlights
  const autoHighlight = autoHighlights.find((h) => {
    // Auto-highlights are always full verse ranges
    return h.start_verse <= verseNumber && h.end_verse >= verseNumber;
  });

  if (autoHighlight) {
    return { color: autoHighlight.theme_color, isAuto: true };
  }

  return null;
}

/**
 * Check if the start of a verse is highlighted
 */
function getStartHighlight(
  verseNumber: number,
  highlights: Highlight[],
  autoHighlights: AutoHighlight[]
): { color: string; isAuto: boolean } | null {
  // Check user highlights
  const highlight = highlights.find((h) => {
    // Highlight strictly after this verse -> irrelevant
    if (h.start_verse > verseNumber) return false;
    // Highlight strictly before this verse -> irrelevant
    if (h.end_verse < verseNumber) return false;

    // If highlight starts before this verse, it definitely covers the start
    if (h.start_verse < verseNumber) return true;

    // If highlight starts on this verse, check char
    const startChar = (h.start_char as number | null) ?? 0;
    return startChar === 0;
  });

  if (highlight) {
    return { color: highlight.color, isAuto: false };
  }

  // Check auto-highlights
  const autoHighlight = autoHighlights.find((h) => {
    return h.start_verse <= verseNumber && h.end_verse >= verseNumber;
  });

  if (autoHighlight) {
    return { color: autoHighlight.theme_color, isAuto: true };
  }

  return null;
}

export function ChapterReader({
  chapter,
  activeTab,
  explanation,
  explanationsOnly = false,
  onContentLayout,
  onOpenNotes,
  filteredHighlights,
  filteredAutoHighlights,
}: ChapterReaderProps) {
  const { colors, mode } = useTheme();
  const specs = getHeaderSpecs(mode);
  const styles = createStyles(colors, explanationsOnly);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);
  const { showToast } = useToast();

  // Use Bible Interaction Context for highlights and interactions
  const {
    chapterHighlights: contextHighlights,
    autoHighlights: contextAutoHighlights,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightEditMenu,
  } = useBibleInteraction();

  // Use filtered highlights if provided, otherwise use context highlights
  const chapterHighlights = filteredHighlights ?? contextHighlights;
  const autoHighlights = filteredAutoHighlights ?? contextAutoHighlights;

  // Text visibility context for hybrid tokenization
  const { visibleYRange } = useTextVisibility();

  // Store verse layouts: map startVerse -> { y, height }
  const sectionPositions = useRef<Record<number, number>>({});
  const sectionLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, []);

  // Error modal state (still local for generic errors)
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, _setErrorMessage] = useState('An error occurred. Please try again.');

  // Group consecutive manual highlights
  const highlightGroups = useMemo(() => {
    return groupConsecutiveHighlights(chapterHighlights);
  }, [chapterHighlights]);

  // Word definition tooltip state
  const [wordDefinitionVisible, setWordDefinitionVisible] = useState(false);
  const [wordToDefine, setWordToDefine] = useState<{
    word: string;
    verseNumber: number;
  } | null>(null);

  // Line layout information for paragraph groups (for accurate tap detection)
  const paragraphLineLayoutsRef = useRef<
    Map<
      string,
      {
        text: string;
        y: number;
        height: number;
        width: number;
        startCharOffset: number;
      }[]
    >
  >(new Map());

  /**
   * Handle layout of a verse/paragraph
   * Stores both Y position (for scroll-to) and height (for visibility calculation)
   */
  const handleVerseLayout = (startVerse: number, y: number, height: number) => {
    sectionPositions.current[startVerse] = y;
    sectionLayouts.current[startVerse] = { y, height };

    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }

    layoutTimeoutRef.current = setTimeout(() => {
      onContentLayout?.(sectionPositions.current);
    }, 100);
  };

  /**
   * Check if a verse group is visible in the viewport
   */
  const isVerseVisible = (startVerse: number): boolean => {
    const layout = sectionLayouts.current[startVerse];
    if (!layout) {
      // If layout not yet calculated, assume visible (safe default)
      return true;
    }
    return isElementVisible(layout.y, layout.height, visibleYRange);
  };

  /**
   * Handle notes button press
   */
  const handleNotesPress = () => {
    onOpenNotes?.();
  };

  /**
   * Handle word selection from HighlightedText
   * Directly opens dictionary definition (no intermediate selection UI)
   */
  const handleWordSelect = (selection: WordSelection, clearSelection: () => void) => {
    // Directly open definition
    setWordToDefine({
      word: selection.word,
      verseNumber: selection.verseNumber,
    });
    setWordDefinitionVisible(true);

    // Clear any selection highlight
    clearSelection();
  };

  /**
   * Handle tap on highlighted text
   * Shows grouped tooltip via context
   */
  const handleHighlightTap = (highlightId: number) => {
    let group = findGroupByHighlightId(highlightGroups, highlightId);

    if (!group) {
      const highlight = chapterHighlights.find((h) => h.highlight_id === highlightId);
      if (highlight) {
        group = {
          highlights: [highlight],
          startVerse: highlight.start_verse,
          endVerse: highlight.end_verse,
          color: highlight.color,
          isGrouped: false,
        };
      }
    }

    if (group) {
      const text =
        typeof group.highlights[0]?.selected_text === 'string'
          ? group.highlights[0].selected_text
          : undefined;
      openVerseTooltip(null, group, text);
    } else {
      // Fallback
      const highlight = chapterHighlights.find((h) => h.highlight_id === highlightId);
      if (highlight) {
        openHighlightEditMenu(highlight.highlight_id, highlight.color as HighlightColor);
      }
    }
  };

  /**
   * Handle tap on plain text
   * Shows verse insight tooltip via context
   */
  const handleVerseTap = (verseNumber: number) => {
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);
    openVerseTooltip(verseNumber, null, verse?.text);
  };

  /**
   * Handle tap on auto-highlighted text
   */
  const handleAutoHighlightPress = (autoHighlight: AutoHighlight) => {
    openAutoHighlightTooltip(autoHighlight);
  };

  /**
   * Handle close word definition tooltip
   */
  const handleWordDefinitionClose = () => {
    setWordDefinitionVisible(false);
    setWordToDefine(null);
  };

  /**
   * Handle copy from word definition tooltip
   */
  const handleWordDefinitionCopy = () => {
    showToast('Copied to clipboard');
  };

  /**
   * Handle text layout event to capture line positions
   */
  const handleTextLayout = (groupKey: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const { lines } = event.nativeEvent;
    let charOffset = 0;
    const lineInfo = lines.map((line) => {
      const info = {
        text: line.text,
        y: line.y,
        height: line.height,
        width: line.width,
        startCharOffset: charOffset,
      };
      charOffset += line.text.length;
      return info;
    });
    paragraphLineLayoutsRef.current.set(groupKey, lineInfo);
  };

  return (
    <View style={styles.container} collapsable={false}>
      {/* Chapter Title Row with Bookmark, Notes, and Share buttons - Only show in Bible view */}
      {!explanationsOnly && (
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
      )}

      {/* Render Bible verses (only in Bible view) */}
      {!explanationsOnly &&
        chapter.sections.map((section) => (
          <Fragment key={`section-${section.startVerse}-${section.subtitle || 'no-subtitle'}`}>
            {/* Section Subtitle */}
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
                        handleVerseLayout(
                          group[0].verseNumber,
                          e.nativeEvent.layout.y,
                          e.nativeEvent.layout.height
                        )
                      }
                    >
                      <Text
                        style={styles.verseTextParagraph}
                        onTextLayout={(e) => handleTextLayout(groupKey, e)}
                      >
                        {group.map((verse, verseIndex) => {
                          let currBackgroundColor: string | undefined;
                          const startHighlight = getStartHighlight(
                            verse.verseNumber,
                            chapterHighlights,
                            autoHighlights
                          );

                          if (startHighlight) {
                            const baseColor = getHighlightColor(
                              startHighlight.color as HighlightColor,
                              mode
                            );
                            const opacity = startHighlight.isAuto ? 0.2 : 0.35;
                            const opacityHex = Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0');
                            currBackgroundColor = baseColor + opacityHex;
                          }

                          let prevBackgroundColor: string | undefined;
                          if (verseIndex > 0) {
                            const prevVerse = group[verseIndex - 1];
                            const endHighlight = getEndHighlight(
                              prevVerse.verseNumber,
                              prevVerse.text.length,
                              chapterHighlights,
                              autoHighlights
                            );

                            if (endHighlight) {
                              const baseColor = getHighlightColor(
                                endHighlight.color as HighlightColor,
                                mode
                              );
                              const opacity = endHighlight.isAuto ? 0.2 : 0.35;
                              const opacityHex = Math.round(opacity * 255)
                                .toString(16)
                                .padStart(2, '0');
                              prevBackgroundColor = baseColor + opacityHex;
                            }
                          }

                          return (
                            <Text key={verse.verseNumber}>
                              <Text style={styles.verseNumberSuperscript}>
                                {verseIndex > 0 && (
                                  <>
                                    <Text
                                      style={
                                        prevBackgroundColor && {
                                          backgroundColor: prevBackgroundColor,
                                        }
                                      }
                                    >
                                      {' '}
                                    </Text>
                                    <Text
                                      style={
                                        currBackgroundColor && {
                                          backgroundColor: currBackgroundColor,
                                        }
                                      }
                                    >
                                      {' '}
                                    </Text>
                                  </>
                                )}
                                <Text
                                  style={
                                    currBackgroundColor && {
                                      backgroundColor: currBackgroundColor,
                                    }
                                  }
                                >
                                  {toSuperscript(verse.verseNumber)}
                                </Text>
                                <Text
                                  style={
                                    currBackgroundColor && {
                                      backgroundColor: currBackgroundColor,
                                    }
                                  }
                                >
                                  {' '}
                                </Text>
                              </Text>
                              <HighlightedText
                                text={verse.text}
                                verseNumber={verse.verseNumber}
                                highlights={chapterHighlights}
                                autoHighlights={autoHighlights}
                                onHighlightTap={handleHighlightTap}
                                onAutoHighlightPress={handleAutoHighlightPress}
                                onVerseTap={handleVerseTap}
                                onWordSelect={handleWordSelect}
                                style={styles.verseText}
                                isVisible={isVerseVisible(group[0].verseNumber)}
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
                      onHighlightTap={handleHighlightTap}
                      onAutoHighlightPress={handleAutoHighlightPress}
                      onVerseTap={handleVerseTap}
                      onWordSelect={handleWordSelect}
                      style={styles.verseText}
                      isVisible={true}
                    />
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: spacing.xxxl }} />
          </Fragment>
        ))}

      {/* Explanation Content */}
      {explanation &&
        (() => {
          // Construct deterministic title
          const generatedTitle =
            activeTab === 'summary'
              ? `Summary of ${chapter.bookName} ${chapter.chapterNumber}`
              : activeTab === 'byline'
                ? `Line-by-Line: ${chapter.bookName} ${chapter.chapterNumber}`
                : `Detailed Insight: ${chapter.bookName} ${chapter.chapterNumber}`;

          // Extract title from markdown (H1, H2, etc.)
          // Match heading at start of content, handling various line endings
          const titleMatch = explanation.content.match(/^(#{1,6})\s+(.+?)(?:\r?\n|$)/);
          const extractedTitle = titleMatch ? titleMatch[2].trim() : null;

          // Use extracted title if found, otherwise fallback to generated title
          const title = extractedTitle || generatedTitle;

          // Remove the first heading line from content if found
          const contentWithoutTitle = titleMatch
            ? explanation.content.replace(/^#{1,6}\s+.+?(?:\r?\n|$)/, '')
            : explanation.content;

          return (
            <View style={styles.explanationContainer} collapsable={false}>
              {/* Title row with action buttons */}
              {title && (
                <View style={styles.explanationTitleRow}>
                  <Text style={styles.explanationTitle}>{title}</Text>
                  <View style={styles.explanationTitleActions}>
                    <ShareButton
                      bookId={chapter.bookId}
                      chapterNumber={chapter.chapterNumber}
                      bookName={chapter.bookName}
                      insightType={activeTab}
                      size={22}
                      color={colors.textSecondary}
                      testID="insight-title-share-button"
                    />
                    {/* 
                      TODO: Re-enable when backend supports insight_type in bookmarks response.
                      Currently GET /bible/book/bookmarks does not return insight_type, so persistence fails.

                      <InsightBookmarkButton
                        bookId={chapter.bookId}
                        chapterNumber={chapter.chapterNumber}
                        insightType={activeTab}
                        size={22}
                        color={colors.textSecondary}
                        testID="insight-title-bookmark-button"
                      /> 
                    */}
                  </View>
                </View>
              )}

              {/* Markdown content */}
              <Markdown style={markdownStyles}>{contentWithoutTitle}</Markdown>
            </View>
          );
        })()}

      {/* 
          NOTE: Tooltips and Modals (VerseMateTooltip, HighlightSelectionSheet, etc.)
          are now rendered by the BibleInteractionContext provider at the ChapterScreen level.
          This allows them to float over the SplitView right panel without being clipped
          by the left panel's overflow.
      */}

      {/* Error Modal */}
      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />

      {/* Word Definition Tooltip */}
      {wordToDefine && (
        <WordDefinitionTooltip
          visible={wordDefinitionVisible}
          word={wordToDefine.word}
          bookName={chapter.title.split(' ').slice(0, -1).join(' ')}
          chapterNumber={chapter.chapterNumber}
          verseNumber={wordToDefine.verseNumber}
          onClose={handleWordDefinitionClose}
          onCopy={handleWordDefinitionCopy}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, explanationsOnly?: boolean) =>
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
      marginTop: explanationsOnly ? 0 : spacing.xxxl,
      paddingTop: explanationsOnly ? 0 : spacing.xxl,
      borderTopWidth: explanationsOnly ? 0 : 1,
      borderTopColor: colors.border,
    },
    explanationTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    // Removed explanationTitleContainer as we are reverting to direct Text usage like titleRow
    explanationTitle: {
      flex: 1,
      fontSize: fontSizes.heading1,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      lineHeight: fontSizes.heading1 * lineHeights.heading, // Fixed: Multiply fontSize by lineHeight
      marginRight: spacing.md,
    },
    explanationTitleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
