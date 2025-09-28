/**
 * Book Mapping Service
 * Provides utilities for Bible book navigation and cross-references
 */

export interface BookInfo {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
}

export interface BookReference {
  bookId: number;
  name: string;
}

/**
 * Complete Bible book mapping with IDs 1-66
 */
const BIBLE_BOOKS: BookInfo[] = [
  // Old Testament (1-39)
  { id: 1, name: 'Genesis', testament: 'old', chapters: 50 },
  { id: 2, name: 'Exodus', testament: 'old', chapters: 40 },
  { id: 3, name: 'Leviticus', testament: 'old', chapters: 27 },
  { id: 4, name: 'Numbers', testament: 'old', chapters: 36 },
  { id: 5, name: 'Deuteronomy', testament: 'old', chapters: 34 },
  { id: 6, name: 'Joshua', testament: 'old', chapters: 24 },
  { id: 7, name: 'Judges', testament: 'old', chapters: 21 },
  { id: 8, name: 'Ruth', testament: 'old', chapters: 4 },
  { id: 9, name: '1 Samuel', testament: 'old', chapters: 31 },
  { id: 10, name: '2 Samuel', testament: 'old', chapters: 24 },
  { id: 11, name: '1 Kings', testament: 'old', chapters: 22 },
  { id: 12, name: '2 Kings', testament: 'old', chapters: 25 },
  { id: 13, name: '1 Chronicles', testament: 'old', chapters: 29 },
  { id: 14, name: '2 Chronicles', testament: 'old', chapters: 36 },
  { id: 15, name: 'Ezra', testament: 'old', chapters: 10 },
  { id: 16, name: 'Nehemiah', testament: 'old', chapters: 13 },
  { id: 17, name: 'Esther', testament: 'old', chapters: 10 },
  { id: 18, name: 'Job', testament: 'old', chapters: 42 },
  { id: 19, name: 'Psalms', testament: 'old', chapters: 150 },
  { id: 20, name: 'Proverbs', testament: 'old', chapters: 31 },
  { id: 21, name: 'Ecclesiastes', testament: 'old', chapters: 12 },
  { id: 22, name: 'Song of Solomon', testament: 'old', chapters: 8 },
  { id: 23, name: 'Isaiah', testament: 'old', chapters: 66 },
  { id: 24, name: 'Jeremiah', testament: 'old', chapters: 52 },
  { id: 25, name: 'Lamentations', testament: 'old', chapters: 5 },
  { id: 26, name: 'Ezekiel', testament: 'old', chapters: 48 },
  { id: 27, name: 'Daniel', testament: 'old', chapters: 12 },
  { id: 28, name: 'Hosea', testament: 'old', chapters: 14 },
  { id: 29, name: 'Joel', testament: 'old', chapters: 3 },
  { id: 30, name: 'Amos', testament: 'old', chapters: 9 },
  { id: 31, name: 'Obadiah', testament: 'old', chapters: 1 },
  { id: 32, name: 'Jonah', testament: 'old', chapters: 4 },
  { id: 33, name: 'Micah', testament: 'old', chapters: 7 },
  { id: 34, name: 'Nahum', testament: 'old', chapters: 3 },
  { id: 35, name: 'Habakkuk', testament: 'old', chapters: 3 },
  { id: 36, name: 'Zephaniah', testament: 'old', chapters: 3 },
  { id: 37, name: 'Haggai', testament: 'old', chapters: 2 },
  { id: 38, name: 'Zechariah', testament: 'old', chapters: 14 },
  { id: 39, name: 'Malachi', testament: 'old', chapters: 4 },

  // New Testament (40-66)
  { id: 40, name: 'Matthew', testament: 'new', chapters: 28 },
  { id: 41, name: 'Mark', testament: 'new', chapters: 16 },
  { id: 42, name: 'Luke', testament: 'new', chapters: 24 },
  { id: 43, name: 'John', testament: 'new', chapters: 21 },
  { id: 44, name: 'Acts', testament: 'new', chapters: 28 },
  { id: 45, name: 'Romans', testament: 'new', chapters: 16 },
  { id: 46, name: '1 Corinthians', testament: 'new', chapters: 16 },
  { id: 47, name: '2 Corinthians', testament: 'new', chapters: 13 },
  { id: 48, name: 'Galatians', testament: 'new', chapters: 6 },
  { id: 49, name: 'Ephesians', testament: 'new', chapters: 6 },
  { id: 50, name: 'Philippians', testament: 'new', chapters: 4 },
  { id: 51, name: 'Colossians', testament: 'new', chapters: 4 },
  { id: 52, name: '1 Thessalonians', testament: 'new', chapters: 5 },
  { id: 53, name: '2 Thessalonians', testament: 'new', chapters: 3 },
  { id: 54, name: '1 Timothy', testament: 'new', chapters: 6 },
  { id: 55, name: '2 Timothy', testament: 'new', chapters: 4 },
  { id: 56, name: 'Titus', testament: 'new', chapters: 3 },
  { id: 57, name: 'Philemon', testament: 'new', chapters: 1 },
  { id: 58, name: 'Hebrews', testament: 'new', chapters: 13 },
  { id: 59, name: 'James', testament: 'new', chapters: 5 },
  { id: 60, name: '1 Peter', testament: 'new', chapters: 5 },
  { id: 61, name: '2 Peter', testament: 'new', chapters: 3 },
  { id: 62, name: '1 John', testament: 'new', chapters: 5 },
  { id: 63, name: '2 John', testament: 'new', chapters: 1 },
  { id: 64, name: '3 John', testament: 'new', chapters: 1 },
  { id: 65, name: 'Jude', testament: 'new', chapters: 1 },
  { id: 66, name: 'Revelation', testament: 'new', chapters: 22 },
];

