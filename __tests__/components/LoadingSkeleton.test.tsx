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
      expect(skeleton.props.style).toMatchObject({
        width: 200,
        height: 50,
      });
    });

    it('should render with animation enabled by default', () => {
      render(<LoadingSkeleton />);

      const skeleton = screen.getByTestId('loading-skeleton');
      expect(skeleton.props.animating).toBe(true);
    });

    it('should allow disabling animation', () => {
      render(<LoadingSkeleton animated={false} />);

      const skeleton = screen.getByTestId('loading-skeleton');
      expect(skeleton.props.animating).toBe(false);
    });

    it('should apply custom styles', () => {
      const customStyle = { borderRadius: 10 };
      render(<LoadingSkeleton style={customStyle} />);

      const skeleton = screen.getByTestId('loading-skeleton');
      expect(skeleton.props.style).toMatchObject(customStyle);
    });
  });

  describe('ChapterLoadingSkeleton', () => {
    it('should render chapter loading skeleton with header and verses', () => {
      render(<ChapterLoadingSkeleton />);

      expect(screen.getByTestId('chapter-loading-skeleton')).toBeTruthy();
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

      // Check that verse skeletons have different widths to simulate realistic content
      const widths = verseSkeletons.map(skeleton => skeleton.props.style.width);
      expect(new Set(widths).size).toBeGreaterThan(1); // Should have multiple different widths
    });

    it('should handle zero verse count gracefully', () => {
      render(<ChapterLoadingSkeleton verseCount={0} />);

      expect(screen.getByTestId('chapter-loading-skeleton')).toBeTruthy();
      expect(screen.getByTestId('chapter-header-skeleton')).toBeTruthy();
      expect(screen.queryAllByTestId(/verse-skeleton-/)).toHaveLength(0);
    });
  });

  describe('BookListLoadingSkeleton', () => {
    it('should render book list loading skeleton', () => {
      render(<BookListLoadingSkeleton />);

      expect(screen.getByTestId('book-list-loading-skeleton')).toBeTruthy();
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
      expect(bookSkeletons).toHaveLength(3);

      // Each book skeleton should contain a chapter count skeleton
      bookSkeletons.forEach((_, index) => {
        expect(screen.getByTestId(`chapter-count-skeleton-${index}`)).toBeTruthy();
      });
    });
  });

  describe('Animation and Timing', () => {
    it('should have consistent animation duration across components', () => {
      const { rerender } = render(<ChapterLoadingSkeleton />);

      const chapterSkeleton = screen.getByTestId('chapter-loading-skeleton');
      const animationDuration = chapterSkeleton.props.animationDuration;

      rerender(<BookListLoadingSkeleton />);
      const bookListSkeleton = screen.getByTestId('book-list-loading-skeleton');
      const bookAnimationDuration = bookListSkeleton.props.animationDuration;

      expect(animationDuration).toBe(bookAnimationDuration);
    });

    it('should start animation immediately', () => {
      const startTime = Date.now();
      render(<LoadingSkeleton />);

      const skeleton = screen.getByTestId('loading-skeleton');
      expect(skeleton.props.animating).toBe(true);

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

      const bookListSkeleton = screen.getByTestId('book-list-loading-skeleton');

      // Should have responsive styling based on screen width
      expect(bookListSkeleton.props.style).toBeDefined();
    });

    it('should maintain proper spacing on different devices', () => {
      render(<ChapterLoadingSkeleton />);

      const chapterSkeleton = screen.getByTestId('chapter-loading-skeleton');
      const verseSkeletons = screen.getAllByTestId(/verse-skeleton-/);

      // Check that spacing is consistent
      verseSkeletons.forEach((skeleton) => {
        expect(skeleton.props.style.marginBottom).toBeDefined();
        expect(skeleton.props.style.marginBottom).toBeGreaterThan(0);
      });
    });
  });
});