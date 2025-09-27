import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadingPositionService } from '@/services/readingPosition';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('ReadingPositionService', () => {
  let service: ReadingPositionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReadingPositionService();
  });

  describe('savePosition', () => {
    it('should save reading position to AsyncStorage', async () => {
      const position = {
        bookId: 1,
        chapter: 1,
        verse: 5,
        scrollPosition: 200,
        timestamp: Date.now(),
      };

      mockAsyncStorage.setItem.mockResolvedValue();

      await service.savePosition(position);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'reading_position_1_1',
        JSON.stringify(position)
      );
    });

    it('should handle errors when saving position', async () => {
      const position = {
        bookId: 1,
        chapter: 1,
        verse: 1,
        scrollPosition: 0,
        timestamp: Date.now(),
      };

      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw error but log it
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.savePosition(position);

      expect(consoleSpy).toHaveBeenCalledWith('Error saving reading position:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should validate position data before saving', async () => {
      const invalidPositions = [
        { bookId: 0, chapter: 1, verse: 1, scrollPosition: 0, timestamp: Date.now() },
        { bookId: 1, chapter: 0, verse: 1, scrollPosition: 0, timestamp: Date.now() },
        { bookId: 1, chapter: 1, verse: 0, scrollPosition: 0, timestamp: Date.now() },
        { bookId: 1, chapter: 1, verse: 1, scrollPosition: -1, timestamp: Date.now() },
      ];

      for (const position of invalidPositions) {
        await expect(service.savePosition(position)).rejects.toThrow('Invalid position data');
      }

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getPosition', () => {
    it('should retrieve reading position from AsyncStorage', async () => {
      const savedPosition = {
        bookId: 1,
        chapter: 1,
        verse: 5,
        scrollPosition: 200,
        timestamp: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPosition));

      const result = await service.getPosition(1, 1);

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('reading_position_1_1');
      expect(result).toEqual(savedPosition);
    });

    it('should return null when no position is saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await service.getPosition(1, 1);

      expect(result).toBeNull();
    });

    it('should handle corrupted data in AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json data');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getPosition(1, 1);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing reading position:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle AsyncStorage errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getPosition(1, 1);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error getting reading position:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should validate input parameters', async () => {
      await expect(service.getPosition(0, 1)).rejects.toThrow('Invalid book ID');
      await expect(service.getPosition(1, 0)).rejects.toThrow('Invalid chapter number');
      await expect(service.getPosition(-1, 1)).rejects.toThrow('Invalid book ID');
      await expect(service.getPosition(1, -1)).rejects.toThrow('Invalid chapter number');
    });
  });

  describe('removePosition', () => {
    it('should remove reading position from AsyncStorage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await service.removePosition(1, 1);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('reading_position_1_1');
    });

    it('should handle errors when removing position', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.removePosition(1, 1);

      expect(consoleSpy).toHaveBeenCalledWith('Error removing reading position:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getAllPositions', () => {
    it('should retrieve all reading positions', async () => {
      const positions = {
        reading_position_1_1: JSON.stringify({
          bookId: 1,
          chapter: 1,
          verse: 5,
          scrollPosition: 200,
          timestamp: Date.now(),
        }),
        reading_position_2_3: JSON.stringify({
          bookId: 2,
          chapter: 3,
          verse: 10,
          scrollPosition: 400,
          timestamp: Date.now(),
        }),
        other_key: 'other_value',
      };

      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue(Object.keys(positions));
      mockAsyncStorage.multiGet = jest.fn().mockResolvedValue(
        Object.entries(positions).map(([key, value]) => [key, value])
      );

      const result = await service.getAllPositions();

      expect(result).toHaveLength(2);
      expect(result[0].bookId).toBe(1);
      expect(result[1].bookId).toBe(2);
    });

    it('should handle empty storage', async () => {
      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue([]);

      const result = await service.getAllPositions();

      expect(result).toEqual([]);
    });

    it('should filter out invalid positions', async () => {
      const positions = {
        reading_position_1_1: JSON.stringify({
          bookId: 1,
          chapter: 1,
          verse: 5,
          scrollPosition: 200,
          timestamp: Date.now(),
        }),
        reading_position_2_3: 'invalid json',
        reading_position_3_1: JSON.stringify({
          // Missing required fields
          bookId: 3,
        }),
      };

      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue(Object.keys(positions));
      mockAsyncStorage.multiGet = jest.fn().mockResolvedValue(
        Object.entries(positions).map(([key, value]) => [key, value])
      );

      const result = await service.getAllPositions();

      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe(1);
    });
  });

  describe('getRecentPositions', () => {
    it('should return positions sorted by timestamp descending', async () => {
      const now = Date.now();
      const positions = {
        reading_position_1_1: JSON.stringify({
          bookId: 1,
          chapter: 1,
          verse: 5,
          scrollPosition: 200,
          timestamp: now - 1000,
        }),
        reading_position_2_3: JSON.stringify({
          bookId: 2,
          chapter: 3,
          verse: 10,
          scrollPosition: 400,
          timestamp: now,
        }),
        reading_position_3_1: JSON.stringify({
          bookId: 3,
          chapter: 1,
          verse: 1,
          scrollPosition: 0,
          timestamp: now - 2000,
        }),
      };

      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue(Object.keys(positions));
      mockAsyncStorage.multiGet = jest.fn().mockResolvedValue(
        Object.entries(positions).map(([key, value]) => [key, value])
      );

      const result = await service.getRecentPositions(2);

      expect(result).toHaveLength(2);
      expect(result[0].bookId).toBe(2); // Most recent
      expect(result[1].bookId).toBe(1); // Second most recent
    });

    it('should limit results to specified count', async () => {
      const now = Date.now();
      const positions = {
        reading_position_1_1: JSON.stringify({
          bookId: 1,
          chapter: 1,
          verse: 5,
          scrollPosition: 200,
          timestamp: now - 1000,
        }),
        reading_position_2_3: JSON.stringify({
          bookId: 2,
          chapter: 3,
          verse: 10,
          scrollPosition: 400,
          timestamp: now,
        }),
        reading_position_3_1: JSON.stringify({
          bookId: 3,
          chapter: 1,
          verse: 1,
          scrollPosition: 0,
          timestamp: now - 2000,
        }),
      };

      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue(Object.keys(positions));
      mockAsyncStorage.multiGet = jest.fn().mockResolvedValue(
        Object.entries(positions).map(([key, value]) => [key, value])
      );

      const result = await service.getRecentPositions(1);

      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe(2);
    });
  });

  describe('clearAllPositions', () => {
    it('should clear all reading positions', async () => {
      const allKeys = ['reading_position_1_1', 'reading_position_2_3', 'other_key'];

      mockAsyncStorage.getAllKeys = jest.fn().mockResolvedValue(allKeys);
      mockAsyncStorage.multiRemove = jest.fn().mockResolvedValue();

      await service.clearAllPositions();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'reading_position_1_1',
        'reading_position_2_3',
      ]);
    });

    it('should handle errors when clearing positions', async () => {
      mockAsyncStorage.getAllKeys = jest.fn().mockRejectedValue(new Error('Storage error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.clearAllPositions();

      expect(consoleSpy).toHaveBeenCalledWith('Error clearing reading positions:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});