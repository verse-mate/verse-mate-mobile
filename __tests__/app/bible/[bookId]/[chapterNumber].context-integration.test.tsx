/**
 * Tests for Chapter Navigation Store
 *
 * These tests verify the chapter navigation store functions correctly:
 * - Store can be initialized with values
 * - Store can be updated via setCurrentChapter
 * - Store notifies subscribers on changes
 * - Store can be reset
 *
 * @see stores/chapter-navigation-store.ts
 */

import {
  getSnapshot,
  initializeState,
  resetStore,
  setCurrentChapter,
  subscribe,
} from '@/stores/chapter-navigation-store';

describe('Chapter Navigation Store', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('resetStore', () => {
    it('resets store to default Genesis 1 values', () => {
      // First set to something else
      setCurrentChapter(19, 23, 'Psalms');
      expect(getSnapshot().bookId).toBe(19);

      // Then reset
      resetStore();

      const snapshot = getSnapshot();
      expect(snapshot.bookId).toBe(1);
      expect(snapshot.chapter).toBe(1);
      expect(snapshot.bookName).toBe('Genesis');
    });
  });

  describe('initializeState', () => {
    it('initializes store with provided values', () => {
      initializeState(19, 23, 'Psalms');

      const snapshot = getSnapshot();
      expect(snapshot.bookId).toBe(19);
      expect(snapshot.chapter).toBe(23);
      expect(snapshot.bookName).toBe('Psalms');
    });

    it('does not notify subscribers during initialization', () => {
      const callback = jest.fn();
      subscribe(callback);

      initializeState(19, 23, 'Psalms');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setCurrentChapter', () => {
    it('updates store with new values', () => {
      initializeState(1, 1, 'Genesis');

      setCurrentChapter(43, 3, 'John');

      const snapshot = getSnapshot();
      expect(snapshot.bookId).toBe(43);
      expect(snapshot.chapter).toBe(3);
      expect(snapshot.bookName).toBe('John');
    });

    it('notifies subscribers when values change', () => {
      const callback = jest.fn();
      subscribe(callback);

      setCurrentChapter(43, 3, 'John');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify subscribers when values are the same', () => {
      initializeState(43, 3, 'John');
      const callback = jest.fn();
      subscribe(callback);

      // Set to same values
      setCurrentChapter(43, 3, 'John');

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles multiple sequential updates', () => {
      const callback = jest.fn();
      subscribe(callback);

      // Note: First call won't trigger callback since resetStore() sets to Genesis 1
      // So we start from a different value
      setCurrentChapter(19, 23, 'Psalms');
      setCurrentChapter(2, 5, 'Exodus');
      setCurrentChapter(66, 22, 'Revelation');

      expect(callback).toHaveBeenCalledTimes(3);

      const snapshot = getSnapshot();
      expect(snapshot.bookId).toBe(66);
      expect(snapshot.chapter).toBe(22);
      expect(snapshot.bookName).toBe('Revelation');
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = subscribe(callback);

      setCurrentChapter(43, 3, 'John');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      setCurrentChapter(66, 22, 'Revelation');
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('supports multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      subscribe(callback1);
      subscribe(callback2);

      setCurrentChapter(43, 3, 'John');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSnapshot', () => {
    it('returns current state', () => {
      initializeState(19, 23, 'Psalms');

      const snapshot = getSnapshot();

      expect(snapshot).toEqual({
        bookId: 19,
        chapter: 23,
        bookName: 'Psalms',
      });
    });

    it('returns new object reference after update', () => {
      initializeState(1, 1, 'Genesis');
      const snapshot1 = getSnapshot();

      setCurrentChapter(2, 5, 'Exodus');
      const snapshot2 = getSnapshot();

      expect(snapshot1).not.toBe(snapshot2);
    });
  });
});
