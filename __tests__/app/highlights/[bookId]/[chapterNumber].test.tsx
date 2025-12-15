import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChapterHighlightsScreen from '@/app/highlights/[bookId]/[chapterNumber]';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useHighlights } from '@/hooks/bible/use-highlights';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

const mockUseLocalSearchParams = require('expo-router').useLocalSearchParams;

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
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{component}</ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

describe('ChapterHighlightsScreen', () => {
  const mockHighlights = [
    {
      highlight_id: 1,
      user_id: 'test-user-123',
      chapter_id: 1001,
      book_id: 1,
      chapter_number: 1,
      start_verse: 1,
      end_verse: 1,
      color: 'yellow' as HighlightColor,
      start_char: 0,
      end_char: 50,
      selected_text: 'In the beginning God created the heavens',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      highlight_id: 2,
      user_id: 'test-user-123',
      chapter_id: 1001,
      book_id: 1,
      chapter_number: 1,
      start_verse: 3,
      end_verse: 5,
      color: 'green' as HighlightColor,
      start_char: 0,
      end_char: 200,
      selected_text: 'And God said, Let there be light',
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();

    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-123' },
      isAuthenticated: true,
      isLoading: false,
    } as any);

    mockUseHighlights.mockReturnValue({
      allHighlights: [],
      chapterHighlights: mockHighlights as any,
      isFetchingHighlights: false,
      refetchHighlights: jest.fn(),
      isAddingHighlight: false,
      isUpdatingHighlight: false,
      isDeletingHighlight: false,
      isHighlighted: jest.fn(),
      addHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      deleteHighlight: jest.fn(),
    });
  });

  it('renders header with correct book and chapter', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    expect(screen.getByText('Genesis 1')).toBeTruthy();
  });

  it('renders all highlights for the chapter', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    await waitFor(() => {
      // Check for titles
      expect(screen.getByText('Genesis 1:1')).toBeTruthy();
      expect(screen.getByText('Genesis 1:3-5')).toBeTruthy();
      // Check for content
      expect(screen.getByText('In the beginning God created the heavens')).toBeTruthy();
      expect(screen.getByText('And God said, Let there be light')).toBeTruthy();
    });
  });

  it('navigates to chapter reading view when highlight is pressed', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    await waitFor(() => {
      const highlightItem = screen.getByText('In the beginning God created the heavens');
      fireEvent.press(highlightItem);
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/bible/[bookId]/[chapterNumber]',
      params: { bookId: 1, chapterNumber: 1, verse: 1, endVerse: 1 },
    });
  });

  it('navigates back when back button is pressed', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    const backButton = screen.getByLabelText('Go back');
    fireEvent.press(backButton);
    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });

  it('shows empty state if no highlights exist for the chapter', async () => {
    mockUseHighlights.mockReturnValue({
      allHighlights: [],
      chapterHighlights: [],
      isFetchingHighlights: false,
      refetchHighlights: jest.fn(),
      isAddingHighlight: false,
      isUpdatingHighlight: false,
      isDeletingHighlight: false,
      isHighlighted: jest.fn(),
      addHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      deleteHighlight: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No highlights found')).toBeTruthy();
    });
  });

  it('shows loading indicator when fetching highlights', async () => {
    mockUseHighlights.mockReturnValue({
      allHighlights: [],
      chapterHighlights: [],
      isFetchingHighlights: true,
      refetchHighlights: jest.fn(),
      isAddingHighlight: false,
      isUpdatingHighlight: false,
      isDeletingHighlight: false,
      isHighlighted: jest.fn(),
      addHighlight: jest.fn(),
      updateHighlightColor: jest.fn(),
      deleteHighlight: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({
      bookId: '1',
      chapterNumber: '1',
      bookName: 'Genesis',
    });
    renderWithProviders(<ChapterHighlightsScreen />);
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });
});
