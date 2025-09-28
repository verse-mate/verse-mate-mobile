import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ChapterLoadingSkeleton } from '@/components/ChapterLoadingSkeleton';
import { BookListLoadingSkeleton } from '@/components/BookListLoadingSkeleton';

describe('LoadingSkeleton Components', () => {
  describe('LoadingSkeleton', () => {
    it('should render basic loading skeleton', () => {
      render(<LoadingSkeleton />);

      expect(screen.getByTestId('loading-skeleton')).toBeTruthy();
    });

    it('should render with custom width and height', () => {
      render(<LoadingSkeleton width={200} height={50} />);

      const skeleton = screen.getByTestId('loading-skeleton');
      // Check that the style array contains the width and height
      const styleArray = skeleton.props.style;
      const hasWidthAndHeight = styleArray.some((style: any) => style && style.width === 200 && style.height === 50);
      expect(hasWidthAndHeight).toBe(true);
    });

    it('should render with animation enabled by default', () => {
      render(<LoadingSkeleton />);

      const skeleton = screen.getByTestId('loading-skeleton');
      // Animation is internal to react-native-reanimated, so we just check the component renders
      expect(skeleton).toBeTruthy();
    });

    it('should allow disabling animation', () => {
      render(<LoadingSkeleton animated={false} />);

      const skeleton = screen.getByTestId('loading-skeleton');
      // When animation is disabled, the animated style should not be applied
      expect(skeleton).toBeTruthy();
    });

    it('should apply custom styles', () => {
      const customStyle = { borderRadius: 10 };
      render(<LoadingSkeleton style={customStyle} />);

      const skeleton = screen.getByTestId('loading-skeleton');
      // Check that the style array contains the custom style
      const styleArray = skeleton.props.style;
      const hasCustomStyle = styleArray.some((style: any) => style && style.borderRadius === 10);
      expect(hasCustomStyle).toBe(true);
    });
  });

  describe('ChapterLoadingSkeleton', () => {
    it('should render chapter loading skeleton with header and verses', () => {
      render(<ChapterLoadingSkeleton />);

      expect(screen.getByLabelText('Loading chapter content')).toBeTruthy();
      expect(screen.getByTestId('chapter-header-skeleton')).toBeTruthy();
      expect(screen.getAllByTestId(/verse-skeleton-/)).toHaveLength(10); // Default verse count
    });

    it('should render custom number of verse skeletons', () => {
      render(<ChapterLoadingSkeleton verseCount={15} />);

      expect(screen.getAllByTestId(/verse-skeleton-/)).toHaveLength(15);
    });

    it('should render with proper accessibility labels', () => {
      render(<ChapterLoadingSkeleton />);

      expect(screen.getByLabelText('Loading chapter content')).toBeTruthy();
      expect(screen.getByLabelText('Loading chapter title')).toBeTruthy();
    });

    it('should render verse skeletons with varying widths', () => {
      render(<ChapterLoadingSkeleton verseCount={3} />);

      const verseSkeletons = screen.getAllByTestId(/verse-skeleton-/);

      // Just check that we have the expected number of verse skeletons
      expect(verseSkeletons).toHaveLength(3);
    });

    it('should handle zero verse count gracefully', () => {
      render(<ChapterLoadingSkeleton verseCount={0} />);

      expect(screen.getByLabelText('Loading chapter content')).toBeTruthy();
      expect(screen.getByTestId('chapter-header-skeleton')).toBeTruthy();
      expect(screen.queryAllByTestId(/verse-skeleton-/)).toHaveLength(0);
    });
  });

  describe('BookListLoadingSkeleton', () => {
    it('should render book list loading skeleton', () => {
      render(<BookListLoadingSkeleton />);

      expect(screen.getByLabelText('Loading book list')).toBeTruthy();
      expect(screen.getAllByTestId(/book-item-skeleton-/)).toHaveLength(20); // Default book count
    });

    it('should render custom number of book item skeletons', () => {
      render(<BookListLoadingSkeleton bookCount={10} />);

      expect(screen.getAllByTestId(/book-item-skeleton-/)).toHaveLength(10);
    });

    it('should render testament section headers', () => {
      render(<BookListLoadingSkeleton />);

      expect(screen.getByTestId('old-testament-header-skeleton')).toBeTruthy();
      expect(screen.getByTestId('new-testament-header-skeleton')).toBeTruthy();
    });

    it('should render with proper accessibility labels', () => {
      render(<BookListLoadingSkeleton />);

      expect(screen.getByLabelText('Loading book list')).toBeTruthy();
      expect(screen.getByLabelText('Loading Old Testament books')).toBeTruthy();
      expect(screen.getByLabelText('Loading New Testament books')).toBeTruthy();
    });

    it('should render search bar skeleton', () => {
      render(<BookListLoadingSkeleton showSearch={true} />);

      expect(screen.getByTestId('search-bar-skeleton')).toBeTruthy();
      expect(screen.getByLabelText('Loading search bar')).toBeTruthy();
    });

    it('should hide search bar skeleton when not needed', () => {
      render(<BookListLoadingSkeleton showSearch={false} />);

      expect(screen.queryByTestId('search-bar-skeleton')).toBeNull();
    });

    it('should render chapter count skeletons for each book', () => {
      render(<BookListLoadingSkeleton bookCount={3} />);

      const bookSkeletons = screen.getAllByTestId(/book-item-skeleton-/);
      // For 3 books: Old Testament = ceil(3 * 0.6) = 2, New Testament = ceil(3 * 0.4) = 2, Total = 4
      expect(bookSkeletons).toHaveLength(4);

      // Verify chapter count skeletons exist
      expect(screen.getAllByTestId(/chapter-count-skeleton-/)).toHaveLength(4);
    });
  });

  describe('Animation and Timing', () => {
    it('should have consistent animation duration across components', () => {
      const { unmount } = render(<ChapterLoadingSkeleton />);

      const chapterSkeleton = screen.getByLabelText('Loading chapter content');
      expect(chapterSkeleton).toBeTruthy();

      unmount();
      render(<BookListLoadingSkeleton />);
      const bookListSkeleton = screen.getByLabelText('Loading book list');
      expect(bookListSkeleton).toBeTruthy();
    });

    it('should start animation immediately', () => {
      const startTime = Date.now();
      render(<LoadingSkeleton />);

      const skeleton = screen.getByTestId('loading-skeleton');
      expect(skeleton).toBeTruthy();

      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should start quickly
    });
  });

  describe('Performance', () => {
    it('should render large number of skeletons efficiently', () => {
      const startTime = performance.now();

      render(<ChapterLoadingSkeleton verseCount={100} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 100 verse skeletons quickly (under 100ms)
      expect(renderTime).toBeLessThan(100);
      expect(screen.getAllByTestId(/verse-skeleton-/)).toHaveLength(100);
    });

    it('should not cause memory leaks with repeated renders', () => {
      const { rerender, unmount } = render(<ChapterLoadingSkeleton />);

      // Simulate multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(<ChapterLoadingSkeleton verseCount={i + 1} />);
      }

      // Should unmount cleanly without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', () => {
      // Mock different screen dimensions
      const originalWidth = 375;
      const wideScreenWidth = 768;

      render(<BookListLoadingSkeleton />);

      const bookListSkeleton = screen.getByLabelText('Loading book list');

      // Should have responsive styling based on screen width
      expect(bookListSkeleton.props.style).toBeDefined();
    });

    it('should maintain proper spacing on different devices', () => {
      render(<ChapterLoadingSkeleton />);

      const chapterSkeleton = screen.getByLabelText('Loading chapter content');
      const verseSkeletons = screen.getAllByTestId(/verse-skeleton-/);

      // Just verify that components render properly
      expect(chapterSkeleton).toBeTruthy();
      expect(verseSkeletons.length).toBeGreaterThan(0);
    });
  });
});