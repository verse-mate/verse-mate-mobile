/**
 * Tests for BibleInteractionContext
 *
 * Protects Change H1: Deduplicate highlight hooks.
 * Verifies that BibleInteractionProvider exposes the correct data and
 * action API to consumers, and that underlying hooks are called
 * efficiently (once from the provider, not per-consumer).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';
import { BibleInteractionProvider, useBibleInteraction } from '@/contexts/BibleInteractionContext';

// Mock overlay components to avoid Reanimated/GestureHandler deps
jest.mock('@/components/bible/VerseMateTooltip', () => ({
  VerseMateTooltip: () => null,
}));
jest.mock('@/components/bible/AutoHighlightTooltip', () => ({
  AutoHighlightTooltip: () => null,
}));
// The sheet's props, so a test can pick a colour the way the sheet does.
const mockSheetProps: { current: Record<string, any> | null } = { current: null };
jest.mock('@/components/bible/HighlightSelectionSheet', () => ({
  HighlightSelectionSheet: (props: Record<string, any>) => {
    mockSheetProps.current = props;
    return null;
  },
}));
jest.mock('@/components/bible/HighlightEditMenu', () => ({
  HighlightEditMenu: () => null,
}));
jest.mock('@/components/bible/SimpleColorPickerModal', () => ({
  SimpleColorPickerModal: () => null,
}));

// Mock hooks used by the provider
const mockUseHighlights = jest.fn((_bookId: number, _chapterNumber: number) => ({
  chapterHighlights: [{ highlight_id: 1, color: 'yellow' }],
  addHighlight: jest.fn(),
  updateHighlightColor: jest.fn(),
  deleteHighlight: jest.fn(),
}));

jest.mock('@/hooks/bible/use-highlights', () => ({
  useHighlights: (bookId: number, chapterNumber: number) =>
    mockUseHighlights(bookId, chapterNumber),
}));

jest.mock('@/hooks/bible/use-auto-highlights', () => ({
  useAutoHighlights: jest.fn(() => ({
    autoHighlights: [{ id: 'auto-1' }],
  })),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user' },
    isAuthenticated: true,
  })),
}));

jest.mock('@/contexts/ToastContext', () => ({
  useToast: jest.fn(() => ({
    showToast: jest.fn(),
  })),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('BibleInteractionContext', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BibleInteractionProvider bookId={1} chapterNumber={1} bookName="Genesis">
        {children}
      </BibleInteractionProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHighlights.mockReturnValue({
      chapterHighlights: [{ highlight_id: 1, color: 'yellow' }],
      addHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      deleteHighlight: jest.fn(),
    });
  });

  it('[REGRESSION] provides chapterHighlights and autoHighlights to consumers', () => {
    const { result } = renderHook(() => useBibleInteraction(), { wrapper });

    expect(Array.isArray(result.current.chapterHighlights)).toBe(true);
    expect(result.current.chapterHighlights.length).toBeGreaterThan(0);
    expect(Array.isArray(result.current.autoHighlights)).toBe(true);
    expect(result.current.autoHighlights.length).toBeGreaterThan(0);
  });

  it('[REGRESSION] provides mutation functions (addHighlight, updateHighlightColor, deleteHighlight)', () => {
    const { result } = renderHook(() => useBibleInteraction(), { wrapper });

    expect(typeof result.current.addHighlight).toBe('function');
    expect(typeof result.current.updateHighlightColor).toBe('function');
    expect(typeof result.current.deleteHighlight).toBe('function');
  });

  it('[REGRESSION] exposes interaction triggers (openVerseTooltip, closeAll)', () => {
    const { result } = renderHook(() => useBibleInteraction(), { wrapper });

    expect(typeof result.current.openVerseTooltip).toBe('function');
    expect(typeof result.current.closeAll).toBe('function');
    expect(typeof result.current.openAutoHighlightTooltip).toBe('function');
    expect(typeof result.current.openHighlightSelection).toBe('function');
    expect(typeof result.current.openHighlightEditMenu).toBe('function');
  });

  it('[TDD] useHighlights is called exactly once even with multiple context consumers', () => {
    const { View } = require('react-native');
    const { render } = require('@testing-library/react-native');

    // Two children both consuming the context
    function Consumer() {
      useBibleInteraction();
      return null;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <BibleInteractionProvider bookId={1} chapterNumber={1} bookName="Genesis">
          <View>
            <Consumer />
            <Consumer />
          </View>
        </BibleInteractionProvider>
      </QueryClientProvider>
    );

    // useHighlights is called once from the provider, not per-consumer.
    // This verifies the deduplication pattern: data hooks live in the provider,
    // consumers access the context value without triggering additional queries.
    expect(mockUseHighlights).toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION] throws when used outside provider', () => {
    // Suppress console.error for expected error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useBibleInteraction());
    }).toThrow('useBibleInteraction must be used within a BibleInteractionProvider');

    consoleSpy.mockRestore();
  });
  describe('a colour from the highlight sheet', () => {
    const words = { start: 5, end: 5, startChar: 4, endChar: 9 };

    function openSheetAndPick(color: string, scope: string) {
      const addHighlight = jest.fn().mockResolvedValue(undefined);
      mockUseHighlights.mockReturnValue({
        chapterHighlights: [],
        addHighlight,
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
      });
      const { result } = renderHook(() => useBibleInteraction(), { wrapper });
      act(() => result.current.openHighlightSelection(words, 'light'));
      return { addHighlight, pick: () => mockSheetProps.current?.onColorSelect(color, scope) };
    }

    it('highlights exactly the selected words for "Selection"', async () => {
      const { addHighlight, pick } = openSheetAndPick('green', 'selection');
      await act(async () => {
        await pick();
      });
      expect(addHighlight).toHaveBeenCalledWith(
        expect.objectContaining({
          startVerse: 5,
          endVerse: 5,
          startChar: 4,
          endChar: 9,
          color: 'green',
          selectedText: 'light',
        })
      );
    });

    it('highlights the whole verse, no character range, for "Whole verse"', async () => {
      const { addHighlight, pick } = openSheetAndPick('blue', 'verse');
      await act(async () => {
        await pick();
      });
      const params = addHighlight.mock.calls[0][0];
      expect(params).toMatchObject({ startVerse: 5, endVerse: 5, color: 'blue' });
      expect(params.startChar).toBeUndefined();
      expect(params.endChar).toBeUndefined();
    });
  });
});
