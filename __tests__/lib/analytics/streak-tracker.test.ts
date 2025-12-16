/**
 * Streak Tracker Tests
 *
 * Tests for user reading streak calculation and tracking:
 * - Streak increments when user opens app on consecutive days
 * - Streak resets to 1 when user misses a day
 * - last_active_date is updated on each session
 * - current_streak user property is set correctly
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 5: Streak Tracking
 */

import { calculateStreak, getDateString, isConsecutiveDay } from '@/lib/analytics/streak-tracker';

describe('Streak Tracker', () => {
  describe('getDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const date = new Date('2025-12-15T10:30:00.000Z');
      expect(getDateString(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return current date when no date provided', () => {
      const result = getDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isConsecutiveDay', () => {
    it('should return true for consecutive days', () => {
      const yesterday = '2025-12-14';
      const today = '2025-12-15';
      expect(isConsecutiveDay(yesterday, today)).toBe(true);
    });

    it('should return false for same day', () => {
      const today = '2025-12-15';
      expect(isConsecutiveDay(today, today)).toBe(false);
    });

    it('should return false for non-consecutive days', () => {
      const twoDaysAgo = '2025-12-13';
      const today = '2025-12-15';
      expect(isConsecutiveDay(twoDaysAgo, today)).toBe(false);
    });

    it('should handle month boundaries', () => {
      const lastDayOfNov = '2025-11-30';
      const firstDayOfDec = '2025-12-01';
      expect(isConsecutiveDay(lastDayOfNov, firstDayOfDec)).toBe(true);
    });

    it('should handle year boundaries', () => {
      const lastDayOfYear = '2024-12-31';
      const firstDayOfYear = '2025-01-01';
      expect(isConsecutiveDay(lastDayOfYear, firstDayOfYear)).toBe(true);
    });
  });

  describe('calculateStreak', () => {
    it('should return 1 for first session (no previous data)', () => {
      const result = calculateStreak(null, null, '2025-12-15');
      expect(result).toEqual({
        currentStreak: 1,
        lastActiveDate: '2025-12-15',
      });
    });

    it('should maintain streak for same day activity', () => {
      const result = calculateStreak(5, '2025-12-15', '2025-12-15');
      expect(result).toEqual({
        currentStreak: 5,
        lastActiveDate: '2025-12-15',
      });
    });

    it('should increment streak for consecutive day activity', () => {
      const result = calculateStreak(5, '2025-12-14', '2025-12-15');
      expect(result).toEqual({
        currentStreak: 6,
        lastActiveDate: '2025-12-15',
      });
    });

    it('should reset streak to 1 when day is missed', () => {
      const result = calculateStreak(5, '2025-12-13', '2025-12-15');
      expect(result).toEqual({
        currentStreak: 1,
        lastActiveDate: '2025-12-15',
      });
    });

    it('should handle long streaks', () => {
      const result = calculateStreak(365, '2025-12-14', '2025-12-15');
      expect(result).toEqual({
        currentStreak: 366,
        lastActiveDate: '2025-12-15',
      });
    });
  });
});
