/**
 * Tests for useChapterNavigation Hook - Linear Mode
 *
 * Tests the linear navigation mode (no circular wrap) at Bible boundaries:
 * - Genesis 1: canGoPrevious returns false, prevChapter is null
 * - Revelation 22: canGoNext returns false, nextChapter is null
 * - Middle chapters: normal navigation behavior
 *
 * Linear mode is the default for V3 MVP (circular navigation deferred).
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { renderHook } from '@testing-library/react-native';
import { useChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

describe('useChapterNavigation - Linear Mode', () => {
  /**
   * Test 1: At Genesis 1, canGoPrevious returns false and prevChapter is null
   */
  it('returns canGoPrevious=false and prevChapter=null at Genesis 1 (linear mode)', () => {
    const { result } = renderHook(
      () => useChapterNavigation(1, 1, mockTestamentBooks, false) // circular = false
    );

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.prevChapter).toBeNull();

    // Next chapter should still work
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 2 });
  });

  /**
   * Test 2: At Revelation 22, canGoNext returns false and nextChapter is null
   */
  it('returns canGoNext=false and nextChapter=null at Revelation 22 (linear mode)', () => {
    const { result } = renderHook(
      () => useChapterNavigation(66, 22, mockTestamentBooks, false) // circular = false
    );

    expect(result.current.canGoNext).toBe(false);
    expect(result.current.nextChapter).toBeNull();

    // Previous chapter should still work
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.prevChapter).toEqual({ bookId: 66, chapterNumber: 21 });
  });

  /**
   * Test 3: Middle chapters navigate correctly in linear mode
   */
  it('navigates correctly for middle chapters in linear mode', () => {
    // Test Genesis 25 (middle of Genesis)
    const { result: genesis25 } = renderHook(() =>
      useChapterNavigation(1, 25, mockTestamentBooks, false)
    );

    expect(genesis25.current.canGoNext).toBe(true);
    expect(genesis25.current.canGoPrevious).toBe(true);
    expect(genesis25.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 26 });
    expect(genesis25.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 24 });

    // Test Psalms 100 (middle of Bible)
    const { result: psalms100 } = renderHook(() =>
      useChapterNavigation(19, 100, mockTestamentBooks, false)
    );

    expect(psalms100.current.canGoNext).toBe(true);
    expect(psalms100.current.canGoPrevious).toBe(true);
    expect(psalms100.current.nextChapter).toEqual({ bookId: 19, chapterNumber: 101 });
    expect(psalms100.current.prevChapter).toEqual({ bookId: 19, chapterNumber: 99 });
  });

  /**
   * Test: Cross-book navigation works in linear mode
   */
  it('navigates across books correctly in linear mode', () => {
    // Genesis 50 -> Exodus 1
    const { result: genesis50 } = renderHook(() =>
      useChapterNavigation(1, 50, mockTestamentBooks, false)
    );

    expect(genesis50.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 1 });
    expect(genesis50.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 49 });

    // Exodus 1 -> Genesis 50
    const { result: exodus1 } = renderHook(() =>
      useChapterNavigation(2, 1, mockTestamentBooks, false)
    );

    expect(exodus1.current.prevChapter).toEqual({ bookId: 1, chapterNumber: 50 });
    expect(exodus1.current.nextChapter).toEqual({ bookId: 2, chapterNumber: 2 });
  });

  /**
   * Test: Default mode is linear (circular = false by default)
   */
  it('defaults to linear mode when circular parameter is not provided', () => {
    // At Genesis 1, should block previous navigation
    const { result: genesis1 } = renderHook(
      () => useChapterNavigation(1, 1, mockTestamentBooks) // No circular parameter
    );

    expect(genesis1.current.canGoPrevious).toBe(false);
    expect(genesis1.current.prevChapter).toBeNull();

    // At Revelation 22, should block next navigation
    const { result: revelation22 } = renderHook(
      () => useChapterNavigation(66, 22, mockTestamentBooks) // No circular parameter
    );

    expect(revelation22.current.canGoNext).toBe(false);
    expect(revelation22.current.nextChapter).toBeNull();
  });
});

describe('useChapterNavigation - Circular Mode (for future use)', () => {
  /**
   * Test: Circular mode wraps at Genesis 1
   */
  it('wraps to Revelation 22 when at Genesis 1 in circular mode', () => {
    const { result } = renderHook(
      () => useChapterNavigation(1, 1, mockTestamentBooks, true) // circular = true
    );

    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.prevChapter).toEqual({ bookId: 66, chapterNumber: 22 });
  });

  /**
   * Test: Circular mode wraps at Revelation 22
   */
  it('wraps to Genesis 1 when at Revelation 22 in circular mode', () => {
    const { result } = renderHook(
      () => useChapterNavigation(66, 22, mockTestamentBooks, true) // circular = true
    );

    expect(result.current.canGoNext).toBe(true);
    expect(result.current.nextChapter).toEqual({ bookId: 1, chapterNumber: 1 });
  });
});
