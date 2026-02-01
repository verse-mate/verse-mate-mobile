/**
 * useChapterDisplay Hook Tests
 *
 * Tests for the chapter display hook that provides Reanimated shared values
 * for tracking the current book ID, chapter number, and derived book name.
 * This hook enables the header to update on the UI thread without React re-renders.
 *
 * NOTE: Reanimated's mock implementation of useDerivedValue only evaluates once
 * during initialization and does not re-evaluate when dependencies change.
 * The reactivity of derived values is tested via E2E Maestro tests.
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 * @see Task Group 1: Create Chapter Display Hook
 */

import { act, renderHook } from '@testing-library/react-native';
import {
  __TEST_ONLY_RESET_STATE,
  __TEST_ONLY_SET_BOOKS_METADATA,
  useChapterDisplay,
} from '@/hooks/bible/use-chapter-display';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

describe('useChapterDisplay', () => {
  beforeEach(() => {
    // Reset module-level state before each test
    __TEST_ONLY_RESET_STATE();
  });

  afterEach(() => {
    // Clean up after each test
    __TEST_ONLY_RESET_STATE();
  });

  describe('shared value initialization', () => {
    it('should initialize shared values with default values when no booksMetadata provided', () => {
      const { result } = renderHook(() => useChapterDisplay());

      // Verify initial shared values exist and have default values
      expect(result.current.currentBookIdValue).toBeDefined();
      expect(result.current.currentChapterValue).toBeDefined();
      expect(result.current.bookNameValue).toBeDefined();

      // Default values should be 1 (Genesis) and 1 (chapter 1)
      expect(result.current.currentBookIdValue.value).toBe(1);
      expect(result.current.currentChapterValue.value).toBe(1);
    });

    it('should initialize with provided initial book and chapter values', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { result } = renderHook(() =>
        useChapterDisplay({ initialBookId: 40, initialChapter: 5 })
      );

      expect(result.current.currentBookIdValue.value).toBe(40);
      expect(result.current.currentChapterValue.value).toBe(5);
    });
  });

  describe('useDerivedValue for book name', () => {
    it('should derive book name correctly from booksMetadata on initial render', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { result } = renderHook(() =>
        useChapterDisplay({ initialBookId: 1, initialChapter: 1 })
      );

      // Book ID 1 is Genesis - verify initial derivation works
      expect(result.current.bookNameValue.value).toBe('Genesis');
    });

    it('should derive correct book name for Matthew (bookId 40) on initialization', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { result } = renderHook(() =>
        useChapterDisplay({ initialBookId: 40, initialChapter: 5 })
      );

      // Book ID 40 is Matthew
      expect(result.current.bookNameValue.value).toBe('Matthew');
    });
  });

  describe('hook interface', () => {
    it('should export correct interface with shared values and setChapter function', () => {
      const { result } = renderHook(() => useChapterDisplay());

      // Verify all expected properties are present
      expect(result.current).toHaveProperty('currentBookIdValue');
      expect(result.current).toHaveProperty('currentChapterValue');
      expect(result.current).toHaveProperty('bookNameValue');
      expect(result.current).toHaveProperty('setChapter');
      expect(result.current).toHaveProperty('setBooksMetadata');

      // Verify setChapter is a function
      expect(typeof result.current.setChapter).toBe('function');
      expect(typeof result.current.setBooksMetadata).toBe('function');
    });

    it('should update bookId and chapterNumber shared values when setChapter is called', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { result } = renderHook(() => useChapterDisplay());

      act(() => {
        result.current.setChapter(19, 23); // Psalms 23
      });

      // Verify shared values are updated
      expect(result.current.currentBookIdValue.value).toBe(19);
      expect(result.current.currentChapterValue.value).toBe(23);

      // Note: bookNameValue derivation only runs on initialization in mock
      // Real reactivity is verified via E2E tests
    });
  });

  describe('missing booksMetadata handling', () => {
    it('should handle missing booksMetadata gracefully with empty string for book name', () => {
      // Do not set booksMetadata
      __TEST_ONLY_RESET_STATE();

      const { result } = renderHook(() =>
        useChapterDisplay({ initialBookId: 1, initialChapter: 1 })
      );

      // Should not crash, bookName should be empty string when metadata not available
      expect(result.current.bookNameValue.value).toBe('');
    });

    it('should return empty string for book name when bookId not found in metadata', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { result } = renderHook(() =>
        useChapterDisplay({ initialBookId: 999, initialChapter: 1 })
      );

      // Invalid bookId should return empty string
      expect(result.current.bookNameValue.value).toBe('');
    });
  });

  describe('module-level state persistence', () => {
    it('should persist state across hook remounts for stability', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      // First render
      const { result: result1 } = renderHook(() =>
        useChapterDisplay({ initialBookId: 1, initialChapter: 1 })
      );

      // Update values
      act(() => {
        result1.current.setChapter(40, 5);
      });

      expect(result1.current.currentBookIdValue.value).toBe(40);
      expect(result1.current.currentChapterValue.value).toBe(5);

      // Second render - values should be persisted via module-level state
      const { result: result2 } = renderHook(() => useChapterDisplay());

      // The new hook instance should have the updated values
      expect(result2.current.currentBookIdValue.value).toBe(40);
      expect(result2.current.currentChapterValue.value).toBe(5);
    });
  });
});
