import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
import { colors } from '@/constants/bible-design-tokens';
import type { AutoHighlight } from '@/types/auto-highlights';

// Mock AutoHighlight data
const mockAutoHighlight: AutoHighlight = {
  auto_highlight_id: 1, // Added
  book_id: 43, // Changed from 'JHN' to a number
  chapter_number: 3,
  start_verse: 16,
  end_verse: 16,
  theme_id: 1, // Changed from 'love' to a number
  theme_name: 'Gods Love',
  theme_color: 'yellow',
  relevance_score: 5,

  created_at: '2023-01-01T12:00:00Z', // Added
};

describe('AutoHighlightTooltip', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    render(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    expect(screen.getByText('Gods Love')).toBeTruthy();
    expect(screen.getByText('AI-generated highlight')).toBeTruthy();
    expect(screen.getByText('Verse 16')).toBeTruthy();
  });

  it('does not render when autoHighlight is null', () => {
    render(
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
    render(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={true}
      />
    );

    const saveButton = screen.getByText('Save as My Highlight');
    fireEvent.press(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith('yellow', { start: 16, end: 16 });
    // onClose is called after animation, which we can't easily test without waiting or mocking timers
    // But we can check if the dismiss logic was triggered (which eventually calls onClose)
  });

  it('shows login prompt when not logged in', () => {
    render(
      <AutoHighlightTooltip
        autoHighlight={mockAutoHighlight}
        visible={true}
        onClose={mockOnClose}
        onSaveAsUserHighlight={mockOnSave}
        isLoggedIn={false}
      />
    );

    expect(screen.queryByText('Save as My Highlight')).toBeNull();
    expect(screen.getByText('Sign in to save this highlight to your collection')).toBeTruthy();
  });
});
