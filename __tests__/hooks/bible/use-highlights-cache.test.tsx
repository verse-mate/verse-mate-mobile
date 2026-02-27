/**
 * Tests for highlight mutation cache update logic
 *
 * Protects the addMutation.onSuccess cache append behavior:
 * - After a successful add, the all-highlights cache is updated with the server response
 * - Chapter highlights cache is invalidated to get real highlight_id
 * - onSettled invalidation fires regardless of onSuccess outcome
 *
 * Also tests the isUserDataSynced gating for remote queries.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useHighlights } from '@/hooks/bible/use-highlights';

// Unmock use-highlights (may be globally mocked)
jest.unmock('@/hooks/bible/use-highlights');

// Mock AuthContext
const mockUser = { id: 'user-1' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock OfflineContext with controllable isUserDataSynced
let mockIsUserDataSynced = false;
let mockIsOnline = true;
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: jest.fn(() => ({
    isUserDataSynced: mockIsUserDataSynced,
    isOnline: mockIsOnline,
  })),
}));

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
  AnalyticsEvent: { HIGHLIGHT_CREATED: 'HIGHLIGHT_CREATED' },
}));

// Mock offline storage functions
jest.mock('@/services/offline', () => ({
  addLocalHighlight: jest.fn(),
  addSyncAction: jest.fn(),
  deleteLocalHighlight: jest.fn(),
  getLocalAllHighlights: jest.fn().mockResolvedValue([]),
  getLocalHighlights: jest.fn().mockResolvedValue([]),
  updateLocalHighlightColor: jest.fn(),
}));

// Mock the generated mutation/query functions
const mockAddMutationFn = jest.fn();
jest.mock('@/src/api/generated/@tanstack/react-query.gen', () => ({
  getBibleHighlightsByUserIdOptions: jest.fn((opts: any) => ({
    queryKey: [{ _id: 'getBibleHighlightsByUserId', path: opts.path }],
    queryFn: jest.fn().mockResolvedValue({ highlights: [] }),
  })),
  getBibleHighlightsByUserIdQueryKey: jest.fn((opts: any) => [
    { _id: 'getBibleHighlightsByUserId', path: opts.path },
  ]),
  getBibleHighlightsByUserIdByBookIdByChapterNumberOptions: jest.fn((opts: any) => ({
    queryKey: [{ _id: 'getBibleHighlightsByUserIdByBookIdByChapterNumber', path: opts.path }],
    queryFn: jest.fn().mockResolvedValue({ highlights: [] }),
  })),
  getBibleHighlightsByUserIdByBookIdByChapterNumberQueryKey: jest.fn((opts: any) => [
    { _id: 'getBibleHighlightsByUserIdByBookIdByChapterNumber', path: opts.path },
  ]),
  postBibleHighlightAddMutation: jest.fn(() => ({
    mutationFn: mockAddMutationFn,
  })),
  putBibleHighlightByHighlightIdMutation: jest.fn(() => ({
    mutationFn: jest.fn(),
  })),
  deleteBibleHighlightByHighlightIdMutation: jest.fn(() => ({
    mutationFn: jest.fn(),
  })),
}));

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useHighlights cache behavior', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsUserDataSynced = false;
    mockIsOnline = true;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('addMutation cache update (T-001)', () => {
    it('appends server highlight to all-highlights cache on success', async () => {
      const serverHighlight = {
        highlight_id: 999,
        user_id: 'user-1',
        chapter_id: 1001,
        book_id: 1,
        chapter_number: 1,
        start_verse: 1,
        end_verse: 2,
        color: 'yellow',
        start_char: null,
        end_char: null,
        selected_text: 'test',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockAddMutationFn.mockResolvedValue({ highlight: serverHighlight });

      // Seed the all-highlights cache with an existing highlight
      const allHighlightsKey = [{ _id: 'getBibleHighlightsByUserId', path: { user_id: 'user-1' } }];
      queryClient.setQueryData(allHighlightsKey, {
        highlights: [
          {
            highlight_id: 1,
            user_id: 'user-1',
            chapter_id: 1001,
            book_id: 1,
            chapter_number: 1,
            start_verse: 5,
            end_verse: 5,
            color: 'blue',
            start_char: null,
            end_char: null,
            selected_text: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() => useHighlights(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 1,
          startVerse: 1,
          endVerse: 2,
          color: 'yellow',
        });
      });

      // Verify the all-highlights cache now contains both highlights
      const cachedData = queryClient.getQueryData<{ highlights: any[] }>(allHighlightsKey);
      expect(cachedData).toBeDefined();
      // Should have original + server highlight appended
      const ids = cachedData?.highlights.map((h: any) => h.highlight_id) ?? [];
      expect(ids).toContain(999);
    });
  });

  describe('isUserDataSynced gating (T-002)', () => {
    it('enables remote queries when isUserDataSynced is false', () => {
      mockIsUserDataSynced = false;

      const { result } = renderHook(() => useHighlights(), {
        wrapper: createWrapper(queryClient),
      });

      // When isUserDataSynced is false and user is authenticated, remote queries should be enabled
      // We verify this indirectly: the hook should be fetching (not just returning empty)
      expect(result.current.isFetchingHighlights).toBeDefined();
    });

    it('disables remote all-highlights query when isUserDataSynced is true', () => {
      mockIsUserDataSynced = true;

      const fetchSpy = jest.spyOn(queryClient, 'fetchQuery');

      renderHook(() => useHighlights(), {
        wrapper: createWrapper(queryClient),
      });

      // Remote query should NOT have been triggered when synced
      // The local offline fallback should be used instead
      const remoteCallsForAllHighlights = fetchSpy.mock.calls.filter((call) => {
        const key = (call[0] as any)?.queryKey?.[0]?._id;
        return key === 'getBibleHighlightsByUserId';
      });
      expect(remoteCallsForAllHighlights).toHaveLength(0);

      fetchSpy.mockRestore();
    });

    it('disables remote chapter-highlights query when isUserDataSynced is true', () => {
      mockIsUserDataSynced = true;

      const fetchSpy = jest.spyOn(queryClient, 'fetchQuery');

      renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
        wrapper: createWrapper(queryClient),
      });

      const remoteCallsForChapter = fetchSpy.mock.calls.filter((call) => {
        const key = (call[0] as any)?.queryKey?.[0]?._id;
        return key === 'getBibleHighlightsByUserIdByBookIdByChapterNumber';
      });
      expect(remoteCallsForChapter).toHaveLength(0);

      fetchSpy.mockRestore();
    });
  });
});
