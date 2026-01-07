/**
 * Tests for wrapCircularIndex utility function
 *
 * Tests circular wrapping of Bible chapter indices:
 * - Negative indices wrap to end of Bible (e.g., -1 -> 1188 for Revelation 22)
 * - Indices beyond max wrap to beginning (e.g., 1189 -> 0 for Genesis 1)
 * - Valid indices (0-1188) pass through unchanged
 *
 * @see Spec: agent-os/specs/circular-bible-navigation/spec.md
 */

import { wrapCircularIndex } from '@/utils/bible/chapter-index-utils';
import { mockTestamentBooks } from '../mocks/data/bible-books.data';

describe('wrapCircularIndex', () => {
  describe('wrapping negative indices', () => {
    it('should wrap index -1 to max index (1188 for Revelation 22)', () => {
      const result = wrapCircularIndex(-1, mockTestamentBooks);
      expect(result).toBe(1188);
    });

    it('should wrap index -2 to second-to-last chapter (1187 for Revelation 21)', () => {
      const result = wrapCircularIndex(-2, mockTestamentBooks);
      expect(result).toBe(1187);
    });
  });

  describe('wrapping indices beyond max', () => {
    it('should wrap index 1189 (max + 1) to 0 (Genesis 1)', () => {
      const result = wrapCircularIndex(1189, mockTestamentBooks);
      expect(result).toBe(0);
    });

    it('should wrap index 1190 (max + 2) to 1 (Genesis 2)', () => {
      const result = wrapCircularIndex(1190, mockTestamentBooks);
      expect(result).toBe(1);
    });
  });

  describe('valid indices within range', () => {
    it('should return 0 unchanged for Genesis 1', () => {
      const result = wrapCircularIndex(0, mockTestamentBooks);
      expect(result).toBe(0);
    });

    it('should return 1188 unchanged for Revelation 22', () => {
      const result = wrapCircularIndex(1188, mockTestamentBooks);
      expect(result).toBe(1188);
    });

    it('should return mid-range index unchanged', () => {
      const result = wrapCircularIndex(500, mockTestamentBooks);
      expect(result).toBe(500);
    });
  });

  describe('edge cases with invalid metadata', () => {
    it('should return -1 for undefined booksMetadata', () => {
      const result = wrapCircularIndex(0, undefined);
      expect(result).toBe(-1);
    });

    it('should return -1 for empty booksMetadata', () => {
      const result = wrapCircularIndex(0, []);
      expect(result).toBe(-1);
    });
  });
});
