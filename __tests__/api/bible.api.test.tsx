/**
 * Bible API Integration Tests
 *
 * Tests for React Query hooks with MSW mocking
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { getBookById } from '../../constants/bible-books';
import { useOfflineContext } from '../../contexts/OfflineContext';
import { getLocalBibleChapter } from '../../services/offline';
import {
  bibleKeys,
  useBibleChapter,
  useBibleExplanation,
  useBibleSummary,
  useBibleTestaments,
  useLastRead,
  useSaveLastRead,
} from '../../src/api';
import {
  clearMockLastReadPosition,
  setMockLastReadPosition,
} from '../mocks/handlers/bible.handlers';

jest.mock('../../contexts/OfflineContext');
jest.mock('../../services/offline');
jest.mock('../../constants/bible-books');

// Create a new QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: Number.POSITIVE_INFINITY, // Prevent garbage collection during tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function createWrapper() {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

describe('Bible API Hooks', () => {
  describe('useBibleTestaments', () => {
    it('should fetch all Bible books metadata', async () => {
      const { result } = renderHook(() => useBibleTestaments(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data structure
      expect(result.current.data).toHaveLength(66);
      expect(result.current.data?.[0]).toEqual({
        id: 1,
        name: 'Genesis',
        testament: 'OT',
        chapterCount: 50,
        genre: 1, // Genre is returned as number, not object
      });

      // Verify last book (Revelation)
      expect(result.current.data?.[65]).toEqual({
        id: 66,
        name: 'Revelation',
        testament: 'NT',
        chapterCount: 22,
        genre: 8, // Genre is returned as number, not object
      });
    });

    it('should cache testament data', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useBibleTestaments(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Second render with same wrapper should use cache (isLoading false immediately)
      const { result: result2 } = renderHook(() => useBibleTestaments(), {
        wrapper,
      });

      expect(result2.current.isLoading).toBe(false);
      expect(result2.current.data).toBeDefined();
    });
  });

  describe('useBibleChapter', () => {
    beforeEach(() => {
      (useOfflineContext as jest.Mock).mockReturnValue({
        isOfflineModeEnabled: false,
        downloadedBibleVersions: [],
      });
    });

    it('should fetch Genesis Chapter 1', async () => {
      const { result } = renderHook(() => useBibleChapter(1, 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data as any;

      expect(result.current.data).toMatchObject({
        bookId: 1,
        bookName: 'Genesis',
        chapterNumber: 1,
        testament: 'OT',
        title: 'Genesis 1',
      });

      // Check sections
      expect(data.sections).toHaveLength(1);
      expect(data.sections[0].subtitle).toBe('The Creation');

      // Check verses
      expect(data.sections[0].verses.length).toBeGreaterThan(0);
      expect(data.sections[0].verses[0]).toMatchObject({
        verseNumber: 1,
        text: expect.stringContaining('In the beginning'),
      });
    });

    it('should fetch Matthew Chapter 5', async () => {
      const { result } = renderHook(() => useBibleChapter(40, 5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data as any;

      expect(result.current.data).toMatchObject({
        bookId: 40,
        bookName: 'Matthew',
        chapterNumber: 5,
        testament: 'NT',
        title: 'Matthew 5',
      });

      // Check multiple sections
      expect(data.sections.length).toBeGreaterThan(1);
      expect(data.sections[0].subtitle).toBe('The Beatitudes');
    });

    it('should handle offline mode with local data', async () => {
      // Enable offline mode
      (useOfflineContext as jest.Mock).mockReturnValue({
        isOfflineModeEnabled: true,
        downloadedBibleVersions: ['NASB1995'],
      });

      // Mock local data
      (getLocalBibleChapter as jest.Mock).mockResolvedValue([
        { verse_number: 1, text: 'In the beginning' },
        { verse_number: 2, text: 'The earth was formless' },
      ]);

      (getBookById as jest.Mock).mockReturnValue({
        id: 1,
        name: 'Genesis',
        testament: 'OT',
      });

      const { result } = renderHook(() => useBibleChapter(1, 1), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data as any;
      expect(getLocalBibleChapter).toHaveBeenCalledWith('NASB1995', 1, 1);
      expect(data.bookName).toBe('Genesis');
      expect(data.sections.length).toBeGreaterThan(0);
      expect(data.sections[0].verses[0].text).toBe('In the beginning');
    });

    it('should not fetch when bookId is 0', () => {
      const { result } = renderHook(() => useBibleChapter(0, 1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull(); // Hook returns null when query is disabled
    });

    it('should handle invalid book ID', async () => {
      const { result } = renderHook(() => useBibleChapter(999, 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useBibleExplanation', () => {
    it('should fetch summary explanation', async () => {
      const { result } = renderHook(() => useBibleExplanation(1, 1, 'summary'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        bookId: 1,
        chapterNumber: 1,
        type: 'summary',
        content: expect.stringContaining('Summary of Genesis 1'),
        languageCode: 'en-US',
      });
    });

    it('should use useBibleSummary helper', async () => {
      const { result } = renderHook(() => useBibleSummary(1, 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.type).toBe('summary');
    });

    it('should not fetch when type is empty', () => {
      const { result } = renderHook(() => useBibleExplanation(1, 1, ''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull(); // Hook returns null when query is disabled
    });
  });

  describe('useSaveLastRead & useLastRead', () => {
    beforeEach(() => {
      clearMockLastReadPosition();
    });

    it('should save last read position', async () => {
      const { result } = renderHook(() => useSaveLastRead(), {
        wrapper: createWrapper(),
      });

      // Trigger mutation
      result.current.mutate({
        user_id: 'test-user-123',
        book_id: 40,
        chapter_number: 5,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should get last read position', async () => {
      // Set mock position
      setMockLastReadPosition(40, 5);

      const { result } = renderHook(() => useLastRead('test-user-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        book_id: 40,
        chapter_number: 5,
      });
    });

    it('should return default position when no last read exists', async () => {
      const { result } = renderHook(() => useLastRead('test-user-456'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Default to Genesis 1
      expect(result.current.data).toMatchObject({
        book_id: 1,
        chapter_number: 1,
      });
    });

    it('should not fetch when userId is empty', () => {
      const { result } = renderHook(() => useLastRead(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({}); // Hook returns empty object when userId is empty
    });
  });

  describe('Query Keys', () => {
    it('should generate correct query keys', () => {
      expect(bibleKeys.testaments()).toBeDefined();
      expect(bibleKeys.chapter({ path: { bookId: '1', chapterNumber: '1' } })).toBeDefined();
      expect(
        bibleKeys.explanation({
          path: { bookId: '1', chapterNumber: '1' },
          query: { explanationType: 'summary' },
        })
      ).toBeDefined();
    });
  });
});
