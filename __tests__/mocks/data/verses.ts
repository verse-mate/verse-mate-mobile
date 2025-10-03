/**
 * Mock Bible Verse Data Factory
 *
 * Factory functions for creating mock Bible verse data for VerseMate tests
 * @version 1.0.0 - Initial version (2025-10-03)
 */

export interface Verse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation?: string;
}

export interface VerseWithExplanation extends Verse {
  explanation?: {
    id: string;
    content: string;
    language: string;
    generatedAt: Date;
  };
}

/**
 * Create a mock Bible verse
 */
export const createMockVerse = (overrides?: Partial<Verse>): Verse => ({
  id: 'verse-1',
  book: 'John',
  chapter: 3,
  verse: 16,
  text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
  translation: 'NIV',
  ...overrides,
});

/**
 * Create a mock verse with AI explanation
 */
export const createMockVerseWithExplanation = (
  overrides?: Partial<VerseWithExplanation>
): VerseWithExplanation => ({
  ...createMockVerse(),
  explanation: {
    id: 'explanation-1',
    content: 'This verse is often called the "Gospel in a nutshell" as it summarizes the core message of Christianity: God\'s love for humanity and the gift of salvation through Jesus Christ.',
    language: 'en',
    generatedAt: new Date('2025-10-03T12:00:00Z'),
  },
  ...overrides,
});

// Predefined verse fixtures
export const mockJohn316 = createMockVerse({
  id: 'john-3-16',
  book: 'John',
  chapter: 3,
  verse: 16,
  text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
  translation: 'NIV',
});

export const mockPsalm23 = createMockVerse({
  id: 'psalm-23-1',
  book: 'Psalm',
  chapter: 23,
  verse: 1,
  text: 'The Lord is my shepherd, I lack nothing.',
  translation: 'NIV',
});

export const mockGenesis11 = createMockVerse({
  id: 'genesis-1-1',
  book: 'Genesis',
  chapter: 1,
  verse: 1,
  text: 'In the beginning God created the heavens and the earth.',
  translation: 'NIV',
});

export const mockProverbs31 = createMockVerse({
  id: 'proverbs-3-1',
  book: 'Proverbs',
  chapter: 3,
  verse: 5,
  text: 'Trust in the Lord with all your heart and lean not on your own understanding.',
  translation: 'NIV',
});

export const mockRomans828 = createMockVerse({
  id: 'romans-8-28',
  book: 'Romans',
  chapter: 8,
  verse: 28,
  text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
  translation: 'NIV',
});

/**
 * Create a list of mock verses
 */
export const createMockVerseList = (count: number = 5): Verse[] => {
  const verses = [mockJohn316, mockPsalm23, mockGenesis11, mockProverbs31, mockRomans828];
  return verses.slice(0, count);
};
