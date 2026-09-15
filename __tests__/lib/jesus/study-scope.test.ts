/**
 * Narrowing a chapter's inductive study to a Jesus event's verses.
 *
 * The tab used to show a five-row metadata table; the report was "Study
 * structure of Jesus feature didn't make app version". These cover the part
 * that decides WHAT survives the narrowing — the ref parsing is the fiddly
 * half, and a study that silently keeps the whole chapter looks identical to
 * one that narrowed correctly.
 */
import type { InductiveStudy } from '@versemate/studies';
import {
  eventVerseSpan,
  narrowStudyToEvent,
  parseVerseRefs,
  refTouchesSpan,
  spanRangeLabel,
} from '@/lib/jesus/study-scope';
import type { JesusEventPassage } from '@/types/jesus';

const LUKE_2_41_52: JesusEventPassage = {
  book_id: 42,
  book_name: 'Luke',
  chapter: 2,
  verse_start: 41,
  verse_end: 52,
  is_primary: true,
  display: 'Luke 2:41-52',
};

describe('parseVerseRefs', () => {
  it('reads the shapes the study generator actually emits', () => {
    expect(parseVerseRefs('2:41-52', 2)).toEqual([{ chapter: 2, start: 41, end: 52 }]);
    expect(parseVerseRefs('2:19, 51', 2)).toEqual([
      { chapter: 2, start: 19, end: 19 },
      { chapter: 2, start: 51, end: 51 },
    ]);
    // A bare range inherits the fallback chapter.
    expect(parseVerseRefs('41-52', 2)).toEqual([{ chapter: 2, start: 41, end: 52 }]);
  });

  it('inherits the chapter of the last qualified reference', () => {
    expect(parseVerseRefs('2:11 (soter); 30 (soterion)', 9)).toEqual([
      { chapter: 2, start: 11, end: 11 },
      { chapter: 2, start: 30, end: 30 },
    ]);
  });

  it('does not read a count as a verse', () => {
    // "(×2)" is a tally, not a reference — reading it as v2 would pull
    // unrelated material into the event.
    const refs = parseVerseRefs('2:9 (×2), 11', 2);
    expect(refs).toContainEqual({ chapter: 2, start: 9, end: 9 });
    expect(refs).toContainEqual({ chapter: 2, start: 11, end: 11 });
    expect(refs).not.toContainEqual({ chapter: 2, start: 2, end: 2 });
  });

  it('ignores bare numbers in free text when asked to', () => {
    // A segment title like "The 12 disciples" must not parse as verse 12.
    expect(parseVerseRefs('The 12 disciples', 2, true)).toEqual([]);
    expect(parseVerseRefs('The birth decree (2:1-7)', 2, true)).toEqual([
      { chapter: 2, start: 1, end: 7 },
    ]);
  });

  it('returns nothing for empty input rather than throwing', () => {
    expect(parseVerseRefs(null, 2)).toEqual([]);
    expect(parseVerseRefs(undefined, 2)).toEqual([]);
    expect(parseVerseRefs('', 2)).toEqual([]);
  });
});

describe('refTouchesSpan', () => {
  const span = eventVerseSpan(LUKE_2_41_52)!;

  it('matches any overlap, not just containment', () => {
    expect(refTouchesSpan({ chapter: 2, start: 41, end: 52 }, span)).toBe(true);
    expect(refTouchesSpan({ chapter: 2, start: 50, end: 60 }, span)).toBe(true);
    expect(refTouchesSpan({ chapter: 2, start: 45, end: 45 }, span)).toBe(true);
  });

  it('rejects a different chapter and a non-overlapping range', () => {
    expect(refTouchesSpan({ chapter: 3, start: 41, end: 52 }, span)).toBe(false);
    expect(refTouchesSpan({ chapter: 2, start: 1, end: 7 }, span)).toBe(false);
  });
});

describe('eventVerseSpan / spanRangeLabel', () => {
  it('carries the passage through', () => {
    const span = eventVerseSpan(LUKE_2_41_52);
    expect(span).toMatchObject({ bookId: 42, chapter: 2, start: 41, end: 52 });
    expect(spanRangeLabel(span!)).toBe('2:41-52');
  });

  it('labels a single verse without a range', () => {
    const span = eventVerseSpan({ ...LUKE_2_41_52, verse_start: 49, verse_end: 49 })!;
    expect(spanRangeLabel(span)).toBe('2:49');
  });

  it('labels a whole-chapter passage with just the chapter', () => {
    const span = eventVerseSpan({ ...LUKE_2_41_52, verse_start: null, verse_end: null })!;
    expect(spanRangeLabel(span)).toBe('2');
  });

  it('is null for a missing passage', () => {
    expect(eventVerseSpan(null)).toBeNull();
    expect(eventVerseSpan(undefined)).toBeNull();
  });
});

describe('narrowStudyToEvent', () => {
  const study = {
    steps: [
      {
        number: 1,
        kind: 'keywords',
        inventory: [
          { word: 'temple', verses: '2:46' },
          { word: 'decree', verses: '2:1' },
        ],
      },
      {
        number: 2,
        kind: 'bullets',
        // Word-tagged bullets carry no passage scope at all.
        items: [{ tag: 'POSTURE', text: 'Come humbly' }],
      },
    ],
    interpretation: {
      movements: [
        { range: '2:1-7', title: 'The birth' },
        { range: '2:41-52', title: 'The boy in the temple' },
      ],
    },
    application: {
      questions: [
        { range: '2:41-52', text: 'Where do you seek Him?' },
        { range: '2:8-20', text: 'What did the shepherds do?' },
      ],
    },
  } as unknown as InductiveStudy;

  const span = eventVerseSpan(LUKE_2_41_52)!;

  it('keeps only the rows that touch the event', () => {
    const out = narrowStudyToEvent(study, span);
    const keywords = out.study.steps[0] as unknown as {
      inventory: { word: string }[];
    };
    expect(keywords.inventory.map((r) => r.word)).toEqual(['temple']);
  });

  it('keeps an untaggable step whole and marks it chapter context', () => {
    // Step 2's bullets are tagged POSTURE/EYES/WILL, not verses. Dropping it
    // would leave a hole in the nine-step spine; the UI says which cards are
    // chapter context instead.
    const out = narrowStudyToEvent(study, span);
    expect(out.chapterScopedSteps.has(2)).toBe(true);
    expect(out.chapterScopedSteps.has(1)).toBe(false);
  });

  it('narrows movements and application questions to the event', () => {
    const out = narrowStudyToEvent(study, span);
    expect(out.study.interpretation.movements).toHaveLength(1);
    expect(out.study.application.questions).toHaveLength(1);
    expect(out.kept).toEqual({ movements: 1, questions: 1 });
    expect(out.total).toEqual({ movements: 2, questions: 2 });
    expect(out.narrowed).toBe(true);
  });

  it('falls back to every movement rather than rendering an empty section', () => {
    // A span with no usable ranges must not produce a blank Interpretation.
    const elsewhere = eventVerseSpan({
      ...LUKE_2_41_52,
      chapter: 9,
      verse_start: 1,
      verse_end: 2,
    })!;
    const out = narrowStudyToEvent(study, elsewhere);
    expect(out.study.interpretation.movements).toHaveLength(2);
    expect(out.study.application.questions).toHaveLength(2);
  });
});
