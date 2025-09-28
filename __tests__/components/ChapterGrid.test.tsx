import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ChapterGrid } from '@/components/ChapterGrid';

const mockBook = {
  id: 1,
  name: 'Genesis',
  testament: 'old' as const,
  chapters: 50,
};

describe('ChapterGrid', () => {
  const mockOnChapterSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all chapters in a 5-column grid', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      // Should render all 50 chapters
      for (let i = 1; i <= 50; i++) {
        expect(screen.getByText(i.toString())).toBeTruthy();
      }
    });

    it('should display book name as header', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByText('Genesis')).toBeTruthy();
    });

    it('should arrange chapters in 5-column layout', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const grid = screen.getByTestId('chapter-grid');
      expect(grid.props.numColumns).toBe(5);
    });

    it('should highlight selected chapter', () => {
      render(
        <ChapterGrid
          book={mockBook}
          selectedChapter={1}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const chapter1 = screen.getByTestId('chapter-1');
      expect(chapter1.props.style).toMatchObject({
        backgroundColor: '#b09a6d',
      });
    });
  });

  describe('Interaction', () => {
    it('should call onChapterSelect when a chapter is pressed', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      fireEvent.press(screen.getByTestId('chapter-1'));

      expect(mockOnChapterSelect).toHaveBeenCalledWith(mockBook, 1);
    });

    it('should handle chapter selection for different chapters', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      fireEvent.press(screen.getByTestId('chapter-25'));

      expect(mockOnChapterSelect).toHaveBeenCalledWith(mockBook, 25);
    });

    it('should not call onChapterSelect when already selected chapter is pressed', () => {
      render(
        <ChapterGrid
          book={mockBook}
          selectedChapter={1}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      fireEvent.press(screen.getByTestId('chapter-1'));

      expect(mockOnChapterSelect).not.toHaveBeenCalled();
    });
  });

  describe('Different Book Sizes', () => {
    it('should handle single-chapter books', () => {
      const singleChapterBook = {
        id: 31,
        name: 'Obadiah',
        testament: 'old' as const,
        chapters: 1,
      };

      render(
        <ChapterGrid
          book={singleChapterBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.queryByText('2')).toBeNull();
    });

    it('should handle large books like Psalms', () => {
      const psalmsBook = {
        id: 19,
        name: 'Psalms',
        testament: 'old' as const,
        chapters: 150,
      };

      render(
        <ChapterGrid
          book={psalmsBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('150')).toBeTruthy();
    });

    it('should efficiently render large chapter lists', () => {
      const psalmsBook = {
        id: 19,
        name: 'Psalms',
        testament: 'old' as const,
        chapters: 150,
      };

      const startTime = performance.now();

      render(
        <ChapterGrid
          book={psalmsBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with 150 chapters
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
          loading={true}
        />
      );

      expect(screen.getByTestId('chapter-grid-loading')).toBeTruthy();
    });

    it('should disable interaction during loading', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
          loading={true}
        />
      );

      const grid = screen.getByTestId('chapter-grid-container');
      expect(grid.props.pointerEvents).toBe('none');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels for chapters', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByLabelText('Chapter 1 of Genesis')).toBeTruthy();
      expect(screen.getByLabelText('Chapter 25 of Genesis')).toBeTruthy();
    });

    it('should indicate selected state for screen readers', () => {
      render(
        <ChapterGrid
          book={mockBook}
          selectedChapter={1}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const chapter1 = screen.getByTestId('chapter-1');
      expect(chapter1.props.accessibilityState.selected).toBe(true);

      const chapter2 = screen.getByTestId('chapter-2');
      expect(chapter2.props.accessibilityState.selected).toBe(false);
    });

    it('should have proper accessibility role', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const chapter1 = screen.getByTestId('chapter-1');
      expect(chapter1.props.accessibilityRole).toBe('button');
    });

    it('should provide accessibility hint for chapter selection', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const chapter1 = screen.getByTestId('chapter-1');
      expect(chapter1.props.accessibilityHint).toBe('Tap to read chapter 1');
    });
  });

  describe('Visual States', () => {
    it('should apply different styles for selected chapter', () => {
      render(
        <ChapterGrid
          book={mockBook}
          selectedChapter={5}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const selectedChapter = screen.getByTestId('chapter-5');
      const unselectedChapter = screen.getByTestId('chapter-6');

      expect(selectedChapter.props.style).toMatchObject({
        backgroundColor: '#b09a6d',
      });
      expect(unselectedChapter.props.style).not.toMatchObject({
        backgroundColor: '#b09a6d',
      });
    });

    it('should apply hover/press states for interaction feedback', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const chapter1 = screen.getByTestId('chapter-1');

      fireEvent(chapter1, 'pressIn');
      expect(chapter1.props.style).toMatchObject({
        opacity: 0.7,
      });

      fireEvent(chapter1, 'pressOut');
      expect(chapter1.props.style).toMatchObject({
        opacity: 1,
      });
    });
  });

  describe('Navigation Integration', () => {
    it('should handle navigation to specific chapter', () => {
      const mockNavigateToChapter = jest.fn();

      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockNavigateToChapter}
        />
      );

      fireEvent.press(screen.getByTestId('chapter-10'));

      expect(mockNavigateToChapter).toHaveBeenCalledWith(mockBook, 10);
    });

    it('should support deep linking patterns', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      fireEvent.press(screen.getByTestId('chapter-15'));

      expect(mockOnChapterSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Genesis',
        }),
        15
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should use FlatList for large chapter counts', () => {
      const largeBook = {
        id: 19,
        name: 'Psalms',
        testament: 'old' as const,
        chapters: 150,
      };

      render(
        <ChapterGrid
          book={largeBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByTestId('chapter-grid')).toBeTruthy();
    });

    it('should implement proper key extraction for list items', () => {
      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const grid = screen.getByTestId('chapter-grid');
      expect(grid.props.keyExtractor).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle book with zero chapters gracefully', () => {
      const emptyBook = {
        id: 999,
        name: 'Test Book',
        testament: 'old' as const,
        chapters: 0,
      };

      render(
        <ChapterGrid
          book={emptyBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByText('No chapters available')).toBeTruthy();
    });

    it('should handle missing book data', () => {
      render(
        <ChapterGrid
          book={null as any}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      expect(screen.getByText('Book not found')).toBeTruthy();
    });

    it('should handle invalid selected chapter', () => {
      render(
        <ChapterGrid
          book={mockBook}
          selectedChapter={999} // Invalid chapter number
          onChapterSelect={mockOnChapterSelect}
        />
      );

      // Should not crash and show all chapters normally
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('50')).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt grid spacing for different screen sizes', () => {
      // Mock smaller screen
      jest.spyOn(require('react-native'), 'Dimensions').mockReturnValue({
        get: () => ({ width: 320, height: 568 }), // iPhone 5 size
      });

      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const grid = screen.getByTestId('chapter-grid');
      expect(grid.props.style).toBeDefined();
    });

    it('should maintain 5-column layout on tablets', () => {
      // Mock tablet screen
      jest.spyOn(require('react-native'), 'Dimensions').mockReturnValue({
        get: () => ({ width: 768, height: 1024 }), // iPad size
      });

      render(
        <ChapterGrid
          book={mockBook}
          onChapterSelect={mockOnChapterSelect}
        />
      );

      const grid = screen.getByTestId('chapter-grid');
      expect(grid.props.numColumns).toBe(5);
    });
  });
});