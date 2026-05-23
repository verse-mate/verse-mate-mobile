/**
 * Tests for useChapterState Hook
 *
 * The useChapterState hook is the single source of truth for chapter navigation state.
 * It manages bookId, chapterNumber, and bookName, with debounced URL sync.
 *
 * Key behaviors tested:
 * - Initial state from URL params
 * - navigateToChapter() updates state correctly
 * - URL params are read once on mount only (no snap-back)
 * - Book name is computed from bookId using metadata
 * - Invalid bookId/chapter handled gracefully
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
// Import after mocks - ESLint/Biome may complain but import order matters for Jest mocking
import { router, useLocalSearchParams } from 'expo-router';
import { useChapterState } from '@/hooks/bible/use-chapter-state';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Use the standard expo-router mock
jest.mock('expo-router', () => require('../../mocks/expo-router.mock').default);

// Mock useBibleTestaments
jest.mock('@/src/api/hooks', () => ({
  useBibleTestaments: jest.fn(() => ({
    data: mockTestamentBooks,
    isLoading: false,
  })),
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockSetParams = router.setParams as jest.Mock;

describe('useChapterState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1: Initial state from URL params
   */
  it('initializes state from URL params on mount', () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '5',
      chapterNumber: '10',
    });

    const { result } = renderHook(() => useChapterState());

    expect(result.current.bookId).toBe(5);
    expect(result.current.chapterNumber).toBe(10);
    expect(result.current.bookName).toBe('Deuteronomy');
  });

  /**
   * Test 2: navigateToChapter() updates state correctly
   */
  it('updates state when navigateToChapter is called', () => {
    const { result } = renderHook(() => useChapterState());

    act(() => {
      result.current.navigateToChapter(2, 5);
    });

    expect(result.current.bookId).toBe(2);
    expect(result.current.chapterNumber).toBe(5);
    expect(result.current.bookName).toBe('Exodus');
  });

  /**
   * Test 3: State updates when URL changes after mount (Deep Links)
   * This ensures that external navigation (like deep links or menu)
   * updates the hook state even after it has initialized.
   */
  it('updates state when URL params change after initial mount', () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    const { result, rerender } = renderHook(() => useChapterState());

    // Navigate to Genesis 5
    act(() => {
      result.current.navigateToChapter(1, 5);
    });

    expect(result.current.chapterNumber).toBe(5);

    // Simulate URL param change (e.g. from deep link or menu)
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '3',
    });

    // Rerender the hook
    rerender({});

    // State should HAVE changed to chapter 3
    expect(result.current.chapterNumber).toBe(3);
  });

  /**
   * Test 4: Book name is computed from bookId using metadata
   */
  it('computes book name from bookId using metadata', () => {
    const { result } = renderHook(() => useChapterState());

    // Test various books
    act(() => {
      result.current.navigateToChapter(19, 23); // Psalms 23
    });
    expect(result.current.bookName).toBe('Psalms');

    act(() => {
      result.current.navigateToChapter(40, 1); // Matthew 1
    });
    expect(result.current.bookName).toBe('Matthew');

    act(() => {
      result.current.navigateToChapter(66, 22); // Revelation 22
    });
    expect(result.current.bookName).toBe('Revelation');
  });

  /**
   * Test 5: Invalid bookId/chapter handled gracefully
   */
  it('handles invalid bookId and chapter gracefully', () => {
    const { result } = renderHook(() => useChapterState());

    // Navigate to invalid bookId (should clamp to valid range)
    act(() => {
      result.current.navigateToChapter(100, 1);
    });

    // Should clamp to valid bookId range (1-66)
    expect(result.current.bookId).toBeLessThanOrEqual(66);
    expect(result.current.bookId).toBeGreaterThanOrEqual(1);

    // Navigate to invalid chapter (negative)
    act(() => {
      result.current.navigateToChapter(1, -5);
    });

    // Should handle gracefully (exact behavior depends on implementation)
    expect(result.current.chapterNumber).toBeGreaterThanOrEqual(1);
  });

  /**
   * Test: Debounced URL sync occurs after delay
   *
   * URL writer emits the canonical slug form (matches generate-chapter-share-url)
   * so deep-link / share URLs round-trip through the screen unchanged.
   */
  it('syncs URL with debounce after navigateToChapter', async () => {
    const { result } = renderHook(() => useChapterState());

    act(() => {
      result.current.navigateToChapter(5, 10);
    });

    // URL should not be updated immediately
    expect(mockSetParams).not.toHaveBeenCalled();

    // Fast-forward past the debounce delay
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // URL should now be updated (slug form, verse params cleared)
    await waitFor(() => {
      expect(mockSetParams).toHaveBeenCalledWith({
        bookId: 'deuteronomy',
        chapterNumber: '10',
        verse: undefined,
        endVerse: undefined,
      });
    });
  });

  /**
   * Test: Multiple rapid navigations only trigger one URL sync
   */
  it('debounces multiple rapid navigations to single URL sync', () => {
    const { result } = renderHook(() => useChapterState());

    // Rapid navigation changes
    act(() => {
      result.current.navigateToChapter(1, 2);
      result.current.navigateToChapter(1, 3);
      result.current.navigateToChapter(1, 4);
      result.current.navigateToChapter(1, 5);
    });

    // State should be at the last navigation
    expect(result.current.chapterNumber).toBe(5);

    // Fast-forward past debounce
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // URL sync should only happen once with final values (slug form, verse params cleared)
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({
      bookId: 'genesis',
      chapterNumber: '5',
      verse: undefined,
      endVerse: undefined,
    });
  });

  /**
   * Test: booksMetadata is exposed from hook
   */
  it('exposes booksMetadata from useBibleTestaments', () => {
    const { result } = renderHook(() => useChapterState());

    expect(result.current.booksMetadata).toBeDefined();
    expect(result.current.booksMetadata).toEqual(mockTestamentBooks);
  });

  /**
   * Test: totalChapters computed correctly
   */
  it('computes totalChapters from book metadata', () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
    });

    const { result } = renderHook(() => useChapterState());

    // Genesis has 50 chapters
    expect(result.current.totalChapters).toBe(50);

    // Navigate to Exodus (40 chapters)
    act(() => {
      result.current.navigateToChapter(2, 1);
    });
    expect(result.current.totalChapters).toBe(40);
  });

  /**
   * Test: max-chapter clamping
   */
  it('clamps chapterNumber to book max when metadata loads', () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '999',
    });

    const { result } = renderHook(() => useChapterState());

    // Genesis has 50 chapters, so 999 should be clamped to 1
    expect(result.current.chapterNumber).toBe(1);
    expect(result.current.bookId).toBe(1);
  });

  /**
   * Regression: slug URL params resolve to the correct book (VER-117).
   *
   * Before the fix, `Number(params.bookId)` returned NaN for non-numeric slugs
   * and fell back to Genesis, so /bible/galatians/6 served Genesis 6 content.
   */
  describe('slug URL params (VER-117 regression)', () => {
    it('resolves "galatians" slug to bookId 48', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: 'galatians',
        chapterNumber: '6',
      });

      const { result } = renderHook(() => useChapterState());

      expect(result.current.bookId).toBe(48);
      expect(result.current.chapterNumber).toBe(6);
      expect(result.current.bookName).toBe('Galatians');
    });

    it('resolves "john" slug to bookId 43', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: 'john',
        chapterNumber: '3',
      });

      const { result } = renderHook(() => useChapterState());

      expect(result.current.bookId).toBe(43);
      expect(result.current.chapterNumber).toBe(3);
      expect(result.current.bookName).toBe('John');
    });

    it('resolves multi-word slugs like "1-corinthians" to bookId 46', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: '1-corinthians',
        chapterNumber: '13',
      });

      const { result } = renderHook(() => useChapterState());

      expect(result.current.bookId).toBe(46);
      expect(result.current.chapterNumber).toBe(13);
      expect(result.current.bookName).toBe('1 Corinthians');
    });

    it('still accepts numeric bookId for backward compatibility', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: '48',
        chapterNumber: '6',
      });

      const { result } = renderHook(() => useChapterState());

      expect(result.current.bookId).toBe(48);
      expect(result.current.chapterNumber).toBe(6);
      expect(result.current.bookName).toBe('Galatians');
    });

    it('falls back to Genesis 1 when the slug is unknown', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: 'not-a-book',
        chapterNumber: '5',
      });

      const { result } = renderHook(() => useChapterState());

      expect(result.current.bookId).toBe(1);
      // Chapter is preserved (still a valid number) — only the book defaulted
      expect(result.current.chapterNumber).toBe(5);
    });

    it('does not rewrite the URL when params already match state in slug form', () => {
      mockUseLocalSearchParams.mockReturnValue({
        bookId: 'galatians',
        chapterNumber: '6',
      });

      renderHook(() => useChapterState());

      // Fast-forward past the debounce window — URL must NOT churn from
      // 'galatians' to '48' just because the writer formatted bookId differently.
      act(() => {
        jest.advanceTimersByTime(1100);
      });

      expect(mockSetParams).not.toHaveBeenCalled();
    });
  });

  /**
   * Test: verse params cleared on URL sync
   */
  it('clears verse and endVerse params on URL sync', async () => {
    const { result } = renderHook(() => useChapterState());

    act(() => {
      result.current.navigateToChapter(3, 5);
    });

    // Fast-forward past debounce
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(mockSetParams).toHaveBeenCalledWith(
        expect.objectContaining({
          verse: undefined,
          endVerse: undefined,
        })
      );
    });
  });
});