/**
 * Alternative book names and abbreviations for flexible lookup
 */
const BOOK_ALIASES: Record<string, number> = {
  // Standard abbreviations
  gen: 1,
  gn: 1,
  ex: 2,
  exo: 2,
  exod: 2,
  lev: 3,
  le: 3,
  lv: 3,
  num: 4,
  nu: 4,
  nm: 4,
  nb: 4,
  deut: 5,
  dt: 5,
  de: 5,
  josh: 6,
  jos: 6,
  jsh: 6,
  judg: 7,
  jdg: 7,
  jg: 7,
  jdgs: 7,
  ru: 8,
  rut: 8,
  rth: 8,

  // Samuel, Kings, Chronicles with variations
  '1sam': 9,
  '1 sam': 9,
  'i samuel': 9,
  'first samuel': 9,
  '1samuel': 9,
  '2sam': 10,
  '2 sam': 10,
  'ii samuel': 10,
  'second samuel': 10,
  '2samuel': 10,
  '1kgs': 11,
  '1 kgs': 11,
  '1 kings': 11,
  'i kings': 11,
  'first kings': 11,
  '1kings': 11,
  '2kgs': 12,
  '2 kgs': 12,
  '2 kings': 12,
  'ii kings': 12,
  'second kings': 12,
  '2kings': 12,
  '1chr': 13,
  '1 chr': 13,
  '1 chronicles': 13,
  'i chronicles': 13,
  'first chronicles': 13,
  '1chronicles': 13,
  '2chr': 14,
  '2 chr': 14,
  '2 chronicles': 14,
  'ii chronicles': 14,
  'second chronicles': 14,
  '2chronicles': 14,

  ezr: 15,
  ez: 15,
  neh: 16,
  ne: 16,
  est: 17,
  esth: 17,
  jb: 18,
  ps: 19,
  psa: 19,
  psalm: 19,
  pss: 19,
  pr: 20,
  pro: 20,
  prov: 20,
  prv: 20,
  ecc: 21,
  ec: 21,
  eccl: 21,
  eccles: 21,
  ss: 22,
  so: 22,
  sos: 22,
  song: 22,
  canticles: 22,
  is: 23,
  isa: 23,
  jer: 24,
  je: 24,
  jr: 24,
  lam: 25,
  la: 25,
  eze: 26,
  ezk: 26,
  ezek: 26,
  dan: 27,
  da: 27,
  dn: 27,
  hos: 28,
  ho: 28,
  jl: 29,
  joe: 29,
  am: 30,
  amo: 30,
  ob: 31,
  oba: 31,
  obad: 31,
  jon: 32,
  jnh: 32,
  mic: 33,
  mi: 33,
  na: 34,
  nah: 34,
  nam: 34,
  hab: 35,
  hb: 35,
  zep: 36,
  zph: 36,
  hag: 37,
  hg: 37,
  zec: 38,
  zch: 38,
  zech: 38,
  mal: 39,
  ml: 39,

  // New Testament
  mt: 40,
  mat: 40,
  matt: 40,
  mk: 41,
  mar: 41,
  lk: 42,
  lu: 42,
  luk: 42,
  jn: 43,
  joh: 43,
  ac: 44,
  act: 44,
  ro: 45,
  rom: 45,
  '1cor': 46,
  '1 cor': 46,
  '1 corinthians': 46,
  'i corinthians': 46,
  'first corinthians': 46,
  '1corinthians': 46,
  '2cor': 47,
  '2 cor': 47,
  '2 corinthians': 47,
  'ii corinthians': 47,
  'second corinthians': 47,
  '2corinthians': 47,
  gal: 48,
  ga: 48,
  eph: 49,
  ep: 49,
  php: 50,
  phi: 50,
  phil: 50,
  col: 51,
  co: 51,
  '1th': 52,
  '1 th': 52,
  '1 thessalonians': 52,
  'i thessalonians': 52,
  'first thessalonians': 52,
  '1thessalonians': 52,
  '2th': 53,
  '2 th': 53,
  '2 thessalonians': 53,
  'ii thessalonians': 53,
  'second thessalonians': 53,
  '2thessalonians': 53,
  '1ti': 54,
  '1 ti': 54,
  '1 timothy': 54,
  'i timothy': 54,
  'first timothy': 54,
  '1timothy': 54,
  '2ti': 55,
  '2 ti': 55,
  '2 timothy': 55,
  'ii timothy': 55,
  'second timothy': 55,
  '2timothy': 55,
  tit: 56,
  ti: 56,
  phm: 57,
  pm: 57,
  phlm: 57,
  heb: 58,
  he: 58,
  jas: 59,
  jm: 59,
  jam: 59,
  '1pe': 60,
  '1 pe': 60,
  '1 peter': 60,
  'i peter': 60,
  'first peter': 60,
  '1peter': 60,
  '2pe': 61,
  '2 pe': 61,
  '2 peter': 61,
  'ii peter': 61,
  'second peter': 61,
  '2peter': 61,
  '1jn': 62,
  '1 jn': 62,
  '1 john': 62,
  'i john': 62,
  'first john': 62,
  '1john': 62,
  '2jn': 63,
  '2 jn': 63,
  '2 john': 63,
  'ii john': 63,
  'second john': 63,
  '2john': 63,
  '3jn': 64,
  '3 jn': 64,
  '3 john': 64,
  'iii john': 64,
  'third john': 64,
  '3john': 64,
  jud: 65,
  jude: 65,
  rev: 66,
  re: 66,
  revelation: 66,
  apocalypse: 66,
};

