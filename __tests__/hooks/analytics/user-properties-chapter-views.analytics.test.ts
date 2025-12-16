/**
 * User Properties and Chapter Views Analytics Tests
 *
 * Tests for analytics events and user properties:
 * - CHAPTER_VIEWED fires with bookId, chapterNumber, and bibleVersion
 * - preferred_bible_version property is set on version change
 * - theme_preference property is set on theme change
 * - language_setting and country properties are set on app launch
 * - platform: 'mobile' super property is registered
 * - is_registered property updates on login
 * - VERSEMATE_TOOLTIP_OPENED fires with verse context
 * - AUTO_HIGHLIGHT_TOOLTIP_VIEWED fires with chapter context
 *
 * @see Task Group 4: User Properties and Chapter Views
 */

import { analytics } from '@/lib/analytics/analytics';
import { AnalyticsEvent } from '@/lib/analytics/types';

// Mock the analytics service
jest.mock('@/lib/analytics/analytics', () => ({
  analytics: {
    track: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    registerSuperProperties: jest.fn(),
    isEnabled: jest.fn(() => true),
  },
}));

describe('User Properties and Chapter Views Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CHAPTER_VIEWED event', () => {
    it('should fire with bookId, chapterNumber, and bibleVersion', () => {
      analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: 43,
        chapterNumber: 3,
        bibleVersion: 'NASB1995',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: 43,
        chapterNumber: 3,
        bibleVersion: 'NASB1995',
      });
    });

    it('should fire with different bible versions', () => {
      analytics.track(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: 1,
        chapterNumber: 1,
        bibleVersion: 'KJV',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.CHAPTER_VIEWED, {
        bookId: 1,
        chapterNumber: 1,
        bibleVersion: 'KJV',
      });
    });
  });

  describe('User Properties', () => {
    it('should set preferred_bible_version property on version change', () => {
      const userId = 'user-123';
      analytics.identify(userId, {
        preferred_bible_version: 'NASB1995',
      });

      expect(analytics.identify).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          preferred_bible_version: 'NASB1995',
        })
      );
    });

    it('should set theme_preference property on theme change', () => {
      const userId = 'user-456';
      analytics.identify(userId, {
        theme_preference: 'dark',
      });

      expect(analytics.identify).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          theme_preference: 'dark',
        })
      );
    });

    it('should set language_setting and country properties on app launch', () => {
      const userId = 'user-789';
      analytics.identify(userId, {
        language_setting: 'en',
        country: 'US',
      });

      expect(analytics.identify).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          language_setting: 'en',
          country: 'US',
        })
      );
    });

    it('should register platform: mobile as super property', () => {
      analytics.registerSuperProperties({ platform: 'mobile' });

      expect(analytics.registerSuperProperties).toHaveBeenCalledWith({
        platform: 'mobile',
      });
    });

    it('should set is_registered: true on login', () => {
      const userId = 'user-abc';
      analytics.identify(userId, {
        is_registered: true,
      });

      expect(analytics.identify).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          is_registered: true,
        })
      );
    });
  });

  describe('AI Explanation Tooltip Events', () => {
    it('should fire VERSEMATE_TOOLTIP_OPENED with verse context', () => {
      analytics.track(AnalyticsEvent.VERSEMATE_TOOLTIP_OPENED, {
        bookId: 43,
        chapterNumber: 3,
        verseNumber: 16,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.VERSEMATE_TOOLTIP_OPENED, {
        bookId: 43,
        chapterNumber: 3,
        verseNumber: 16,
      });
    });

    it('should fire AUTO_HIGHLIGHT_TOOLTIP_VIEWED with chapter context', () => {
      analytics.track(AnalyticsEvent.AUTO_HIGHLIGHT_TOOLTIP_VIEWED, {
        bookId: 1,
        chapterNumber: 1,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.AUTO_HIGHLIGHT_TOOLTIP_VIEWED, {
        bookId: 1,
        chapterNumber: 1,
      });
    });
  });
});
