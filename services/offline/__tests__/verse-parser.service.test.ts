import { getSpecificVerses } from '../sqlite-manager';
import { parseAndInjectVerses } from '../verse-parser.service';

// Mock sqlite-manager
jest.mock('../sqlite-manager', () => ({
  getSpecificVerses: jest.fn(),
  getLocalBibleChapter: jest.fn(),
  initDatabase: jest.fn().mockResolvedValue({}),
}));

describe('verse-parser.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses and injects a single verse reference', async () => {
    const input = 'As seen in {verse:Genesis 1:1}.';
    (getSpecificVerses as jest.Mock).mockResolvedValue([
      { verse_number: 1, text: 'In the beginning God created the heavens and the earth.' },
    ]);

    const result = await parseAndInjectVerses(input, 'NASB1995', { includeVerseNumbers: false });

    expect(getSpecificVerses).toHaveBeenCalledWith('NASB1995', 'Genesis', 1, [1]);
    expect(result).toBe('As seen in In the beginning God created the heavens and the earth..');
  });

  it('parses and injects a range of verses with numbers', async () => {
    const input = 'Check {verse:John 3:16-17}.';
    (getSpecificVerses as jest.Mock).mockResolvedValue([
      { verse_number: 16, text: 'For God so loved the world...' },
      { verse_number: 17, text: 'For God did not send the Son...' },
    ]);

    const result = await parseAndInjectVerses(input, 'NASB1995', { includeVerseNumbers: true });

    expect(getSpecificVerses).toHaveBeenCalledWith('NASB1995', 'John', 3, [16, 17]);
    // Note: implementation joins with \n
    expect(result).toBe(
      'Check 16\nFor God so loved the world...\n17\nFor God did not send the Son....'
    );
  });

  it('includes reference if requested', async () => {
    const input = 'Read {verse:Psalms 23:1}.';
    (getSpecificVerses as jest.Mock).mockResolvedValue([
      { verse_number: 1, text: 'The Lord is my shepherd' },
    ]);

    const result = await parseAndInjectVerses(input, 'NASB1995', {
      includeReference: true,
      includeVerseNumbers: false,
    });

    expect(result).toBe('Read The Lord is my shepherd (Psalms 23:1).');
  });

  it('handles multiple references in one text', async () => {
    const input = '{verse:Genesis 1:1} and {verse:Genesis 1:2}.';
    (getSpecificVerses as jest.Mock)
      .mockResolvedValueOnce([{ verse_number: 1, text: 'Verse 1' }])
      .mockResolvedValueOnce([{ verse_number: 2, text: 'Verse 2' }]);

    const result = await parseAndInjectVerses(input, 'NASB1995', { includeVerseNumbers: false });

    expect(result).toBe('Verse 1 and Verse 2.');
  });

  it('returns original text if verse not found', async () => {
    const input = '{verse:Unknown 1:1}';
    (getSpecificVerses as jest.Mock).mockResolvedValue([]);

    const result = await parseAndInjectVerses(input, 'NASB1995');

    expect(result).toBe('{verse:Unknown 1:1}');
  });
});
