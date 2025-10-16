/**
 * Tests for useBookProgress Hook
 *
 * Focused tests for book progress calculation.
 * Tests percentage calculation, rounding, and edge cases.
 *
 * @see Task Group 8.1 - Write 2-4 focused tests for ProgressBar
 * @see hooks/bible/use-book-progress.ts
 */

import { renderHook } from '@testing-library/react-native';
import { useBookProgress } from '@/hooks/bible/use-book-progress';

describe('useBookProgress', () => {
  it('calculates progress percentage correctly', () => {
    // Genesis 1/50 should be 2%
    const { result } = renderHook(() => useBookProgress(1, 1, 50));

    expect(result.current.progress.percentage).toBe(2);
    expect(result.current.progress.currentChapter).toBe(1);
    expect(result.current.progress.totalChapters).toBe(50);
    expect(result.current.isCalculating).toBe(false);
  });

  it('rounds percentage to nearest whole number', () => {
    // 13/50 = 26% (exactly)
    const { result: exact } = renderHook(() => useBookProgress(1, 13, 50));
    expect(exact.current.progress.percentage).toBe(26);

    // 14/50 = 28% (exactly)
    const { result: rounded } = renderHook(() => useBookProgress(1, 14, 50));
    expect(rounded.current.progress.percentage).toBe(28);

    // 1/3 = 33.333... → rounds to 33%
    const { result: roundDown } = renderHook(() => useBookProgress(1, 1, 3));
    expect(roundDown.current.progress.percentage).toBe(33);

    // 2/3 = 66.666... → rounds to 67%
    const { result: roundUp } = renderHook(() => useBookProgress(1, 2, 3));
    expect(roundUp.current.progress.percentage).toBe(67);
  });

  it('handles edge cases correctly', () => {
    // First chapter (1/50 = 2%)
    const { result: first } = renderHook(() => useBookProgress(1, 1, 50));
    expect(first.current.progress.percentage).toBe(2);

    // Last chapter (50/50 = 100%)
    const { result: last } = renderHook(() => useBookProgress(1, 50, 50));
    expect(last.current.progress.percentage).toBe(100);

    // Middle chapter (25/50 = 50%)
    const { result: middle } = renderHook(() => useBookProgress(1, 25, 50));
    expect(middle.current.progress.percentage).toBe(50);

    // Single chapter book (1/1 = 100%)
    const { result: single } = renderHook(() => useBookProgress(1, 1, 1));
    expect(single.current.progress.percentage).toBe(100);
  });

  it('updates calculation when inputs change', () => {
    const { result, rerender } = renderHook(
      ({ chapter, total }: { chapter: number; total: number }) =>
        useBookProgress(1, chapter, total),
      { initialProps: { chapter: 1, total: 50 } }
    );

    // Initial: 1/50 = 2%
    expect(result.current.progress.percentage).toBe(2);

    // Update: 25/50 = 50%
    rerender({ chapter: 25, total: 50 });
    expect(result.current.progress.percentage).toBe(50);

    // Update: 50/50 = 100%
    rerender({ chapter: 50, total: 50 });
    expect(result.current.progress.percentage).toBe(100);
  });
});
