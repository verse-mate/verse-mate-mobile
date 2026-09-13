/**
 * The USFM table is positional, so it is verified against BIBLE_BOOKS rather
 * than trusted by eye — a single shifted entry would silently request the wrong
 * book's audio.
 */
import { BIBLE_BOOKS } from '@/constants/bible-books';
import {
  bookIdForUsfm,
  chaptersForBook,
  chaptersForTestament,
  testamentForBookId,
  usfmForBookId,
} from '@/lib/bible-brain/usfm-books';

describe('usfmForBookId', () => {
  it('covers all 66 books with unique codes', () => {
    const codes = BIBLE_BOOKS.map((book) => usfmForBookId(book.id));
    expect(codes.filter((code) => code === null)).toEqual([]);
    expect(new Set(codes).size).toBe(66);
    expect(BIBLE_BOOKS).toHaveLength(66);
  });

  it('maps the anchors Bible Brain is addressed by', () => {
    expect(usfmForBookId(1)).toBe('GEN');
    expect(usfmForBookId(40)).toBe('MAT');
    expect(usfmForBookId(41)).toBe('MRK');
    expect(usfmForBookId(43)).toBe('JHN');
    expect(usfmForBookId(66)).toBe('REV');
  });

  it('keeps the testament boundary aligned with BIBLE_BOOKS', () => {
    // Malachi is the last OT book, Matthew the first NT one.
    expect(usfmForBookId(39)).toBe('MAL');
    expect(testamentForBookId(39)).toBe('OT');
    expect(testamentForBookId(40)).toBe('NT');
  });

  it('rejects out-of-range and non-integer ids', () => {
    expect(usfmForBookId(0)).toBeNull();
    expect(usfmForBookId(67)).toBeNull();
    expect(usfmForBookId(1.5)).toBeNull();
    expect(usfmForBookId(Number.NaN)).toBeNull();
  });
});

describe('bookIdForUsfm', () => {
  it('round-trips every book', () => {
    for (const book of BIBLE_BOOKS) {
      const usfm = usfmForBookId(book.id);
      expect(usfm).not.toBeNull();
      expect(bookIdForUsfm(usfm as string)).toBe(book.id);
    }
  });

  it('is case-insensitive and null for an unknown code', () => {
    expect(bookIdForUsfm('jhn')).toBe(43);
    expect(bookIdForUsfm('ZZZ')).toBeNull();
  });
});

describe('chaptersForBook', () => {
  it('produces one ref per chapter using the real chapter count', () => {
    const refs = chaptersForBook('ENGESVN1DA', 43);
    expect(refs).toHaveLength(21); // John has 21 chapters
    expect(refs[0]).toEqual({ filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 1 });
    expect(refs[20].chapter).toBe(21);
  });

  it('is empty for an unknown book', () => {
    expect(chaptersForBook('ENGESVN1DA', 999)).toEqual([]);
  });
});

describe('chaptersForTestament', () => {
  it('covers the whole New Testament', () => {
    const refs = chaptersForTestament('ENGESVN1DA', 'NT');
    const expected = BIBLE_BOOKS.filter((b) => b.testament === 'NT').reduce(
      (sum, b) => sum + b.chapterCount,
      0
    );
    expect(refs).toHaveLength(expected);
    expect(refs[0].book).toBe('MAT');
    expect(refs[refs.length - 1].book).toBe('REV');
  });

  it('covers the whole Old Testament', () => {
    const refs = chaptersForTestament('ENGESVO1DA', 'OT');
    expect(refs[0].book).toBe('GEN');
    expect(refs[refs.length - 1].book).toBe('MAL');
  });
});
