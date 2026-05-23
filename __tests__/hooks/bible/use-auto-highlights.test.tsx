/**
 * Tests for useAutoHighlights Hook
 *
 * Focused regression tests for the logged-in user path.
 *
 * Regression: GH-288 / VER-116
 * When user preferences omit `default_relevance_threshold`, the hook was building
 * `theme_relevance=1:undefined,…` which the backend rejects, returning no highlights
 * for all logged-in users.
 *
 * @see hook: /hooks/bible/use-auto-highlights.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { server } from '../../mocks/server';

const API_BASE_URL = 'http://localhost:4000';

jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    isAuthenticated: true,
  })),
}));

jest.mock('@/hooks/use-auto-highlights-enabled', () => ({
  useAutoHighlightsEnabled: jest.fn(() => ({
    isEnabled: undefined,
    setEnabled: jest.fn(),
    isLoading: false,
  })),
}));

const mockHighlights = [
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
];

describe('useAutoHighlights', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return Wrapper;
  };

  it('[REGRESSION GH-288] returns highlights for logged-in user when preferences include default_relevance_threshold', async () => {
    server.use(
      http.get(`${API_BASE_URL}/bible/user/theme-preferences`, () => {
        return HttpResponse.json({
          success: true,
          data: [
            {
              theme_id: 1,
              theme_name: 'Key Verses',
              theme_color: 'yellow',
              theme_description: null,
              is_enabled: true,
              custom_color: null,
              relevance_threshold: 3,
              default_relevance_threshold: 3,
              admin_override: false,
            },
          ],
        });
      }),
      http.get(`${API_BASE_URL}/bible/auto-highlights/:bookId/:chapterNumber`, ({ request }) => {
        const url = new URL(request.url);
        const themeRelevance = url.searchParams.get('theme_relevance');
        // Verify the hook sends a valid numeric threshold, not "1:undefined"
        if (themeRelevance && themeRelevance.includes('undefined')) {
          return HttpResponse.json({ success: false }, { status: 400 });
        }
        return HttpResponse.json({ success: true, data: mockHighlights });
      })
    );

    const { result } = renderHook(() => useAutoHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => !result.current.isLoading);

    expect(result.current.autoHighlights.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('[REGRESSION GH-288] returns highlights when backend omits default_relevance_threshold (defensive fallback)', async () => {
    server.use(
      http.get(`${API_BASE_URL}/bible/user/theme-preferences`, () => {
        return HttpResponse.json({
          success: true,
          // Intentionally omit default_relevance_threshold and admin_override
          // to simulate a backend that doesn't include these fields
          data: [
            {
              theme_id: 1,
              theme_name: 'Key Verses',
              theme_color: 'yellow',
              theme_description: null,
              is_enabled: true,
              custom_color: null,
              relevance_threshold: 3,
            },
          ],
        });
      }),
      http.get(`${API_BASE_URL}/bible/auto-highlights/:bookId/:chapterNumber`, ({ request }) => {
        const url = new URL(request.url);
        const themeRelevance = url.searchParams.get('theme_relevance');
        if (themeRelevance && themeRelevance.includes('undefined')) {
          return HttpResponse.json({ success: false }, { status: 400 });
        }
        return HttpResponse.json({ success: true, data: mockHighlights });
      })
    );

    const { result } = renderHook(() => useAutoHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => !result.current.isLoading);

    expect(result.current.autoHighlights.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array when all themes are disabled', async () => {
    server.use(
      http.get(`${API_BASE_URL}/bible/user/theme-preferences`, () => {
        return HttpResponse.json({
          success: true,
          data: [
            {
              theme_id: 1,
              theme_name: 'Key Verses',
              theme_color: 'yellow',
              theme_description: null,
              is_enabled: false,
              custom_color: null,
              relevance_threshold: 3,
              default_relevance_threshold: 3,
              admin_override: false,
            },
          ],
        });
      })
    );

    const { result } = renderHook(() => useAutoHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => !result.current.isLoading);

    expect(result.current.autoHighlights).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
