/**
 * useLastRead Hook Tests
 *
 * Tests for the hook that fetches a user's last read Bible position
 *
 * @see Task Group 9.4 - Test useLastRead hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLastRead } from '@/src/api/bible/hooks';
import { bibleApiClient } from '@/src/api/bible/client';

// Mock the API client
jest.mock('@/src/api/bible/client', () => ({
  bibleApiClient: {
    post: jest.fn(),
  },
}));

describe('useLastRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
        },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should return last read position for valid user', async () => {
    // Mock successful API response
    const mockLastRead = {
      user_id: 'guest',
      book_id: 1,
      chapter_number: 5,
    };

    (bibleApiClient.post as jest.Mock).mockResolvedValueOnce({
      data: mockLastRead,
    });

    const { result } = renderHook(() => useLastRead('guest'), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockLastRead);
    expect(bibleApiClient.post).toHaveBeenCalledWith('/bible/book/chapter/last-read', {
      user_id: 'guest',
    });
  });

  it('should return null when no last read position found', async () => {
    // Mock API error (404 - no position found)
    (bibleApiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useLastRead('guest'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Hook should return null instead of throwing error
    expect(result.current.data).toBeNull();
  });

  it('should cache result for 5 minutes (stale time)', async () => {
    const mockLastRead = {
      user_id: 'guest',
      book_id: 40,
      chapter_number: 5,
    };

    (bibleApiClient.post as jest.Mock).mockResolvedValueOnce({
      data: mockLastRead,
    });

    const { result, rerender } = renderHook(() => useLastRead('guest'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockLastRead);
    expect(bibleApiClient.post).toHaveBeenCalledTimes(1);

    // Rerender should not trigger new API call (cached)
    rerender({ children: null } as never);

    expect(bibleApiClient.post).toHaveBeenCalledTimes(1);
  });

  it('should not fetch when userId is empty', () => {
    const { result } = renderHook(() => useLastRead(''), { wrapper });

    // Query should be disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(bibleApiClient.post).not.toHaveBeenCalled();
  });

  it('should fetch different position for different user', async () => {
    const mockLastRead1 = {
      user_id: 'user1',
      book_id: 1,
      chapter_number: 1,
    };

    const mockLastRead2 = {
      user_id: 'user2',
      book_id: 66,
      chapter_number: 22,
    };

    (bibleApiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: mockLastRead1 })
      .mockResolvedValueOnce({ data: mockLastRead2 });

    // Fetch for user1
    const { result: result1 } = renderHook(() => useLastRead('user1'), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    expect(result1.current.data).toEqual(mockLastRead1);

    // Fetch for user2
    const { result: result2 } = renderHook(() => useLastRead('user2'), { wrapper });

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    expect(result2.current.data).toEqual(mockLastRead2);
    expect(bibleApiClient.post).toHaveBeenCalledTimes(2);
  });
});
