/**
 * Tests for the pure prev/next resolution the pager drives its virtual position
 * from.
 *
 * This exists as a separate function precisely so the pager can resolve a chapter
 * it is not currently rendering — the fast-swipe fix — so the cases that matter
 * are the ones a fast run of swipes walks through: mid-book, book boundaries, and
 * the two ends of the Bible.
 */

import { computeChapterNavigation } from '@/hooks/bible/use-chapter-navigation';
import type { TestamentBook } from '@/src/api';

/** Genesis (50), Exodus (40), … Revelation (22) — only what the tests need. */
const BOOKS = [
  { id: 1, name: 'Genesis', chapterCount: 50 },
  { id: 2, name: 'Exodus', chapterCount: 40 },
  { id: 65, name: 'Jude', chapterCount: 1 },
  { id: 66, name: 'Revelation', chapterCount: 22 },
] as unknown as TestamentBook[];

describe('computeChapterNavigation', () => {
  it('steps forward within a book', () => {
    const nav = computeChapterNavigation(1, 3, BOOKS);
    expect(nav.nextChapter).toEqual({ bookId: 1, chapterNumber: 4 });
    expect(nav.prevChapter).toEqual({ bookId: 1, chapterNumber: 2 });
  });

  it('crosses into the next book at the last chapter', () => {
    const nav = computeChapterNavigation(1, 50, BOOKS);
    expect(nav.nextChapter).toEqual({ bookId: 2, chapterNumber: 1 });
  });

  it('crosses back into the previous book at chapter 1', () => {
    const nav = computeChapterNavigation(2, 1, BOOKS);
    expect(nav.prevChapter).toEqual({ bookId: 1, chapterNumber: 50 });
  });

  it('has no previous at Genesis 1 and no next at Revelation 22', () => {
    expect(computeChapterNavigation(1, 1, BOOKS).prevChapter).toBeNull();
    expect(computeChapterNavigation(1, 1, BOOKS).canGoPrevious).toBe(false);
    expect(computeChapterNavigation(66, 22, BOOKS).nextChapter).toBeNull();
    expect(computeChapterNavigation(66, 22, BOOKS).canGoNext).toBe(false);
  });

  it('wraps both ends in circular mode', () => {
    expect(computeChapterNavigation(66, 22, BOOKS, true).nextChapter).toEqual({
      bookId: 1,
      chapterNumber: 1,
    });
    expect(computeChapterNavigation(1, 1, BOOKS, true).prevChapter).toEqual({
      bookId: 66,
      chapterNumber: 22,
    });
  });

  it('degrades to no navigation without metadata', () => {
    const nav = computeChapterNavigation(1, 1, undefined);
    expect(nav.canGoNext).toBe(false);
    expect(nav.canGoPrevious).toBe(false);
  });

  it('resolves a run of consecutive forward steps', () => {
    // The property the fast-swipe fix depends on: feeding each result back in
    // walks the Bible one chapter at a time, with no reliance on React state.
    let at = { bookId: 1, chapterNumber: 48 };
    const visited: string[] = [];
    for (let i = 0; i < 5; i++) {
      const next = computeChapterNavigation(at.bookId, at.chapterNumber, BOOKS).nextChapter;
      if (!next) break;
      at = next;
      visited.push(`${at.bookId}-${at.chapterNumber}`);
    }
    expect(visited).toEqual(['1-49', '1-50', '2-1', '2-2', '2-3']);
  });
});
