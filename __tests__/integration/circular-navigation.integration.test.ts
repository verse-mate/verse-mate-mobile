/**
 * Integration Tests: Circular Bible Navigation
 *
 * Tests end-to-end circular navigation workflows at Bible boundaries:
 * - Full round-trip: Genesis 1 -> Revelation 22 -> Genesis 1
 * - Seamless transition with no visual indicators
 * - Existing cross-book navigation unaffected
 * - Route/URL updates correctly after circular navigation
 *
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 * @see Task Group 5: Test Review & Gap Analysis
 */

import { renderHook } from '@testing-library/react-native';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import {
  getAbsolutePageIndex,
  getChapterFromPageIndex,
  wrapCircularIndex,
} from '@/utils/bible/chapter-index-utils';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

describe('Circular Bible Navigation - Integration', () => {
  /**
   * Test 1: Full round-trip Genesis 1 -> Revelation 22 -> Genesis 1
   *
   * Verifies the complete circular workflow using multiple layers:
   * - Utility functions for index calculation
   * - Hook for navigation state
   * - Validates that navigation wraps correctly in both directions
   */
  describe('Full circular round-trip workflow', () => {
    it('should complete Genesis 1 -> Revelation 22 -> Genesis 1 round-trip', () => {
      // Step 1: Start at Genesis 1
      const genesis1Index = getAbsolutePageIndex(1, 1, mockTestamentBooks);
      expect(genesis1Index).toBe(0);

      // Step 2: Navigate backward from Genesis 1 (should wrap to Revelation 22)
      const wrappedBackward = wrapCircularIndex(-1, mockTestamentBooks);
      expect(wrappedBackward).toBe(1188); // Max index (Revelation 22)

      const revFromBackward = getChapterFromPageIndex(wrappedBackward, mockTestamentBooks);
      expect(revFromBackward).toEqual({ bookId: 66, chapterNumber: 22 });

      // Step 3: Verify hook returns correct navigation at Genesis 1
      const { result: navAtGenesis1 } = renderHook(() =>
        useChapterNavigation(1, 1, mockTestamentBooks)
      );
      expect(navAtGenesis1.current.prevChapter).toEqual({ bookId: 66, chapterNumber: 22 });
      expect(navAtGenesis1.current.canGoPrevious).toBe(true);

      // Step 4: Navigate forward from Revelation 22 (should wrap to Genesis 1)
      const revelation22Index = getAbsolutePageIndex(66, 22, mockTestamentBooks);
      expect(revelation22Index).toBe(1188);

      const wrappedForward = wrapCircularIndex(1189, mockTestamentBooks);
      expect(wrappedForward).toBe(0); // Genesis 1

      const genFromForward = getChapterFromPageIndex(wrappedForward, mockTestamentBooks);
      expect(genFromForward).toEqual({ bookId: 1, chapterNumber: 1 });

      // Step 5: Verify hook returns correct navigation at Revelation 22
      const { result: navAtRev22 } = renderHook(() =>
        useChapterNavigation(66, 22, mockTestamentBooks)
      );
      expect(navAtRev22.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 1 });
      expect(navAtRev22.current.canGoNext).toBe(true);
    });

    it('should maintain consistent indices throughout multiple circular traversals', () => {
      // Bible has 1189 chapters (indices 0-1188)
      const totalChapters = 1189;

      // Traverse forward past the boundary from Revelation 22 (index 1188)
      const startIndex = 1188;

      // Forward by 1: should be Genesis 1 (index 0)
      const forward1 = wrapCircularIndex(startIndex + 1, mockTestamentBooks);
      expect(forward1).toBe(0);

      // Forward by 2: should be Genesis 2 (index 1)
      const forward2 = wrapCircularIndex(startIndex + 2, mockTestamentBooks);
      expect(forward2).toBe(1);

      // Full circle from Genesis 1: 0 + 1189 should wrap back to 0
      const fullCircleFromStart = wrapCircularIndex(0 + totalChapters, mockTestamentBooks);
      expect(fullCircleFromStart).toBe(0);

      // Backward from Genesis 1
      const backward1 = wrapCircularIndex(-1, mockTestamentBooks);
      expect(backward1).toBe(1188);

      const backward2 = wrapCircularIndex(-2, mockTestamentBooks);
      expect(backward2).toBe(1187);

      // Backward by full Bible from index 0: should wrap back to 0
      const backwardFull = wrapCircularIndex(0 - totalChapters, mockTestamentBooks);
      expect(backwardFull).toBe(0);
    });
  });

  /**
   * Test 2: Seamless transition - no special visual indicators
   *
   * Verifies that circular navigation uses the same mechanisms as regular navigation
   * (no special toasts, banners, or announcements)
   */
  describe('Seamless transition behavior', () => {
    it('should use same navigation mechanism for circular as regular navigation', () => {
      // Regular mid-Bible navigation
      const { result: midNav } = renderHook(() => useChapterNavigation(1, 25, mockTestamentBooks));
      expect(midNav.current.canGoNext).toBe(true);
      expect(midNav.current.canGoPrevious).toBe(true);
      expect(midNav.current.nextChapter).not.toBeNull();
      expect(midNav.current.prevChapter).not.toBeNull();

      // Circular navigation at Genesis 1
      const { result: gen1Nav } = renderHook(() => useChapterNavigation(1, 1, mockTestamentBooks));
      // Same structure - canGo* always true, chapters always defined
      expect(gen1Nav.current.canGoNext).toBe(true);
      expect(gen1Nav.current.canGoPrevious).toBe(true);
      expect(gen1Nav.current.nextChapter).not.toBeNull();
      expect(gen1Nav.current.prevChapter).not.toBeNull();

      // Circular navigation at Revelation 22
      const { result: rev22Nav } = renderHook(() =>
        useChapterNavigation(66, 22, mockTestamentBooks)
      );
      // Same structure - canGo* always true, chapters always defined
      expect(rev22Nav.current.canGoNext).toBe(true);
      expect(rev22Nav.current.canGoPrevious).toBe(true);
      expect(rev22Nav.current.nextChapter).not.toBeNull();
      expect(rev22Nav.current.prevChapter).not.toBeNull();
    });

    it('should return valid chapter references (never null) at all positions', () => {
      // Test various positions including boundaries
      const testPositions = [
        { bookId: 1, chapter: 1 }, // Genesis 1 (Bible start)
        { bookId: 1, chapter: 50 }, // Genesis 50 (book boundary)
        { bookId: 2, chapter: 1 }, // Exodus 1 (after book boundary)
        { bookId: 39, chapter: 4 }, // Malachi 4 (OT/NT boundary)
        { bookId: 40, chapter: 1 }, // Matthew 1 (NT start)
        { bookId: 66, chapter: 22 }, // Revelation 22 (Bible end)
      ];

      for (const pos of testPositions) {
        const { result } = renderHook(() =>
          useChapterNavigation(pos.bookId, pos.chapter, mockTestamentBooks)
        );

        expect(result.current.nextChapter).not.toBeNull();
        expect(result.current.prevChapter).not.toBeNull();
        expect(result.current.canGoNext).toBe(true);
        expect(result.current.canGoPrevious).toBe(true);
      }
    });
  });

  /**
   * Test 3: Existing cross-book navigation unaffected
   *
   * Verifies that circular navigation only affects Bible boundaries,
   * not regular cross-book navigation
   */
  describe('Cross-book navigation preservation', () => {
    it('should maintain Genesis 50 -> Exodus 1 cross-book navigation', () => {
      const { result } = renderHook(() => useChapterNavigation(1, 50, mockTestamentBooks));

      // Next should be Exodus 1, not wrap to Genesis 1
      expect(result.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 1 });
      expect(result.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 49 });
    });

    it('should maintain Exodus 1 -> Genesis 50 cross-book navigation', () => {
      const { result } = renderHook(() => useChapterNavigation(2, 1, mockTestamentBooks));

      // Previous should be Genesis 50, not wrap to Revelation 22
      expect(result.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 50 });
      expect(result.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 2 });
    });

    it('should maintain OT/NT boundary (Malachi 4 -> Matthew 1) navigation', () => {
      const { result: malachiNav } = renderHook(() =>
        useChapterNavigation(39, 4, mockTestamentBooks)
      );

      expect(malachiNav.current.nextChapter).toEqual({ bookId: 40, chapterNumber: 1 });

      const { result: matthewNav } = renderHook(() =>
        useChapterNavigation(40, 1, mockTestamentBooks)
      );

      expect(matthewNav.current.prevChapter).toEqual({ bookId: 39, chapterNumber: 4 });
    });

    it('should handle single-chapter books correctly (not confuse with circular)', () => {
      // Obadiah (book 31) has only 1 chapter
      const { result: obadiahNav } = renderHook(() =>
        useChapterNavigation(31, 1, mockTestamentBooks)
      );

      // Should navigate to adjacent books, not wrap circularly
      expect(obadiahNav.current.nextChapter).toEqual({ bookId: 32, chapterNumber: 1 }); // Jonah 1
      expect(obadiahNav.current.prevChapter).toEqual({ bookId: 30, chapterNumber: 9 }); // Amos 9
    });
  });

  /**
   * Test 4: Index calculations at boundaries
   *
   * Verifies that index utilities correctly handle boundary calculations
   * for proper route/URL updates
   */
  describe('Index calculations for route updates', () => {
    it('should calculate correct absolute indices at Bible boundaries', () => {
      // Genesis 1 should be index 0
      expect(getAbsolutePageIndex(1, 1, mockTestamentBooks)).toBe(0);

      // Genesis 2 should be index 1
      expect(getAbsolutePageIndex(1, 2, mockTestamentBooks)).toBe(1);

      // Revelation 22 should be index 1188 (last)
      expect(getAbsolutePageIndex(66, 22, mockTestamentBooks)).toBe(1188);

      // Revelation 21 should be index 1187
      expect(getAbsolutePageIndex(66, 21, mockTestamentBooks)).toBe(1187);
    });

    it('should convert wrapped indices back to correct chapter references', () => {
      // Test wrapping from both directions
      const wrappedToEnd = wrapCircularIndex(-1, mockTestamentBooks);
      const chapterFromEnd = getChapterFromPageIndex(wrappedToEnd, mockTestamentBooks);
      expect(chapterFromEnd).toEqual({ bookId: 66, chapterNumber: 22 });

      const wrappedToStart = wrapCircularIndex(1189, mockTestamentBooks);
      const chapterFromStart = getChapterFromPageIndex(wrappedToStart, mockTestamentBooks);
      expect(chapterFromStart).toEqual({ bookId: 1, chapterNumber: 1 });
    });

    it('should produce consistent results regardless of approach direction', () => {
      // Approaching Revelation 22 from Revelation 21
      const rev21Index = getAbsolutePageIndex(66, 21, mockTestamentBooks);
      const nextFromRev21 = getChapterFromPageIndex(rev21Index + 1, mockTestamentBooks);
      expect(nextFromRev21).toEqual({ bookId: 66, chapterNumber: 22 });

      // Approaching Revelation 22 by wrapping backward from Genesis 1
      const wrappedToRev22 = wrapCircularIndex(-1, mockTestamentBooks);
      const chapterFromWrap = getChapterFromPageIndex(wrappedToRev22, mockTestamentBooks);
      expect(chapterFromWrap).toEqual({ bookId: 66, chapterNumber: 22 });

      // Both should resolve to the same book/chapter
      expect(nextFromRev21).toEqual(chapterFromWrap);
    });
  });

  /**
   * Test 5: Navigation chain integrity
   *
   * Verifies that following the navigation chain leads to expected results
   */
  describe('Navigation chain integrity', () => {
    it('should allow continuous forward navigation through Bible boundaries', () => {
      // Start near the end: Revelation 21
      const { result: rev21Nav } = renderHook(() =>
        useChapterNavigation(66, 21, mockTestamentBooks)
      );
      expect(rev21Nav.current.nextChapter).toEqual({ bookId: 66, chapterNumber: 22 });

      // At Revelation 22
      const { result: rev22Nav } = renderHook(() =>
        useChapterNavigation(66, 22, mockTestamentBooks)
      );
      expect(rev22Nav.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 1 });

      // At Genesis 1 (after wrapping)
      const { result: gen1AfterWrap } = renderHook(() =>
        useChapterNavigation(1, 1, mockTestamentBooks)
      );
      expect(gen1AfterWrap.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 2 });
    });

    it('should allow continuous backward navigation through Bible boundaries', () => {
      // Start near the beginning: Genesis 2
      const { result: gen2Nav } = renderHook(() => useChapterNavigation(1, 2, mockTestamentBooks));
      expect(gen2Nav.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 1 });

      // At Genesis 1
      const { result: gen1Nav } = renderHook(() => useChapterNavigation(1, 1, mockTestamentBooks));
      expect(gen1Nav.current.prevChapter).toEqual({ bookId: 66, chapterNumber: 22 });

      // At Revelation 22 (after wrapping backward)
      const { result: rev22AfterWrap } = renderHook(() =>
        useChapterNavigation(66, 22, mockTestamentBooks)
      );
      expect(rev22AfterWrap.current.prevChapter).toEqual({ bookId: 66, chapterNumber: 21 });
    });
  });
});
