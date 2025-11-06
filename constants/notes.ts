/**
 * Notes Feature Configuration
 *
 * Configuration constants for the notes functionality including character limits,
 * draft storage settings, and display thresholds.
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md
 */

/**
 * Notes configuration object with all feature constants
 *
 * Usage:
 * - Character limit enforcement in text inputs
 * - Draft auto-save configuration
 * - Preview text truncation
 * - Character counter display threshold
 */
export const NOTES_CONFIG = {
  /** Maximum content length in characters (frontend limit) */
  MAX_CONTENT_LENGTH: 5000,

  /** Character count threshold to display counter (shows at 4500+) */
  COUNTER_DISPLAY_THRESHOLD: 4500,

  /** Storage key prefix for AsyncStorage draft persistence */
  DRAFT_STORAGE_KEY: 'note_draft_',

  /** Debounce delay in milliseconds for draft auto-save */
  DRAFT_DEBOUNCE_MS: 500,

  /** Preview text truncation length for note cards */
  PREVIEW_TRUNCATE_LENGTH: 100,
} as const;

/**
 * Type-safe access to notes config keys
 */
export type NotesConfigKey = keyof typeof NOTES_CONFIG;
