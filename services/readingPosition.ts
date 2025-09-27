/**
 * Reading Position Service
 * Handles persistence of reading positions using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReadingPosition {
  bookId: number;
  chapter: number;
  verse: number;
  scrollPosition: number;
  timestamp: number;
}

/**
 * Service for managing reading position persistence
 */
export class ReadingPositionService {
  private readonly keyPrefix = 'reading_position';
  private readonly maxPositions = 100; // Limit stored positions to prevent excessive storage usage

  /**
   * Generate storage key for a book and chapter
   */
  private getStorageKey(bookId: number, chapter: number): string {
    return `${this.keyPrefix}_${bookId}_${chapter}`;
  }

  /**
   * Validate reading position data
   */
  private validatePosition(position: Partial<ReadingPosition>): void {
    if (!position.bookId || position.bookId < 1 || position.bookId > 66) {
      throw new Error('Invalid position data: bookId must be between 1 and 66');
    }

    if (!position.chapter || position.chapter < 1) {
      throw new Error('Invalid position data: chapter must be a positive number');
    }

    if (!position.verse || position.verse < 1) {
      throw new Error('Invalid position data: verse must be a positive number');
    }

    if (position.scrollPosition === undefined || position.scrollPosition < 0) {
      throw new Error('Invalid position data: scrollPosition must be a non-negative number');
    }
  }

  /**
   * Save reading position for a specific book and chapter
   */
  public async savePosition(position: ReadingPosition): Promise<void> {
    try {
      // Validate position data
      this.validatePosition(position);

      const key = this.getStorageKey(position.bookId, position.chapter);
      const positionData = {
        ...position,
        timestamp: Date.now(), // Always use current timestamp
      };

      await AsyncStorage.setItem(key, JSON.stringify(positionData));

      // Clean up old positions if we have too many
      await this.cleanupOldPositions();
    } catch (error) {
      console.error('Error saving reading position:', error);
      // Don't throw error to avoid disrupting user experience
    }
  }

  /**
   * Get reading position for a specific book and chapter
   */
  public async getPosition(bookId: number, chapter: number): Promise<ReadingPosition | null> {
    try {
      // Validate input parameters
      if (!Number.isInteger(bookId) || bookId < 1 || bookId > 66) {
        throw new Error(`Invalid book ID: ${bookId}`);
      }

      if (!Number.isInteger(chapter) || chapter < 1) {
        throw new Error(`Invalid chapter number: ${chapter}`);
      }

      const key = this.getStorageKey(bookId, chapter);
      const storedData = await AsyncStorage.getItem(key);

      if (!storedData) {
        return null;
      }

      const position: ReadingPosition = JSON.parse(storedData);

      // Validate stored data
      if (!this.isValidStoredPosition(position)) {
        console.warn('Invalid stored position data, removing:', position);
        await AsyncStorage.removeItem(key);
        return null;
      }

      return position;
    } catch (error) {
      console.error('Error getting reading position:', error);
      return null;
    }
  }

  /**
   * Remove reading position for a specific book and chapter
   */
  public async removePosition(bookId: number, chapter: number): Promise<void> {
    try {
      const key = this.getStorageKey(bookId, chapter);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing reading position:', error);
    }
  }

