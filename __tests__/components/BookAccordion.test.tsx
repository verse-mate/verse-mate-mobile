import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BookAccordion } from '@/components/BookAccordion';

const mockBooks = [
  { id: 1, name: 'Genesis', testament: 'old' as const, chapters: 50 },
  { id: 2, name: 'Exodus', testament: 'old' as const, chapters: 40 },
  { id: 40, name: 'Matthew', testament: 'new' as const, chapters: 28 },
  { id: 41, name: 'Mark', testament: 'new' as const, chapters: 16 },
];

const mockRecentBooks = [
  { id: 1, name: 'Genesis', testament: 'old' as const, chapters: 50, lastRead: Date.now() },
  { id: 40, name: 'Matthew', testament: 'new' as const, chapters: 28, lastRead: Date.now() - 1000 },
];

describe('BookAccordion', () => {
  const mockOnBookSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all books for selected testament', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
      expect(screen.getByText('Exodus')).toBeTruthy();
      expect(screen.queryByText('Matthew')).toBeNull();
      expect(screen.queryByText('Mark')).toBeNull();
    });

    it('should render chapter counts for each book', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('50 chapters')).toBeTruthy();
      expect(screen.getByText('40 chapters')).toBeTruthy();
    });

    it('should show recent books section when available', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          recentBooks={mockRecentBooks}
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Recently Read')).toBeTruthy();
      expect(screen.getAllByText('Genesis')).toHaveLength(2); // In recent and main list
    });

    it('should render books in alphabetical order', () => {
      const unorderedBooks = [
        { id: 2, name: 'Exodus', testament: 'old' as const, chapters: 40 },
        { id: 1, name: 'Genesis', testament: 'old' as const, chapters: 50 },
        { id: 3, name: 'Leviticus', testament: 'old' as const, chapters: 27 },
      ];

      render(
        <BookAccordion
          books={unorderedBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      const bookElements = screen.getAllByTestId(/book-item-/);
      expect(bookElements[0]).toHaveTextContent('Exodus');
      expect(bookElements[1]).toHaveTextContent('Genesis');
      expect(bookElements[2]).toHaveTextContent('Leviticus');
    });
  });

  describe('Interaction', () => {
    it('should call onBookSelect when a book is pressed', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      fireEvent.press(screen.getByTestId('book-item-1'));

      expect(mockOnBookSelect).toHaveBeenCalledWith({
        id: 1,
        name: 'Genesis',
        testament: 'old',
        chapters: 50,
      });
    });

    it('should expand/collapse recent books section', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          recentBooks={mockRecentBooks}
          onBookSelect={mockOnBookSelect}
        />
      );

      const recentHeader = screen.getByTestId('recent-books-header');
      fireEvent.press(recentHeader);

      // Should toggle collapsed state
      expect(screen.queryByTestId('recent-book-item-1')).toBeNull();
    });

    it('should handle book selection from recent books', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          recentBooks={mockRecentBooks}
          onBookSelect={mockOnBookSelect}
        />
      );

      fireEvent.press(screen.getByTestId('recent-book-item-1'));

      expect(mockOnBookSelect).toHaveBeenCalledWith({
        id: 1,
        name: 'Genesis',
        testament: 'old',
        chapters: 50,
        lastRead: expect.any(Number),
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when books are loading', () => {
      render(
        <BookAccordion
          books={[]}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
          loading={true}
        />
      );

      expect(screen.getByTestId('book-list-loading')).toBeTruthy();
    });

    it('should show empty state when no books are available', () => {
      render(
        <BookAccordion
          books={[]}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
          loading={false}
        />
      );

      expect(screen.getByText('No books found')).toBeTruthy();
    });
  });

  describe('Search Filtering', () => {
    it('should filter books based on search query', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          searchQuery="gen"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
      expect(screen.queryByText('Exodus')).toBeNull();
    });

    it('should show no results message when search has no matches', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          searchQuery="xyz"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('No books match your search')).toBeTruthy();
    });

    it('should be case insensitive for search', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          searchQuery="GENESIS"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should render large lists efficiently', () => {
      const manyBooks = Array.from({ length: 66 }, (_, i) => ({
        id: i + 1,
        name: `Book ${i + 1}`,
        testament: (i < 39 ? 'old' : 'new') as 'old' | 'new',
        chapters: 20,
      }));

      const startTime = performance.now();

      render(
        <BookAccordion
          books={manyBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly (under 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('should use FlatList for performance optimization', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByTestId('book-accordion-flatlist')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels for books', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByLabelText('Select Genesis, 50 chapters')).toBeTruthy();
      expect(screen.getByLabelText('Select Exodus, 40 chapters')).toBeTruthy();
    });

    it('should have proper accessibility role for book items', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      const bookItem = screen.getByTestId('book-item-1');
      expect(bookItem.props.accessibilityRole).toBe('button');
    });

    it('should support screen reader navigation', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      const accordion = screen.getByTestId('book-accordion');
      expect(accordion.props.accessible).toBe(true);
    });
  });

  describe('Testament Switching', () => {
    it('should update displayed books when testament changes', () => {
      const { rerender } = render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
      expect(screen.queryByText('Matthew')).toBeNull();

      rerender(
        <BookAccordion
          books={mockBooks}
          selectedTestament="new"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.queryByText('Genesis')).toBeNull();
      expect(screen.getByText('Matthew')).toBeTruthy();
    });

    it('should maintain scroll position when switching testaments', async () => {
      const { rerender } = render(
        <BookAccordion
          books={mockBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      // Switch testament
      rerender(
        <BookAccordion
          books={mockBooks}
          selectedTestament="new"
          onBookSelect={mockOnBookSelect}
        />
      );

      // Should reset to top
      await waitFor(() => {
        const flatList = screen.getByTestId('book-accordion-flatlist');
        expect(flatList.props.contentOffset).toEqual({ x: 0, y: 0 });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing book data gracefully', () => {
      const incompleteBooks = [
        { id: 1, name: 'Genesis' } as any,
        { id: 2, testament: 'old' } as any,
      ];

      render(
        <BookAccordion
          books={incompleteBooks}
          selectedTestament="old"
          onBookSelect={mockOnBookSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
    });

    it('should handle invalid testament gracefully', () => {
      render(
        <BookAccordion
          books={mockBooks}
          selectedTestament={'invalid' as any}
          onBookSelect={mockOnBookSelect}
        />
      );

      // Should show empty state or all books
      expect(screen.getByText('No books found')).toBeTruthy();
    });
  });
});