/**
 * Tests for useNotes Hook
 *
 * Focused tests for critical CRUD operations and helper functions.
 * Tests cover:
 * - Fetching notes with authentication
 * - Adding notes with optimistic updates
 * - Updating notes
 * - Deleting notes with rollback on error
 * - Helper functions (getNotesByChapter, hasNotes)
 *
 * Limit: 2-8 highly focused tests maximum
 *
 * @see hook: /hooks/bible/use-notes.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { useNotes } from '@/hooks/bible/use-notes';
import { MOCK_USER_ID } from '../../mocks/data/notes.data';
import { resetNotesStore } from '../../mocks/handlers/notes.handlers';
import { server } from '../../mocks/server';

const API_BASE_URL = 'https://api.verse-mate.apegro.dev';

// Use a user ID that matches the mock pattern expected by auth handlers
const TEST_USER_ID = 'user-1234567890';
const TEST_ACCESS_TOKEN = `mock-access-token-${TEST_USER_ID}`;

// Mock auth tokens with proper user ID format
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(TEST_ACCESS_TOKEN),
  getRefreshToken: jest.fn().mockResolvedValue(`mock-refresh-token-${TEST_USER_ID}`),
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

describe('useNotes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset notes store to initial state
    resetNotesStore();

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
          id: TEST_USER_ID,
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

  // Test 1: Should fetch notes on mount for authenticated user
  it('should fetch notes with authentication', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isFetchingNotes).toBe(true);

    // Wait for notes to load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    // Should have notes from mock store (5 notes in initial data)
    expect(result.current.notes.length).toBeGreaterThan(0);
    expect(result.current.notes.length).toBe(5);
  });

  // Test 2: Should add note with optimistic update
  it('should add note with optimistic update', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    const initialCount = result.current.notes.length;

    // Add a note
    await act(async () => {
      await result.current.addNote(1, 1, 'Test note content');
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isAddingNote).toBe(false);
    });

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.notes.length).toBeGreaterThan(initialCount);
    });

    // Should find the new note
    const newNote = result.current.notes.find((n) => n.content === 'Test note content');
    expect(newNote).toBeDefined();
    expect(newNote?.book_id).toBe(1);
    expect(newNote?.chapter_number).toBe(1);
  });

  // Test 3: Should update note content
  it('should update note content', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    // Get first note
    const noteToUpdate = result.current.notes[0];
    expect(noteToUpdate).toBeDefined();

    // Update the note
    await act(async () => {
      await result.current.updateNote(noteToUpdate.note_id, 'Updated content');
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isUpdatingNote).toBe(false);
    });

    // Wait for refetch to complete and verify update
    await waitFor(() => {
      const updatedNote = result.current.notes.find((n) => n.note_id === noteToUpdate.note_id);
      expect(updatedNote?.content).toBe('Updated content');
    });
  });

  // Test 4: Should delete note
  it('should delete note with rollback on error', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    const initialCount = result.current.notes.length;
    const noteToDelete = result.current.notes[0];
    expect(noteToDelete).toBeDefined();

    // Delete the note
    await act(async () => {
      await result.current.deleteNote(noteToDelete.note_id);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isDeletingNote).toBe(false);
    });

    // Wait for refetch to complete and verify deletion
    await waitFor(() => {
      expect(result.current.notes.length).toBeLessThan(initialCount);
    });

    // Note should not be in list
    const deletedNote = result.current.notes.find((n) => n.note_id === noteToDelete.note_id);
    expect(deletedNote).toBeUndefined();
  });

  // Test 5: Should filter notes by chapter with getNotesByChapter
  it('should filter notes by chapter with getNotesByChapter', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    // Get notes for Genesis 1 (should have 2 notes in mock data)
    const genesis1Notes = result.current.getNotesByChapter(1, 1);

    // Should have 2 notes for Genesis 1
    expect(genesis1Notes.length).toBe(2);
    expect(genesis1Notes.every((n) => n.book_id === 1 && n.chapter_number === 1)).toBe(true);
  });

  // Test 6: Should check if chapter has notes with hasNotes
  it('should check if chapter has notes with hasNotes', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: createWrapper(),
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isFetchingNotes).toBe(false);
    });

    // Genesis 1 should have notes (2 in mock data)
    expect(result.current.hasNotes(1, 1)).toBe(true);

    // John 3 should have notes (1 in mock data)
    expect(result.current.hasNotes(43, 3)).toBe(true);

    // Random chapter should not have notes
    expect(result.current.hasNotes(999, 999)).toBe(false);
  });
});
