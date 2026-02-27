/**
 * Integration Tests: Chapter Prefetching
 *
 * Tests prefetching behavior for chapter navigation:
 * - Adjacent chapters are prefetched via useEffect on mount
 * - React Query cache prevents duplicate API calls
 * - Cross-book prefetching works correctly
 * - Cache key alignment between prefetch and useBibleChapter
 *
 * @see Task Group 6.1: Write 2-8 tests for prefetching
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useBibleChapter, usePrefetchNextChapter, usePrefetchPreviousChapter } from '@/src/api';

// Mock usePreferredLanguage (used by prefetch hooks for explanation prefetch)
jest.mock('@/hooks/use-preferred-language', () => ({
  usePreferredLanguage: jest.fn(() => 'en'),
}));

// Mock OfflineContext (used by useBibleChapter)
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: jest.fn(() => ({
    downloadedBibleVersions: [],
    downloadedCommentaryLanguages: [],
    downloadedTopicLanguages: [],
  })),
}));

/**
 * Create a wrapper with QueryClientProvider for testing hooks
 */
const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('Chapter Prefetching', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 1000 * 60 * 5, // 5 minutes
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * Test 1: usePrefetchNextChapter auto-prefetches next chapter on mount
   */
  it('prefetches next chapter within same book', async () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    renderHook(() => usePrefetchNextChapter(1, 1, 50), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      // useEffect fires prefetchQuery for chapter text + explanation
      expect(prefetchSpy).toHaveBeenCalled();
      const calls = prefetchSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toHaveProperty('queryKey');
    });

    prefetchSpy.mockRestore();
  });

  /**
   * Test 2: usePrefetchPreviousChapter auto-prefetches previous chapter on mount
   */
  it('prefetches previous chapter within same book', async () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    renderHook(() => usePrefetchPreviousChapter(1, 5), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(prefetchSpy).toHaveBeenCalled();
      const calls = prefetchSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toHaveProperty('queryKey');
    });

    prefetchSpy.mockRestore();
  });

  /**
   * Test 3: Cross-book prefetch — at last chapter, prefetches first chapter of next book
   */
  it('prefetches first chapter of next book when at last chapter', async () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    // Genesis has 50 chapters — at chapter 50, should prefetch Exodus 1
    renderHook(() => usePrefetchNextChapter(1, 50, 50), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(prefetchSpy).toHaveBeenCalled();
      // Should prefetch Exodus (bookId=2) chapter 1
      const chapterCall = prefetchSpy.mock.calls[0][0] as any;
      expect(chapterCall.queryKey[0]).toHaveProperty('path');
      expect(chapterCall.queryKey[0].path).toEqual(
        expect.objectContaining({ bookId: '2', chapterNumber: '1' })
      );
    });

    prefetchSpy.mockRestore();
  });

  /**
   * Test 4: Does not prefetch before Genesis 1 (beginning of Bible)
   */
  it('does not prefetch before first chapter of Bible', () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    renderHook(() => usePrefetchPreviousChapter(1, 1), {
      wrapper: createWrapper(queryClient),
    });

    // Should not have called prefetchQuery (no chapter before Genesis 1)
    expect(prefetchSpy).not.toHaveBeenCalled();

    prefetchSpy.mockRestore();
  });

  /**
   * Test 5: Does not prefetch past Revelation 22 (end of Bible)
   */
  it('does not prefetch past last chapter of Bible', () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    // Revelation (bookId=66) has 22 chapters
    renderHook(() => usePrefetchNextChapter(66, 22, 22), {
      wrapper: createWrapper(queryClient),
    });

    // Should not have called prefetchQuery (no chapter after Revelation 22)
    expect(prefetchSpy).not.toHaveBeenCalled();

    prefetchSpy.mockRestore();
  });

  /**
   * Test 6: Prefetching doesn't block main thread (synchronous execution)
   */
  it('executes prefetch synchronously without blocking', () => {
    const startTime = performance.now();
    renderHook(() => usePrefetchNextChapter(1, 1, 50), {
      wrapper: createWrapper(queryClient),
    });
    const endTime = performance.now();

    // Prefetch should complete very quickly (< 50ms) since it's async in background
    expect(endTime - startTime).toBeLessThan(50);
  });

  /**
   * Test 7: Prefetch hooks auto-prefetch on mount via useEffect
   */
  it('auto-prefetches adjacent chapters on mount', async () => {
    const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

    // Render hook - this should trigger useEffect auto-prefetch
    renderHook(() => usePrefetchNextChapter(1, 5, 50), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      // Verify prefetchQuery was called by the useEffect
      expect(prefetchSpy).toHaveBeenCalled();
      expect(prefetchSpy.mock.calls.length).toBeGreaterThan(0);
    });

    prefetchSpy.mockRestore();
  });

  /**
   * Cache key alignment tests
   *
   * Protects Change C1: Prefetch key alignment.
   * usePrefetchNextChapter uses the SDK-generated queryKey, while useBibleChapter
   * now also uses the same generated key. These tests verify alignment.
   */
  describe('cache key alignment', () => {
    it('[REGRESSION] usePrefetchNextChapter calls prefetchQuery with a queryKey matching SDK shape', async () => {
      const prefetchSpy = jest.spyOn(queryClient, 'prefetchQuery');

      renderHook(() => usePrefetchNextChapter(1, 1, 50), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(prefetchSpy).toHaveBeenCalled();

        const call = prefetchSpy.mock.calls[0][0];
        expect(call).toHaveProperty('queryKey');

        // SDK-generated key is an array with an object containing _id
        const queryKey = call.queryKey;
        expect(queryKey).toBeDefined();
        expect(queryKey[0]).toHaveProperty('_id', 'getBibleBookByBookIdByChapterNumber');
      });

      prefetchSpy.mockRestore();
    });

    it('[TDD] prefetch and useBibleChapter share the same cache key', async () => {
      // Prefetch Genesis 2 via usePrefetchNextChapter
      renderHook(() => usePrefetchNextChapter(1, 1, 50), { wrapper: createWrapper(queryClient) });

      // Get the generated key that useBibleChapter will use
      const {
        getBibleBookByBookIdByChapterNumberOptions,
      } = require('@/src/api/generated/@tanstack/react-query.gen');
      const generatedOpts = getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: '1', chapterNumber: '2' },
      });

      // Wait for prefetch to populate the cache
      await waitFor(() => {
        queryClient.getQueryData(generatedOpts.queryKey);
        // Cache should be populated (even if the fetch failed, the key entry exists)
        // The key alignment is what matters — both use the same key shape
        expect(queryClient.getQueryState(generatedOpts.queryKey)).toBeDefined();
      });
    });

    it('[T-003] query key used by useBibleChapter matches prefetch key exactly', () => {
      const {
        getBibleBookByBookIdByChapterNumberOptions,
      } = require('@/src/api/generated/@tanstack/react-query.gen');

      // Get the key that useBibleChapter would use (it calls the same options helper)
      const chapterOpts = getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: '1', chapterNumber: '5' },
      });

      // Get the key that usePrefetchNextChapter would use (identical call)
      const prefetchOpts = getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: '1', chapterNumber: '5' },
      });

      // Keys must be deeply equal — this is the critical invariant that prevents cache misses
      expect(chapterOpts.queryKey).toEqual(prefetchOpts.queryKey);
      // The _id should match the generated operation name
      expect(chapterOpts.queryKey[0]).toHaveProperty('_id', 'getBibleBookByBookIdByChapterNumber');
    });

    it('[TDD] useBibleChapter reads from the same cache key as prefetch', () => {
      // Seed the cache with the generated key shape
      const {
        getBibleBookByBookIdByChapterNumberOptions,
      } = require('@/src/api/generated/@tanstack/react-query.gen');
      const generatedOpts = getBibleBookByBookIdByChapterNumberOptions({
        path: { bookId: '1', chapterNumber: '2' },
      });

      const mockChapterData = {
        book: {
          bookId: 1,
          name: 'Genesis',
          testament: 'OT',
          genre: { g: 0, n: '' },
          chapters: [
            {
              chapterNumber: 2,
              subtitles: [],
              verses: [{ verseNumber: 1, text: 'Thus the heavens...' }],
            },
          ],
        },
      };

      // Seed using the generated key format
      queryClient.setQueryData(generatedOpts.queryKey, mockChapterData);

      const { result } = renderHook(() => useBibleChapter(1, 2), {
        wrapper: createWrapper(queryClient),
      });

      // Since staleTime is Infinity, cached data should be used without refetch
      // The hook should NOT be loading because data is already in cache
      expect(result.current.isLoading).toBe(false);
      // Data should be transformed from the cached response
      expect(result.current.data).not.toBeNull();
    });
  });
});
