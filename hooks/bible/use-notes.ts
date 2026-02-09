/**
 * useNotes Hook
 *
 * Manages notes state with optimistic UI updates and API synchronization.
 * Provides methods to add, update, delete, and check notes for Bible chapters.
 *
 * @example
 * ```tsx
 * const {
 *   notes,
 *   isFetchingNotes,
 *   isAddingNote,
 *   isUpdatingNote,
 *   isDeletingNote,
 *   addNote,
 *   updateNote,
 *   deleteNote,
 *   getNotesByChapter,
 *   hasNotes,
 * } = useNotes();
 *
 * // Check if chapter has notes
 * const hasChapterNotes = hasNotes(1, 1); // Genesis 1
 *
 * // Get notes for specific chapter
 * const chapterNotes = getNotesByChapter(1, 1);
 *
 * // Add note with optimistic update
 * await addNote(1, 1, 'My note content');
 *
 * // Update note with optimistic update
 * await updateNote('note-id-123', 'Updated content');
 *
 * // Delete note with optimistic update
 * await deleteNote('note-id-123');
 * ```
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import { getLocalAllNotes } from '@/services/offline';
import {
  deleteBibleBookNoteRemoveMutation,
  getBibleBookNotesByUserIdOptions,
  getBibleBookNotesByUserIdQueryKey,
  postBibleBookNoteAddMutation,
  putBibleBookNoteUpdateMutation,
} from '@/src/api/generated/@tanstack/react-query.gen';
import type {
  DeleteBibleBookNoteRemoveData,
  GetBibleBookNotesByUserIdResponse,
  PostBibleBookNoteAddData,
  PutBibleBookNoteUpdateData,
} from '@/src/api/generated/types.gen';
import type { Note } from '@/types/notes';

/**
 * Return type for useNotes hook
 */
export interface UseNotesResult {
  /** Array of all notes for the user */
  notes: Note[];
  /** Whether notes are being fetched from API */
  isFetchingNotes: boolean;
  /** Whether a note is being added */
  isAddingNote: boolean;
  /** Whether a note is being updated */
  isUpdatingNote: boolean;
  /** Whether a note is being deleted */
  isDeletingNote: boolean;
  /** Add a note with optimistic update, returns the created note */
  addNote: (bookId: number, chapterNumber: number, content: string) => Promise<Note | null>;
  /** Update a note with optimistic update */
  updateNote: (noteId: string, content: string) => Promise<void>;
  /** Delete a note with optimistic update */
  deleteNote: (noteId: string) => Promise<void>;
  /** Get notes filtered by chapter */
  getNotesByChapter: (bookId: number, chapterNumber: number) => Note[];
  /** Check if chapter has any notes */
  hasNotes: (bookId: number, chapterNumber: number) => boolean;
  /** Manually refetch notes from API */
  refetchNotes: () => Promise<void>;
}

/**
 * Hook to manage notes state with optimistic updates
 *
 * Features:
 * - Fetches notes from API on mount
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on API failure
 * - Authentication checks before API calls
 * - Loading states for all operations
 * - Helper functions for filtering and checking notes
 *
 * @returns {UseNotesResult} Notes state and methods
 */
