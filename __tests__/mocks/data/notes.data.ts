/**
 * Mock Data for Notes API
 *
 * Sample notes for testing notes functionality across multiple chapters
 */

import type {
  DeleteBibleBookNoteRemoveResponse,
  GetBibleBookNotesByUserIdResponse,
  PostBibleBookNoteAddResponse,
  PutBibleBookNoteUpdateResponse,
} from '@/src/api/generated/types.gen';

/**
 * Mock user ID for testing
 */
export const MOCK_USER_ID = 'test-user-123';

/**
 * Sample notes for multiple chapters
 * Genesis 1, John 3, Psalms 23, Matthew 5
 */
export const mockNotes: GetBibleBookNotesByUserIdResponse['notes'] = [
  {
    note_id: 'note-1',
    content: 'In the beginning God created the heavens and the earth. This is a profound opening.',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  },
  {
    note_id: 'note-2',
    content: 'Another reflection on Genesis 1 about the creation days.',
    created_at: '2024-01-16T14:30:00Z',
    updated_at: '2024-01-16T14:30:00Z',
    chapter_number: 1,
    book_id: 1,
    book_name: 'Genesis',
    verse_number: null,
  },
  {
    note_id: 'note-3',
    content: 'For God so loved the world - what an amazing expression of divine love!',
    created_at: '2024-01-20T09:15:00Z',
    updated_at: '2024-01-20T09:15:00Z',
    chapter_number: 3,
    book_id: 43,
    book_name: 'John',
    verse_number: null,
  },
  {
    note_id: 'note-4',
    content: 'The Lord is my shepherd - comfort in times of need.',
    created_at: '2024-01-22T16:45:00Z',
    updated_at: '2024-01-22T16:45:00Z',
    chapter_number: 23,
    book_id: 19,
    book_name: 'Psalms',
    verse_number: null,
  },
  {
    note_id: 'note-5',
    content: 'The Sermon on the Mount teachings are revolutionary.',
    created_at: '2024-01-25T11:20:00Z',
    updated_at: '2024-01-25T11:20:00Z',
    chapter_number: 5,
    book_id: 40,
    book_name: 'Matthew',
    verse_number: null,
  },
];

/**
 * Full response structure for GET notes
 */
export const mockNotesResponse: GetBibleBookNotesByUserIdResponse = {
  notes: mockNotes,
};

/**
 * Empty notes response for new users
 */
export const mockEmptyNotesResponse: GetBibleBookNotesByUserIdResponse = {
  notes: [],
};

/**
 * Sample successful add note response
 */
export const mockAddNoteResponse: PostBibleBookNoteAddResponse = {
  success: true,
  note: {
    note_id: 'note-new',
    user_id: MOCK_USER_ID,
    chapter_id: 1,
    verse_id: null,
    content: 'New test note content',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

/**
 * Sample successful update note response
 */
export const mockUpdateNoteResponse: PutBibleBookNoteUpdateResponse = {
  success: true,
};

/**
 * Sample successful delete note response
 */
export const mockDeleteNoteResponse: DeleteBibleBookNoteRemoveResponse = {
  success: true,
};
