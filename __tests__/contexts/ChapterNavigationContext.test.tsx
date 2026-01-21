/**
 * ChapterNavigationContext Tests
 *
 * Tests for the chapter navigation context that serves as the single source of truth
 * for navigation state (bookId, chapter, bookName) in the Bible reader.
 */

import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';

describe('ChapterNavigationContext', () => {
  describe('useChapterNavigation hook', () => {
    it('should throw error when used outside ChapterNavigationProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useChapterNavigation());
      }).toThrow('useChapterNavigation must be used within a ChapterNavigationProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('ChapterNavigationProvider', () => {
    const createWrapper = (props: {
      initialBookId?: number;
      initialChapter?: number;
      initialBookName?: string;
      onJumpToChapter?: (bookId: number, chapter: number) => void;
    }) => {
      const {
        initialBookId = 1,
        initialChapter = 1,
        initialBookName = 'Genesis',
        onJumpToChapter = jest.fn(),
      } = props;

      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <ChapterNavigationProvider
          initialBookId={initialBookId}
          initialChapter={initialChapter}
          initialBookName={initialBookName}
          onJumpToChapter={onJumpToChapter}
        >
          {children}
        </ChapterNavigationProvider>
      );
      return Wrapper;
    };

    it('should provide initial values from props', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 19,
          initialChapter: 23,
          initialBookName: 'Psalms',
        }),
      });

      expect(result.current.currentBookId).toBe(19);
      expect(result.current.currentChapter).toBe(23);
      expect(result.current.bookName).toBe('Psalms');
    });

    it('should update all three state values when setCurrentChapter is called', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Initial state
      expect(result.current.currentBookId).toBe(1);
      expect(result.current.currentChapter).toBe(1);
      expect(result.current.bookName).toBe('Genesis');

      // Update to a new chapter
      act(() => {
        result.current.setCurrentChapter(2, 5, 'Exodus');
      });

      // Verify all three values updated synchronously
      expect(result.current.currentBookId).toBe(2);
      expect(result.current.currentChapter).toBe(5);
      expect(result.current.bookName).toBe('Exodus');
    });

    it('should invoke onJumpToChapter callback with correct parameters when jumpToChapter is called', () => {
      const mockOnJumpToChapter = jest.fn();

      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
          onJumpToChapter: mockOnJumpToChapter,
        }),
      });

      // Call jumpToChapter
      act(() => {
        result.current.jumpToChapter(66, 22);
      });

      // Verify callback was invoked with correct parameters
      expect(mockOnJumpToChapter).toHaveBeenCalledTimes(1);
      expect(mockOnJumpToChapter).toHaveBeenCalledWith(66, 22);
    });

    it('should maintain stable context value reference when state does not change (memoization)', () => {
      const { result, rerender } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Capture the initial function references
      const initialSetCurrentChapter = result.current.setCurrentChapter;
      const initialJumpToChapter = result.current.jumpToChapter;

      // Re-render without changing state
      rerender({});

      // Function references should remain stable (due to useCallback)
      expect(result.current.setCurrentChapter).toBe(initialSetCurrentChapter);
      expect(result.current.jumpToChapter).toBe(initialJumpToChapter);
    });

    it('should handle multiple sequential setCurrentChapter calls correctly', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // First update
      act(() => {
        result.current.setCurrentChapter(19, 1, 'Psalms');
      });

      expect(result.current.currentBookId).toBe(19);
      expect(result.current.currentChapter).toBe(1);
      expect(result.current.bookName).toBe('Psalms');

      // Second update
      act(() => {
        result.current.setCurrentChapter(19, 150, 'Psalms');
      });

      expect(result.current.currentBookId).toBe(19);
      expect(result.current.currentChapter).toBe(150);
      expect(result.current.bookName).toBe('Psalms');

      // Third update (different book)
      act(() => {
        result.current.setCurrentChapter(43, 3, 'John');
      });

      expect(result.current.currentBookId).toBe(43);
      expect(result.current.currentChapter).toBe(3);
      expect(result.current.bookName).toBe('John');
    });
  });
});
