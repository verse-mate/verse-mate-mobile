import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ReadingPositionService } from '@/services/readingPosition';

describe('ReadingPositionService', () => {
  let service: ReadingPositionService;
  let mockStorage: any;

  beforeEach(() => {
    // Create a mock AsyncStorage
    mockStorage = {
      getItem: mock(() => Promise.resolve(null)),
      setItem: mock(() => Promise.resolve()),
      removeItem: mock(() => Promise.resolve()),
      clear: mock(() => Promise.resolve()),
      getAllKeys: mock(() => Promise.resolve([])),
      multiGet: mock(() => Promise.resolve([])),
      multiSet: mock(() => Promise.resolve()),
      multiRemove: mock(() => Promise.resolve()),
    };

    // Inject the mock storage into the service
    service = new ReadingPositionService(mockStorage);
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

      await service.savePosition(position);

      expect(mockStorage.setItem).toHaveBeenCalled();
      const [key, value] = mockStorage.setItem.mock.calls[0];
      expect(key).toBe('reading_position_1_1');
      expect(value).toContain('"bookId":1');
      expect(value).toContain('"chapter":1');
      expect(value).toContain('"verse":5');
    });

    it('should handle errors when saving position', async () => {
      const position = {
        bookId: 1,
        chapter: 1,
        verse: 5,
        scrollPosition: 200,
        timestamp: Date.now(),
      };

      mockStorage.setItem.mockImplementation(() => Promise.reject(new Error('Storage error')));

      // Should not throw error but log it
      await expect(service.savePosition(position)).resolves.toBeUndefined();
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

      mockStorage.getItem.mockImplementation(() => Promise.resolve(JSON.stringify(savedPosition)));

      const result = await service.getPosition(1, 1);

      expect(mockStorage.getItem).toHaveBeenCalledWith('reading_position_1_1');
      expect(result).toEqual(savedPosition);
    });

    it('should return null when no position is saved', async () => {
      mockStorage.getItem.mockImplementation(() => Promise.resolve(null));

      const result = await service.getPosition(1, 1);

      expect(result).toBeNull();
    });
  });

  describe('removePosition', () => {
    it('should remove reading position from AsyncStorage', async () => {
      await service.removePosition(1, 1);

      expect(mockStorage.removeItem).toHaveBeenCalledWith('reading_position_1_1');
    });
  });

  describe('clearAllPositions', () => {
    it('should clear all reading positions', async () => {
      const allKeys = ['reading_position_1_1', 'reading_position_2_3', 'other_key'];
      mockStorage.getAllKeys.mockImplementation(() => Promise.resolve(allKeys));

      await service.clearAllPositions();

      expect(mockStorage.multiRemove).toHaveBeenCalledWith([
        'reading_position_1_1',
        'reading_position_2_3'
      ]);
    });
  });
});