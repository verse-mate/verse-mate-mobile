/**
 * Where a run of verses breaks into paragraphs.
 *
 * The API gives verses with no paragraph marks, so the reader breaks them
 * itself: at most five verses per paragraph, and earlier at a sentence end
 * followed by a transition word ("Then", "Now", "But"...). Shared so every
 * place that shows scripture paragraphs it the same way; the Jesus passages
 * used to run a whole account as one block.
 */

/**
 * Check if a verse text starts with a Biblical transition word
 */
export function startsWithTransitionWord(text: string): boolean {
  const transitions = [
    'Then',
    'After',
    'Meanwhile',
    'Now',
    'When',
    'While',
    'But',
    'Yet',
    'However',
    'Nevertheless',
    'Therefore',
    'Thus',
    'So',
    'Accordingly',
    'Moreover',
    'Furthermore',
    'Also',
    'And',
  ];

  const firstWord = text.trim().split(/\s+/)[0];
  const cleanWord = firstWord.replace(/[.,;:!?"']/g, '');
  return transitions.includes(cleanWord);
}

/**
 * Calculate intelligent paragraph break points for a section
 */
export function calculateBreakPoints(verses: { verseNumber: number; text: string }[]): number[] {
  const breakAfter: number[] = [];

  if (verses.length <= 3) return [];

  let versesSinceLastBreak = 0;

  for (let i = 0; i < verses.length - 1; i++) {
    const currentVerse = verses[i];
    const nextVerse = verses[i + 1];
    versesSinceLastBreak++;

    if (versesSinceLastBreak >= 5) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
      continue;
    }

    const endsWithPeriod = currentVerse.text.trim().endsWith('.');
    const nextStartsWithTransition = startsWithTransitionWord(nextVerse.text);

    if (endsWithPeriod && nextStartsWithTransition && versesSinceLastBreak >= 2) {
      breakAfter.push(currentVerse.verseNumber);
      versesSinceLastBreak = 0;
    }
  }

  return breakAfter;
}

/** Split verses into paragraph groups at `calculateBreakPoints`. */
export function groupIntoParagraphs<V extends { verseNumber: number; text: string }>(
  verses: V[]
): V[][] {
  const breakPoints = new Set(calculateBreakPoints(verses));
  const groups: V[][] = [];
  let current: V[] = [];
  verses.forEach((verse, index) => {
    current.push(verse);
    if (breakPoints.has(verse.verseNumber) || index === verses.length - 1) {
      groups.push(current);
      current = [];
    }
  });
  return groups;
}
