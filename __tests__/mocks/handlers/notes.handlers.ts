/**
 * MSW Handlers for Notes API
 *
 * Mock handlers for all notes-related endpoints with in-memory store
 */

import { HttpResponse, http } from 'msw';
import type {
  DeleteBibleBookNoteRemoveData,
  DeleteBibleBookNoteRemoveResponse,
  GetBibleBookNotesByUserIdResponse,
  PostBibleBookNoteAddData,
  PostBibleBookNoteAddResponse,
  PutBibleBookNoteUpdateData,
  PutBibleBookNoteUpdateResponse,
} from '@/src/api/generated/types.gen';
import { MOCK_USER_ID, mockNotesResponse } from '../data/notes.data';

// API Base URL - matches the generated client default
const BIBLE_API_BASE_URL = 'https://api.verse-mate.apegro.dev';

/**
 * In-memory note store for testing
 * This allows tests to add/update/remove notes and see the changes
 */
let noteStore = [...mockNotesResponse.notes];
let nextNoteId = 1000; // Start with high number to avoid conflicts

/**
 * Helper to reset note store to initial state
 */
export function resetNotesStore() {
  noteStore = [...mockNotesResponse.notes];
  nextNoteId = 1000;
}

/**
 * Helper to clear all notes
 */
export function clearNotesStore() {
  noteStore = [];
  nextNoteId = 1000;
}

/**
 * Helper to add note to store (for test setup)
 */
export function addToNotesStore(
  bookId: number,
  chapterNumber: number,
  bookName: string,
  content: string
) {
  const newNote: GetBibleBookNotesByUserIdResponse['notes'][number] = {
    note_id: `note-${nextNoteId++}`,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    chapter_number: chapterNumber,
    book_id: bookId,
    book_name: bookName,
    verse_number: null,
  };

  noteStore.push(newNote);
  return newNote;
}

/**
 * GET /bible/book/notes/:user_id
 * Returns user's notes across all chapters
 */
export const getNotesByUserIdHandler = http.get(
  `${BIBLE_API_BASE_URL}/bible/book/notes/:user_id`,
  ({ params }) => {
    const { user_id } = params;

    // Validate user_id
    if (!user_id) {
      return HttpResponse.json({ message: 'User ID is required', data: null }, { status: 400 });
    }

    // Return notes for the user
    const response: GetBibleBookNotesByUserIdResponse = {
      notes: noteStore,
    };

    return HttpResponse.json(response);
  }
);

/**
 * POST /bible/book/note/add
 * Creates a new note for a chapter
 */
export const addNoteHandler = http.post(
  `${BIBLE_API_BASE_URL}/bible/book/note/add`,
  async ({ request }) => {
    const body = (await request.json()) as PostBibleBookNoteAddData['body'];

    // Validate request
    if (!body.user_id || !body.book_id || !body.chapter_number || !body.content) {
      return HttpResponse.json({ message: 'Missing required fields', data: null }, { status: 400 });
    }

    // Validate content is not empty (trimmed)
    if (body.content.trim().length === 0) {
      return HttpResponse.json({ message: 'Content cannot be empty', data: null }, { status: 400 });
    }

    // Create new note
    const noteId = `note-${nextNoteId++}`;
    const now = new Date().toISOString();

    // Note: In real API, book_name and chapter_id would be looked up from database
    // For testing, we'll use generic values or lookup from existing notes
    const bookNames: Record<number, string> = {
      1: 'Genesis',
      19: 'Psalms',
      40: 'Matthew',
      43: 'John',
    };

    const newNote: GetBibleBookNotesByUserIdResponse['notes'][number] = {
      note_id: noteId,
      content: body.content,
      created_at: now,
      updated_at: now,
      chapter_number: body.chapter_number,
      book_id: body.book_id,
      book_name: bookNames[body.book_id] || `Book ${body.book_id}`,
      verse_number: body.verse_id || null,
    };

    noteStore.push(newNote);

    const response: PostBibleBookNoteAddResponse = {
      success: true,
      note: {
        note_id: noteId,
        user_id: body.user_id,
        chapter_id: body.book_id * 1000 + body.chapter_number, // Mock chapter_id
        verse_id: body.verse_id || null,
        content: body.content,
        created_at: now,
        updated_at: now,
      },
    };

    return HttpResponse.json(response);
  }
);

/**
 * PUT /bible/book/note/update
 * Updates an existing note's content
 */
export const updateNoteHandler = http.put(
  `${BIBLE_API_BASE_URL}/bible/book/note/update`,
  async ({ request }) => {
    const body = (await request.json()) as PutBibleBookNoteUpdateData['body'];

    // Validate request
    if (!body.note_id || !body.content) {
      return HttpResponse.json({ message: 'Missing required fields', data: null }, { status: 400 });
    }

    // Validate content is not empty (trimmed)
    if (body.content.trim().length === 0) {
      return HttpResponse.json({ message: 'Content cannot be empty', data: null }, { status: 400 });
    }

    // Find note in store
    const noteIndex = noteStore.findIndex((n) => n.note_id === body.note_id);

    if (noteIndex === -1) {
      return HttpResponse.json({ message: 'Note not found', data: null }, { status: 404 });
    }

    // Update note
    noteStore[noteIndex] = {
      ...noteStore[noteIndex],
      content: body.content,
      updated_at: new Date().toISOString(),
    };

    const response: PutBibleBookNoteUpdateResponse = {
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * DELETE /bible/book/note/remove
 * Deletes a note
 */
export const deleteNoteHandler = http.delete(
  `${BIBLE_API_BASE_URL}/bible/book/note/remove`,
  ({ request }) => {
    const url = new URL(request.url);
    const note_id = url.searchParams.get('note_id');

    // Validate request
    if (!note_id) {
      return HttpResponse.json(
        { message: 'Missing note_id query parameter', data: null },
        { status: 400 }
      );
    }

    // Find note in store
    const noteIndex = noteStore.findIndex((n) => n.note_id === note_id);

    if (noteIndex === -1) {
      return HttpResponse.json({ message: 'Note not found', data: null }, { status: 404 });
    }

    // Remove note from store
    noteStore.splice(noteIndex, 1);

    const response: DeleteBibleBookNoteRemoveResponse = {
      success: true,
    };

    return HttpResponse.json(response);
  }
);

/**
 * All notes API handlers
 */
export const notesHandlers = [
  getNotesByUserIdHandler,
  addNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
];
