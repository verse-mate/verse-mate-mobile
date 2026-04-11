import type { ReadingPlan } from '@/types/reading-plans';

/**
 * Hardcoded reading plans for frontend-only implementation.
 * These will be replaced by backend API data when available.
 */

function generateChapterEntries(
  bookId: number,
  startChapter: number,
  endChapter: number,
  startDay: number
): { day: number; bookId: number; chapterStart: number; chapterEnd: number }[] {
  const entries = [];
  let day = startDay;
  for (let ch = startChapter; ch <= endChapter; ch++) {
    entries.push({ day, bookId, chapterStart: ch, chapterEnd: ch });
    day++;
  }
  return entries;
}

// NT books: Matthew(40) through Revelation(66)
const ntBooks = [
  { id: 40, chapters: 28 },
  { id: 41, chapters: 16 },
  { id: 42, chapters: 24 },
  { id: 43, chapters: 21 },
  { id: 44, chapters: 28 },
  { id: 45, chapters: 16 },
  { id: 46, chapters: 16 },
  { id: 47, chapters: 13 },
  { id: 48, chapters: 6 },
  { id: 49, chapters: 6 },
  { id: 50, chapters: 4 },
  { id: 51, chapters: 4 },
  { id: 52, chapters: 5 },
  { id: 53, chapters: 3 },
  { id: 54, chapters: 6 },
  { id: 55, chapters: 4 },
  { id: 56, chapters: 3 },
  { id: 57, chapters: 1 },
  { id: 58, chapters: 13 },
  { id: 59, chapters: 5 },
  { id: 60, chapters: 5 },
  { id: 61, chapters: 3 },
  { id: 62, chapters: 5 },
  { id: 63, chapters: 1 },
  { id: 64, chapters: 1 },
  { id: 65, chapters: 1 },
  { id: 66, chapters: 22 },
];

function buildNTPlan(): ReadingPlan {
  const entries: ReadingPlan['entries'] = [];
  let day = 1;
  // ~9 chapters per day to fit 260 chapters in 30 days
  const chaptersPerDay = 9;
  let currentChapters: ReadingPlan['entries'] = [];

  for (const book of ntBooks) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      currentChapters.push({ day, bookId: book.id, chapterStart: ch, chapterEnd: ch });
      if (currentChapters.length >= chaptersPerDay) {
        entries.push(...currentChapters);
        currentChapters = [];
        day++;
      }
    }
  }
  if (currentChapters.length > 0) {
    entries.push(...currentChapters);
  }

  return {
    id: 'nt-30-days',
    name: 'New Testament in 30 Days',
    description:
      'Read through the entire New Testament in one month. About 9 chapters per day covering all 27 books.',
    durationDays: Math.max(day, 30),
    entries,
  };
}

export const READING_PLANS: ReadingPlan[] = [
  buildNTPlan(),
  {
    id: 'psalms-proverbs',
    name: 'Psalms & Proverbs Daily',
    description:
      'A 30-day journey through the wisdom literature. One Psalm and one Proverbs chapter each day.',
    durationDays: 30,
    entries: Array.from({ length: 30 }, (_, i) => [
      { day: i + 1, bookId: 19, chapterStart: i + 1, chapterEnd: i + 1 }, // Psalms 1-30
      { day: i + 1, bookId: 20, chapterStart: (i % 31) + 1, chapterEnd: (i % 31) + 1 }, // Proverbs 1-31 cycling
    ]).flat(),
  },
  {
    id: 'gospels-14-days',
    name: 'The Gospels in 14 Days',
    description:
      'Read all four Gospels in two weeks. Follow the life of Jesus through Matthew, Mark, Luke, and John.',
    durationDays: 14,
    entries: [
      ...generateChapterEntries(40, 1, 28, 1), // Matthew: days 1-28 collapsed
      ...generateChapterEntries(41, 1, 16, 5), // Mark
      ...generateChapterEntries(42, 1, 24, 8), // Luke
      ...generateChapterEntries(43, 1, 21, 12), // John
    ].map((e, i) => ({ ...e, day: Math.floor(i / 7) + 1 })), // ~7 chapters per day
  },
];

export function getReadingPlanById(planId: string): ReadingPlan | undefined {
  return READING_PLANS.find((p) => p.id === planId);
}
