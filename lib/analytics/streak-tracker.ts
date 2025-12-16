/**
 * Streak Tracker Utility
 *
 * Calculates and manages user reading streaks (consecutive days of app usage).
 * Used by PostHogInitializer to update current_streak and last_active_date user properties.
 *
 * @see Spec: agent-os/specs/time-based-analytics/spec.md
 * @see Task Group 5: Streak Tracking
 *
 * @example
 * ```typescript
 * import { calculateStreak, getDateString } from '@/lib/analytics/streak-tracker';
 *
 * const today = getDateString();
 * const { currentStreak, lastActiveDate } = calculateStreak(
 *   previousStreak,
 *   previousLastActiveDate,
 *   today
 * );
 * ```
 */

/**
 * Get date string in YYYY-MM-DD format (date only, no time)
 *
 * @param date - Optional date object, defaults to current date
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are consecutive days
 *
 * @param previousDate - Previous date string (YYYY-MM-DD)
 * @param currentDate - Current date string (YYYY-MM-DD)
 * @returns True if currentDate is exactly one day after previousDate
 */
export function isConsecutiveDay(previousDate: string, currentDate: string): boolean {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);

  // Add one day to previous date
  const nextDay = new Date(prev);
  nextDay.setDate(nextDay.getDate() + 1);

  // Compare date strings (ignoring time)
  return getDateString(nextDay) === currentDate;
}

/**
 * Streak calculation result
 */
export interface StreakResult {
  /** Current streak count (consecutive days) */
  currentStreak: number;
  /** Last active date (YYYY-MM-DD) */
  lastActiveDate: string;
}

/**
 * Calculate streak based on previous values and current date
 *
 * Logic:
 * - First session (no previous data): streak = 1
 * - Same day: maintain current streak
 * - Consecutive day: increment streak
 * - Missed day(s): reset streak to 1
 *
 * @param previousStreak - Previous streak count (null if first session)
 * @param previousLastActiveDate - Previous last active date (null if first session)
 * @param currentDate - Current date string (YYYY-MM-DD)
 * @returns New streak values
 */
export function calculateStreak(
  previousStreak: number | null,
  previousLastActiveDate: string | null,
  currentDate: string
): StreakResult {
  // First session - start streak at 1
  if (previousStreak === null || previousLastActiveDate === null) {
    return {
      currentStreak: 1,
      lastActiveDate: currentDate,
    };
  }

  // Same day - maintain current streak
  if (previousLastActiveDate === currentDate) {
    return {
      currentStreak: previousStreak,
      lastActiveDate: currentDate,
    };
  }

  // Check if consecutive day
  if (isConsecutiveDay(previousLastActiveDate, currentDate)) {
    return {
      currentStreak: previousStreak + 1,
      lastActiveDate: currentDate,
    };
  }

  // Missed a day - reset streak to 1
  return {
    currentStreak: 1,
    lastActiveDate: currentDate,
  };
}
