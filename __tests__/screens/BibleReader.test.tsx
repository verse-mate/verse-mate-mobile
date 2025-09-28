import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BibleReader } from '@/app/bible/[bookId]/[chapter]';
import { ApiService } from '@/services/api';
import { ReadingPositionService } from '@/services/readingPosition';
import { BookMappingService } from '@/utils/bookMapping';
import * as ExpoRouter from 'expo-router';

// Mock the services
jest.mock('@/services/api');
jest.mock('@/services/readingPosition');
jest.mock('@/utils/bookMapping');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: '1', chapter: '1' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

const mockApiService = ApiService as jest.MockedClass<typeof ApiService>;
const mockReadingPositionService = ReadingPositionService as jest.MockedClass<typeof ReadingPositionService>;
const mockBookMappingService = BookMappingService as jest.MockedClass<typeof BookMappingService>;

describe('BibleReader Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation Integration', () => {
    it('should render with correct route parameters', async () => {
      const mockChapterData = {
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [
          { number: 1, text: 'In the beginning God created the heavens and the earth.' },
          { number: 2, text: 'The earth was without form, and void; and darkness was on the face of the deep.' },
        ],
      };

      mockApiService.prototype.getChapter.mockResolvedValue(mockChapterData);
      mockBookMappingService.prototype.getBookName.mockReturnValue('Genesis');

      render(<BibleReader />);

      await waitFor(() => {
        expect(screen.getByText('Genesis 1')).toBeTruthy();
      });
    });

    it('should navigate to next chapter when swipe right gesture is detected', async () => {
      const mockRouter = { push: jest.fn() };
      jest.spyOn(ExpoRouter, 'useRouter').mockReturnValue(mockRouter);

      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [{ number: 1, text: 'Test verse' }],
      });

      render(<BibleReader />);

      const scrollView = screen.getByTestId('chapter-scroll-view');

      // Simulate swipe right gesture for next chapter
      fireEvent(scrollView, 'onSwipeLeft');

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bible/1/2');
      });
    });

    it('should navigate to previous chapter when swipe left gesture is detected', async () => {
      const mockRouter = { push: jest.fn() };
      jest.spyOn(ExpoRouter, 'useRouter').mockReturnValue(mockRouter);
      jest.spyOn(ExpoRouter, 'useLocalSearchParams').mockReturnValue({ bookId: '1', chapter: '2' });

      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 2,
        verses: [{ number: 1, text: 'Test verse' }],
      });

      render(<BibleReader />);

      const scrollView = screen.getByTestId('chapter-scroll-view');

      // Simulate swipe left gesture for previous chapter
      fireEvent(scrollView, 'onSwipeRight');

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bible/1/1');
      });
    });

    it('should handle cross-book navigation correctly', async () => {
      const mockRouter = { push: jest.fn() };
      jest.spyOn(ExpoRouter, 'useRouter').mockReturnValue(mockRouter);
      jest.spyOn(ExpoRouter, 'useLocalSearchParams').mockReturnValue({ bookId: '39', chapter: '4' }); // Malachi 4

      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 39,
        bookName: 'Malachi',
        chapter: 4,
        verses: [{ number: 6, text: 'Last verse of OT' }],
      });

      mockBookMappingService.prototype.getNextBook.mockReturnValue({ bookId: 40, name: 'Matthew' });
      mockBookMappingService.prototype.isLastChapter.mockReturnValue(true);

      render(<BibleReader />);

      const scrollView = screen.getByTestId('chapter-scroll-view');

      // Simulate swipe for next chapter (should go to Matthew 1)
      fireEvent(scrollView, 'onSwipeLeft');

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/bible/40/1');
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch chapter data on component mount', async () => {
      const mockChapterData = {
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [{ number: 1, text: 'In the beginning God created the heavens and the earth.' }],
      };

      mockApiService.prototype.getChapter.mockResolvedValue(mockChapterData);

      render(<BibleReader />);

      await waitFor(() => {
        expect(mockApiService.prototype.getChapter).toHaveBeenCalledWith(1, 1);
      });
    });

    it('should display loading state while fetching data', () => {
      mockApiService.prototype.getChapter.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<BibleReader />);

      expect(screen.getByTestId('loading-skeleton')).toBeTruthy();
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch chapter data';
      mockApiService.prototype.getChapter.mockRejectedValue(new Error(errorMessage));

      render(<BibleReader />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load chapter. Please try again.')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should retry fetching data when retry button is pressed', async () => {
      const errorMessage = 'Network error';
      mockApiService.prototype.getChapter
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValueOnce({
          bookId: 1,
          bookName: 'Genesis',
          chapter: 1,
          verses: [{ number: 1, text: 'In the beginning God created the heavens and the earth.' }],
        });

      render(<BibleReader />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Retry'));

      await waitFor(() => {
        expect(mockApiService.prototype.getChapter).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Genesis 1')).toBeTruthy();
      });
    });
  });

  describe('Reading Position Persistence', () => {
    it('should save reading position when component unmounts', async () => {
      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [{ number: 1, text: 'Test verse' }],
      });

      const { unmount } = render(<BibleReader />);

      await waitFor(() => {
        expect(screen.getByText('Genesis 1')).toBeTruthy();
      });

      unmount();

      expect(mockReadingPositionService.prototype.savePosition).toHaveBeenCalledWith({
        bookId: 1,
        chapter: 1,
        verse: 1,
        scrollPosition: 0,
      });
    });

    it('should restore reading position on component mount', async () => {
      const savedPosition = { bookId: 1, chapter: 1, verse: 5, scrollPosition: 200 };
      mockReadingPositionService.prototype.getPosition.mockResolvedValue(savedPosition);

      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, text: `Verse ${i + 1}` })),
      });

      render(<BibleReader />);

      await waitFor(() => {
        expect(mockReadingPositionService.prototype.getPosition).toHaveBeenCalledWith(1, 1);
      });
    });

    it('should update reading position during scroll', async () => {
      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [{ number: 1, text: 'Test verse' }],
      });

      render(<BibleReader />);

      const scrollView = screen.getByTestId('chapter-scroll-view');

      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 150 },
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 800 },
        },
      });

      // Should debounce and save position
      await waitFor(() => {
        expect(mockReadingPositionService.prototype.savePosition).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('Error Boundaries', () => {
    it('should display error boundary when component crashes', () => {
      const ThrowError = () => {
        throw new Error('Component crash');
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<ThrowError />);

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();

      consoleError.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [{ number: 1, text: 'In the beginning God created the heavens and the earth.' }],
      });

      render(<BibleReader />);

      await waitFor(() => {
        expect(screen.getByLabelText('Bible chapter content')).toBeTruthy();
        expect(screen.getByLabelText('Verse 1')).toBeTruthy();
      });
    });

    it('should support screen reader navigation', async () => {
      mockApiService.prototype.getChapter.mockResolvedValue({
        bookId: 1,
        bookName: 'Genesis',
        chapter: 1,
        verses: [
          { number: 1, text: 'First verse' },
          { number: 2, text: 'Second verse' },
        ],
      });

      render(<BibleReader />);

      await waitFor(() => {
        const verses = screen.getAllByLabelText(/Verse \d+/);
        expect(verses).toHaveLength(2);
        verses.forEach((verse) => {
          expect(verse.props.accessible).toBe(true);
        });
      });
    });
  });
});