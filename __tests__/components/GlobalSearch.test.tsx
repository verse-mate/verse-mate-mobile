import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { GlobalSearch } from '@/components/GlobalSearch';

const mockSearchResults = [
  {
    bookId: 1,
    bookName: 'Genesis',
    chapter: 1,
    verse: 1,
    text: 'In the beginning God created the heavens and the earth.',
    testament: 'old' as const,
  },
  {
    bookId: 43,
    bookName: 'John',
    chapter: 3,
    verse: 16,
    text: 'For God so loved the world that he gave his one and only Son.',
    testament: 'new' as const,
  },
];

describe('GlobalSearch', () => {
  const mockOnSearchResults = jest.fn();
  const mockOnResultSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render search input with placeholder', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByPlaceholderText('Search Bible verses...')).toBeTruthy();
    });

    it('should show search icon', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByTestId('search-icon')).toBeTruthy();
    });

    it('should show clear button when there is input', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'God');

      expect(screen.getByTestId('clear-search-button')).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('should debounce search input', async () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      const searchInput = screen.getByTestId('search-input');

      fireEvent.changeText(searchInput, 'G');
      fireEvent.changeText(searchInput, 'Go');
      fireEvent.changeText(searchInput, 'God');

      // Fast forward debounce delay
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnSearchResults).toHaveBeenCalledTimes(1);
        expect(mockOnSearchResults).toHaveBeenCalledWith('God');
      });
    });

    it('should not search for queries shorter than 3 characters', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'Go');

      jest.advanceTimersByTime(300);

      expect(mockOnSearchResults).not.toHaveBeenCalled();
    });

    it('should clear search when clear button is pressed', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'God');

      const clearButton = screen.getByTestId('clear-search-button');
      fireEvent.press(clearButton);

      expect(searchInput.props.value).toBe('');
    });
  });

  describe('Search Results', () => {
    it('should display search results when available', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      expect(screen.getByText('Genesis 1:1')).toBeTruthy();
      expect(screen.getByText('John 3:16')).toBeTruthy();
      expect(screen.getByText('In the beginning God created the heavens and the earth.')).toBeTruthy();
    });

    it('should handle result selection', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      fireEvent.press(screen.getByTestId('search-result-0'));

      expect(mockOnResultSelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it('should show testament indicators for results', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      expect(screen.getByText('OT')).toBeTruthy(); // Old Testament indicator
      expect(screen.getByText('NT')).toBeTruthy(); // New Testament indicator
    });

    it('should highlight search terms in results', () => {
      const resultsWithHighlight = [
        {
          ...mockSearchResults[0],
          text: 'In the beginning <mark>God</mark> created the heavens and the earth.',
        },
      ];

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={resultsWithHighlight}
          searchQuery="God"
        />
      );

      expect(screen.getByTestId('highlighted-text-0')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when searching', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          loading={true}
        />
      );

      expect(screen.getByTestId('search-loading')).toBeTruthy();
    });

    it('should disable input during loading', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          loading={true}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput.props.editable).toBe(false);
    });
  });

  describe('Empty States', () => {
    it('should show no results message when search has no matches', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={[]}
          searchQuery="nonexistent"
        />
      );

      expect(screen.getByText('No verses found for "nonexistent"')).toBeTruthy();
    });

    it('should show recent searches when no query is entered', () => {
      const recentSearches = ['God', 'love', 'faith'];

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          recentSearches={recentSearches}
        />
      );

      expect(screen.getByText('Recent Searches')).toBeTruthy();
      expect(screen.getByText('God')).toBeTruthy();
      expect(screen.getByText('love')).toBeTruthy();
      expect(screen.getByText('faith')).toBeTruthy();
    });

    it('should handle recent search selection', () => {
      const recentSearches = ['God', 'love'];

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          recentSearches={recentSearches}
        />
      );

      fireEvent.press(screen.getByTestId('recent-search-0'));

      expect(mockOnSearchResults).toHaveBeenCalledWith('God');
    });
  });

  describe('Testament Filtering', () => {
    it('should filter results by testament', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
          testamentFilter="old"
        />
      );

      expect(screen.getByText('Genesis 1:1')).toBeTruthy();
      expect(screen.queryByText('John 3:16')).toBeNull();
    });

    it('should show testament filter toggle', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      expect(screen.getByTestId('testament-filter-all')).toBeTruthy();
      expect(screen.getByTestId('testament-filter-old')).toBeTruthy();
      expect(screen.getByTestId('testament-filter-new')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should virtualize large result sets', () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockSearchResults[0],
        bookId: i + 1,
        verse: i + 1,
      }));

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={manyResults}
        />
      );

      expect(screen.getByTestId('search-results-flatlist')).toBeTruthy();
    });

    it('should limit initial results display', () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockSearchResults[0],
        bookId: i + 1,
        verse: i + 1,
      }));

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={manyResults}
        />
      );

      // Should show "Show more results" option
      expect(screen.getByText('Show more results')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByLabelText('Search Bible verses')).toBeTruthy();
      expect(screen.getByLabelText('Clear search')).toBeTruthy();
    });

    it('should announce search results to screen readers', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      expect(screen.getByLabelText('2 search results found')).toBeTruthy();
    });

    it('should support keyboard navigation', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          searchResults={mockSearchResults}
        />
      );

      const firstResult = screen.getByTestId('search-result-0');
      expect(firstResult.props.accessible).toBe(true);
      expect(firstResult.props.accessibilityRole).toBe('button');
    });
  });

  describe('Search History', () => {
    it('should save search queries to history', async () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
        />
      );

      const searchInput = screen.getByTestId('search-input');
      fireEvent.changeText(searchInput, 'God');

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnSearchResults).toHaveBeenCalledWith('God');
      });

      // Should add to recent searches
      expect(screen.getByText('Recent Searches')).toBeTruthy();
    });

    it('should limit recent searches to 10 items', () => {
      const manyRecentSearches = Array.from({ length: 15 }, (_, i) => `search${i}`);

      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          recentSearches={manyRecentSearches}
        />
      );

      const recentItems = screen.getAllByTestId(/recent-search-/);
      expect(recentItems.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          error="Search failed. Please try again."
        />
      );

      expect(screen.getByText('Search failed. Please try again.')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('should allow retry after error', () => {
      render(
        <GlobalSearch
          onSearchResults={mockOnSearchResults}
          onResultSelect={mockOnResultSelect}
          error="Search failed. Please try again."
          searchQuery="God"
        />
      );

      fireEvent.press(screen.getByText('Retry'));

      expect(mockOnSearchResults).toHaveBeenCalledWith('God');
    });
  });
});