  /**
   * Get all stored reading positions
   */
  public async getAllPositions(): Promise<ReadingPosition[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const positionKeys = keys.filter((key) => key.startsWith(this.keyPrefix));

      if (positionKeys.length === 0) {
        return [];
      }

      const results = await AsyncStorage.multiGet(positionKeys);
      const positions: ReadingPosition[] = [];

      for (const [key, value] of results) {
        if (value) {
          try {
            const position: ReadingPosition = JSON.parse(value);
            if (this.isValidStoredPosition(position)) {
              positions.push(position);
            } else {
              // Remove invalid position data
              await AsyncStorage.removeItem(key);
            }
          } catch (parseError) {
            console.warn('Failed to parse position data for key:', key);
            await AsyncStorage.removeItem(key);
          }
        }
      }

      return positions;
    } catch (error) {
      console.error('Error getting all reading positions:', error);
      return [];
    }
  }

  /**
   * Get recent reading positions sorted by timestamp
   */
  public async getRecentPositions(limit: number = 10): Promise<ReadingPosition[]> {
    try {
      const allPositions = await this.getAllPositions();

      return allPositions
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent reading positions:', error);
      return [];
    }
  }

  /**
   * Get reading progress for a specific book (last read chapter)
   */
  public async getBookProgress(
    bookId: number
  ): Promise<{ chapter: number; timestamp: number } | null> {
    try {
      const allPositions = await this.getAllPositions();
      const bookPositions = allPositions
        .filter((position) => position.bookId === bookId)
        .sort((a, b) => b.timestamp - a.timestamp);

      if (bookPositions.length === 0) {
        return null;
      }

      const latestPosition = bookPositions[0];
      return {
        chapter: latestPosition.chapter,
        timestamp: latestPosition.timestamp,
      };
    } catch (error) {
      console.error('Error getting book progress:', error);
      return null;
    }
  }

  /**
   * Update only scroll position for current location
   */
  public async updateScrollPosition(
    bookId: number,
    chapter: number,
    scrollPosition: number
  ): Promise<void> {
    try {
      const existingPosition = await this.getPosition(bookId, chapter);

      const position: ReadingPosition = {
        bookId,
        chapter,
        verse: existingPosition?.verse || 1,
        scrollPosition,
        timestamp: Date.now(),
      };

      await this.savePosition(position);
    } catch (error) {
      console.error('Error updating scroll position:', error);
    }
  }

  /**
   * Update only verse position for current location
   */
  public async updateVersePosition(bookId: number, chapter: number, verse: number): Promise<void> {
    try {
      const existingPosition = await this.getPosition(bookId, chapter);

      const position: ReadingPosition = {
        bookId,
        chapter,
        verse,
        scrollPosition: existingPosition?.scrollPosition || 0,
        timestamp: Date.now(),
      };

      await this.savePosition(position);
    } catch (error) {
      console.error('Error updating verse position:', error);
    }
  }

  /**
   * Clear all reading positions
   */
  public async clearAllPositions(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const positionKeys = keys.filter((key) => key.startsWith(this.keyPrefix));

      if (positionKeys.length > 0) {
        await AsyncStorage.multiRemove(positionKeys);
      }
    } catch (error) {
      console.error('Error clearing reading positions:', error);
    }
  }

  /**
   * Get statistics about stored positions
   */
  public async getStorageStats(): Promise<{
    totalPositions: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    averagePositionsPerBook: number;
  }> {
    try {
      const positions = await this.getAllPositions();

      if (positions.length === 0) {
        return {
          totalPositions: 0,
          oldestTimestamp: null,
          newestTimestamp: null,
          averagePositionsPerBook: 0,
        };
      }

      const timestamps = positions.map((p) => p.timestamp);
      const uniqueBooks = new Set(positions.map((p) => p.bookId));

      return {
        totalPositions: positions.length,
        oldestTimestamp: Math.min(...timestamps),
        newestTimestamp: Math.max(...timestamps),
        averagePositionsPerBook: positions.length / uniqueBooks.size,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalPositions: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        averagePositionsPerBook: 0,
      };
    }
  }

  /**
   * Export all reading positions (for backup)
   */
  public async exportPositions(): Promise<string> {
    try {
      const positions = await this.getAllPositions();
      return JSON.stringify(
        {
          version: '1.0',
          exportDate: new Date().toISOString(),
          positions,
        },
        null,
        2
      );
    } catch (error) {
      console.error('Error exporting positions:', error);
      throw new Error('Failed to export reading positions');
    }
  }

  /**
   * Import reading positions (from backup)
   */
  public async importPositions(jsonData: string): Promise<{ imported: number; errors: number }> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.positions || !Array.isArray(data.positions)) {
        throw new Error('Invalid import data format');
      }

      let imported = 0;
      let errors = 0;

      for (const position of data.positions) {
        try {
          this.validatePosition(position);
          await this.savePosition(position);
          imported++;
        } catch (error) {
          console.warn('Failed to import position:', position, error);
          errors++;
        }
      }

      return { imported, errors };
    } catch (error) {
      console.error('Error importing positions:', error);
      throw new Error('Failed to import reading positions');
    }
  }

  /**
   * Validate stored position data structure
   */
  private isValidStoredPosition(position: any): position is ReadingPosition {
    return (
      position &&
      typeof position.bookId === 'number' &&
      typeof position.chapter === 'number' &&
      typeof position.verse === 'number' &&
      typeof position.scrollPosition === 'number' &&
      typeof position.timestamp === 'number' &&
      position.bookId >= 1 &&
      position.bookId <= 66 &&
      position.chapter >= 1 &&
      position.verse >= 1 &&
      position.scrollPosition >= 0
    );
  }

  /**
   * Clean up old positions to prevent excessive storage usage
   */
  private async cleanupOldPositions(): Promise<void> {
    try {
      const positions = await this.getAllPositions();

      if (positions.length <= this.maxPositions) {
        return;
      }

      // Sort by timestamp and keep only the most recent positions
      const sortedPositions = positions.sort((a, b) => b.timestamp - a.timestamp);
      const positionsToRemove = sortedPositions.slice(this.maxPositions);

      // Remove old positions
      for (const position of positionsToRemove) {
        await this.removePosition(position.bookId, position.chapter);
      }

      console.log(`Cleaned up ${positionsToRemove.length} old reading positions`);
    } catch (error) {
      console.error('Error cleaning up old positions:', error);
    }
  }
}
