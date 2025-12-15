import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { AutoHighlight } from '@/types/auto-highlights';

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock the hook
jest.mock('@/src/api/generated/hooks', () => ({
  useBibleByLine: jest.fn(() => ({
    data: {
      content:
        '## 3:16\n> For God so loved the world...\n\n### Summary\nGod loved the world so much.',
    },
    isLoading: false,
  })),
}));

// Mock AutoHighlight data
const mockAutoHighlight: AutoHighlight = {
  auto_highlight_id: 1,
  book_id: 43,
  chapter_number: 3,
  start_verse: 16,
  end_verse: 16,
  theme_id: 1,
  theme_name: 'Gods Love',
  theme_color: 'yellow',
  relevance_score: 5,
  created_at: '2023-01-01T12:00:00Z',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('AutoHighlightTooltip', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers to control animations
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders correctly when visible', () => {
    renderWithProviders(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    // Advance timers to complete animations
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByText('Gods Love')).toBeTruthy();
    expect(screen.getByText('Verse 16')).toBeTruthy();
    // Toggle button is hidden for single-verse highlights
    expect(screen.queryByText('View Verse Insight')).toBeNull();
  });

  it('does not render when autoHighlight is null', () => {
    renderWithProviders(
      <AutoHighlightTooltip
        autoHighlight={null}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    expect(screen.queryByText('Gods Love')).toBeNull();
  });

  it('calls onSaveAsUserHighlight when save button is pressed', () => {
    renderWithProviders(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    // Advance timers to complete animations
    act(() => {
      jest.advanceTimersByTime(500);
    });

    const saveButton = screen.getByText('Save as My Highlight');
    fireEvent.press(saveButton);

    // Updated expectation: includes the extracted verse text
    expect(mockOnSave).toHaveBeenCalledWith(
      'yellow',
      { start: 16, end: 16 },
      'For God so loved the world...'
    );
  });

  it('shows login prompt when not logged in', () => {
    renderWithProviders(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={false}
      />
    );

    // Advance timers to complete animations
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Save as My Highlight')).toBeNull();
    expect(screen.getByText('Sign in to save this highlight to your collection')).toBeTruthy();
  });

  it('shows parsed insight when toggle is clicked for multi-verse highlight', () => {
    const multiVerseHighlight = { ...mockAutoHighlight, end_verse: 17 };

    renderWithProviders(
      <AutoHighlightTooltip
        autoHighlight={multiVerseHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    // Advance timers to complete animations
    act(() => {
      jest.advanceTimersByTime(500);
    });

    const toggleButton = screen.getByText('View Verse Insight');

    act(() => {
      fireEvent.press(toggleButton);
      // Advance timers for expansion animation
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByText('Hide Verse Insight')).toBeTruthy();
    expect(screen.getByText(/God loved the world so much/)).toBeTruthy();
  });
});