/**
 * Service for Bible book mapping and navigation utilities
 */
export class BookMappingService {
  /**
   * Get book name by ID
   */
  public getBookName(bookId: number): string {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }
    return book.name;
  }

  /**
   * Get book ID by name (supports aliases and abbreviations)
   */
  public getBookId(bookName: string): number {
    const normalizedName = bookName.toLowerCase().trim();

    // Try exact match first
    const exactMatch = BIBLE_BOOKS.find((book) => book.name.toLowerCase() === normalizedName);
    if (exactMatch) {
      return exactMatch.id;
    }

    // Try alias lookup
    const aliasMatch = BOOK_ALIASES[normalizedName];
    if (aliasMatch) {
      return aliasMatch;
    }

    throw new Error(`Invalid book name: ${bookName}`);
  }

  /**
   * Get testament for a book ID
   */
  public getTestament(bookId: number): 'old' | 'new' {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }
    return book.testament;
  }

  /**
   * Get next book in sequence (handles cross-testament navigation)
   */
  public getNextBook(bookId: number): BookReference | null {
    if (bookId < 1 || bookId > 66) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }

    if (bookId === 66) {
      return null; // Revelation is the last book
    }

    const nextBookId = bookId + 1;
    return {
      bookId: nextBookId,
      name: this.getBookName(nextBookId),
    };
  }

  /**
   * Get previous book in sequence (handles cross-testament navigation)
   */
  public getPreviousBook(bookId: number): BookReference | null {
    if (bookId < 1 || bookId > 66) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }

    if (bookId === 1) {
      return null; // Genesis is the first book
    }

    const prevBookId = bookId - 1;
    return {
      bookId: prevBookId,
      name: this.getBookName(prevBookId),
    };
  }

  /**
   * Get last chapter number for a book
   */
  public getLastChapterOfBook(bookId: number): number {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }
    return book.chapters;
  }

  /**
   * Check if a chapter is the last chapter of a book
   */
  public isLastChapter(bookId: number, chapterNumber: number): boolean {
    if (bookId < 1 || bookId > 66) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }

    if (chapterNumber < 1) {
      throw new Error(`Invalid chapter number: ${chapterNumber}`);
    }

    const lastChapter = this.getLastChapterOfBook(bookId);

    if (chapterNumber > lastChapter) {
      const bookName = this.getBookName(bookId);
      throw new Error(`Invalid chapter number for ${bookName}: ${chapterNumber}`);
    }

    return chapterNumber === lastChapter;
  }

  /**
   * Get all books
   */
  public getAllBooks(): BookInfo[] {
    return [...BIBLE_BOOKS]; // Return copy to prevent mutation
  }

  /**
   * Get books by testament
   */
  public getBooksByTestament(testament: 'old' | 'new'): BookInfo[] {
    if (testament !== 'old' && testament !== 'new') {
      throw new Error(`Invalid testament: ${testament}`);
    }

    return BIBLE_BOOKS.filter((book) => book.testament === testament);
  }

  /**
   * Search books by name (fuzzy search)
   */
  public searchBooks(query: string): BookInfo[] {
    if (!query || query.trim().length === 0) {
      return this.getAllBooks();
    }

    const normalizedQuery = query.toLowerCase().trim();

    return BIBLE_BOOKS.filter((book) => {
      const bookName = book.name.toLowerCase();
      return (
        bookName.includes(normalizedQuery) ||
        bookName.replace(/\s+/g, '').includes(normalizedQuery.replace(/\s+/g, ''))
      );
    });
  }

  /**
   * Get book info by ID
   */
  public getBookInfo(bookId: number): BookInfo {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    if (!book) {
      throw new Error(`Invalid book ID: ${bookId}`);
    }
    return { ...book }; // Return copy to prevent mutation
  }

  /**
   * Validate book and chapter combination
   */
  public isValidChapter(bookId: number, chapterNumber: number): boolean {
    try {
      const book = this.getBookInfo(bookId);
      return chapterNumber >= 1 && chapterNumber <= book.chapters;
    } catch {
      return false;
    }
  }

  /**
   * Get next chapter reference (handles cross-book navigation)
   */
  public getNextChapter(
    bookId: number,
    chapterNumber: number
  ): { bookId: number; chapter: number } | null {
    if (!this.isValidChapter(bookId, chapterNumber)) {
      throw new Error(`Invalid book/chapter combination: ${bookId}/${chapterNumber}`);
    }

    const lastChapter = this.getLastChapterOfBook(bookId);

    if (chapterNumber < lastChapter) {
      // Next chapter in same book
      return { bookId, chapter: chapterNumber + 1 };
    }

    // Next book, first chapter
    const nextBook = this.getNextBook(bookId);
    if (nextBook) {
      return { bookId: nextBook.bookId, chapter: 1 };
    }

    return null; // End of Bible
  }

  /**
   * Get previous chapter reference (handles cross-book navigation)
   */
  public getPreviousChapter(
    bookId: number,
    chapterNumber: number
  ): { bookId: number; chapter: number } | null {
    if (!this.isValidChapter(bookId, chapterNumber)) {
      throw new Error(`Invalid book/chapter combination: ${bookId}/${chapterNumber}`);
    }

    if (chapterNumber > 1) {
      // Previous chapter in same book
      return { bookId, chapter: chapterNumber - 1 };
    }

    // Previous book, last chapter
    const prevBook = this.getPreviousBook(bookId);
    if (prevBook) {
      const lastChapter = this.getLastChapterOfBook(prevBook.bookId);
      return { bookId: prevBook.bookId, chapter: lastChapter };
    }

    return null; // Beginning of Bible
  }

  /**
   * Generate a readable reference string
   */
  public formatReference(bookId: number, chapter?: number, verse?: number): string {
    const bookName = this.getBookName(bookId);

    if (chapter === undefined) {
      return bookName;
    }

    if (verse === undefined) {
      return `${bookName} ${chapter}`;
    }

    return `${bookName} ${chapter}:${verse}`;
  }

  /**
   * Parse a reference string into components
   */
  public parseReference(
    reference: string
  ): { bookId: number; chapter?: number; verse?: number } | null {
    try {
      const trimmed = reference.trim();

      // Match patterns like "Genesis 1:1", "Gen 1", "Genesis"
      const match = trimmed.match(/^(.+?)(?:\s+(\d+)(?::(\d+))?)?$/);

      if (!match) {
        return null;
      }

      const [, bookPart, chapterPart, versePart] = match;

      const bookId = this.getBookId(bookPart);
      const chapter = chapterPart ? parseInt(chapterPart, 10) : undefined;
      const verse = versePart ? parseInt(versePart, 10) : undefined;

      // Validate chapter if provided
      if (chapter !== undefined && !this.isValidChapter(bookId, chapter)) {
        return null;
      }

      return { bookId, chapter, verse };
    } catch {
      return null;
    }
  }

  /**
   * Get reading plan suggestions based on current position
   */
  public getReadingSuggestions(
    currentBookId: number,
    currentChapter: number
  ): {
    bookId: number;
    chapter: number;
    description: string;
  }[] {
    const suggestions = [];

    // Next chapter
    const nextChapter = this.getNextChapter(currentBookId, currentChapter);
    if (nextChapter) {
      suggestions.push({
        ...nextChapter,
        description: 'Continue reading',
      });
    }

    // Popular chapters
    const popularChapters = [
      { bookId: 19, chapter: 23, description: 'Psalm 23 (The Lord is my shepherd)' },
      { bookId: 43, chapter: 3, description: 'John 3 (For God so loved the world)' },
      { bookId: 45, chapter: 8, description: 'Romans 8 (No condemnation)' },
      { bookId: 46, chapter: 13, description: '1 Corinthians 13 (Love chapter)' },
      { bookId: 19, chapter: 91, description: 'Psalm 91 (Protection)' },
    ];

    // Add popular chapters that aren't the current one
    popularChapters.forEach((chapter) => {
      if (chapter.bookId !== currentBookId || chapter.chapter !== currentChapter) {
        suggestions.push(chapter);
      }
    });

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }
}
