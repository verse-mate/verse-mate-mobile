/**
 * useLastReadPosition Hook Tests
 *
 * Tests for the last read position persistence hook
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLastReadPosition } from '@/hooks/bible/use-last-read-position';
import type { LastReadPosition } from '@/types/bible';
import { STORAGE_KEYS } from '@/types/bible';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('useLastReadPosition', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should load null position when no data in storage', async () => {
      // Mock getItem to return null
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useLastReadPosition());

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.lastPosition).toBeNull();

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(result.current.error).toBeNull();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should load valid Bible position from storage', async () => {
      const storedPosition: LastReadPosition = {
        type: 'bible',
        bookId: 1,
        chapterNumber: 5,
        activeTab: 'summary',
        activeView: 'bible',
        timestamp: Date.now(),
      };

      // Mock getItem to return stored position
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedPosition));

      const { result } = renderHook(() => useLastReadPosition());

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toEqual(storedPosition);
      expect(result.current.error).toBeNull();
    });

    it('should load valid topic position from storage', async () => {
      const storedPosition: LastReadPosition = {
        type: 'topic',
        topicId: '550e8400-e29b-41d4-a716-446655440000',
        topicCategory: 'EVENT',
        activeTab: 'byline',
        activeView: 'explanations',
        timestamp: Date.now(),
      };

      // Mock getItem to return stored position
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedPosition));

      const { result } = renderHook(() => useLastReadPosition());

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toEqual(storedPosition);
      expect(result.current.error).toBeNull();
    });

    it('should clear invalid Bible position (missing bookId)', async () => {
      const invalidPosition = {
        type: 'bible',
        // Missing bookId
        chapterNumber: 5,
        activeTab: 'summary',
        activeView: 'bible',
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(invalidPosition));

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should clear invalid Bible position (bookId out of range)', async () => {
      const invalidPosition: LastReadPosition = {
        type: 'bible',
        bookId: 70, // Invalid: must be 1-66
        chapterNumber: 5,
        activeTab: 'summary',
        activeView: 'bible',
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(invalidPosition));

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should clear invalid topic position (missing topicId)', async () => {
      const invalidPosition = {
        type: 'topic',
        // Missing topicId
        activeTab: 'summary',
        activeView: 'bible',
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(invalidPosition));

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should handle JSON parse error gracefully', async () => {
      // Mock getItem to return invalid JSON
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json {');

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should handle storage read error gracefully', async () => {
      const storageError = new Error('Storage read failed');
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(storageError);

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastPosition).toBeNull();
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('savePosition', () => {
    beforeEach(() => {
      // Default to no stored position
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    });

    it('should save valid Bible position', async () => {
      const { result } = renderHook(() => useLastReadPosition());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const positionToSave = {
        type: 'bible' as const,
        bookId: 1,
        chapterNumber: 5,
        activeTab: 'summary' as const,
        activeView: 'bible' as const,
      };

      await act(async () => {
        await result.current.savePosition(positionToSave);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.LAST_READ_POSITION,
        expect.stringContaining('"type":"bible"')
      );

      // Verify stored data includes timestamp
      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      ) as LastReadPosition;
      expect(savedData.type).toBe('bible');
      expect(savedData.bookId).toBe(1);
      expect(savedData.chapterNumber).toBe(5);
      expect(savedData.timestamp).toBeGreaterThan(0);

      // Verify state updated
      expect(result.current.lastPosition).toEqual(savedData);
    });

    it('should save valid topic position', async () => {
      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const positionToSave = {
        type: 'topic' as const,
        topicId: '550e8400-e29b-41d4-a716-446655440000',
        topicCategory: 'PROPHECY',
        activeTab: 'detailed' as const,
        activeView: 'explanations' as const,
      };

      await act(async () => {
        await result.current.savePosition(positionToSave);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.LAST_READ_POSITION,
        expect.stringContaining('"type":"topic"')
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      ) as LastReadPosition;
      expect(savedData.type).toBe('topic');
      expect(savedData.topicId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(savedData.topicCategory).toBe('PROPHECY');
    });

    it('should reject invalid Bible position (missing bookId)', async () => {
      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const invalidPosition = {
        type: 'bible' as const,
        // Missing bookId
        chapterNumber: 5,
        activeTab: 'summary' as const,
        activeView: 'bible' as const,
      };

      await act(async () => {
        await result.current.savePosition(invalidPosition as any);
      });

      expect(result.current.error).toBeTruthy();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should reject invalid Bible position (bookId out of range)', async () => {
      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const invalidPosition = {
        type: 'bible' as const,
        bookId: 100, // Out of range
        chapterNumber: 5,
        activeTab: 'summary' as const,
        activeView: 'bible' as const,
      };

      await act(async () => {
        await result.current.savePosition(invalidPosition);
      });

      expect(result.current.error).toBeTruthy();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should reject invalid topic position (empty topicId)', async () => {
      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const invalidPosition = {
        type: 'topic' as const,
        topicId: '', // Empty string
        activeTab: 'summary' as const,
        activeView: 'bible' as const,
      };

      await act(async () => {
        await result.current.savePosition(invalidPosition);
      });

      expect(result.current.error).toBeTruthy();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle storage write error gracefully', async () => {
      const storageError = new Error('Storage write failed');
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(storageError);

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const positionToSave = {
        type: 'bible' as const,
        bookId: 1,
        chapterNumber: 5,
        activeTab: 'summary' as const,
        activeView: 'bible' as const,
      };

      await act(async () => {
        await result.current.savePosition(positionToSave);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('clearPosition', () => {
    it('should clear saved position', async () => {
      const storedPosition: LastReadPosition = {
        type: 'bible',
        bookId: 1,
        chapterNumber: 5,
        activeTab: 'summary',
        activeView: 'bible',
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedPosition));

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Position should be loaded
      expect(result.current.lastPosition).toEqual(storedPosition);

      // Clear position
      await act(async () => {
        await result.current.clearPosition();
      });

      expect(result.current.lastPosition).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_READ_POSITION);
    });

    it('should handle storage clear error gracefully', async () => {
      const storageError = new Error('Storage clear failed');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(storageError);

      const { result } = renderHook(() => useLastReadPosition());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearPosition();
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});
