/**
 * Tests for BibleInteractionContext
 *
 * Protects Change H1: Deduplicate highlight hooks.
 * Verifies that BibleInteractionProvider exposes the correct data and
 * action API to consumers, and that underlying hooks are called
 * efficiently (once from the provider, not per-consumer).
 */

import { renderHook } from '@testing-library/react-native';
import type React from 'react';
import { BibleInteractionProvider, useBibleInteraction } from '@/contexts/BibleInteractionContext';

// Mock overlay components to avoid Reanimated/GestureHandler deps
jest.mock('@/components/bible/VerseMateTooltip', () => ({
  VerseMateTooltip: () => null,
}));
jest.mock('@/components/bible/AutoHighlightTooltip', () => ({
  AutoHighlightTooltip: () => null,
}));
jest.mock('@/components/bible/HighlightSelectionSheet', () => ({
  HighlightSelectionSheet: () => null,
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
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BibleInteractionProvider bookId={1} chapterNumber={1} bookName="Genesis">
      {children}
    </BibleInteractionProvider>
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
      <BibleInteractionProvider bookId={1} chapterNumber={1} bookName="Genesis">
        <View>
          <Consumer />
          <Consumer />
        </View>
      </BibleInteractionProvider>
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
});
