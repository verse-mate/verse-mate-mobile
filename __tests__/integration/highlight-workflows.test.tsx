/**
 * Highlight Feature Integration Tests
 *
 * End-to-end tests for complete highlight workflows that span multiple components.
 * Tests critical user journeys and error scenarios.
 *
 * @see Task Group 8.3: Write up to 10 additional strategic tests maximum
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useHighlights } from '@/hooks/bible/use-highlights';
import { MOCK_USER_ID } from '../mocks/data/highlights.data';
import { resetHighlightStore } from '../mocks/handlers/highlights.handlers';
import { server } from '../mocks/server';

const API_BASE_URL = 'http://localhost:4000';

// Mock auth tokens
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

describe('Highlight Workflows Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    resetHighlightStore();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

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
    queryClient.clear();
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

  /**
   * Test 1: Complete Create → View → Edit → Delete cycle
   * Critical end-to-end workflow
   */
  it('should complete full highlight lifecycle: create → view → edit → delete', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 2 }), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;

    // Step 1: Create a highlight
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 2,
        startVerse: 10,
        endVerse: 11,
        color: 'yellow',
        startChar: 0,
        endChar: 50,
        selectedText: 'Test lifecycle highlight',
      });
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Step 2: Verify it appears in the list
    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialCount + 1);
    });

    const newHighlight = result.current.chapterHighlights.find(
      (h) => h.selected_text === 'Test lifecycle highlight'
    );
    expect(newHighlight).toBeDefined();
    expect(newHighlight?.color).toBe('yellow');

    // Step 3: Edit the color
    if (newHighlight?.highlight_id !== undefined) {
      await act(async () => {
        await result.current.updateHighlightColor(newHighlight.highlight_id, 'blue');
      });

      await waitFor(() => {
        expect(result.current.isUpdatingHighlight).toBe(false);
      });

      await waitFor(() => {
        const updatedHighlight = result.current.chapterHighlights.find(
          (h) => h.highlight_id === newHighlight.highlight_id
        );
        expect(updatedHighlight?.color).toBe('blue');
      });
    }

    // Step 4: Delete the highlight
    if (newHighlight?.highlight_id !== undefined) {
      await act(async () => {
        await result.current.deleteHighlight(newHighlight.highlight_id);
      });

      await waitFor(() => {
        expect(result.current.isDeletingHighlight).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.chapterHighlights.length).toBe(initialCount);
      });
    }
  });

  /**
   * Test 2: Network failure recovery
   * Test optimistic update rollback on network error
   */
  it('should rollback optimistic update on network failure', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 2 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;

    // Override handler to return network error
    server.use(
      http.post(`${API_BASE_URL}/bible/highlight/add`, () => {
        return HttpResponse.json({ message: 'Network error', data: null }, { status: 500 });
      })
    );

    // Attempt to add highlight
    await act(async () => {
      try {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 2,
          startVerse: 15,
          endVerse: 15,
          color: 'green',
          startChar: 0,
          endChar: 50,
          selectedText: 'Network failure test',
        });
      } catch (_error) {
        // Expected to fail
      }
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Verify rollback - count should be same as initial
    expect(result.current.chapterHighlights.length).toBe(initialCount);
  });

  /**
   * Test 3: Same verse, same character range overlap
   * Tests precise overlap detection at character level
   */
  it('should detect overlap for same verse and same character range', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Attempt exact overlap (verse 1, chars 0-50 already exists in mock data)
    await act(async () => {
      try {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 1,
          startVerse: 1,
          endVerse: 1,
          color: 'purple',
          startChar: 0,
          endChar: 50,
          selectedText: 'Exact overlap test',
        });
      } catch (_error) {
        // Expected to throw overlap error
      }
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Verify no change - rollback occurred
    expect(result.current.chapterHighlights.length).toBe(initialLength);
  });

  /**
   * Test 4: Overlapping character ranges within same verse
   * Tests partial character overlap detection
   */
  it('should detect overlap for overlapping character ranges within verse', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Attempt partial overlap (verse 1, chars 0-50 exists, trying 25-75)
    await act(async () => {
      try {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 1,
          startVerse: 1,
          endVerse: 1,
          color: 'orange',
          startChar: 25,
          endChar: 75,
          selectedText: 'Partial overlap test',
        });
      } catch (_error) {
        // Expected to throw overlap error
      }
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    expect(result.current.chapterHighlights.length).toBe(initialLength);
  });

  /**
   * Test 5: Overlapping verse ranges (multi-verse)
   * Tests verse-level overlap detection for multi-verse highlights
   */
  it('should detect overlap for overlapping verse ranges', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Attempt to overlap with existing multi-verse highlight (verses 3-5 already exists)
    await act(async () => {
      try {
        await result.current.addHighlight({
          bookId: 1,
          chapterNumber: 1,
          startVerse: 4,
          endVerse: 6,
          color: 'pink',
          startChar: 0,
          endChar: 100,
          selectedText: 'Multi-verse overlap test',
        });
      } catch (_error) {
        // Expected to throw overlap error
      }
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    expect(result.current.chapterHighlights.length).toBe(initialLength);
  });

  /**
   * Test 6: Non-overlapping highlights in same chapter
   * Verifies that valid non-overlapping highlights are accepted
   */
  it('should allow non-overlapping highlights in same chapter', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Add highlight that does NOT overlap (verse 10, existing highlights are verses 1 and 3-5)
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 1,
        startVerse: 10,
        endVerse: 10,
        color: 'green',
        startChar: 0,
        endChar: 50,
        selectedText: 'Non-overlapping highlight',
      });
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialLength + 1);
    });

    const newHighlight = result.current.chapterHighlights.find(
      (h) => h.selected_text === 'Non-overlapping highlight'
    );
    expect(newHighlight).toBeDefined();
  });

  /**
   * Test 7: Authentication requirement enforcement
   * Verifies that unauthenticated users cannot create highlights
   */
  it('should not allow highlight creation when unauthenticated', async () => {
    // Override auth to return unauthenticated
    server.use(
      http.get(`${API_BASE_URL}/auth/session`, () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      })
    );

    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    // Wait for auth check to complete
    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialLength = result.current.chapterHighlights.length;

    // Attempt to add highlight (should fail due to auth check in hook)
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 1,
        startVerse: 20,
        endVerse: 20,
        color: 'yellow',
        startChar: 0,
        endChar: 50,
        selectedText: 'Unauthenticated test',
      });
    });

    // Verify no highlights were added
    expect(result.current.chapterHighlights.length).toBe(initialLength);
  });

  /**
   * Test 8: Successful mutation persists optimistic update
   * Verifies optimistic update is kept after successful API call
   */
  it('should persist optimistic update on successful mutation', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 2 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;

    // Add highlight
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 2,
        startVerse: 1,
        endVerse: 1,
        color: 'blue',
        startChar: 0,
        endChar: 50,
        selectedText: 'Success persist test',
      });
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    // Wait for refetch after success
    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialCount + 1);
    });

    // Verify highlight persists
    const persistedHighlight = result.current.chapterHighlights.find(
      (h) => h.selected_text === 'Success persist test'
    );
    expect(persistedHighlight).toBeDefined();
    expect(persistedHighlight?.color).toBe('blue');
  });

  /**
   * Test 9: Multiple operations in sequence
   * Tests that multiple mutations work correctly in sequence
   */
  it('should handle multiple operations in sequence correctly', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 2 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;

    // Add first highlight
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 2,
        startVerse: 1,
        endVerse: 1,
        color: 'yellow',
        startChar: 0,
        endChar: 30,
        selectedText: 'First sequential highlight',
      });
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialCount + 1);
    });

    // Add second highlight
    await act(async () => {
      await result.current.addHighlight({
        bookId: 1,
        chapterNumber: 2,
        startVerse: 2,
        endVerse: 2,
        color: 'green',
        startChar: 0,
        endChar: 30,
        selectedText: 'Second sequential highlight',
      });
    });

    await waitFor(() => {
      expect(result.current.isAddingHighlight).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.chapterHighlights.length).toBe(initialCount + 2);
    });

    // Verify both exist
    expect(
      result.current.chapterHighlights.find((h) => h.selected_text === 'First sequential highlight')
    ).toBeDefined();
    expect(
      result.current.chapterHighlights.find(
        (h) => h.selected_text === 'Second sequential highlight'
      )
    ).toBeDefined();
  });

  /**
   * Test 10: Delete operation rollback on error
   * Tests that delete operations rollback on failure
   */
  it('should rollback delete operation on error', async () => {
    const { result } = renderHook(() => useHighlights({ bookId: 1, chapterNumber: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isFetchingHighlights).toBe(false);
    });

    const initialCount = result.current.chapterHighlights.length;
    const highlightToDelete = result.current.chapterHighlights[0];

    // Ensure we have a highlight to delete
    expect(highlightToDelete).toBeDefined();

    // Override delete handler to fail
    server.use(
      http.delete(`${API_BASE_URL}/bible/highlight/:highlight_id`, () => {
        return HttpResponse.json({ message: 'Delete failed', data: null }, { status: 500 });
      })
    );

    // Attempt to delete
    await act(async () => {
      try {
        await result.current.deleteHighlight(highlightToDelete.highlight_id);
      } catch (_error) {
        // Expected to fail
      }
    });

    await waitFor(() => {
      expect(result.current.isDeletingHighlight).toBe(false);
    });

    // Verify highlight still exists (rollback occurred)
    expect(result.current.chapterHighlights.length).toBe(initialCount);
    const stillExists = result.current.chapterHighlights.find(
      (h) => h.highlight_id === highlightToDelete.highlight_id
    );
    expect(stillExists).toBeDefined();
  });
});
