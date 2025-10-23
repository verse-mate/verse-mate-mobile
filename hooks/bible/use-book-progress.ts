/**
 * useBookProgress Hook
 *
 * Calculates reading progress through a book as a percentage.
 * Formula: (currentChapter / totalChapters) * 100, rounded to nearest whole number
 *
 * @param _bookId - Current book ID (1-66) - Reserved for future use
 * @param currentChapter - Current chapter number being read
 * @param totalChapters - Total number of chapters in the book
 * @returns Book progress data including percentage, current chapter, and total chapters
 *
 * @see Spec lines 70-75 (Progress tracking)
 * @see Task Group 8.2
 *
 * @example
 * const { progress } = useBookProgress(1, 1, 50); // Genesis 1/50
 * // Returns: { progress: { currentChapter: 1, totalChapters: 50, percentage: 2 }, isCalculating: false }
 */

import { useMemo } from 'react';
import type { BookProgress, UseBookProgressResult } from '@/types/bible';

export function useBookProgress(
  _bookId: number,
  currentChapter: number,
  totalChapters: number
): UseBookProgressResult {
  const progress: BookProgress = useMemo(() => {
    // Calculate percentage: (currentChapter / totalChapters) * 100
    // Round to nearest whole number
    const percentage = Math.round((currentChapter / totalChapters) * 100);

    return {
      currentChapter,
      totalChapters,
      percentage,
    };
  }, [currentChapter, totalChapters]);

  return {
    progress,
    isCalculating: false, // Synchronous calculation, never in loading state
  };
}
