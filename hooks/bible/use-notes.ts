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
import { getBookById } from '@/constants/bible-books';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useToast } from '@/contexts/ToastContext';
import { AnalyticsEvent, analytics } from '@/lib/analytics';
import {
  addLocalNote,
  addSyncAction,
  deleteLocalNote,
  getLocalAllNotes,
  updateLocalNote,
} from '@/services/offline';
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
  const { isUserDataSynced, isOnline } = useOfflineContext();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const isDeviceOffline = !isOnline;

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

  // Fetch notes from API (disabled when offline)
  const {
    data: notesData,
    isFetching: isQueryFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    ...getBibleBookNotesByUserIdOptions(queryOptions),
    enabled: isAuthenticated && !!user?.id && !isDeviceOffline && !isUserDataSynced,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch notes from local storage when offline or just to have fallback
  const { data: localNotesData, isFetching: isLocalFetching } = useQuery({
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
        book_name: getBookById(n.book_id)?.name ?? `Book ${n.book_id}`,
      }));
    },
    enabled: isDeviceOffline || isUserDataSynced, // Enable if offline OR if we have synced data (even if online, for speed?)
    // Actually, just fetch it if needed.
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Extract notes array from response (offline or remote)
  // When user data is synced locally, the remote query is disabled, so we must
  // read from the local cache regardless of network state.
  const notes = useMemo(() => {
    if ((isDeviceOffline || isUserDataSynced) && localNotesData) {
      return localNotesData as Note[];
    }
    return notesData?.notes || [];
  }, [isDeviceOffline, isUserDataSynced, localNotesData, notesData]);

  // Add note mutation
  const addMutation = useMutation({
    ...postBibleBookNoteAddMutation(),
    mutationFn: async (variables) => {
      if (!isOnline) {
        if (!variables.body) throw new Error('Missing body');
        const { book_id, chapter_number, content } = variables.body;
        const tempId = `temp-${Date.now()}`;
        const note = {
          note_id: tempId,
          book_id,
          chapter_number,
          verse_number: null,
          content,
          updated_at: new Date().toISOString(),
        };
        await addLocalNote(note);
        await addSyncAction('NOTE', 'CREATE', variables.body);
        return {
          success: true,
          note: {
            ...note,
            created_at: note.updated_at,
            verse_id: null,
            user_id: user?.id || '',
            chapter_id: book_id * 1000 + chapter_number,
          },
        };
      }
      const fn = postBibleBookNoteAddMutation().mutationFn;
      if (!fn) throw new Error('Mutation function missing');

      // biome-ignore lint/suspicious/noExplicitAny: context required by type
      const response = await fn(variables, undefined as any);

      // NOTES-1: When the user's data is synced locally, the remote notes
      // query is disabled (see line ~139) and the UI reads from the local
      // SQLite cache. A bare POST leaves that cache stale, so the standalone
      // notes screen never sees the new note until the next full sync.
      // Mirror the server-confirmed note into the local cache so consumers
      // that read from `localNotesData` reflect the add immediately.
      if (isUserDataSynced && response?.note && variables.body) {
        try {
          await addLocalNote({
            note_id: response.note.note_id,
            book_id: variables.body.book_id,
            chapter_number: variables.body.chapter_number,
            verse_number:
              typeof response.note.verse_id === 'number' ? response.note.verse_id : null,
            content: response.note.content,
            updated_at: response.note.updated_at,
          });
        } catch (err) {
          // Don't fail the mutation if the local mirror write fails —
          // the server is still the source of truth and invalidateQueries
          // below will eventually reconcile.
          console.warn('[notes] failed to mirror new note into local cache', err);
        }
      }

      return response;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notesQueryKey });

      // Snapshot previous value for rollback
      const previousNotes =
        queryClient.getQueryData<GetBibleBookNotesByUserIdResponse>(notesQueryKey);

      // Optimistically update to the new value
      if (previousNotes && variables.body) {
        const { book_id, chapter_number, content } = variables.body;

        // Add optimistic note (note_id will be set by server)
        const optimisticNote: Note = {
          note_id: `temp-${Date.now()}`, // Temporary ID
          content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          chapter_number,
          book_id,
          book_name: getBookById(book_id)?.name ?? `Book ${book_id}`,
          verse_number: null,
        };

        // If offline, we already added to local DB, so query invalidation will pick it up?
        // No, invalidation only works if we re-run the queryFn.
        // If queryFn is local (isOffline=true), it re-reads local DB.
        // So optimistic update is less critical if we invalidate immediately?
        // But invalidation is async. Optimistic update is still good for instant feedback.

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
      showToast('Failed to save note. Please try again.');
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
      // Also invalidate local query
      queryClient.invalidateQueries({ queryKey: ['local-notes-offline-fallback'] });
    },
  });

  // Update note mutation
  const updateMutation = useMutation({
    ...putBibleBookNoteUpdateMutation(),
    mutationFn: async (variables) => {
      if (!isOnline) {
        if (!variables.body) throw new Error('Missing body');
        const { note_id, content } = variables.body;
        await updateLocalNote(note_id, content);
        await addSyncAction('NOTE', 'UPDATE', variables.body);
        return {
          success: true,
          note: {
            note_id,
            content,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(), // Mock
            user_id: user?.id || '', // Mock
            book_id: 0, // Mock
            chapter_number: 0, // Mock
          },
        };
      }
      const fn = putBibleBookNoteUpdateMutation().mutationFn;
      if (!fn) throw new Error('Mutation function missing');

      // biome-ignore lint/suspicious/noExplicitAny: context required by type
      return fn(variables, undefined as any);
    },
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
      showToast('Failed to update note. Please try again.');
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
      queryClient.invalidateQueries({ queryKey: ['local-notes-offline-fallback'] });
    },
  });

  // Delete note mutation
  const deleteMutation = useMutation({
    ...deleteBibleBookNoteRemoveMutation(),
    mutationFn: async (variables) => {
      if (!isOnline) {
        if (!variables.query) throw new Error('Missing query');
        const { note_id } = variables.query;
        await deleteLocalNote(note_id);
        await addSyncAction('NOTE', 'DELETE', variables.query);
        return { success: true };
      }
      const fn = deleteBibleBookNoteRemoveMutation().mutationFn;
      if (!fn) throw new Error('Mutation function missing');

      // biome-ignore lint/suspicious/noExplicitAny: context required by type
      return fn(variables, undefined as any);
    },
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
      showToast('Failed to delete note. Please try again.');
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
      queryClient.invalidateQueries({ queryKey: ['local-notes-offline-fallback'] });
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
  // 2. Query is actively fetching (remote or local), OR
  // 3. Auth is loaded, we are online, data not yet synced, and query hasn't fetched yet (dataUpdatedAt === 0)
  const isFetchingNotes =
    isAuthLoading ||
    isQueryFetching ||
    isLocalFetching ||
    (isAuthenticated && !isDeviceOffline && !isUserDataSynced && dataUpdatedAt === 0);

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
