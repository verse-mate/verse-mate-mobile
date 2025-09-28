import { BookMappingService } from '@/utils/bookMapping';

describe('BookMappingService', () => {
  let service: BookMappingService;

  beforeEach(() => {
    service = new BookMappingService();
  });

  describe('getBookName', () => {
    it('should return correct book names for Old Testament books', () => {
      expect(service.getBookName(1)).toBe('Genesis');
      expect(service.getBookName(2)).toBe('Exodus');
      expect(service.getBookName(39)).toBe('Malachi');
    });

    it('should return correct book names for New Testament books', () => {
      expect(service.getBookName(40)).toBe('Matthew');
      expect(service.getBookName(41)).toBe('Mark');
      expect(service.getBookName(66)).toBe('Revelation');
    });

    it('should throw error for invalid book IDs', () => {
      expect(() => service.getBookName(0)).toThrow('Invalid book ID: 0');
      expect(() => service.getBookName(67)).toThrow('Invalid book ID: 67');
      expect(() => service.getBookName(-1)).toThrow('Invalid book ID: -1');
    });
  });

  describe('getBookId', () => {
    it('should return correct book IDs for Old Testament books', () => {
      expect(service.getBookId('Genesis')).toBe(1);
      expect(service.getBookId('Exodus')).toBe(2);
      expect(service.getBookId('Malachi')).toBe(39);
    });

    it('should return correct book IDs for New Testament books', () => {
      expect(service.getBookId('Matthew')).toBe(40);
      expect(service.getBookId('Mark')).toBe(41);
      expect(service.getBookId('Revelation')).toBe(66);
    });

    it('should be case insensitive', () => {
      expect(service.getBookId('genesis')).toBe(1);
      expect(service.getBookId('GENESIS')).toBe(1);
      expect(service.getBookId('GeNeSiS')).toBe(1);
    });

    it('should handle variations in book names', () => {
      expect(service.getBookId('1 Samuel')).toBe(9);
      expect(service.getBookId('1Samuel')).toBe(9);
      expect(service.getBookId('First Samuel')).toBe(9);
      expect(service.getBookId('I Samuel')).toBe(9);
    });

    it('should throw error for invalid book names', () => {
      expect(() => service.getBookId('InvalidBook')).toThrow('Invalid book name: InvalidBook');
      expect(() => service.getBookId('')).toThrow('Invalid book name: ');
    });
  });

  describe('getTestament', () => {
    it('should return "old" for Old Testament books', () => {
      expect(service.getTestament(1)).toBe('old'); // Genesis
      expect(service.getTestament(20)).toBe('old'); // Proverbs
      expect(service.getTestament(39)).toBe('old'); // Malachi
    });

    it('should return "new" for New Testament books', () => {
      expect(service.getTestament(40)).toBe('new'); // Matthew
      expect(service.getTestament(50)).toBe('new'); // Philippians
      expect(service.getTestament(66)).toBe('new'); // Revelation
    });

    it('should throw error for invalid book IDs', () => {
      expect(() => service.getTestament(0)).toThrow('Invalid book ID: 0');
      expect(() => service.getTestament(67)).toThrow('Invalid book ID: 67');
    });
  });

  describe('getNextBook', () => {
    it('should return next book within same testament', () => {
      const nextBook = service.getNextBook(1); // Genesis
      expect(nextBook).toEqual({ bookId: 2, name: 'Exodus' });

      const nextNTBook = service.getNextBook(40); // Matthew
      expect(nextNTBook).toEqual({ bookId: 41, name: 'Mark' });
    });

    it('should transition from Old Testament to New Testament', () => {
      const nextBook = service.getNextBook(39); // Malachi (last OT book)
      expect(nextBook).toEqual({ bookId: 40, name: 'Matthew' });
    });

    it('should return null for the last book in the Bible', () => {
      const nextBook = service.getNextBook(66); // Revelation
      expect(nextBook).toBeNull();
    });

    it('should throw error for invalid book IDs', () => {
      expect(() => service.getNextBook(0)).toThrow('Invalid book ID: 0');
      expect(() => service.getNextBook(67)).toThrow('Invalid book ID: 67');
    });
  });

  describe('getPreviousBook', () => {
    it('should return previous book within same testament', () => {
      const prevBook = service.getPreviousBook(2); // Exodus
      expect(prevBook).toEqual({ bookId: 1, name: 'Genesis' });

      const prevNTBook = service.getPreviousBook(41); // Mark
      expect(prevNTBook).toEqual({ bookId: 40, name: 'Matthew' });
    });

    it('should transition from New Testament to Old Testament', () => {
      const prevBook = service.getPreviousBook(40); // Matthew (first NT book)
      expect(prevBook).toEqual({ bookId: 39, name: 'Malachi' });
    });

    it('should return null for the first book in the Bible', () => {
      const prevBook = service.getPreviousBook(1); // Genesis
      expect(prevBook).toBeNull();
    });

    it('should throw error for invalid book IDs', () => {
      expect(() => service.getPreviousBook(0)).toThrow('Invalid book ID: 0');
      expect(() => service.getPreviousBook(67)).toThrow('Invalid book ID: 67');
    });
  });

  describe('getLastChapterOfBook', () => {
    it('should return correct last chapter numbers for various books', () => {
      expect(service.getLastChapterOfBook(1)).toBe(50); // Genesis
      expect(service.getLastChapterOfBook(19)).toBe(150); // Psalms
      expect(service.getLastChapterOfBook(40)).toBe(28); // Matthew
      expect(service.getLastChapterOfBook(66)).toBe(22); // Revelation
    });

    it('should return 1 for single-chapter books', () => {
      expect(service.getLastChapterOfBook(31)).toBe(1); // Obadiah
      expect(service.getLastChapterOfBook(57)).toBe(1); // Philemon
      expect(service.getLastChapterOfBook(64)).toBe(1); // 3 John
    });

    it('should throw error for invalid book IDs', () => {
      expect(() => service.getLastChapterOfBook(0)).toThrow('Invalid book ID: 0');
      expect(() => service.getLastChapterOfBook(67)).toThrow('Invalid book ID: 67');
    });
  });

  describe('isLastChapter', () => {
    it('should return true for last chapters of books', () => {
      expect(service.isLastChapter(1, 50)).toBe(true); // Genesis 50
      expect(service.isLastChapter(40, 28)).toBe(true); // Matthew 28
      expect(service.isLastChapter(66, 22)).toBe(true); // Revelation 22
    });

    it('should return false for non-last chapters', () => {
      expect(service.isLastChapter(1, 49)).toBe(false); // Genesis 49
      expect(service.isLastChapter(40, 27)).toBe(false); // Matthew 27
      expect(service.isLastChapter(66, 21)).toBe(false); // Revelation 21
    });

    it('should return true for single-chapter books', () => {
      expect(service.isLastChapter(31, 1)).toBe(true); // Obadiah 1
      expect(service.isLastChapter(57, 1)).toBe(true); // Philemon 1
    });

    it('should throw error for invalid parameters', () => {
      expect(() => service.isLastChapter(0, 1)).toThrow('Invalid book ID: 0');
      expect(() => service.isLastChapter(1, 0)).toThrow('Invalid chapter number: 0');
      expect(() => service.isLastChapter(1, 51)).toThrow('Invalid chapter number for Genesis: 51');
    });
  });

  describe('getAllBooks', () => {
    it('should return all 66 books in correct order', () => {
      const books = service.getAllBooks();

      expect(books).toHaveLength(66);
      expect(books[0]).toEqual({ id: 1, name: 'Genesis', testament: 'old', chapters: 50 });
      expect(books[38]).toEqual({ id: 39, name: 'Malachi', testament: 'old', chapters: 4 });
      expect(books[39]).toEqual({ id: 40, name: 'Matthew', testament: 'new', chapters: 28 });
      expect(books[65]).toEqual({ id: 66, name: 'Revelation', testament: 'new', chapters: 22 });
    });

    it('should return books with all required properties', () => {
      const books = service.getAllBooks();

      books.forEach((book) => {
        expect(book).toHaveProperty('id');
        expect(book).toHaveProperty('name');
        expect(book).toHaveProperty('testament');
        expect(book).toHaveProperty('chapters');

        expect(typeof book.id).toBe('number');
        expect(typeof book.name).toBe('string');
        expect(['old', 'new']).toContain(book.testament);
        expect(typeof book.chapters).toBe('number');
        expect(book.chapters).toBeGreaterThan(0);
      });
    });
  });

  describe('getBooksByTestament', () => {
    it('should return Old Testament books', () => {
      const oldTestamentBooks = service.getBooksByTestament('old');

      expect(oldTestamentBooks).toHaveLength(39);
      expect(oldTestamentBooks[0].name).toBe('Genesis');
      expect(oldTestamentBooks[38].name).toBe('Malachi');
      oldTestamentBooks.forEach((book) => {
        expect(book.testament).toBe('old');
      });
    });

    it('should return New Testament books', () => {
      const newTestamentBooks = service.getBooksByTestament('new');

      expect(newTestamentBooks).toHaveLength(27);
      expect(newTestamentBooks[0].name).toBe('Matthew');
      expect(newTestamentBooks[26].name).toBe('Revelation');
      newTestamentBooks.forEach((book) => {
        expect(book.testament).toBe('new');
      });
    });

    it('should throw error for invalid testament', () => {
      expect(() => service.getBooksByTestament('invalid' as any)).toThrow('Invalid testament: invalid');
    });
  });

  describe('searchBooks', () => {
    it('should find books by exact name match', () => {
      const results = service.searchBooks('Genesis');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Genesis');
    });

    it('should find books by partial name match', () => {
      const results = service.searchBooks('Samuel');
      expect(results).toHaveLength(2);
      expect(results.map(book => book.name)).toContain('1 Samuel');
      expect(results.map(book => book.name)).toContain('2 Samuel');
    });

    it('should be case insensitive', () => {
      const results = service.searchBooks('john');
      expect(results.length).toBeGreaterThan(0);
      expect(results.map(book => book.name)).toContain('John');
    });

    it('should return empty array for no matches', () => {
      const results = service.searchBooks('InvalidBook');
      expect(results).toHaveLength(0);
    });

    it('should handle empty search query', () => {
      const results = service.searchBooks('');
      expect(results).toHaveLength(66); // Returns all books
    });
  });

  describe('Edge Cases', () => {
    it('should handle book transitions correctly', () => {
      // Test transition from Genesis to Exodus
      const nextFromGenesis = service.getNextBook(1);
      expect(nextFromGenesis?.bookId).toBe(2);

      // Test transition from Malachi to Matthew
      const nextFromMalachi = service.getNextBook(39);
      expect(nextFromMalachi?.bookId).toBe(40);

      // Test transition from Matthew to Malachi (previous)
      const prevFromMatthew = service.getPreviousBook(40);
      expect(prevFromMatthew?.bookId).toBe(39);
    });

    it('should handle boundary books correctly', () => {
      // First book
      expect(service.getPreviousBook(1)).toBeNull();
      expect(service.getNextBook(1)?.bookId).toBe(2);

      // Last book
      expect(service.getNextBook(66)).toBeNull();
      expect(service.getPreviousBook(66)?.bookId).toBe(65);
    });

    it('should validate chapter ranges correctly', () => {
      // Test valid chapters
      expect(() => service.isLastChapter(1, 1)).not.toThrow();
      expect(() => service.isLastChapter(1, 50)).not.toThrow();

      // Test invalid chapters
      expect(() => service.isLastChapter(1, 0)).toThrow();
      expect(() => service.isLastChapter(1, 51)).toThrow();
    });
  });
});