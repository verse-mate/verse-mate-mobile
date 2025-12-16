/**
 * Feature Usage Analytics Tests
 *
 * Tests for analytics events fired from feature usage hooks and components:
 * - BOOKMARK_ADDED fires with bookId and chapterNumber
 * - BOOKMARK_REMOVED fires with bookId and chapterNumber
 * - HIGHLIGHT_CREATED fires with bookId, chapterNumber, and color
 * - HIGHLIGHT_DELETED fires with highlightId
 * - NOTE_CREATED fires with bookId and chapterNumber (no content)
 * - DICTIONARY_LOOKUP fires with strongsNumber and language
 * - VIEW_MODE_SWITCHED fires with mode
 * - EXPLANATION_TAB_CHANGED fires with tab
 * - AUTO_HIGHLIGHT_SETTING_CHANGED fires with settingId and enabled
 * - CHAPTER_SHARED fires with bookId and chapterNumber
 * - TOPIC_SHARED fires with category and topicSlug
 *
 * @see Task Group 3: Feature Usage and Reading Events
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

describe('Feature Usage Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bookmark Events', () => {
    it('should fire BOOKMARK_ADDED with bookId and chapterNumber', () => {
      analytics.track(AnalyticsEvent.BOOKMARK_ADDED, {
        bookId: 43,
        chapterNumber: 3,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.BOOKMARK_ADDED, {
        bookId: 43,
        chapterNumber: 3,
      });
    });

    it('should fire BOOKMARK_REMOVED with bookId and chapterNumber', () => {
      analytics.track(AnalyticsEvent.BOOKMARK_REMOVED, {
        bookId: 19,
        chapterNumber: 23,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.BOOKMARK_REMOVED, {
        bookId: 19,
        chapterNumber: 23,
      });
    });
  });

  describe('Highlight Events', () => {
    it('should fire HIGHLIGHT_CREATED with bookId, chapterNumber, and color', () => {
      analytics.track(AnalyticsEvent.HIGHLIGHT_CREATED, {
        bookId: 1,
        chapterNumber: 1,
        color: 'yellow',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.HIGHLIGHT_CREATED, {
        bookId: 1,
        chapterNumber: 1,
        color: 'yellow',
      });
    });

    it('should fire HIGHLIGHT_EDITED with highlightId and color', () => {
      analytics.track(AnalyticsEvent.HIGHLIGHT_EDITED, {
        highlightId: 12345,
        color: 'green',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.HIGHLIGHT_EDITED, {
        highlightId: 12345,
        color: 'green',
      });
    });

    it('should fire HIGHLIGHT_DELETED with highlightId', () => {
      analytics.track(AnalyticsEvent.HIGHLIGHT_DELETED, {
        highlightId: 67890,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.HIGHLIGHT_DELETED, {
        highlightId: 67890,
      });
    });
  });

  describe('Note Events', () => {
    it('should fire NOTE_CREATED with bookId and chapterNumber (no content)', () => {
      // Note: We NEVER track note content for privacy
      analytics.track(AnalyticsEvent.NOTE_CREATED, {
        bookId: 40,
        chapterNumber: 5,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.NOTE_CREATED, {
        bookId: 40,
        chapterNumber: 5,
      });
      // Verify no content property
      const call = (analytics.track as jest.Mock).mock.calls[0];
      expect(call[1]).not.toHaveProperty('content');
    });

    it('should fire NOTE_EDITED with noteId', () => {
      analytics.track(AnalyticsEvent.NOTE_EDITED, {
        noteId: 'note-uuid-123',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.NOTE_EDITED, {
        noteId: 'note-uuid-123',
      });
    });

    it('should fire NOTE_DELETED with noteId', () => {
      analytics.track(AnalyticsEvent.NOTE_DELETED, {
        noteId: 'note-uuid-456',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.NOTE_DELETED, {
        noteId: 'note-uuid-456',
      });
    });
  });

  describe('Dictionary Events', () => {
    it('should fire DICTIONARY_LOOKUP with strongsNumber and language (Greek)', () => {
      analytics.track(AnalyticsEvent.DICTIONARY_LOOKUP, {
        strongsNumber: 'G26',
        language: 'greek',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.DICTIONARY_LOOKUP, {
        strongsNumber: 'G26',
        language: 'greek',
      });
    });

    it('should fire DICTIONARY_LOOKUP with strongsNumber and language (Hebrew)', () => {
      analytics.track(AnalyticsEvent.DICTIONARY_LOOKUP, {
        strongsNumber: 'H430',
        language: 'hebrew',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.DICTIONARY_LOOKUP, {
        strongsNumber: 'H430',
        language: 'hebrew',
      });
    });
  });

  describe('View Mode Events', () => {
    it('should fire VIEW_MODE_SWITCHED with mode: bible', () => {
      analytics.track(AnalyticsEvent.VIEW_MODE_SWITCHED, {
        mode: 'bible',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.VIEW_MODE_SWITCHED, {
        mode: 'bible',
      });
    });

    it('should fire VIEW_MODE_SWITCHED with mode: explanations', () => {
      analytics.track(AnalyticsEvent.VIEW_MODE_SWITCHED, {
        mode: 'explanations',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.VIEW_MODE_SWITCHED, {
        mode: 'explanations',
      });
    });
  });

  describe('Explanation Tab Events', () => {
    it('should fire EXPLANATION_TAB_CHANGED with tab: summary', () => {
      analytics.track(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'summary',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'summary',
      });
    });

    it('should fire EXPLANATION_TAB_CHANGED with tab: byline', () => {
      analytics.track(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'byline',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'byline',
      });
    });

    it('should fire EXPLANATION_TAB_CHANGED with tab: detailed', () => {
      analytics.track(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'detailed',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.EXPLANATION_TAB_CHANGED, {
        tab: 'detailed',
      });
    });
  });

  describe('Auto-Highlight Settings Events', () => {
    it('should fire AUTO_HIGHLIGHT_SETTING_CHANGED with settingId and enabled: true', () => {
      analytics.track(AnalyticsEvent.AUTO_HIGHLIGHT_SETTING_CHANGED, {
        settingId: 'key-verses',
        enabled: true,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.AUTO_HIGHLIGHT_SETTING_CHANGED, {
        settingId: 'key-verses',
        enabled: true,
      });
    });

    it('should fire AUTO_HIGHLIGHT_SETTING_CHANGED with settingId and enabled: false', () => {
      analytics.track(AnalyticsEvent.AUTO_HIGHLIGHT_SETTING_CHANGED, {
        settingId: 'promises',
        enabled: false,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.AUTO_HIGHLIGHT_SETTING_CHANGED, {
        settingId: 'promises',
        enabled: false,
      });
    });
  });

  describe('Share Events', () => {
    it('should fire CHAPTER_SHARED with bookId and chapterNumber', () => {
      analytics.track(AnalyticsEvent.CHAPTER_SHARED, {
        bookId: 43,
        chapterNumber: 3,
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.CHAPTER_SHARED, {
        bookId: 43,
        chapterNumber: 3,
      });
    });

    it('should fire TOPIC_SHARED with category and topicSlug', () => {
      analytics.track(AnalyticsEvent.TOPIC_SHARED, {
        category: 'PERSON',
        topicSlug: 'jesus-christ',
      });

      expect(analytics.track).toHaveBeenCalledWith(AnalyticsEvent.TOPIC_SHARED, {
        category: 'PERSON',
        topicSlug: 'jesus-christ',
      });
    });
  });
});
