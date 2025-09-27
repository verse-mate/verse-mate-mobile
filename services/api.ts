/**
 * VerseMate API Service
 * Handles all communication with the VerseMate API for Bible data fetching
 */

interface Testament {
  id: string;
  name: string;
  books: Book[];
}

interface Book {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
}

interface Verse {
  number: number;
  text: string;
}

interface ChapterData {
  bookId: number;
  bookName: string;
  chapter: number;
  verses: Verse[];
  version: string;
}

interface SearchResult {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  relevanceScore: number;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Cache entry for storing API responses
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * API Service for VerseMate Bible data
 */
export class ApiService {
  private baseUrl: string;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // Base delay in milliseconds
  private readonly defaultCacheTtl: number = 5 * 60 * 1000; // 5 minutes
  private readonly longCacheTtl: number = 60 * 60 * 1000; // 1 hour for static data

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generic HTTP request method with retry logic and caching
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheTtl: number = this.defaultCacheTtl
  ): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

    // Check cache first
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${this.baseUrl}${endpoint}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VerseMate-Mobile/1.0',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as ApiError;
          error.status = response.status;

          // Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          throw error;
        }

        const data: T = await response.json();

        // Cache successful response
        this.setCache(cacheKey, data, cacheTtl);

        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * 2 ** attempt;
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);

    // Prevent memory leaks by limiting cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value as string;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all testaments with their books
   */
  public async getTestaments(): Promise<Testament[]> {
    return this.request<Testament[]>('/bible/testaments', {}, this.longCacheTtl);
  }

  /**
   * Get all books or filter by testament
   */
  public async getBooks(testament?: 'old' | 'new'): Promise<Book[]> {
    const endpoint = testament ? `/bible/books?testament=${testament}` : '/bible/books';
    return this.request<Book[]>(endpoint, {}, this.longCacheTtl);
  }

  /**
   * Get chapter data for a specific book and chapter
   */
  public async getChapter(bookId: number, chapterNumber: number): Promise<ChapterData> {
    // Validate input parameters
    if (!Number.isInteger(bookId) || bookId < 1 || bookId > 66) {
      throw new Error(`Invalid book ID: ${bookId}. Must be between 1 and 66.`);
    }

    if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
      throw new Error(`Invalid chapter number: ${chapterNumber}. Must be a positive integer.`);
    }

    const endpoint = `/bible/book/${bookId}/${chapterNumber}`;
    return this.request<ChapterData>(endpoint, {}, this.defaultCacheTtl);
  }

  /**
   * Search for verses across the Bible
   */
  public async searchChapters(
    query: string,
    testament: 'old' | 'new' | 'all' = 'all'
  ): Promise<SearchResult[]> {
    // Validate search query
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    const params = new URLSearchParams({
      q: query.trim(),
      testament,
    });

    const endpoint = `/bible/search?${params.toString()}`;
    return this.request<SearchResult[]>(endpoint, {}, this.defaultCacheTtl);
  }

  /**
   * Get book information by ID
   */
  public async getBookInfo(bookId: number): Promise<Book> {
    if (!Number.isInteger(bookId) || bookId < 1 || bookId > 66) {
      throw new Error(`Invalid book ID: ${bookId}. Must be between 1 and 66.`);
    }

    const books = await this.getBooks();
    const book = books.find((b) => b.id === bookId);

    if (!book) {
      throw new Error(`Book with ID ${bookId} not found`);
    }

    return book;
  }

  /**
   * Get verse data for a specific verse
   */
  public async getVerse(
    bookId: number,
    chapterNumber: number,
    verseNumber: number
  ): Promise<Verse> {
    const chapterData = await this.getChapter(bookId, chapterNumber);
    const verse = chapterData.verses.find((v) => v.number === verseNumber);

    if (!verse) {
      throw new Error(`Verse ${verseNumber} not found in ${chapterData.bookName} ${chapterNumber}`);
    }

    return verse;
  }

  /**
   * Get verse range (multiple verses)
   */
  public async getVerseRange(
    bookId: number,
    chapterNumber: number,
    startVerse: number,
    endVerse: number
  ): Promise<Verse[]> {
    const chapterData = await this.getChapter(bookId, chapterNumber);

    return chapterData.verses.filter(
      (verse) => verse.number >= startVerse && verse.number <= endVerse
    );
  }

  /**
   * Check if the service is available (health check)
   */
  public async checkHealth(): Promise<boolean> {
    try {
      await this.request('/health', {}, 0); // No caching for health checks
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API status information
   */
  public async getStatus(): Promise<{ status: string; version: string; timestamp: string }> {
    return this.request('/status', {}, 0); // No caching for status
  }

  /**
   * Prefetch commonly accessed data
   */
  public async prefetchCommonData(): Promise<void> {
    try {
      // Prefetch all books (small dataset, frequently accessed)
      await this.getBooks();

      // Prefetch testaments
      await this.getTestaments();

      // Prefetch Genesis 1 (common starting point)
      await this.getChapter(1, 1);

      // Prefetch John 3:16 (commonly referenced verse)
      await this.getChapter(43, 3);
    } catch (error) {
      // Silent fail for prefetching - not critical for functionality
      console.warn('Failed to prefetch common data:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    entries: { key: string; age: number; ttl: number }[];
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}
