/**
 * Text Selection Utilities Tests
 *
 * Tests for character position calculation and multi-verse selection handling.
 *
 * @see Task 4.1: Write 2-8 focused tests for text selection
 */

import {
  calculateCharPosition,
  calculateMultiVerseSelection,
  checkSelectionOverlap,
  extractTextSelection,
  formatVerseRange,
} from '@/utils/text-selection';

describe('Text Selection Utilities', () => {
  describe('calculateCharPosition', () => {
    it('should return position within verse boundaries', () => {
      const verseText = 'In the beginning God created the heavens and the earth.';

      // Normal position
      expect(calculateCharPosition(verseText, 7)).toBe(7);

      // Start of verse
      expect(calculateCharPosition(verseText, 0)).toBe(0);

      // End of verse
      expect(calculateCharPosition(verseText, verseText.length)).toBe(verseText.length);
    });

    it('should clamp position to verse boundaries', () => {
      const verseText = 'In the beginning God created the heavens and the earth.';

      // Beyond end
      expect(calculateCharPosition(verseText, 1000)).toBe(verseText.length);

      // Negative position
      expect(calculateCharPosition(verseText, -5)).toBe(0);
    });
  });

  describe('calculateMultiVerseSelection', () => {
    const verses = [
      { verseNumber: 1, text: 'In the beginning God created the heavens and the earth.' },
      {
        verseNumber: 2,
        text: 'The earth was formless and void, and darkness was over the surface of the deep.',
      },
      { verseNumber: 3, text: 'Then God said, "Let there be light"; and there was light.' },
    ];

    it('should calculate single verse selection', () => {
      const result = calculateMultiVerseSelection(verses, 1, 1, 7, 20);

      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(1);
      expect(result.startChar).toBe(7);
      expect(result.endChar).toBe(20);
      expect(result.selectedText).toBe('beginning God');
    });

    it('should calculate multi-verse selection span', () => {
      const result = calculateMultiVerseSelection(verses, 1, 2, 10, 30);

      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(2);
      expect(result.startChar).toBe(10);
      expect(result.endChar).toBe(30);
      // Selection starts at char 10 in verse 1: "inning God created..."
      expect(result.selectedText).toContain('inning God created');
      expect(result.selectedText).toContain('The earth was formless and');
    });

    it('should handle selection across three verses', () => {
      const result = calculateMultiVerseSelection(verses, 1, 3, 0, 20);

      expect(result.startVerse).toBe(1);
      expect(result.endVerse).toBe(3);
      expect(result.startChar).toBe(0);
      expect(result.endChar).toBe(20);
      expect(result.selectedText).toContain('In the beginning');
      expect(result.selectedText).toContain('The earth was formless');
      expect(result.selectedText).toContain('Then God said');
    });
  });

  describe('extractTextSelection', () => {
    it('should extract selected text from verse', () => {
      const verseText = 'In the beginning God created the heavens and the earth.';
      const selection = { start: 7, end: 20 };

      const result = extractTextSelection(selection, verseText);

      expect(result.start).toBe(7);
      expect(result.end).toBe(20);
      expect(result.text).toBe('beginning God');
    });

    it('should normalize selection boundaries', () => {
      const verseText = 'In the beginning God created the heavens and the earth.';
      const selection = { start: -5, end: 1000 };

      const result = extractTextSelection(selection, verseText);

      expect(result.start).toBe(0);
      expect(result.end).toBe(verseText.length);
      expect(result.text).toBe(verseText);
    });
  });

  describe('checkSelectionOverlap', () => {
    it('should detect overlap with same character range', () => {
      const existingHighlights = [
        {
          start_verse: 1,
          end_verse: 1,
          start_char: 10,
          end_char: 30,
        },
      ];

      // Exact overlap
      expect(checkSelectionOverlap(1, 1, 10, 30, existingHighlights)).toBe(true);

      // Partial overlap (start inside existing)
      expect(checkSelectionOverlap(1, 1, 15, 40, existingHighlights)).toBe(true);

      // Partial overlap (end inside existing)
      expect(checkSelectionOverlap(1, 1, 5, 20, existingHighlights)).toBe(true);

      // Containing overlap (new selection contains existing)
      expect(checkSelectionOverlap(1, 1, 5, 40, existingHighlights)).toBe(true);
    });

    it('should not detect overlap with non-overlapping ranges', () => {
      const existingHighlights = [
        {
          start_verse: 1,
          end_verse: 1,
          start_char: 10,
          end_char: 30,
        },
      ];

      // Before existing highlight
      expect(checkSelectionOverlap(1, 1, 0, 9, existingHighlights)).toBe(false);

      // After existing highlight
      expect(checkSelectionOverlap(1, 1, 31, 50, existingHighlights)).toBe(false);

      // Different verse
      expect(checkSelectionOverlap(2, 2, 0, 50, existingHighlights)).toBe(false);
    });

    it('should detect overlap for multi-verse selections', () => {
      const existingHighlights = [
        {
          start_verse: 1,
          end_verse: 2,
          start_char: 10,
          end_char: 30,
        },
      ];

      // Overlapping verse range
      expect(checkSelectionOverlap(2, 3, 0, 50, existingHighlights)).toBe(true);

      // Non-overlapping verse range
      expect(checkSelectionOverlap(3, 4, 0, 50, existingHighlights)).toBe(false);
    });
  });

  describe('formatVerseRange', () => {
    it('should format single verse', () => {
      expect(formatVerseRange(1, 1)).toBe('Verse 1');
      expect(formatVerseRange(42, 42)).toBe('Verse 42');
    });

    it('should format verse range', () => {
      expect(formatVerseRange(1, 5)).toBe('Verses 1-5');
      expect(formatVerseRange(10, 20)).toBe('Verses 10-20');
    });
  });
});
