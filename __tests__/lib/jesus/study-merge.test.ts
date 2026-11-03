/**
 * The cross-Gospel study: every account's narrowed chapter study laid side by
 * side. These pin what goes in, what is taken from the primary account only,
 * and how each row says which Gospel it came from.
 */
import type { InductiveStudy } from '@versemate/studies';
import { type AccountStudy, mergeAccountStudies, withBook } from '@/lib/jesus/study-merge';
import { eventVerseSpan, narrowStudyToEvent } from '@/lib/jesus/study-scope';
import type { JesusEventPassage } from '@/types/jesus';

function chapterStudy(bookName: string, chapter: number, eventVerse: number): InductiveStudy {
  return {
    bookId: 0,
    bookName,
    chapter,
    title: `${bookName} ${chapter}`,
    subtitle: 'The Precept Method, Verse by Verse',
    themeOneLine: `${bookName} ${chapter} theme`,
    steps: [
      {
        number: 1,
        kind: 'bullets',
        title: 'Begin with prayer',
        summary: '',
        items: [{ tag: 'POSTURE', text: `${bookName} prayer` }],
      },
      {
        number: 2,
        kind: 'qa',
        title: "Ask the 5 W's",
        summary: '',
        items: [{ tag: 'WHO', q: 'Who?', a: `Answer touching ${chapter}:${eventVerse}` }],
      },
      {
        number: 3,
        kind: 'keywords',
        title: 'Key words',
        summary: '',
        inventory: [
          { word: `${bookName}-in`, count: 1, verses: `${chapter}:${eventVerse}` },
          { word: `${bookName}-out`, count: 1, verses: `${chapter}:1` },
        ],
      },
      {
        number: 4,
        kind: 'lists',
        title: 'Lists',
        summary: '',
        lists: [
          {
            title: 'About Jesus',
            columns: ['Verse', 'Truth'],
            rows: [{ ref: `${chapter}:${eventVerse}`, truth: `${bookName} truth` }],
          },
        ],
      },
    ],
    interpretation: {
      movements: [
        { number: 1, title: 'Before', range: `${chapter}:1-2`, body: '' },
        { number: 2, title: `${bookName} event`, range: `${chapter}:${eventVerse}`, body: '' },
      ],
    },
    application: {
      questions: [
        { range: `${chapter}:${eventVerse}`, question: 'Shared question?' },
        { range: `${chapter}:${eventVerse}`, question: `${bookName} only?` },
      ],
    },
  };
}

function account(bookName: string, bookId: number, chapter: number, verse: number): AccountStudy {
  const passage = {
    book_id: bookId,
    book_name: bookName,
    chapter,
    verse_start: verse,
    verse_end: verse,
    is_primary: false,
    display: `${bookName} ${chapter}:${verse}`,
  } as JesusEventPassage;
  const span = eventVerseSpan(passage);
  if (!span) throw new Error('no span');
  return {
    bookName,
    display: passage.display,
    narrowed: narrowStudyToEvent(chapterStudy(bookName, chapter, verse), span),
  };
}

const accounts = [account('Matthew', 40, 21, 12), account('John', 43, 2, 14)];

describe('mergeAccountStudies', () => {
  const merged = mergeAccountStudies(accounts, 'Cleansing the temple');
  if (!merged) throw new Error('nothing merged');
  const step = (n: number) => merged.study.steps.find((s) => s.number === n);

  it('titles the study with the event and drops the chapter theme', () => {
    expect(merged.study.title).toBe('Cleansing the temple');
    expect(merged.study.themeOneLine).toBe('');
    expect(merged.accounts).toEqual(['Matthew 21:12', 'John 2:14']);
  });

  it("merges each narrowed step's rows from every account, labelled by book", () => {
    const kw = step(3);
    expect(kw?.kind).toBe('keywords');
    if (kw?.kind !== 'keywords') return;
    expect(kw.inventory.map((r) => [r.word, r.verses])).toEqual([
      ['Matthew-in', 'Matthew 21:12'],
      ['John-in', 'John 2:14'],
    ]);
    const lists = step(4);
    if (lists?.kind !== 'lists') throw new Error('lists');
    expect(lists.lists.map((l) => l.title)).toEqual([
      'About Jesus — Matthew',
      'About Jesus — John',
    ]);
    expect(lists.lists[1].rows[0].ref).toBe('John 2:14');
  });

  it('takes whole-chapter steps from the primary account only, as chapter context', () => {
    const prayer = step(1);
    if (prayer?.kind !== 'bullets') throw new Error('bullets');
    expect(prayer.items.map((i) => i.text)).toEqual(['Matthew prayer']);
    // The 5 W's ask about the chapter — once, not once per Gospel.
    const qa = step(2);
    if (qa?.kind !== 'qa') throw new Error('qa');
    expect(qa.items).toHaveLength(1);
    expect([...merged.chapterScopedSteps].sort()).toEqual([1, 2]);
  });

  it("keeps every account's movements and questions, labelled and de-duplicated", () => {
    expect(merged.study.interpretation.movements.map((m) => [m.number, m.range])).toEqual([
      [1, 'Matthew 21:12'],
      [2, 'John 2:14'],
    ]);
    expect(merged.study.application.questions.map((q) => q.question)).toEqual([
      'Shared question?',
      'Matthew only?',
      'John only?',
    ]);
  });

  it('returns nothing for no accounts', () => {
    expect(mergeAccountStudies([], 'x')).toBeNull();
  });
});

describe('withBook', () => {
  it('prefixes a bare reference and leaves a booked one alone', () => {
    expect(withBook('Mark', '11:15')).toBe('Mark 11:15');
    expect(withBook('Mark', 'Mark 11:15')).toBe('Mark 11:15');
    expect(withBook('Mark', '')).toBe('Mark');
  });
});
