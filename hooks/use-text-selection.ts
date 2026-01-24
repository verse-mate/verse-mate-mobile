/**
 * useTextSelection Hook
 *
 * Manages text selection state for Bible verse text.
 * Handles word detection from tap coordinates, selection state,
 * and menu positioning.
 *
 * Features:
 * - Detects tapped word from text and coordinates
 * - Manages selection state (verse, text, position)
 * - Calculates menu position based on tap location
 * - Supports clearing selection
 *
 * @example
 * ```tsx
 * const {
 *   selection,
 *   menuPosition,
 *   selectWord,
 *   clearSelection,
 * } = useTextSelection();
 *
 * // When user taps a word
 * selectWord({
 *   verseNumber: 1,
 *   text: "love",
 *   startChar: 10,
 *   endChar: 14,
 *   tapPosition: { x: 150, y: 300 },
 * });
 * ```
 */

import { useRef, useState } from 'react';

/**
 * Selection state for a word or phrase
 */
export interface WordSelection {
  /** Verse number containing the selection */
  verseNumber: number;
  /** Selected text */
  text: string;
  /** Start character position in verse */
  startChar: number;
  /** End character position in verse */
  endChar: number;
}

/**
 * Position for the selection menu
 */
export interface MenuPosition {
  /** X coordinate (center of selection) */
  x: number;
  /** Y coordinate (top of selection) */
  y: number;
}

/**
 * Input for selecting a word
 */
export interface SelectWordInput {
  /** Verse number */
  verseNumber: number;
  /** The word text */
  text: string;
  /** Start character position */
  startChar: number;
  /** End character position */
  endChar: number;
  /** Position where user tapped */
  tapPosition: { x: number; y: number };
}

/**
 * Return type for useTextSelection hook
 */
export interface UseTextSelectionReturn {
  /** Current selection state (null if nothing selected) */
  selection: WordSelection | null;
  /** Whether the selection menu should be visible */
  isMenuVisible: boolean;
  /** Position for the selection menu */
  menuPosition: MenuPosition;
  /** Select a word at the given position */
  selectWord: (input: SelectWordInput) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Show the menu (after debounce) */
  showMenu: () => void;
  /** Hide the menu */
  hideMenu: () => void;
}

/**
 * Extract word at character position from text
 */
export function getWordAtPosition(
  text: string,
  position: number
): { word: string; start: number; end: number } | null {
  if (position < 0 || position > text.length) return null;

  // Find word boundaries
  let start = position;
  let end = position;

  // Move start back to beginning of word
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }

  // Move end forward to end of word
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  // If we're on whitespace/punctuation, find the nearest word
  if (start === end) {
    // Look forward first
    while (end < text.length && !/\w/.test(text[end])) {
      end++;
    }
    if (end < text.length) {
      start = end;
      while (end < text.length && /\w/.test(text[end])) {
        end++;
      }
    }
  }

  if (start === end) return null;

  return {
    word: text.slice(start, end),
    start,
    end,
  };
}

/**
 * useTextSelection Hook
 *
 * Manages text selection state for Bible verses.
 */
export function useTextSelection(): UseTextSelectionReturn {
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  // Debounce timer for showing menu
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Select a word at the given position
   */
  const selectWord = (input: SelectWordInput) => {
    const { verseNumber, text, startChar, endChar, tapPosition } = input;

    // Clear any pending menu timer
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }

    // Set selection
    setSelection({
      verseNumber,
      text,
      startChar,
      endChar,
    });

    // Set menu position (above the tap position)
    setMenuPosition({
      x: tapPosition.x,
      y: tapPosition.y,
    });

    // Show menu after 300ms debounce
    menuTimerRef.current = setTimeout(() => {
      setIsMenuVisible(true);
    }, 300);
  };

  /**
   * Clear the current selection
   */
  const clearSelection = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
    setSelection(null);
    setIsMenuVisible(false);
    setMenuPosition({ x: 0, y: 0 });
  };

  /**
   * Show the menu immediately
   */
  const showMenu = () => {
    if (selection) {
      if (menuTimerRef.current) {
        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = null;
      }
      setIsMenuVisible(true);
    }
  };

  /**
   * Hide the menu
   */
  const hideMenu = () => {
    setIsMenuVisible(false);
  };

  return {
    selection,
    isMenuVisible,
    menuPosition,
    selectWord,
    clearSelection,
    showMenu,
    hideMenu,
  };
}
