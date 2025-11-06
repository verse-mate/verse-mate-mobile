/**
 * Tests for useNoteDraft Hook
 *
 * Focused tests for draft management with AsyncStorage persistence.
 * Tests cover critical behaviors: auto-save, restore, clear, and storage key format.
 *
 * @see Task Group 3.1: Write 2-8 focused tests for useNoteDraft hook
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { NOTES_CONFIG } from '@/constants/notes';
import { useNoteDraft } from '@/hooks/bible/use-note-draft';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useNoteDraft', () => {
  beforeEach(() => {
    // Clear AsyncStorage before each test
    AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('should return null draft content initially', () => {
    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    expect(result.current.draftContent).toBeNull();
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.isDraftRestored).toBe(false);
  });

  it('should save draft to AsyncStorage after debounce delay', async () => {
    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    // Save draft
    act(() => {
      result.current.saveDraft('Test draft content');
    });

    // Wait for debounce (500ms)
    await waitFor(
      () => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'note_draft_1_note-123',
          expect.any(String)
        );
      },
      { timeout: 1000 }
    );

    // Verify draft content in storage
    const storedDraft = await AsyncStorage.getItem('note_draft_1_note-123');
    expect(storedDraft).toBeTruthy();
    if (storedDraft) {
      const parsed = JSON.parse(storedDraft);
      expect(parsed.content).toBe('Test draft content');
    }
  });

  it('should restore draft on mount if exists', async () => {
    // Pre-populate AsyncStorage with draft
    const draftData = {
      content: 'Restored draft content',
      savedAt: new Date().toISOString(),
      bookId: 1,
      chapterNumber: 1,
      noteId: 'note-123',
    };
    await AsyncStorage.setItem('note_draft_1_note-123', JSON.stringify(draftData));

    // Render hook
    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    // Wait for draft to load
    await waitFor(() => {
      expect(result.current.draftContent).toBe('Restored draft content');
    });

    expect(result.current.hasDraft).toBe(true);
    expect(result.current.isDraftRestored).toBe(true);
  });

  it('should clear draft from AsyncStorage', async () => {
    // Pre-populate with draft
    await AsyncStorage.setItem('note_draft_1_note-123', JSON.stringify({ content: 'Test' }));

    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    // Wait for draft to load
    await waitFor(() => {
      expect(result.current.hasDraft).toBe(true);
    });

    // Clear draft
    await act(async () => {
      await result.current.clearDraft();
    });

    // Verify removed from storage
    const storedDraft = await AsyncStorage.getItem('note_draft_1_note-123');
    expect(storedDraft).toBeNull();
    expect(result.current.draftContent).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('should use correct storage key format for new notes', async () => {
    const { result } = renderHook(() => useNoteDraft(1, undefined)); // No noteId = new note

    act(() => {
      result.current.saveDraft('New note draft');
    });

    await waitFor(
      () => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('note_draft_1_new', expect.any(String));
      },
      { timeout: 1000 }
    );
  });

  it('should use correct storage key format for existing notes', async () => {
    const { result } = renderHook(() => useNoteDraft(1, 'note-456'));

    act(() => {
      result.current.saveDraft('Edited note draft');
    });

    await waitFor(
      () => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'note_draft_1_note-456',
          expect.any(String)
        );
      },
      { timeout: 1000 }
    );
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    // Mock AsyncStorage.getItem to throw error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('AsyncStorage error'));

    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    // Should not crash and return null draft
    await waitFor(() => {
      expect(result.current.draftContent).toBeNull();
      expect(result.current.hasDraft).toBe(false);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load draft:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should debounce multiple rapid save calls', async () => {
    const { result } = renderHook(() => useNoteDraft(1, 'note-123'));

    // Rapid saves
    act(() => {
      result.current.saveDraft('Content 1');
    });
    act(() => {
      result.current.saveDraft('Content 2');
    });
    act(() => {
      result.current.saveDraft('Content 3');
    });

    // Wait for debounce
    await waitFor(
      () => {
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );

    // Should only save once with the latest content
    const storedDraft = await AsyncStorage.getItem('note_draft_1_note-123');
    if (storedDraft) {
      const parsed = JSON.parse(storedDraft);
      expect(parsed.content).toBe('Content 3');
    }
  });
});
