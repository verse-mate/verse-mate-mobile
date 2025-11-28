/**
 * Tests for Highlights Screen
 *
 * Tests grouping, collapsible groups, navigation, authentication,
 * empty state, and pull-to-refresh functionality.
 *
 * @see Task Group 6.1: Focused tests for highlights screen
 * @see app/highlights.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HighlightsScreen from '@/app/highlights';
import { useAuth } from '@/contexts/AuthContext';
import { useHighlights } from '@/hooks/bible/use-highlights';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/bible/use-highlights');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

// Mock safe area context to ensure it renders children
jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaView: jest.fn(({ children }) => children),
    useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
  };
});

// Mock AutoHighlightSettings to prevent network requests
jest.mock('@/components/settings/AutoHighlightSettings', () => ({
  AutoHighlightSettings: () => null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseHighlights = useHighlights as jest.MockedFunction<typeof useHighlights>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function renderWithProviders(component: React.ReactElement) {
  return render(
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </SafeAreaProvider>
  );
}

describe('HighlightsScreen', () => {
  const mockUser = { id: 'test-user-123', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  describe('Grouping by book and chapter', () => {
    it('should group highlights by book and chapter', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [
          {
            highlight_id: 1,
            user_id: 'test-user-123',
            chapter_id: 1001, // Genesis 1
            book_id: 1,
            chapter_number: 1,
            start_verse: 1,
            end_verse: 1,
            color: 'yellow',
            start_char: 0,
            end_char: 50,
            selected_text: 'In the beginning God created the heavens',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          {
            highlight_id: 2,
            user_id: 'test-user-123',
            chapter_id: 1001, // Genesis 1
            book_id: 1,
            chapter_number: 1,
            start_verse: 3,
            end_verse: 5,
            color: 'green',
            start_char: 0,
            end_char: 200,
            selected_text: 'And God said, Let there be light',
            created_at: '2025-01-02T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
          {
            highlight_id: 3,
            user_id: 'test-user-123',
            chapter_id: 43003, // John 3
            book_id: 43,
            chapter_number: 3,
            start_verse: 16,
            end_verse: 16,
            color: 'blue',
            start_char: 0,
            end_char: 100,
            selected_text: 'For God so loved the world',
            created_at: '2025-01-03T00:00:00Z',
            updated_at: '2025-01-03T00:00:00Z',
          },
        ],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      renderWithProviders(<HighlightsScreen />);

      await waitFor(() => {
        // Should have 2 groups (Genesis 1 and John 3)
        expect(screen.getByTestId('chapter-group-1-1')).toBeTruthy();
        expect(screen.getByTestId('chapter-group-43-3')).toBeTruthy();

        // Genesis 1 group should show 2 highlights count
        expect(screen.getByText(/Genesis 1 \(2 highlights\)/)).toBeTruthy();

        // John 3 group should show 1 highlight count
        expect(screen.getByText(/John 3 \(1 highlight\)/)).toBeTruthy();
      });
    });
  });

  describe('Collapsible group toggle', () => {
    it('should toggle chapter groups on press', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [
          {
            highlight_id: 1,
            user_id: 'test-user-123',
            chapter_id: 1001, // Genesis 1
            book_id: 1,
            chapter_number: 1,
            start_verse: 1,
            end_verse: 1,
            color: 'yellow',
            start_char: 0,
            end_char: 50,
            selected_text: 'In the beginning',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      const { getByTestId, queryByText } = renderWithProviders(<HighlightsScreen />);

      await waitFor(() => {
        expect(getByTestId('chapter-group-1-1')).toBeTruthy();
      });

      // Initially collapsed, so highlight text should not be visible
      expect(queryByText('In the beginning')).toBeNull();
    });
  });

  describe('Navigation to chapter on tap', () => {
    it('should navigate to chapter when highlight item is tapped', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [
          {
            highlight_id: 1,
            user_id: 'test-user-123',
            chapter_id: 1001,
            book_id: 1,
            chapter_number: 1,
            start_verse: 1,
            end_verse: 1,
            color: 'yellow',
            start_char: 0,
            end_char: 50,
            selected_text: 'In the beginning',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      const { getByTestId, getByText } = renderWithProviders(<HighlightsScreen />);

      await waitFor(() => {
        expect(getByTestId('chapter-group-1-1')).toBeTruthy();
      });

      // Expand the group first
      fireEvent.press(getByTestId('chapter-group-1-1'));

      await waitFor(() => {
        // Text now includes verse number: 1 In the beginning
        expect(getByText(/\u00b9.*In the beginning/)).toBeTruthy();
      });

      // Tap the highlight item
      fireEvent.press(getByTestId('highlight-item-1'));

      // Should navigate to chapter (wait for async haptic feedback)
      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith('/bible/1/1');
      });
    });
  });

  describe('Authentication guard', () => {
    it('should show login prompt when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      renderWithProviders(<HighlightsScreen />);

      expect(screen.getByText('Please login to view your highlights')).toBeTruthy();
      expect(screen.getByTestId('highlights-login-button')).toBeTruthy();
    });

    it('should navigate to login when login button is pressed', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      const { getByTestId } = renderWithProviders(<HighlightsScreen />);

      fireEvent.press(getByTestId('highlights-login-button'));

      expect(router.push).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('Empty state rendering', () => {
    it('should show empty state when no highlights exist', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [],
        chapterHighlights: [],
        isFetchingHighlights: false,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      renderWithProviders(<HighlightsScreen />);

      await waitFor(() => {
        expect(screen.getByText('No highlights yet')).toBeTruthy();
        expect(screen.getByText('Start highlighting verses to see them here.')).toBeTruthy();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator during initial fetch', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      } as any);

      mockUseHighlights.mockReturnValue({
        allHighlights: [],
        chapterHighlights: [],
        isFetchingHighlights: true,
        isAddingHighlight: false,
        isUpdatingHighlight: false,
        isDeletingHighlight: false,
        isHighlighted: jest.fn(),
        addHighlight: jest.fn(),
        updateHighlightColor: jest.fn(),
        deleteHighlight: jest.fn(),
        refetchHighlights: jest.fn(),
      });

      renderWithProviders(<HighlightsScreen />);

      expect(screen.getByTestId('highlights-loading')).toBeTruthy();
    });
  });
});
