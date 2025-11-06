/**
 * Type Definitions for Notes Feature
 *
 * TypeScript interfaces and types for notes functionality including API responses,
 * draft storage, and grouped data structures.
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md
 */

import type { GetBibleBookNotesByUserIdResponse } from '@/src/api/generated/types.gen';

/**
 * Note item type from API response
 *
 * Represents a single note with all metadata including:
 * - Unique identifier (note_id)
 * - Content text
 * - Timestamps (created_at, updated_at)
 * - Chapter reference (book_id, chapter_number, book_name)
 * - Optional verse reference (verse_number)
 */
export type Note = GetBibleBookNotesByUserIdResponse['notes'][number];

/**
 * Grouped notes structure organized by chapter
 *
 * Used to display notes grouped by their chapter in the notes list screen.
 * Each entry contains chapter metadata and an array of associated notes.
 *
 * @example
 * ```typescript
 * const groupedNotes: NotesByChapter = {
 *   "1-1": { // Key format: "{bookId}-{chapterNumber}"
 *     bookId: 1,
 *     chapterNumber: 1,
 *     bookName: "Genesis",
 *     notes: [note1, note2, note3]
 *   }
 * };
 * ```
 */
export interface NotesByChapter {
  [key: string]: {
    bookId: number;
    chapterNumber: number;
    bookName: string;
    notes: Note[];
  };
}

/**
 * Draft note structure for AsyncStorage persistence
 *
 * Stores note content and metadata temporarily when user navigates away
 * without saving. Enables draft restoration when user returns to edit mode.
 *
 * Storage key format: `note_draft_{chapter_id}_{note_id}`
 * - For new notes: `note_draft_{chapter_id}_new`
 * - For editing: `note_draft_{chapter_id}_{note_id}`
 */
export interface NoteDraft {
  /** Draft content text */
  content: string;

  /** Timestamp when draft was last saved */
  savedAt: string;

  /** Book ID for chapter reference */
  bookId: number;

  /** Chapter number for chapter reference */
  chapterNumber: number;

  /** Note ID (undefined for new notes) */
  noteId?: string;
}
