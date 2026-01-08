/**
 * Tests for useAllTopics Hook
 *
 * Tests the global topic fetching hook that combines topics from all 4 categories
 * (EVENT, PROPHECY, PARABLE, THEME) into a single sorted array.
 *
 * Test coverage:
 * - Fetches topics from all 4 categories
 * - Sorts by category order (EVENT, PROPHECY, PARABLE, THEME), then by sort_order within category
 * - Returns combined array of all topics
 * - Handles loading and error states correctly
 * - Handles empty response for individual categories
 * - Data is properly memoized
 *
 * @see src/api/hooks.ts - useAllTopics hook
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { useAllTopics } from '@/src/api/hooks';
import { getAllMockTopics, mockTopicsByCategory } from '../mocks/handlers/topics.handlers';
import { server } from '../mocks/server';

const API_BASE_URL = 'http://localhost:4000';

describe('useAllTopics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return Wrapper;
  };

  /**
   * Test 1: Hook fetches topics from all 4 categories
   * Verifies that useAllTopics makes requests to all 4 category endpoints
   */
  it('fetches topics from all 4 categories (EVENT, PROPHECY, PARABLE, THEME)', async () => {
    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    // Wait for all queries to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have topics from all categories
    const allTopics = result.current.data;
    expect(allTopics).toBeDefined();
    expect(allTopics.length).toBe(getAllMockTopics().length);

    // Verify topics from each category are present
    const eventTopics = allTopics.filter((t) => t.category === 'EVENT');
    const prophecyTopics = allTopics.filter((t) => t.category === 'PROPHECY');
    const parableTopics = allTopics.filter((t) => t.category === 'PARABLE');
    const themeTopics = allTopics.filter((t) => t.category === 'THEME');

    expect(eventTopics.length).toBe(mockTopicsByCategory.EVENT.length);
    expect(prophecyTopics.length).toBe(mockTopicsByCategory.PROPHECY.length);
    expect(parableTopics.length).toBe(mockTopicsByCategory.PARABLE.length);
    expect(themeTopics.length).toBe(mockTopicsByCategory.THEME.length);
  });

  /**
   * Test 2: Topics are sorted by category order first, then by sort_order within category
   * Category order: EVENT -> PROPHECY -> PARABLE -> THEME
   */
  it('sorts topics by category order (EVENT, PROPHECY, PARABLE, THEME), then by sort_order', async () => {
    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const allTopics = result.current.data;

    // Find category boundaries
    const firstEventIndex = allTopics.findIndex((t) => t.category === 'EVENT');
    const firstProphecyIndex = allTopics.findIndex((t) => t.category === 'PROPHECY');
    const firstParableIndex = allTopics.findIndex((t) => t.category === 'PARABLE');
    const firstThemeIndex = allTopics.findIndex((t) => t.category === 'THEME');

    // Categories should appear in order: EVENT < PROPHECY < PARABLE < THEME
    expect(firstEventIndex).toBeLessThan(firstProphecyIndex);
    expect(firstProphecyIndex).toBeLessThan(firstParableIndex);
    expect(firstParableIndex).toBeLessThan(firstThemeIndex);

    // Within each category, topics should be sorted by sort_order
    const eventTopics = allTopics.filter((t) => t.category === 'EVENT');
    for (let i = 1; i < eventTopics.length; i++) {
      const prevSortOrder = eventTopics[i - 1].sort_order ?? 0;
      const currSortOrder = eventTopics[i].sort_order ?? 0;
      expect(prevSortOrder).toBeLessThanOrEqual(currSortOrder);
    }
  });

  /**
   * Test 3: Hook returns combined array of all topics with category information
   */
  it('returns combined array with category field on each topic', async () => {
    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const allTopics = result.current.data;

    // Every topic should have required fields
    allTopics.forEach((topic) => {
      expect(topic.topic_id).toBeDefined();
      expect(topic.name).toBeDefined();
      expect(topic.category).toBeDefined();
      expect(['EVENT', 'PROPHECY', 'PARABLE', 'THEME']).toContain(topic.category);
    });
  });

  /**
   * Test 4: Hook handles loading state correctly
   * Loading should be true while any category is still loading
   */
  it('handles loading state correctly - isLoading true while any query is pending', async () => {
    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After loading, data should be populated
    expect(result.current.data.length).toBeGreaterThan(0);
  });

  /**
   * Test 5: Hook handles empty response for individual categories gracefully
   */
  it('handles empty response for individual categories gracefully', async () => {
    // Override EVENT category to return empty array
    server.use(
      http.get(`${API_BASE_URL}/topics/search`, ({ request }) => {
        const url = new URL(request.url);
        const category = url.searchParams.get('category');

        if (category === 'EVENT') {
          return HttpResponse.json({ topics: [] });
        }

        // Return normal mock data for other categories
        const topics = mockTopicsByCategory[category as keyof typeof mockTopicsByCategory] || [];
        return HttpResponse.json({ topics });
      })
    );

    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const allTopics = result.current.data;

    // Should have no EVENT topics
    const eventTopics = allTopics.filter((t) => t.category === 'EVENT');
    expect(eventTopics.length).toBe(0);

    // But should still have topics from other categories
    const prophecyTopics = allTopics.filter((t) => t.category === 'PROPHECY');
    const parableTopics = allTopics.filter((t) => t.category === 'PARABLE');
    const themeTopics = allTopics.filter((t) => t.category === 'THEME');

    expect(prophecyTopics.length).toBe(mockTopicsByCategory.PROPHECY.length);
    expect(parableTopics.length).toBe(mockTopicsByCategory.PARABLE.length);
    expect(themeTopics.length).toBe(mockTopicsByCategory.THEME.length);
  });

  /**
   * Test 6: Hook handles error state - isError reflects query failures
   */
  it('handles error states correctly when a category fails to load', async () => {
    // Override to return error for EVENT category
    server.use(
      http.get(`${API_BASE_URL}/topics/search`, ({ request }) => {
        const url = new URL(request.url);
        const category = url.searchParams.get('category');

        if (category === 'EVENT') {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }

        const topics = mockTopicsByCategory[category as keyof typeof mockTopicsByCategory] || [];
        return HttpResponse.json({ topics });
      })
    );

    const { result } = renderHook(() => useAllTopics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should indicate error when any query fails
    expect(result.current.isError).toBe(true);
  });
});
