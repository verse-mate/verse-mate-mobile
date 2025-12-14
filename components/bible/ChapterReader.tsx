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
import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
import { BookmarkToggle } from '@/components/bible/BookmarkToggle';
import { DictionaryModal } from '@/components/bible/DictionaryModal';
import { ErrorModal } from '@/components/bible/ErrorModal';
import { HighlightEditMenu } from '@/components/bible/HighlightEditMenu';
import type { TextSelection, WordTapEvent } from '@/components/bible/HighlightedText';
import { HighlightedText } from '@/components/bible/HighlightedText';
import { HighlightSelectionSheet } from '@/components/bible/HighlightSelectionSheet';
import { NotesButton } from '@/components/bible/NotesButton';
import { ShareButton } from '@/components/bible/ShareButton';
import { SimpleColorPickerModal } from '@/components/bible/SimpleColorPickerModal';
import { TextSelectionMenu } from '@/components/bible/TextSelectionMenu';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
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
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';
import { useAuth } from '@/hooks/use-auth';
import { getWordAtPosition } from '@/hooks/use-text-selection';
import type { AutoHighlight } from '@/types/auto-highlights';
import type { ChapterContent, ContentTabType, ExplanationContent } from '@/types/bible';
import {
  findGroupByHighlightId,
  groupConsecutiveHighlights,
  type HighlightGroup,
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
  const styles = useMemo(() => createStyles(colors, explanationsOnly), [colors, explanationsOnly]);
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
  const [selectedHighlightGroupForEdit, setSelectedHighlightGroupForEdit] =
    useState<HighlightGroup | null>(null);

  // Auto-highlight modal state
  const [autoHighlightTooltipVisible, setAutoHighlightTooltipVisible] = useState(false);
  const [selectedAutoHighlight, setSelectedAutoHighlight] = useState<AutoHighlight | null>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('An error occurred. Please try again.');

  // New tooltip modal state
  const [verseInsightTooltipVisible, setVerseInsightTooltipVisible] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [manualHighlightTooltipVisible, setManualHighlightTooltipVisible] = useState(false);
  const [selectedHighlightGroup, setSelectedHighlightGroup] = useState<HighlightGroup | null>(null);
  const [colorPickerModalVisible, setColorPickerModalVisible] = useState(false);

  // Group consecutive manual highlights
  const highlightGroups = useMemo(() => {
    return groupConsecutiveHighlights(chapterHighlights);
  }, [chapterHighlights]);

  /**
   * Show error modal with custom message
   */
  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  // Dictionary modal state
  const [dictionaryModalVisible, setDictionaryModalVisible] = useState(false);
  const [dictionaryWord, setDictionaryWord] = useState<string>('');

  // Text selection menu state
  const [selectionMenuVisible, setSelectionMenuVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordTapEvent | null>(null);

  // Line layout information for paragraph groups (for accurate tap detection)
  // Key: groupKey (e.g., "group-1-5"), Value: array of line info
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
   * DISABLED: No longer opens highlight options modal
   */
  const handleVerseLongPress = (verseNumber: number) => {
    // Disabled - long press on verse no longer opens highlight modal
    return;
  };

  /**
   * Handle color selection from HighlightSelectionSheet
   */
  const handleCreateHighlight = async (color: HighlightColor) => {
    if (!selectionContext) return;

    const { verseNumber, selection } = selectionContext;

    // Get the verse to check if this is a full-verse highlight
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);

    // Check if selection covers the entire verse
    const isFullVerse = verse && selection.start === 0 && selection.end === verse.text.length;

    try {
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseNumber,
        endVerse: verseNumber,
        color,
        // Only include startChar/endChar for partial verse highlights
        ...(isFullVerse
          ? { selectedText: selection.text }
          : {
              startChar: selection.start,
              endChar: selection.end,
              selectedText: selection.text,
            }),
      });

      setSelectionSheetVisible(false);
      setSelectionContext(null);
    } catch (error) {
      console.error('Failed to create highlight:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.toLowerCase().includes('overlap')) {
        showError(
          'This text overlaps with an existing highlight. Please delete the existing highlight first or select different text.'
        );
      } else {
        showError('Failed to create highlight. Please try again.');
      }
    }
  };

  /**
   * Handle tap on highlighted text
   * Shows grouped tooltip if part of consecutive group, otherwise shows tooltip for single highlight
   */
  const handleHighlightTap = (highlightId: number) => {
    // Try to find in grouped highlights first (full-verse highlights only)
    let group = findGroupByHighlightId(highlightGroups, highlightId);

    // If not found, it's a character-level highlight - create a single-item group for it
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
      setSelectedHighlightGroup(group);
      setManualHighlightTooltipVisible(true);
    } else {
      // Fallback: open edit menu for robustness (e.g. stale ID or failed grouping)
      setSelectedHighlightId(highlightId);
      setEditMenuVisible(true);
    }
  };

  /**
   * Handle long-press on highlighted text
   * Shows quick edit menu
   */
  const handleHighlightLongPress = (highlightId: number) => {
    setSelectedHighlightId(highlightId);
    setEditMenuVisible(true);
  };

  /**
   * Handle tap on plain text
   * Shows verse insight tooltip
   */
  const handleVerseTap = (verseNumber: number) => {
    setSelectedVerse(verseNumber);
    setVerseInsightTooltipVisible(true);
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
    // If we have a group to edit, update all highlights in the group
    if (selectedHighlightGroupForEdit) {
      try {
        // Update all highlights in the group
        await Promise.all(
          selectedHighlightGroupForEdit.highlights.map((h) =>
            updateHighlightColor(h.highlight_id, color)
          )
        );
        setEditMenuVisible(false);
        setSelectedHighlightId(null);
        setSelectedHighlightGroupForEdit(null);
      } catch (error) {
        console.error('Failed to update highlight colors:', error);
        showError('Failed to update highlight colors. Please try again.');
      }
      return;
    }

    // Fallback to single highlight update
    if (!selectedHighlightId) return;

    try {
      await updateHighlightColor(selectedHighlightId, color);
      setEditMenuVisible(false);
      setSelectedHighlightId(null);
    } catch (error) {
      console.error('Failed to update highlight color:', error);
      showError('Failed to update highlight color. Please try again.');
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
      setSelectedHighlightGroupForEdit(null);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      showError('Failed to delete highlight. Please try again.');
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
   * Handle close Dictionary modal
   */
  const handleDictionaryClose = () => {
    setDictionaryModalVisible(false);
    setDictionaryWord('');
  };

  /**
   * Handle word tap from HighlightedText (legacy - not used in paragraph mode)
   * Shows the floating selection menu
   */
  const handleWordTap = useCallback((event: WordTapEvent) => {
    setSelectedWord(event);
    setSelectionMenuVisible(true);
  }, []);

  /**
   * Handle text layout event to capture line positions
   * This is called when the Text component renders and provides line-by-line layout info
   */
  const handleTextLayout = useCallback(
    (groupKey: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;

      // Build line info with cumulative character offsets
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
   * Uses line layout info from onTextLayout to accurately detect which line was tapped
   */
  const handleParagraphTap = useCallback(
    (
      event: GestureResponderEvent,
      group: { verseNumber: number; text: string }[],
      groupKey: string
    ) => {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;

      // Get line layouts for this paragraph group
      const lineLayouts = paragraphLineLayoutsRef.current.get(groupKey);

      // Build verse offsets map for the entire paragraph
      // This maps global character positions to verse info
      let totalOffset = 0;
      const verseOffsets: {
        verseNumber: number;
        text: string;
        startOffset: number;
        endOffset: number;
      }[] = [];

      for (let i = 0; i < group.length; i++) {
        const verse = group[i];
        // Account for leading spaces/thin spaces between verses
        if (i > 0) {
          // Two thin spaces (prev end + curr start) between verses
          totalOffset += 2;
        }
        // Account for verse number (superscript) and narrow no-break space
        const verseNumberLength = toSuperscript(verse.verseNumber).length + 1; // +1 for narrow space
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

      // Calculate estimated character position using line layouts if available
      let estimatedCharPos: number;

      if (lineLayouts && lineLayouts.length > 0) {
        // Find which line was tapped using locationY
        let tappedLine = lineLayouts[0];
        for (const line of lineLayouts) {
          if (locationY >= line.y && locationY < line.y + line.height) {
            tappedLine = line;
            break;
          }
          // If tap is below this line but there are more lines, continue
          if (locationY >= line.y + line.height) {
            tappedLine = line;
          }
        }

        // Estimate character position within the tapped line
        const avgCharWidth = tappedLine.width / Math.max(tappedLine.text.length, 1);
        const charInLine = Math.floor(locationX / avgCharWidth);
        const clampedCharInLine = Math.max(0, Math.min(charInLine, tappedLine.text.length - 1));

        // Calculate global character position
        estimatedCharPos = tappedLine.startCharOffset + clampedCharInLine;
      } else {
        // Fallback: use old X-only estimation (less accurate for multi-line)
        const avgCharWidth = 9;
        estimatedCharPos = Math.floor(locationX / avgCharWidth);
      }

      // Find which verse contains this position
      const verseInfo = verseOffsets.find(
        (v) => estimatedCharPos >= v.startOffset && estimatedCharPos < v.endOffset
      );

      if (!verseInfo) {
        // Fallback: find nearest verse
        const firstVerse = group[0];
        if (!firstVerse) return;

        // If position is before first verse text, select first word
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

        // If position is after last verse, select last word of last verse
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

      // Calculate position within verse text
      const positionInVerse = estimatedCharPos - verseInfo.startOffset;
      const clampedPosition = Math.max(0, Math.min(positionInVerse, verseInfo.text.length - 1));

      // Find word at that position
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

      // Estimate character position from tap X
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
   * Handle Select Verse action - selects the entire verse text
   */
  const handleSelectVerse = useCallback(() => {
    if (!selectedWord) return;

    // Find the verse
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);

    if (!verse) return;

    // Update selectedWord to reflect full verse selection
    setSelectedWord({
      ...selectedWord,
      startChar: 0,
      endChar: verse.text.length,
      word: verse.text,
    });
  }, [selectedWord, chapter]);

  /**
   * Handle Define action from selection menu
   */
  const handleSelectionDefine = useCallback(() => {
    if (!selectedWord) return;
    setDictionaryWord(selectedWord.word);
    setDictionaryModalVisible(true);
    handleSelectionMenuClose();
  }, [selectedWord, handleSelectionMenuClose]);

  /**
   * Handle Copy action from selection menu
   */
  const handleSelectionCopy = useCallback(async () => {
    if (!selectedWord) return;

    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);

    let payload = selectedWord.word;

    if (verse) {
      // Prefer exact slice from verse to capture true selection
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
   * Handle Share action from selection menu
   */
  const handleSelectionShare = useCallback(async () => {
    if (!selectedWord) return;

    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);

    const textToShare = verse
      ? `"${verse.text}"\n\n- ${chapter.title} ${selectedWord.verseNumber}`
      : `"${selectedWord.word}"`;

    await Share.share({
      message: textToShare,
    });
    handleSelectionMenuClose();
  }, [selectedWord, chapter, handleSelectionMenuClose]);

  /**
   * Handle Highlight action from selection menu
   * Opens the highlight selection sheet with the selected word
   */
  const handleSelectionHighlight = useCallback(() => {
    if (!selectedWord) return;

    // Find the verse text
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === selectedWord.verseNumber);

    if (!verse) return;

    setSelectionContext({
      verseNumber: selectedWord.verseNumber,
      selection: {
        start: selectedWord.startChar,
        end: selectedWord.endChar,
        text: selectedWord.word,
      },
    });
    setSelectionSheetVisible(true);
    handleSelectionMenuClose();
  }, [selectedWord, chapter, handleSelectionMenuClose]);

  /**
   * Handle close HighlightEditMenu
   */
  const handleEditMenuClose = () => {
    setEditMenuVisible(false);
    setSelectedHighlightId(null);
    setSelectedHighlightGroupForEdit(null);
  };

  /**
   * Handle remove grouped highlights
   */
  const handleRemoveHighlightGroup = async (group: HighlightGroup) => {
    // Close modal immediately to prevent re-opening after highlights are deleted
    setManualHighlightTooltipVisible(false);
    setSelectedHighlightGroup(null);

    try {
      // Delete all highlights in the group
      await Promise.all(group.highlights.map((h) => deleteHighlight(h.highlight_id)));
      showToast('Highlight group removed');
    } catch (error) {
      console.error('Failed to remove highlight group:', error);
      showError('Failed to remove highlight group. Please try again.');
    }
  };

  /**
   * Handle save from verse insight tooltip
   * Opens color picker modal
   */
  const handleSaveFromVerseInsight = () => {
    // Close verse insight tooltip and open color picker
    setVerseInsightTooltipVisible(false);
    setColorPickerModalVisible(true);
  };

  /**
   * Handle color selection from SimpleColorPickerModal
   * Creates highlight for the selected verse
   */
  const handleColorPickerSave = async (color: HighlightColor) => {
    if (!selectedVerse) return;

    // Store verse number locally before resetting state
    const verseNumber = selectedVerse;
    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNumber);

    if (!verse) return;

    // Close modal and reset state immediately to prevent re-opening
    setColorPickerModalVisible(false);
    setSelectedVerse(null);

    try {
      await addHighlight({
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        startVerse: verseNumber,
        endVerse: verseNumber,
        color,
        selectedText: verse.text,
      });

      showToast('Highlight saved!');
    } catch (error) {
      console.error('Failed to create highlight from verse insight:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.toLowerCase().includes('overlap')) {
        showError(
          'This verse already has a highlight. Please delete the existing highlight first.'
        );
      } else {
        showError('Failed to create highlight. Please try again.');
      }
    }
  };

  /**
   * Handle close color picker modal
   */
  const handleColorPickerClose = () => {
    setColorPickerModalVisible(false);
    setSelectedVerse(null);
  };

  /**
   * Handle change color from VerseMate tooltip
   * Opens the HighlightEditMenu to change color for all highlights in the group
   */
  const handleChangeColorFromTooltip = (group: HighlightGroup) => {
    // Close tooltip and open edit menu for the entire group
    setManualHighlightTooltipVisible(false);
    setSelectedHighlightGroup(null);

    // Store the group for batch color updates
    setSelectedHighlightGroupForEdit(group);

    // Open edit menu with the first highlight's color as the current color
    const firstHighlight = group.highlights[0];
    if (firstHighlight) {
      setSelectedHighlightId(firstHighlight.highlight_id);
      setEditMenuVisible(true);
    }
  };

  /**
   * Handle add note from VerseMate tooltip
   * Opens the chapter notes modal
   */
  const handleAddNoteFromTooltip = () => {
    // Close tooltip and clear all modal states
    setVerseInsightTooltipVisible(false);
    setManualHighlightTooltipVisible(false);
    setAutoHighlightTooltipVisible(false);
    setSelectedVerse(null);
    setSelectedHighlightGroup(null);
    setSelectedAutoHighlight(null);

    // Open chapter notes modal
    onOpenNotes?.();
  };

  /**
   * Handle copy from VerseMate tooltip
   * Shows toast message after verse is copied and clears states
   */
  const handleCopyFromTooltip = () => {
    // Clear all modal states to prevent reopening
    setVerseInsightTooltipVisible(false);
    setManualHighlightTooltipVisible(false);
    setAutoHighlightTooltipVisible(false);
    setSelectedVerse(null);
    setSelectedHighlightGroup(null);
    setSelectedAutoHighlight(null);

    // Show success toast
    showToast('Verse copied to clipboard');
  };

  /**
   * Get verse text for VerseMate tooltip
   */
  const getVerseTextForTooltip = (): string | undefined => {
    const verseNum = selectedVerse ?? selectedHighlightGroup?.startVerse;
    if (!verseNum) return undefined;

    const verse = chapter.sections
      .flatMap((section) => section.verses)
      .find((v) => v.verseNumber === verseNum);

    return verse?.text;
  };

  const currentHighlight = chapterHighlights.find((h) => h.highlight_id === selectedHighlightId);
  const currentHighlightColor = currentHighlight?.color || 'yellow';

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
            <ShareButton
              bookId={chapter.bookId}
              chapterNumber={chapter.chapterNumber}
              bookName={chapter.bookName}
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
                      <Text
                        style={styles.verseTextParagraph}
                        onTextLayout={(e) => handleTextLayout(groupKey, e)}
                        onPress={(e) => handleParagraphTap(e, group, groupKey)}
                      >
                        {group.map((verse, verseIndex) => {
                          // Determine background color for verse number (from current verse's start)
                          // We calculate this early to use it for the second half of the leading space
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

                          // Determine background color for leading space (from previous verse's end)
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

                          // Determine background color for trailing space (only if current highlight continues or next verse is highlighted)
                          let trailingSpaceBackgroundColor: string | undefined;
                          const currentVerseEndHighlight = getEndHighlight(
                            verse.verseNumber,
                            verse.text.length,
                            chapterHighlights,
                            autoHighlights
                          );
                          const nextVerse = group[verseIndex + 1];
                          const nextVerseStartHighlight = nextVerse
                            ? getStartHighlight(
                                nextVerse.verseNumber,
                                chapterHighlights,
                                autoHighlights
                              )
                            : null;

                          if (currentVerseEndHighlight) {
                            const baseColor = getHighlightColor(
                              currentVerseEndHighlight.color as HighlightColor,
                              mode
                            );
                            const opacity = currentVerseEndHighlight.isAuto ? 0.2 : 0.35;
                            const opacityHex = Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0');
                            trailingSpaceBackgroundColor = baseColor + opacityHex;
                          } else if (nextVerseStartHighlight) {
                            const baseColor = getHighlightColor(
                              nextVerseStartHighlight.color as HighlightColor,
                              mode
                            );
                            const opacity = nextVerseStartHighlight.isAuto ? 0.2 : 0.35;
                            const opacityHex = Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0');
                            trailingSpaceBackgroundColor = baseColor + opacityHex;
                          }

                          return (
                            <Text key={verse.verseNumber}>
                              <Text style={styles.verseNumberSuperscript}>
                                {verseIndex > 0 && (
                                  <>
                                    {/* First half of whitespace: matches previous verse */}
                                    <Text
                                      style={
                                        prevBackgroundColor && {
                                          backgroundColor: prevBackgroundColor,
                                        }
                                      }
                                    >
                                      {'\u2009'}
                                    </Text>
                                    {/* Second half of whitespace: matches current verse */}
                                    <Text
                                      style={
                                        currBackgroundColor && {
                                          backgroundColor: currBackgroundColor,
                                        }
                                      }
                                    >
                                      {'\u2009'}
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
                                    trailingSpaceBackgroundColor && {
                                      backgroundColor: trailingSpaceBackgroundColor,
                                    }
                                  }
                                >
                                  {'\u202F'}
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
        onCopy={handleCopyFromTooltip}
        onAddNote={handleAddNoteFromTooltip}
        bookName={chapter.bookName}
        isLoggedIn={!!user}
      />

      {/* VerseMate Tooltip - Unified for both plain and highlighted verses */}
      <VerseMateTooltip
        verseNumber={selectedVerse}
        highlightGroup={selectedHighlightGroup}
        bookId={chapter.bookId}
        chapterNumber={chapter.chapterNumber}
        bookName={chapter.bookName}
        visible={verseInsightTooltipVisible || manualHighlightTooltipVisible}
        onClose={() => {
          setVerseInsightTooltipVisible(false);
          setManualHighlightTooltipVisible(false);
          setSelectedVerse(null);
          setSelectedHighlightGroup(null);
        }}
        onSaveAsHighlight={handleSaveFromVerseInsight}
        onRemoveHighlight={handleRemoveHighlightGroup}
        onChangeColor={handleChangeColorFromTooltip}
        onAddNote={handleAddNoteFromTooltip}
        onCopy={handleCopyFromTooltip}
        verseText={getVerseTextForTooltip()}
        isLoggedIn={!!user}
      />

      {/* Simple Color Picker Modal */}
      <SimpleColorPickerModal
        visible={colorPickerModalVisible}
        onClose={handleColorPickerClose}
        onSave={handleColorPickerSave}
      />

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
