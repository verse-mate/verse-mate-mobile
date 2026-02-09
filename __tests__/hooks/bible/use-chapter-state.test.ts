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
   * Test 3: State does not update when URL changes after mount
   * This prevents the "snap-back" bug where URL updates cause state to reset
   */
  it('does not re-read URL params after initial mount', () => {
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

    // Simulate URL param change (would happen after debounced sync)
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '3', // Different value
    });

    // Rerender the hook
    rerender({});

    // State should NOT have changed back to chapter 3
    expect(result.current.chapterNumber).toBe(5);
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

    // URL should now be updated
    await waitFor(() => {
      expect(mockSetParams).toHaveBeenCalledWith({
        bookId: '5',
        chapterNumber: '10',
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

    // URL sync should only happen once with final values
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({
      bookId: '1',
      chapterNumber: '5',
    });
  });
});
