/**
 * Analytics Service and Hook Tests
 *
 * Tests for the analytics foundation layer including:
 * - analytics.track() calls PostHog correctly
 * - analytics.identify() calls PostHog identify correctly
 * - analytics.reset() calls PostHog reset
 * - All tracking is skipped when PostHog is not initialized
 * - useAnalytics() hook returns typed functions
 * - isEnabled boolean reflects PostHog initialization state
 *
 * @see Task Group 1: Analytics Service and Hook
 */

import { renderHook } from '@testing-library/react-native';
import { useAnalytics } from '@/hooks/use-analytics';
import { analytics } from '@/lib/analytics/analytics';
import { getPostHogInstance } from '@/lib/analytics/posthog-provider';
import { AnalyticsEvent } from '@/lib/analytics/types';

// Mock the posthog-provider module
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockRegister = jest.fn();

const mockPostHogInstance = {
  capture: mockCapture,
  identify: mockIdentify,
  reset: mockReset,
  register: mockRegister,
};

jest.mock('@/lib/analytics/posthog-provider', () => ({
  getPostHogInstance: jest.fn(),
}));

// Cast to access mock functions
const mockedGetPostHogInstance = getPostHogInstance as jest.Mock;

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: PostHog is initialized
    mockedGetPostHogInstance.mockReturnValue(mockPostHogInstance);
  });

  describe('analytics.track()', () => {
    it('should call PostHog capture with correct event name and properties', () => {
      const properties = {
        bookId: 1,
        chapterNumber: 3,
        bibleVersion: 'NASB1995',
      };

      analytics.track(AnalyticsEvent.CHAPTER_VIEWED, properties);

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith('CHAPTER_VIEWED', properties);
    });

    it('should skip tracking when PostHog instance is null', () => {
      mockedGetPostHogInstance.mockReturnValue(null);

      analytics.track(AnalyticsEvent.BOOKMARK_ADDED, {
        bookId: 1,
        chapterNumber: 1,
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('analytics.identify()', () => {
    it('should call PostHog identify with user ID and traits', () => {
      const userId = 'user-123';
      const traits = {
        email: 'test@example.com',
        account_type: 'email' as const,
        is_registered: true,
      };

      analytics.identify(userId, traits);

      expect(mockIdentify).toHaveBeenCalledTimes(1);
      expect(mockIdentify).toHaveBeenCalledWith(userId, traits);
    });

    it('should skip identify when PostHog instance is null', () => {
      mockedGetPostHogInstance.mockReturnValue(null);

      analytics.identify('user-123', { email: 'test@example.com' });

      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe('analytics.reset()', () => {
    it('should call PostHog reset', () => {
      analytics.reset();

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('should skip reset when PostHog instance is null', () => {
      mockedGetPostHogInstance.mockReturnValue(null);

      analytics.reset();

      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('analytics.isEnabled()', () => {
    it('should return true when PostHog is initialized', () => {
      mockedGetPostHogInstance.mockReturnValue(mockPostHogInstance);

      expect(analytics.isEnabled()).toBe(true);
    });

    it('should return false when PostHog is not initialized', () => {
      mockedGetPostHogInstance.mockReturnValue(null);

      expect(analytics.isEnabled()).toBe(false);
    });
  });
});

describe('useAnalytics Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPostHogInstance.mockReturnValue(mockPostHogInstance);
  });

  it('should return typed track and identify functions', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(typeof result.current.track).toBe('function');
    expect(typeof result.current.identify).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should have isEnabled as false when PostHog is not initialized', () => {
    mockedGetPostHogInstance.mockReturnValue(null);

    const { result } = renderHook(() => useAnalytics());

    expect(result.current.isEnabled).toBe(false);
  });

  it('should have isEnabled as true when PostHog is initialized', () => {
    mockedGetPostHogInstance.mockReturnValue(mockPostHogInstance);

    const { result } = renderHook(() => useAnalytics());

    expect(result.current.isEnabled).toBe(true);
  });
});
