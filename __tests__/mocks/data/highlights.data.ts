/**
 * Mock Data for Highlight API
 *
 * Sample highlights for testing highlight functionality
 */

import type { GetBibleHighlightsByUserIdResponse } from '@/src/api/generated/types.gen';

/**
 * Mock user ID for testing
 */
export const MOCK_USER_ID = 'test-user-123';

/**
 * Sample highlights with all 6 colors
 * Includes single-verse and multi-verse highlights
 * Includes character-level precision examples
 */
export const mockHighlights: GetBibleHighlightsByUserIdResponse['highlights'] = [
  {
    highlight_id: 1,
    user_id: MOCK_USER_ID,
    chapter_id: 1001, // Genesis 1
    start_verse: 1,
    end_verse: 1,
    color: 'yellow',
    start_char: 0,
    end_char: 50,
    selected_text: 'In the beginning God created the heavens',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    highlight_id: 2,
    user_id: MOCK_USER_ID,
    chapter_id: 1001, // Genesis 1
    start_verse: 3,
    end_verse: 5,
    color: 'green',
    start_char: 0,
    end_char: 200,
    selected_text: 'And God said, Let there be light: and there was light...',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
  {
    highlight_id: 3,
    user_id: MOCK_USER_ID,
    chapter_id: 43003, // John 3
    start_verse: 16,
    end_verse: 16,
    color: 'blue',
    start_char: 0,
    end_char: 100,
    selected_text: 'For God so loved the world, that he gave his only begotten Son',
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
  },
  {
    highlight_id: 4,
    user_id: MOCK_USER_ID,
    chapter_id: 19023, // Psalms 23
    start_verse: 1,
    end_verse: 2,
    color: 'pink',
    start_char: null,
    end_char: null,
    selected_text: 'The LORD is my shepherd; I shall not want...',
    created_at: '2025-01-04T00:00:00Z',
    updated_at: '2025-01-04T00:00:00Z',
  },
  {
    highlight_id: 5,
    user_id: MOCK_USER_ID,
    chapter_id: 40005, // Matthew 5
    start_verse: 3,
    end_verse: 3,
    color: 'purple',
    start_char: 0,
    end_char: 45,
    selected_text: 'Blessed are the poor in spirit',
    created_at: '2025-01-05T00:00:00Z',
    updated_at: '2025-01-05T00:00:00Z',
  },
  {
    highlight_id: 6,
    user_id: MOCK_USER_ID,
    chapter_id: 40005, // Matthew 5
    start_verse: 14,
    end_verse: 16,
    color: 'orange',
    start_char: null,
    end_char: null,
    selected_text: 'Ye are the light of the world...',
    created_at: '2025-01-06T00:00:00Z',
    updated_at: '2025-01-06T00:00:00Z',
  },
];

/**
 * Full response structure for GET all highlights
 */
export const mockHighlightsResponse: GetBibleHighlightsByUserIdResponse = {
  highlights: mockHighlights,
};

/**
 * Empty highlights response for new users
 */
export const mockEmptyHighlightsResponse: GetBibleHighlightsByUserIdResponse = {
  highlights: [],
};

/**
 * Genesis 1 chapter highlights only
 */
export const mockGenesis1Highlights = mockHighlights.filter((h) => h.chapter_id === 1001);

/**
 * John 3 chapter highlights only
 */
export const mockJohn3Highlights = mockHighlights.filter((h) => h.chapter_id === 43003);

/**
 * Matthew 5 chapter highlights only
 */
export const mockMatthew5Highlights = mockHighlights.filter((h) => h.chapter_id === 40005);
