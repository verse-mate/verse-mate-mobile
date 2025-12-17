/**
 * useLastRead Hook Tests
 *
 * Tests for the hook that fetches a user's last read Bible position
 *
 * @see Task Group 9.4 - Test useLastRead hook
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useLastRead } from '@/src/api';
import {
  clearMockLastReadPosition,
  setMockLastReadPosition,
} from '../../mocks/handlers/bible.handlers';

// Mock user UUIDs for testing
const mockUserId1 = '550e8400-e29b-41d4-a716-446655440001';
const mockUserId2 = '550e8400-e29b-41d4-a716-446655440002';

describe('useLastRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
        },
        mutations: {
          retry: false,
        },
      },
    });
    clearMockLastReadPosition();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should return last read position for valid user', async () => {
    // Set mock last read position via MSW handler
    setMockLastReadPosition(1, 5);

    const { result } = renderHook(() => useLastRead(mockUserId1), { wrapper });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({
      book_id: 1,
      chapter_number: 5,
    });
  });

  it('should return default position when no last read exists', async () => {
    // Don't set any mock position - handler returns default (Genesis 1)
    const { result } = renderHook(() => useLastRead(mockUserId1), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return default Genesis 1
    expect(result.current.data).toMatchObject({
      book_id: 1,
      chapter_number: 1,
    });
  });

  it('should not refetch on rerender with same userId', async () => {
    setMockLastReadPosition(40, 5);

    const { result, rerender } = renderHook((userId: string) => useLastRead(userId), {
      wrapper,
      initialProps: mockUserId1,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstData = result.current.data;

    // Rerender with same userId should not trigger new mutation
    rerender(mockUserId1);

    // Data should remain the same
    expect(result.current.data).toBe(firstData);
  });

  it('should not fetch when userId is empty', () => {
    const { result } = renderHook(() => useLastRead(''), { wrapper });

    // Mutation should not be triggered when userId is empty
    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toEqual({});
  });

  it('should fetch different position for different user', async () => {
    // Set position for first user
    setMockLastReadPosition(1, 1);

    const { result: result1 } = renderHook(() => useLastRead(mockUserId1), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(result1.current.data).toMatchObject({
      book_id: 1,
      chapter_number: 1,
    });

    // Change mock position for second user
    setMockLastReadPosition(66, 22);

    const { result: result2 } = renderHook(() => useLastRead(mockUserId2), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    expect(result2.current.data).toMatchObject({
      book_id: 66,
      chapter_number: 22,
    });
  });
});