export function useNotes(): UseNotesResult {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isOfflineModeEnabled, isUserDataSynced } = useOfflineContext();
  const queryClient = useQueryClient();

  const isOffline = isOfflineModeEnabled && isUserDataSynced;

  // Create query options with user ID
  const queryOptions = useMemo(
    () => ({
      path: { user_id: user?.id || '' },
    }),
    [user?.id]
  );

  // Query key for notes (use generated query key function)
  const notesQueryKey = useMemo(
    () => getBibleBookNotesByUserIdQueryKey(queryOptions),
    [queryOptions]
  );

  // Fetch notes from API (disabled in offline mode)
  const {
    data: notesData,
    isFetching: isQueryFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    ...getBibleBookNotesByUserIdOptions(queryOptions),
    enabled: isAuthenticated && !!user?.id && !isOffline,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch notes from local storage when offline
  const { data: localNotesData } = useQuery({
    queryKey: ['local-notes-offline-fallback'],
    queryFn: async () => {
      const localNotes = await getLocalAllNotes();
      return localNotes.map((n) => ({
        note_id: n.note_id,
        book_id: n.book_id,
        chapter_number: n.chapter_number,
        verse_number: n.verse_number,
        content: n.content,
        created_at: n.updated_at,
        updated_at: n.updated_at,
        book_name: `Book ${n.book_id}`,
      }));
    },
    enabled: isOffline,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Extract notes array from response (offline or remote)
  const notes = useMemo(() => {
    if (isOffline && localNotesData) {
      return localNotesData as Note[];
    }
    return notesData?.notes || [];
  }, [isOffline, localNotesData, notesData]);

  // Add note mutation
  const addMutation = useMutation({
    ...postBibleBookNoteAddMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notesQueryKey });

      // Snapshot previous value for rollback
      const previousNotes =
        queryClient.getQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey);

      // Optimistically update to the new value
      if (previousNotes && variables.body) {
        const { book_id, chapter_number, content } = variables.body;

        // Book name lookup (would come from API in real scenario)
        const bookNames: Record<number, string> = {
          1: 'Genesis',
          19: 'Psalms',
          40: 'Matthew',
          43: 'John',
        };

        // Add optimistic note (note_id will be set by server)
        const optimisticNote: Note = {
          note_id: `temp-${Date.now()}`, // Temporary ID
          content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          chapter_number,
          book_id,
          book_name: bookNames[book_id] || `Book ${book_id}`,
          verse_number: null,
        };

        queryClient.setQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey, {
          notes: [optimisticNote, ...previousNotes.notes], // Add at beginning (most recent first)
        });
      }

      // Return context for rollback
      return { previousNotes };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousNotes) {
        queryClient.setQueryData(notesQueryKey, context.previousNotes);
      }
      console.error('Failed to add note:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: NOTE_CREATED event (never track note content)
      if (variables.body) {
        analytics.track(AnalyticsEvent.NOTE_CREATED, {
          bookId: variables.body.book_id,
          chapterNumber: variables.body.chapter_number,
        });
      }

      // Refetch to get accurate server data (with correct note_id and book_name)
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  // Update note mutation
  const updateMutation = useMutation({
    ...putBibleBookNoteUpdateMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notesQueryKey });

      // Snapshot previous value for rollback
      const previousNotes =
        queryClient.getQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey);

      // Optimistically update to the new value
      if (previousNotes && variables.body) {
        const { note_id, content } = variables.body;

        queryClient.setQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey, {
          notes: previousNotes.notes.map((note) =>
            note.note_id === note_id
              ? {
                  ...note,
                  content,
                  updated_at: new Date().toISOString(),
                }
              : note
          ),
        });
      }

      // Return context for rollback
      return { previousNotes };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousNotes) {
        queryClient.setQueryData(notesQueryKey, context.previousNotes);
      }
      console.error('Failed to update note:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: NOTE_EDITED event (never track note content)
      if (variables.body) {
        analytics.track(AnalyticsEvent.NOTE_EDITED, {
          noteId: variables.body.note_id,
        });
      }

      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  // Delete note mutation
  const deleteMutation = useMutation({
    ...deleteBibleBookNoteRemoveMutation(),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notesQueryKey });

      // Snapshot previous value for rollback
      const previousNotes =
        queryClient.getQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey);

      // Optimistically update to the new value
      if (previousNotes && variables.query) {
        const { note_id } = variables.query;

        queryClient.setQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey, {
          notes: previousNotes.notes.filter((note) => note.note_id !== note_id),
        });
      }

      // Return context for rollback
      return { previousNotes };
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousNotes) {
        queryClient.setQueryData(notesQueryKey, context.previousNotes);
      }
      console.error('Failed to delete note:', error);
    },
    onSuccess: (_data, variables) => {
      // Track analytics: NOTE_DELETED event
      if (variables.query) {
        analytics.track(AnalyticsEvent.NOTE_DELETED, {
          noteId: variables.query.note_id,
        });
      }

      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  /**
   * Get notes filtered by chapter
   */
  const getNotesByChapter = (bookId: number, chapterNumber: number): Note[] => {
    return notes.filter((note) => note.book_id === bookId && note.chapter_number === chapterNumber);
  };

  /**
   * Check if a chapter has any notes
   */
  const hasNotes = (bookId: number, chapterNumber: number): boolean => {
    return notes.some((note) => note.book_id === bookId && note.chapter_number === chapterNumber);
  };

  /**
   * Add a note with optimistic update
   */
  const addNote = async (
    bookId: number,
    chapterNumber: number,
    content: string
  ): Promise<Note | null> => {
    // Check authentication
    if (!isAuthenticated || !user?.id) {
      console.error('User must be authenticated to add notes');
      return null;
    }

    // Validate content
    if (!content.trim()) {
      console.error('Note content cannot be empty');
      return null;
    }

    // Call mutation
    const response = await addMutation.mutateAsync({
      body: {
        user_id: user.id,
        book_id: bookId,
        chapter_number: chapterNumber,
        content: content.trim(),
      },
    } as PostBibleBookNoteAddData);

    if (response?.note) {
      return {
        note_id: response.note.note_id,
        content: response.note.content,
        created_at: response.note.created_at,
        updated_at: response.note.updated_at,
        book_id: bookId,
        chapter_number: chapterNumber,
        book_name: '', // Will be populated by UI context
        verse_number: typeof response.note.verse_id === 'number' ? response.note.verse_id : null,
      };
    }

    return null;
  };

  /**
   * Update a note with optimistic update
   */
  const updateNote = async (noteId: string, content: string): Promise<void> => {
    // Check authentication
    if (!isAuthenticated || !user?.id) {
      console.error('User must be authenticated to update notes');
      return;
    }

    // Validate content
    if (!content.trim()) {
      console.error('Note content cannot be empty');
      return;
    }

    // Call mutation
    await updateMutation.mutateAsync({
      body: {
        note_id: noteId,
        content: content.trim(),
      },
    } as PutBibleBookNoteUpdateData);
  };

  /**
   * Delete a note with optimistic update
   */
  const deleteNote = async (noteId: string): Promise<void> => {
    // Check authentication
    if (!isAuthenticated || !user?.id) {
      console.error('User must be authenticated to delete notes');
      return;
    }

    // Call mutation
    await deleteMutation.mutateAsync({
      query: {
        note_id: noteId,
      },
    } as DeleteBibleBookNoteRemoveData);
  };

  /**
   * Manually refetch notes from API
   */
  const refetchNotes = async (): Promise<void> => {
    if (isAuthenticated && user?.id) {
      await refetch();
    }
  };

  // Combine auth and query loading states
  // Loading if:
  // 1. Auth is still loading, OR
  // 2. Query is actively fetching, OR
  // 3. Auth is loaded but query hasn't fetched yet (dataUpdatedAt === 0)
  const isFetchingNotes =
    isAuthLoading || isQueryFetching || (isAuthenticated && dataUpdatedAt === 0);

  return {
    notes,
    isFetchingNotes,
    isAddingNote: addMutation.isPending,
    isUpdatingNote: updateMutation.isPending,
    isDeletingNote: deleteMutation.isPending,
    addNote,
    updateNote,
    deleteNote,
    getNotesByChapter,
    hasNotes,
    refetchNotes,
  };
}
