/**
 * useNoteDraft Hook
 *
 * Manages draft note persistence using AsyncStorage with debounced auto-save.
 * Provides methods to save, restore, and clear note drafts.
 *
 * Features:
 * - Auto-save draft to AsyncStorage with 500ms debounce
 * - Restore draft on mount if exists
 * - Clear draft from storage
 * - Loading and restoration state tracking
 *
 * Storage key format:
 * - New notes: `note_draft_{chapterId}_new`
 * - Existing notes: `note_draft_{chapterId}_{noteId}`
 *
 * @example
 * ```tsx
 * const {
 *   draftContent,
 *   hasDraft,
 *   isDraftRestored,
 *   saveDraft,
 *   clearDraft,
 * } = useNoteDraft(1, 'note-123');
 *
 * // Save draft (debounced 500ms)
 * saveDraft('Draft content');
 *
 * // Clear draft
 * await clearDraft();
 * ```
 *
 * @see Spec: agent-os/specs/2025-11-05-notes-functionality/spec.md (lines 113-119)
 * @see Task Group 3: Draft Management Hook
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { NOTES_CONFIG } from '@/constants/notes';
import type { NoteDraft } from '@/types/notes';

/**
 * Return type for useNoteDraft hook
 */
export interface UseNoteDraftResult {
  /** Current draft content (null if no draft) */
  draftContent: string | null;
  /** Whether a draft exists */
  hasDraft: boolean;
  /** Whether draft was restored from storage (for showing "Draft restored" banner) */
  isDraftRestored: boolean;
  /** Save draft to AsyncStorage (debounced 500ms) */
  saveDraft: (content: string) => void;
  /** Clear draft from AsyncStorage */
  clearDraft: () => Promise<void>;
}

/**
 * Hook to manage note draft persistence
 *
 * @param chapterId - Chapter ID (used for storage key)
 * @param noteId - Note ID (undefined for new notes)
 * @returns {UseNoteDraftResult} Draft state and control functions
 */
export function useNoteDraft(chapterId: number, noteId?: string): UseNoteDraftResult {
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate storage key
  const storageKey = `${NOTES_CONFIG.DRAFT_STORAGE_KEY}${chapterId}_${noteId || 'new'}`;

  /**
   * Load draft from AsyncStorage on mount
   */
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const storedDraft = await AsyncStorage.getItem(storageKey);
        if (storedDraft) {
          const draft: NoteDraft = JSON.parse(storedDraft);
          setDraftContent(draft.content);
          setIsDraftRestored(true);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [storageKey]);

  /**
   * Save draft to AsyncStorage (debounced)
   */
  const saveDraft = (content: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Update local state immediately
    setDraftContent(content);

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const draft: NoteDraft = {
          content,
          savedAt: new Date().toISOString(),
          bookId: Math.floor(chapterId / 1000), // Extract bookId (would come from parent)
          chapterNumber: chapterId % 1000, // Extract chapterNumber (would come from parent)
          noteId,
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(draft));
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, NOTES_CONFIG.DRAFT_DEBOUNCE_MS);
  };

  /**
   * Clear draft from AsyncStorage
   */
  const clearDraft = async () => {
    try {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      await AsyncStorage.removeItem(storageKey);
      setDraftContent(null);
      setIsDraftRestored(false);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    draftContent,
    hasDraft: draftContent !== null && draftContent.length > 0,
    isDraftRestored,
    saveDraft,
    clearDraft,
  };
}
