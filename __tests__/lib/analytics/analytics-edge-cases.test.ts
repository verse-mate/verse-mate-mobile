/**
 * Analytics Edge Cases Tests
 *
 * Tests for critical edge cases and graceful degradation:
 * - PostHog instance is null (no-op, no errors)
 * - registerSuperProperties works correctly
 * - Analytics errors don't break app functionality
 *
 * @see Task Group 5: Test Review and Gap Analysis
 */

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

describe('Analytics Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Graceful degradation when PostHog instance is null', () => {
    beforeEach(() => {
      // Simulate PostHog not being initialized (no EXPO_PUBLIC_POSTHOG_KEY)
      mockedGetPostHogInstance.mockReturnValue(null);
    });

    it('should not throw when tracking with null PostHog instance', () => {
      // Should not throw any errors
      expect(() => {
        analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
          bookId: 1,
          chapterNumber: 1,
          bibleVersion: 'NASB1995',
        });
      }).not.toThrow();
    });

    it('should not throw when identifying with null PostHog instance', () => {
      // Should not throw any errors
      expect(() => {
        analytics.identify('user-123', {
          email: 'test@example.com',
          account_type: 'email',
          is_registered: true,
        });
      }).not.toThrow();
    });

    it('should not throw when resetting with null PostHog instance', () => {
      // Should not throw any errors
      expect(() => {
        analytics.reset();
      }).not.toThrow();
    });

    it('should return false for isEnabled when PostHog is null', () => {
      expect(analytics.isEnabled()).toBe(false);
    });

    it('should not throw when registering super properties with null PostHog instance', () => {
      expect(() => {
        analytics.registerSuperProperties({ platform: 'mobile' });
      }).not.toThrow();
    });
  });

  describe('registerSuperProperties', () => {
    beforeEach(() => {
      // PostHog is initialized
      mockedGetPostHogInstance.mockReturnValue(mockPostHogInstance);
    });

    it('should call PostHog register with provided properties', () => {
      analytics.registerSuperProperties({
        platform: 'mobile',
        app_version: '1.0.0',
      });

      expect(mockRegister).toHaveBeenCalledTimes(1);
      expect(mockRegister).toHaveBeenCalledWith({
        platform: 'mobile',
        app_version: '1.0.0',
      });
    });

    it('should skip registerSuperProperties when PostHog instance is null', () => {
      mockedGetPostHogInstance.mockReturnValue(null);

      analytics.registerSuperProperties({ platform: 'mobile' });

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });
});
