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

import * as Clipboard from 'expo-clipboard';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  Share,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { DictionaryModal } from '@/components/bible/DictionaryModal';
import { ErrorModal } from '@/components/bible/ErrorModal';
import type { WordTapEvent } from '@/components/bible/HighlightedText';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { NotesButton } from '@/components/bible/NotesButton';
import { TextSelectionMenu } from '@/components/bible/TextSelectionMenu';
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
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import type { Highlight } from '@/hooks/bible/use-highlights';
import { getWordAtPosition } from '@/hooks/use-text-selection';
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
  explanation,
  explanationsOnly = false,
  onContentLayout,
  onOpenNotes,
  filteredHighlights,
  filteredAutoHighlights,
}: ChapterReaderProps) {
  const { colors, mode } = useTheme();
  const specs = getHeaderSpecs(mode);
  const styles = useMemo(() => createStyles(colors, explanationsOnly), [colors, explanationsOnly]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);
  const { showToast } = useToast();

  // Use Bible Interaction Context for highlights and interactions
  const {
    chapterHighlights: contextHighlights,
    autoHighlights: contextAutoHighlights,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightSelection,
    openHighlightEditMenu,
  } = useBibleInteraction();

  // Use filtered highlights if provided, otherwise use context highlights
  const chapterHighlights = filteredHighlights ?? contextHighlights;
  const autoHighlights = filteredAutoHighlights ?? contextAutoHighlights;

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

  // Error modal state (still local for generic errors)
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, _setErrorMessage] = useState('An error occurred. Please try again.');

  // Group consecutive manual highlights
  const highlightGroups = useMemo(() => {
    return groupConsecutiveHighlights(chapterHighlights);
  }, [chapterHighlights]);

  // Dictionary modal state
  const [dictionaryModalVisible, setDictionaryModalVisible] = useState(false);
  const [dictionaryWord, setDictionaryWord] = useState<string>('');

  // Text selection menu state
  const [selectionMenuVisible, setSelectionMenuVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordTapEvent | null>(null);

  // Line layout information for paragraph groups (for accurate tap detection)
  const paragraphLineLayoutsRef = useRef<
    Map<
      string,
      { text: string; y: number; height: number; width: number; startCharOffset: number }[]
    >
  >(new Map());

  /**
   * Handle layout of a verse/paragraph
   */
  const handleVerseLayout = (startVerse: number, y: number) => {
    sectionPositions.current[startVerse] = y;

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
  const handleVerseLongPress = (_verseNumber: number) => {
    // Disabled
    return;
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
   * Handle long-press on highlighted text
   * Shows quick edit menu via context
   */
  const handleHighlightLongPress = (highlightId: number) => {
    const highlight = chapterHighlights.find((h) => h.highlight_id === highlightId);
    if (highlight) {
      openHighlightEditMenu(highlightId, highlight.color as HighlightColor);
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
   * Handle close Dictionary modal
   */
  const handleDictionaryClose = () => {
    setDictionaryModalVisible(false);
    setDictionaryWord('');
  };

  /**
   * Handle word tap from HighlightedText
   */
  const handleWordTap = useCallback((event: WordTapEvent) => {
    setSelectedWord(event);
    setSelectionMenuVisible(true);
  }, []);

  /**
   * Handle text layout event to capture line positions
   */
  const handleTextLayout = useCallback(
    (groupKey: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
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
    },
    []
  );

  /**
   * Handle tap on paragraph to detect which word was tapped
   */
  const handleParagraphTap = useCallback(
    (
      event: GestureResponderEvent,
      group: { verseNumber: number; text: string }[],
      groupKey: string
    ) => {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      const lineLayouts = paragraphLineLayoutsRef.current.get(groupKey);

      let totalOffset = 0;
      const verseOffsets: {
        verseNumber: number;
        text: string;
        startOffset: number;
        endOffset: number;
      }[] = [];

      for (let i = 0; i < group.length; i++) {
        const verse = group[i];
        if (i > 0) totalOffset += 2;
        const verseNumberLength = toSuperscript(verse.verseNumber).length + 1;
        const verseStart = totalOffset + verseNumberLength;
        const verseEnd = verseStart + verse.text.length;

        verseOffsets.push({
          verseNumber: verse.verseNumber,
          text: verse.text,
          startOffset: verseStart,
          endOffset: verseEnd,
        });
        totalOffset = verseEnd;
      }

      let estimatedCharPos: number;

      if (lineLayouts && lineLayouts.length > 0) {
        let tappedLine = lineLayouts[0];
        for (const line of lineLayouts) {
          if (locationY >= line.y && locationY < line.y + line.height) {
            tappedLine = line;
            break;
          }
          if (locationY >= line.y + line.height) {
            tappedLine = line;
          }
        }

        const avgCharWidth = tappedLine.width / Math.max(tappedLine.text.length, 1);
        const charInLine = Math.floor(locationX / avgCharWidth);
        const clampedCharInLine = Math.max(0, Math.min(charInLine, tappedLine.text.length - 1));
        estimatedCharPos = tappedLine.startCharOffset + clampedCharInLine;
      } else {
        const avgCharWidth = 9;
        estimatedCharPos = Math.floor(locationX / avgCharWidth);
      }

      const verseInfo = verseOffsets.find(
        (v) => estimatedCharPos >= v.startOffset && estimatedCharPos < v.endOffset
      );

      if (!verseInfo) {
        // Fallback logic
        const firstVerse = group[0];
        if (!firstVerse) return;
        if (estimatedCharPos < verseOffsets[0].startOffset) {
          const wordInfo = getWordAtPosition(firstVerse.text, 0);
          if (!wordInfo) return;
          setSelectedWord({
            verseNumber: firstVerse.verseNumber,
            word: wordInfo.word,
            startChar: wordInfo.start,
            endChar: wordInfo.end,
            position: { x: pageX, y: pageY },
          });
          setSelectionMenuVisible(true);
          return;
        }
        const lastVerseOffset = verseOffsets[verseOffsets.length - 1];
        if (lastVerseOffset) {
          const lastVerse = group[group.length - 1];
          const wordInfo = getWordAtPosition(lastVerse.text, lastVerse.text.length - 1);
          if (!wordInfo) return;
          setSelectedWord({
            verseNumber: lastVerse.verseNumber,
            word: wordInfo.word,
            startChar: wordInfo.start,
            endChar: wordInfo.end,
            position: { x: pageX, y: pageY },
          });
          setSelectionMenuVisible(true);
          return;
        }
        return;
      }

      const positionInVerse = estimatedCharPos - verseInfo.startOffset;
      const clampedPosition = Math.max(0, Math.min(positionInVerse, verseInfo.text.length - 1));
      const wordInfo = getWordAtPosition(verseInfo.text, clampedPosition);
      if (!wordInfo) return;

      setSelectedWord({
        verseNumber: verseInfo.verseNumber,
        word: wordInfo.word,
        startChar: wordInfo.start,
        endChar: wordInfo.end,
        position: { x: pageX, y: pageY },
      });
      setSelectionMenuVisible(true);
    },
    []
  );

  /**
   * Handle tap on single verse (non-paragraph mode)
   */
  const handleSingleVerseTap = useCallback(
    (event: GestureResponderEvent, verse: { verseNumber: number; text: string }) => {
      const { pageX, pageY, locationX } = event.nativeEvent;
      const avgCharWidth = 9;
      const estimatedCharPos = Math.floor(locationX / avgCharWidth);
      const wordInfo = getWordAtPosition(verse.text, estimatedCharPos);
      if (!wordInfo) return;

      setSelectedWord({
        verseNumber: verse.verseNumber,
        word: wordInfo.word,
        startChar: wordInfo.start,
        endChar: wordInfo.end,
        position: { x: pageX, y: pageY },
      });
      setSelectionMenuVisible(true);
    },
    []
  );

  /**
   * Handle selection menu close
   */
  const handleSelectionMenuClose = useCallback(() => {
    setSelectionMenuVisible(false);
    setSelectedWord(null);
  }, []);

  /**
   * Handle Select Verse action
   */
  const handleSelectVerse = useCallback(() => {
    if (!selectedWord) return;
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);
    if (!verse) return;
    setSelectedWord({
      ...selectedWord,
      startChar: 0,
      endChar: verse.text.length,
      word: verse.text,
    });
  }, [selectedWord, chapter]);

  /**
   * Handle Define action
   */
  const handleSelectionDefine = useCallback(() => {
    if (!selectedWord) return;
    setDictionaryWord(selectedWord.word);
    setDictionaryModalVisible(true);
    handleSelectionMenuClose();
  }, [selectedWord, handleSelectionMenuClose]);

  /**
   * Handle Copy action
   */
  const handleSelectionCopy = useCallback(async () => {
    if (!selectedWord) return;
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);
    let payload = selectedWord.word;
    if (verse) {
      const start = Math.max(0, Math.min(selectedWord.startChar, verse.text.length));
      const end = Math.max(start, Math.min(selectedWord.endChar, verse.text.length));
      const selectedSlice = verse.text.slice(start, end) || selectedWord.word;
      payload = `"${selectedSlice}" - ${chapter.title} ${selectedWord.verseNumber}`;
    }
    await Clipboard.setStringAsync(payload);
    showToast('Copied to clipboard');
    handleSelectionMenuClose();
  }, [selectedWord, chapter, showToast, handleSelectionMenuClose]);

  /**
   * Handle Share action
   */
  const handleSelectionShare = useCallback(async () => {
    if (!selectedWord) return;
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);
    const textToShare = verse
      ? `"${verse.text}"\n\n- ${chapter.title} ${selectedWord.verseNumber}`
      : `"${selectedWord.word}"`;
    await Share.share({ message: textToShare });
    handleSelectionMenuClose();
  }, [selectedWord, chapter, handleSelectionMenuClose]);

  /**
   * Handle Highlight action from selection menu
   * Opens the highlight selection sheet via context
   */
  const handleSelectionHighlight = useCallback(() => {
    if (!selectedWord) return;
    openHighlightSelection(
      { start: selectedWord.verseNumber, end: selectedWord.verseNumber },
      selectedWord.word
    );
    handleSelectionMenuClose();
  }, [selectedWord, openHighlightSelection, handleSelectionMenuClose]);

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
                        handleVerseLayout(group[0].verseNumber, e.nativeEvent.layout.y)
                      }
                    >
                      <Text
                        style={styles.verseTextParagraph}
                        onTextLayout={(e) => handleTextLayout(groupKey, e)}
                        onPress={(e) => handleParagraphTap(e, group, groupKey)}
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
                                onHighlightLongPress={handleHighlightLongPress}
                                onAutoHighlightPress={handleAutoHighlightPress}
                                onVerseTap={handleVerseTap}
                                onVerseLongPress={handleVerseLongPress}
                                onWordTap={handleWordTap}
                                activeSelection={
                                  selectedWord?.verseNumber === verse.verseNumber
                                    ? {
                                        verseNumber: selectedWord.verseNumber,
                                        startChar: selectedWord.startChar,
                                        endChar: selectedWord.endChar,
                                      }
                                    : undefined
                                }
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
                      onHighlightTap={handleHighlightTap}
                      onHighlightLongPress={handleHighlightLongPress}
                      onAutoHighlightPress={handleAutoHighlightPress}
                      onVerseTap={handleVerseTap}
                      onVerseLongPress={handleVerseLongPress}
                      onWordTap={handleWordTap}
                      onPress={(e) => handleSingleVerseTap(e, verse)}
                      activeSelection={
                        selectedWord?.verseNumber === verse.verseNumber
                          ? {
                              verseNumber: selectedWord.verseNumber,
                              startChar: selectedWord.startChar,
                              endChar: selectedWord.endChar,
                            }
                          : undefined
                      }
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

      {/* Dictionary Modal */}
      <DictionaryModal
        visible={dictionaryModalVisible}
        word={dictionaryWord}
        onClose={handleDictionaryClose}
      />

      {/* Text Selection Menu (floating above selected text) */}
      {selectedWord && (
        <TextSelectionMenu
          visible={selectionMenuVisible}
          position={selectedWord.position}
          selectedText={selectedWord.word}
          isMultiWord={selectedWord.word.includes(' ')}
          onDefine={handleSelectionDefine}
          onCopy={handleSelectionCopy}
          onShare={handleSelectionShare}
          onSelectVerse={handleSelectVerse}
          onMoreOptions={handleSelectionHighlight}
          onClose={handleSelectionMenuClose}
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
