/**
 * Tests for useHighlights Hook
 *
 * Focused tests for critical CRUD operations:
 * - addHighlight with optimistic update and rollback
 * - updateHighlightColor with optimistic update
 * - deleteHighlight with optimistic update
 * - fetchHighlightsByChapter query
 * - overlap error handling and rollback
 *
 * Limit: 2-8 highly focused tests maximum
 *
 * @see hook: /hooks/bible/use-highlights.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { MOCK_USER_ID } from '../../mocks/data/highlights.data';
import { resetHighlightStore } from '../../mocks/handlers/highlights.handlers';
import { server } from '../../mocks/server';

const API_BASE_URL = 'http://localhost:4000';

// Mock auth tokens with proper user ID format
// NOTE: Using 'test-user-123' to match MOCK_USER_ID from highlights.data.ts
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-access-token-test-user-123'),
  getRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token-test-user-123'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

// Mock token refresh
jest.mock('@/lib/auth/token-refresh', () => ({
  setupProactiveRefresh: jest.fn(() => jest.fn()),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

describe('useHighlights', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset highlight store to initial state
    resetHighlightStore();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Override auth session handler to return our test user (must be in beforeEach for isolation)
    server.use(
      http.get(`${API_BASE_URL}/auth/session`, () => {
        return HttpResponse.json({
          id: MOCK_USER_ID,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        });
      })
    );
  });

  afterEach(() => {
    // Clear all queries and mutations from the query client
    queryClient.clear();

    // Reset MSW handlers to restore the auth session handler
    server.restoreHandlers();
  });

  const createWrapper = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    return Wrapper;
  };

  // Test 1: Should fetch all highlights for authenticated user
  it('should fetch all highlights for authenticated user', async () => {
    const { result } = renderHook(() => useHighlights(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isFetchingHighlights).toBe(true);

    // Wait for highlights to load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    // Should have highlights from mock store (6 highlights in initial data)
    expect(result.current.allHighlights.length).toBeGreaterThan(0);
    expect(result.current.allHighlights.length).toBe(6);
  });

  // Test 2: Should fetch chapter-specific highlights
  it('should fetch chapter-specific highlights for Genesis 1', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for highlights to load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    // Should have Genesis 1 highlights only (2 highlights in mock data)
    expect(result.current.chapterHighlights.length).toBe(2);
    expect(result.current.chapterHighlights[0].chapter_id).toBe(1001);
  });

  // Test 3: Should add highlight with optimistic update
  it('should add highlight with optimistic update', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 2 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;

    // Add a highlight
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 2,
        startVerse: 5,
        endVerse: 6,
        color: 'green',
        startChar: 0,
        endChar: 100,
        selectedText: 'Test highlight text',
      });
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBeGreaterThan(initialCount);
    });

    // Should find the new highlight
    const newHighlight = result.current.chapterHighlights.find(
      (h) => h.selected_text === 'Test highlight text'
    );
    expect(newHighlight).toBeDefined();
    expect(newHighlight?.color).toBe('green');
  });

  // Test 4: Should handle overlap error and rollback optimistic update
  it('should handle overlap error and rollback optimistic update', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Attempt to add overlapping highlight (overlaps with existing highlight at verse 1, chars 0-50)
    await act(async () => {
      try {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 1,
          startVerse: 1,
          endVerse: 1,
          color: 'blue',
          startChar: 10,
          endChar: 60,
          selectedText: 'Overlapping text',
        });
      } catch (_error) {
        // Expected to throw
      }
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Verify rollback - length should be same as initial (optimistic update rolled back)
    expect(result.current.chapterHighlights.length).toBe(initialLength);
  });

  // Test 5: Should update highlight color with optimistic update
  it('should update highlight color with optimistic update', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const firstHighlight = result.current.chapterHighlights[0];
    const originalColor = firstHighlight.color;

    // Update color
    await act(async () => {
      await result.current.updateHighlightColor(firstHighlight.highlight_id, 'purple');
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isUpdatingHighlight).toBe(false);
    });

    // Wait for refetch to complete
    await waitFor(() => {
      const updatedHighlight = result.current.chapterHighlights.find(
        (h) => h.highlight_id === firstHighlight.highlight_id
      );
      expect(updatedHighlight?.color).toBe('purple');
      expect(updatedHighlight?.color).not.toBe(originalColor);
    });
  });

  // Test 6: Should delete highlight with optimistic update
  it('should delete highlight with optimistic update', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;
    const highlightToDelete = result.current.chapterHighlights[0];

    // Delete highlight
    await act(async () => {
      await result.current.deleteHighlight(highlightToDelete.highlight_id);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isDeletingHighlight).toBe(false);
    });

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialCount - 1);
    });

    // Verify highlight was deleted
    const deletedHighlight = result.current.chapterHighlights.find(
      (h) => h.highlight_id === highlightToDelete.highlight_id
    );
    expect(deletedHighlight).toBeUndefined();
  });

  // Test 7: Should check if verse range is highlighted
  it('should check if verse range is highlighted', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    // Check verse 1 (has highlight in mock data)
    expect(result.current.isHighlighted(1, 1)).toBe(true);

    // Check verse 3-5 (has highlight in mock data)
    expect(result.current.isHighlighted(3, 5)).toBe(true);

    // Check verse 10 (no highlight in mock data)
    expect(result.current.isHighlighted(10, 10)).toBe(false);

    // Check character-level overlap
    expect(result.current.isHighlighted(1, 1, 0, 25)).toBe(true); // Overlaps with existing 0-50
    expect(result.current.isHighlighted(1, 1, 60, 80)).toBe(false); // No overlap
  });
});
