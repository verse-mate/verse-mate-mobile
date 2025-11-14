/**
 * MSW Mock Handlers for Auto-Highlights API
 *
 * Mocks the auto-highlights endpoints for testing.
 * These handlers return realistic test data for AI-generated highlights.
 */

import { HttpResponse, http } from 'msw';

// Support both local and production API URLs for testing
const BASE_URLS = ['http://localhost:4000', 'https://api.verse-mate.apegro.dev'];

/**
 * Mock auto-highlights data
 * Genesis 1:1 - Key Verses (yellow), relevance 1
 * Genesis 1:3 - Commands (green), relevance 2
 */
const mockAutoHighlights = [
  {
    auto_highlight_id: 1,
    theme_id: 1,
    theme_name: 'Key Verses',
    theme_color: 'yellow',
    book_id: 1,
    chapter_number: 1,
    start_verse: 1,
    end_verse: 1,
    relevance_score: 1,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    auto_highlight_id: 2,
    theme_id: 3,
    theme_name: 'Commands',
    theme_color: 'green',
    book_id: 1,
    chapter_number: 1,
    start_verse: 3,
    end_verse: 3,
    relevance_score: 2,
    created_at: '2025-01-01T00:00:00Z',
  },
];

/**
 * Mock highlight themes
 */
const mockThemes = [
  {
    theme_id: 1,
    name: 'Key Verses',
    color: 'yellow',
    description: 'Foundational truths and essential doctrine',
    priority: 1,
    is_active: true,
  },
  {
    theme_id: 2,
    name: 'Promises from God',
    color: 'blue',
    description: 'Divine promises and covenants',
    priority: 2,
    is_active: true,
  },
  {
    theme_id: 3,
    name: 'Commands',
    color: 'green',
    description: 'Direct commands and instructions',
    priority: 3,
    is_active: true,
  },
];

/**
 * Mock user theme preferences
 */
const mockUserPreferences = mockThemes.map((theme) => ({
  theme_id: theme.theme_id,
  theme_name: theme.name,
  theme_color: theme.color,
  theme_description: theme.description,
  is_enabled: true,
  custom_color: null,
  relevance_threshold: 3,
}));

/**
 * Create handlers for a given base URL
 */
function createHandlersForBaseUrl(baseUrl: string) {
  return [
    /**
     * GET /bible/auto-highlights/:book_id/:chapter_number
     * Returns auto-highlights for a specific chapter
     */
    http.get(`${baseUrl}/bible/auto-highlights/:bookId/:chapterNumber`, ({ params }) => {
      const { bookId, chapterNumber } = params;

      // Filter highlights by book and chapter
      const highlights = mockAutoHighlights.filter(
        (h) => h.book_id === Number(bookId) && h.chapter_number === Number(chapterNumber)
      );

      return HttpResponse.json({
        success: true,
        data: highlights,
      });
    }),

    /**
     * GET /bible/highlight-themes
     * Returns all available highlight themes
     */
    http.get(`${baseUrl}/bible/highlight-themes`, () => {
      return HttpResponse.json({
        success: true,
        data: mockThemes,
      });
    }),

    /**
     * GET /bible/user/theme-preferences
     * Returns user's theme preferences (requires auth)
     */
    http.get(`${baseUrl}/bible/user/theme-preferences`, ({ request }) => {
      const authHeader = request.headers.get('Authorization');

      // Check for auth token
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          {
            success: false,
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      return HttpResponse.json({
        success: true,
        data: mockUserPreferences,
      });
    }),

    /**
     * PATCH /bible/user/theme-preferences/:theme_id
     * Updates user's preference for a specific theme (requires auth)
     */
    http.patch(`${baseUrl}/bible/user/theme-preferences/:themeId`, async ({ request, params }) => {
      const authHeader = request.headers.get('Authorization');

      // Check for auth token
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return HttpResponse.json(
          {
            success: false,
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      const { themeId } = params;
      const body = await request.json();

      // In a real scenario, we'd update the mock data here
      // For testing, just return success

      return HttpResponse.json({
        success: true,
      });
    }),
  ];
}

// Export handlers for all base URLs
export const autoHighlightsHandlers = BASE_URLS.flatMap(createHandlersForBaseUrl);
