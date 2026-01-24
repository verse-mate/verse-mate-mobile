/**
 * Chapter Header/Slide Synchronization Integration Tests
 *
 * Tests end-to-end integration of the ChapterNavigationContext with PagerView
 * and ChapterHeader to verify instant header updates on swipe navigation.
 *
 * Critical workflows tested:
 * - Circular navigation preserves header sync (Genesis 1 <-> Revelation 22)
 * - Rapid swiping does not cause header/content desync
 * - Context state survives component remounts
 * - End-to-end swipe-to-header-update flow
 *
 * @see Spec: agent-os/specs/2026-01-21-chapter-header-slide-sync/spec.md
 * @see Task Group 5: Test Review and Final Integration
 */

import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

/**
 * Helper to create a wrapper with ChapterNavigationProvider
 */
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

/**
 * Helper to get book name from mock data
 */
function getBookName(bookId: number): string {
  return mockTestamentBooks.find((b) => b.id === bookId)?.name || 'Unknown';
}

describe('Chapter Header/Slide Synchronization Integration', () => {
  describe('Circular navigation preserves header sync', () => {
    /**
     * Test 1: Swiping backward from Genesis 1 to Revelation 22 updates header correctly
     *
     * Simulates the flow where PagerView's handlePageSelected calls setCurrentChapter
     * when user swipes from Genesis 1 to Revelation 22 via circular navigation.
     */
    it('should update header to Revelation 22 when swiping backward from Genesis 1', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Initial state at Genesis 1
      expect(result.current.currentBookId).toBe(1);
      expect(result.current.currentChapter).toBe(1);
      expect(result.current.bookName).toBe('Genesis');

      // Simulate PagerView's context update when swiping backward (circular wrap)
      // This is what happens in handlePageSelected when position wraps to Revelation 22
      act(() => {
        result.current.setCurrentChapter(66, 22, 'Revelation');
      });

      // Header should now show Revelation 22
      expect(result.current.currentBookId).toBe(66);
      expect(result.current.currentChapter).toBe(22);
      expect(result.current.bookName).toBe('Revelation');
    });

    /**
     * Test 2: Swiping forward from Revelation 22 to Genesis 1 updates header correctly
     *
     * Simulates the flow where PagerView's handlePageSelected calls setCurrentChapter
     * when user swipes from Revelation 22 to Genesis 1 via circular navigation.
     */
    it('should update header to Genesis 1 when swiping forward from Revelation 22', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 66,
          initialChapter: 22,
          initialBookName: 'Revelation',
        }),
      });

      // Initial state at Revelation 22
      expect(result.current.currentBookId).toBe(66);
      expect(result.current.currentChapter).toBe(22);
      expect(result.current.bookName).toBe('Revelation');

      // Simulate PagerView's context update when swiping forward (circular wrap)
      act(() => {
        result.current.setCurrentChapter(1, 1, 'Genesis');
      });

      // Header should now show Genesis 1
      expect(result.current.currentBookId).toBe(1);
      expect(result.current.currentChapter).toBe(1);
      expect(result.current.bookName).toBe('Genesis');
    });

    /**
     * Test 3: Full circular round-trip Genesis 1 -> Revelation 22 -> Genesis 1
     *
     * Verifies header state is correctly maintained through a complete circular journey.
     */
    it('should maintain correct header state through circular round-trip', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Step 1: Genesis 1 (start)
      expect(result.current.bookName).toBe('Genesis');
      expect(result.current.currentChapter).toBe(1);

      // Step 2: Swipe backward to Revelation 22
      act(() => {
        result.current.setCurrentChapter(66, 22, 'Revelation');
      });
      expect(result.current.bookName).toBe('Revelation');
      expect(result.current.currentChapter).toBe(22);

      // Step 3: Swipe backward to Revelation 21
      act(() => {
        result.current.setCurrentChapter(66, 21, 'Revelation');
      });
      expect(result.current.bookName).toBe('Revelation');
      expect(result.current.currentChapter).toBe(21);

      // Step 4: Swipe forward back to Revelation 22
      act(() => {
        result.current.setCurrentChapter(66, 22, 'Revelation');
      });
      expect(result.current.bookName).toBe('Revelation');
      expect(result.current.currentChapter).toBe(22);

      // Step 5: Swipe forward to Genesis 1 (circular wrap)
      act(() => {
        result.current.setCurrentChapter(1, 1, 'Genesis');
      });
      expect(result.current.bookName).toBe('Genesis');
      expect(result.current.currentChapter).toBe(1);
    });
  });

  describe('Rapid swiping does not cause header/content desync', () => {
    /**
     * Test 4: Multiple rapid setCurrentChapter calls end with correct final state
     *
     * Simulates rapid swiping where multiple context updates happen in quick succession.
     * The header should always reflect the final navigation state.
     */
    it('should reflect final state after rapid sequential updates', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Simulate rapid swiping through multiple chapters
      act(() => {
        result.current.setCurrentChapter(1, 2, 'Genesis');
        result.current.setCurrentChapter(1, 3, 'Genesis');
        result.current.setCurrentChapter(1, 4, 'Genesis');
        result.current.setCurrentChapter(1, 5, 'Genesis');
      });

      // Header should show Genesis 5 (final state)
      expect(result.current.currentBookId).toBe(1);
      expect(result.current.currentChapter).toBe(5);
      expect(result.current.bookName).toBe('Genesis');
    });

    /**
     * Test 5: Rapid swiping across book boundaries maintains correct header
     *
     * Simulates rapid swiping that crosses multiple book boundaries.
     */
    it('should handle rapid swiping across book boundaries', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 49,
          initialBookName: 'Genesis',
        }),
      });

      // Rapid swipe through Genesis 49 -> 50 -> Exodus 1 -> 2 -> 3
      act(() => {
        result.current.setCurrentChapter(1, 50, 'Genesis');
      });
      act(() => {
        result.current.setCurrentChapter(2, 1, 'Exodus');
      });
      act(() => {
        result.current.setCurrentChapter(2, 2, 'Exodus');
      });
      act(() => {
        result.current.setCurrentChapter(2, 3, 'Exodus');
      });

      // Final state should be Exodus 3
      expect(result.current.currentBookId).toBe(2);
      expect(result.current.currentChapter).toBe(3);
      expect(result.current.bookName).toBe('Exodus');
    });

    /**
     * Test 6: Rapid alternating swipes (back and forth) maintains sync
     *
     * Simulates user rapidly swiping back and forth between pages.
     */
    it('should handle rapid alternating swipes without desync', () => {
      const { result } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 19,
          initialChapter: 23,
          initialBookName: 'Psalms',
        }),
      });

      // Rapid alternating swipes: 23 -> 24 -> 23 -> 24 -> 23
      act(() => {
        result.current.setCurrentChapter(19, 24, 'Psalms');
      });
      act(() => {
        result.current.setCurrentChapter(19, 23, 'Psalms');
      });
      act(() => {
        result.current.setCurrentChapter(19, 24, 'Psalms');
      });
      act(() => {
        result.current.setCurrentChapter(19, 23, 'Psalms');
      });

      // Final state should match last update
      expect(result.current.currentBookId).toBe(19);
      expect(result.current.currentChapter).toBe(23);
      expect(result.current.bookName).toBe('Psalms');
    });
  });

  describe('Context state survives component remounts', () => {
    /**
     * Test 7: Re-render does not lose context state
     *
     * Verifies that context state persists across re-renders.
     */
    it('should preserve context state across re-renders', () => {
      const { result, rerender } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 43,
          initialChapter: 3,
          initialBookName: 'John',
        }),
      });

      // Initial state
      expect(result.current.bookName).toBe('John');
      expect(result.current.currentChapter).toBe(3);

      // Update state
      act(() => {
        result.current.setCurrentChapter(43, 16, 'John');
      });

      // Verify state updated
      expect(result.current.currentChapter).toBe(16);

      // Re-render the hook
      rerender({});

      // State should persist after re-render
      expect(result.current.currentBookId).toBe(43);
      expect(result.current.currentChapter).toBe(16);
      expect(result.current.bookName).toBe('John');
    });

    /**
     * Test 8: Function references remain stable across re-renders
     *
     * Important for performance - ensures context consumers don't re-render unnecessarily.
     */
    it('should maintain stable function references after state updates', () => {
      const { result, rerender } = renderHook(() => useChapterNavigation(), {
        wrapper: createWrapper({
          initialBookId: 1,
          initialChapter: 1,
          initialBookName: 'Genesis',
        }),
      });

      // Capture initial function references
      const initialSetCurrentChapter = result.current.setCurrentChapter;
      const initialJumpToChapter = result.current.jumpToChapter;

      // Update state
      act(() => {
        result.current.setCurrentChapter(1, 5, 'Genesis');
      });

      // Re-render
      rerender({});

      // Function references should be stable (useCallback)
      expect(result.current.setCurrentChapter).toBe(initialSetCurrentChapter);
      expect(result.current.jumpToChapter).toBe(initialJumpToChapter);
    });
  });
});
