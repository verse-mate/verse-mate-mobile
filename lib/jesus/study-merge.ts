/**
 * One study across every Gospel account of a Jesus event.
 *
 * Reported as "Cleansing of the temple study also only shows Matthew detail":
 * the Study tab narrowed ONE account's chapter study (with a chip per Gospel to
 * switch), so an event the four Gospels all tell was always read through one
 * of them. The studies are written per chapter, so there is no study of the
 * event as such — but each account's chapter study, narrowed to that account's
 * verses (study-scope), is a study OF the event as that Gospel tells it. Laid
 * side by side, step by step, they are the cross-Gospel study:
 *
 *  - every narrowed step contributes its rows, each relabelled with the book
 *    ("21:12" → "Matthew 21:12") so the reader can tell the tellings apart;
 *  - a step NO account could narrow (the prayer step, the chapter theme) is
 *    whole-chapter material in every account. Four chapters' worth of it would
 *    bury the event, so it is taken from the primary account alone and stays
 *    marked as chapter context;
 *  - every account's interpretation movements and application questions are
 *    kept, labelled, in account order.
 *
 * This juxtaposes rather than synthesises — it cannot say how the accounts
 * relate (the Compare tab does that). It is the floor a generated event-level
 * study can replace event by event.
 */
import type { InductiveStudy } from '@versemate/studies';
import type {
  StepBullets,
  StepContrasts,
  StepKeywords,
  StepLists,
  StepProse,
  StepQA,
  StepSegments,
  StudyApplication,
  StudyMovement,
  StudyStep,
} from '@versemate/studies/types';
import type { NarrowedStudy } from '@/lib/jesus/study-scope';

export interface AccountStudy {
  /** "Mark" — the label every row from this account carries. */
  bookName: string;
  /** "Mark 11:15-19" — the account's passage. */
  display: string;
  narrowed: NarrowedStudy;
}

export interface MergedStudy {
  study: InductiveStudy;
  /** Steps taken whole from the primary account's chapter. */
  chapterScopedSteps: Set<number>;
  /** The accounts that went into it, in order. */
  accounts: string[];
}

/** "21:12, 13" → "Matthew 21:12, 13"; leaves an already-booked ref alone. */
export function withBook(bookName: string, ref: string | undefined | null): string {
  const text = (ref ?? '').trim();
  if (!text) return bookName;
  return text.startsWith(bookName) ? text : `${bookName} ${text}`;
}

function mergeStep(parts: { bookName: string; step: StudyStep }[]): StudyStep {
  const [first] = parts;
  const base = first.step;
  switch (base.kind) {
    case 'keywords':
      return {
        ...base,
        inventory: parts.flatMap(({ bookName, step }) =>
          (step as StepKeywords).inventory.map((row) => ({
            ...row,
            verses: withBook(bookName, row.verses),
          }))
        ),
      };
    case 'lists':
      return {
        ...base,
        lists: parts.flatMap(({ bookName, step }) =>
          (step as StepLists).lists.map((list) => ({
            ...list,
            title: `${list.title} — ${bookName}`,
            rows: list.rows.map((row) => ({ ...row, ref: withBook(bookName, row.ref) })),
          }))
        ),
      };
    case 'contrasts':
      return {
        ...base,
        items: parts.flatMap(({ bookName, step }) =>
          (step as StepContrasts).items.map((item) => ({
            ...item,
            verses: withBook(bookName, item.verses),
          }))
        ),
      };
    case 'bullets':
      return {
        ...base,
        items: parts.flatMap(({ bookName, step }) =>
          (step as StepBullets).items.map((item) => ({
            ...item,
            tag: withBook(bookName, item.tag),
          }))
        ),
      };
    case 'qa':
      return {
        ...base,
        items: parts.flatMap(({ bookName, step }) =>
          (step as StepQA).items.map((item) => ({ ...item, q: `${bookName} — ${item.q}` }))
        ),
      };
    case 'segments':
      return {
        ...base,
        segments: parts.flatMap(({ bookName, step }) =>
          (step as StepSegments).segments.map((seg) => ({
            ...seg,
            title: `${bookName} — ${seg.title}`,
          }))
        ),
      };
    case 'prose':
      return {
        ...base,
        body: parts
          .map(({ bookName, step }) => `**${bookName}**\n\n${(step as StepProse).body}`)
          .join('\n\n'),
      };
  }
}

/**
 * @param accounts  each account's narrowed study, primary first
 * @param title     what the study is "of" — the event's title
 */
export function mergeAccountStudies(accounts: AccountStudy[], title: string): MergedStudy | null {
  if (accounts.length === 0) return null;
  const [primary] = accounts;
  const chapterScopedSteps = new Set<number>();

  // Step numbers in the primary's order, then any a later account adds.
  const numbers: number[] = [];
  for (const { narrowed } of accounts) {
    for (const step of narrowed.study.steps) {
      if (!numbers.includes(step.number)) numbers.push(step.number);
    }
  }

  const steps: StudyStep[] = [];
  for (const number of numbers) {
    const narrowedParts = accounts.flatMap(({ bookName, narrowed }) => {
      const step = narrowed.study.steps.find((s) => s.number === number);
      // The 5 W's are asked of the chapter ("Who is the chapter primarily
      // about?"). study-scope keeps that step whole whenever any answer
      // touches the event, so merging it would ask the same chapter-level
      // questions once per Gospel. It is chapter context, like the prayer.
      if (!step || step.kind === 'qa') return [];
      return narrowed.chapterScopedSteps.has(number) ? [] : [{ bookName, step }];
    });
    // Same kind only: a step the generator shaped differently in one chapter
    // cannot be merged row-for-row, so that account's version is left out
    // rather than rendered as the wrong shape.
    const sameKind = narrowedParts.filter((p) => p.step.kind === narrowedParts[0]?.step.kind);
    if (sameKind.length > 0) {
      steps.push(mergeStep(sameKind));
      continue;
    }
    const whole =
      primary.narrowed.study.steps.find((s) => s.number === number) ??
      accounts
        .map((a) => a.narrowed.study.steps.find((s) => s.number === number))
        .find((s): s is StudyStep => Boolean(s));
    if (whole) {
      steps.push(whole);
      chapterScopedSteps.add(number);
    }
  }

  const movements: StudyMovement[] = accounts
    .flatMap(({ bookName, narrowed }) =>
      narrowed.study.interpretation.movements.map((mv) => ({
        ...mv,
        title: `${bookName} — ${mv.title}`,
        range: withBook(bookName, mv.range),
      }))
    )
    .map((mv, i) => ({ ...mv, number: i + 1 }));

  const seen = new Set<string>();
  const questions: StudyApplication[] = accounts.flatMap(({ bookName, narrowed }) =>
    narrowed.study.application.questions
      .filter((q) => {
        const key = q.question.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((q) => ({ ...q, range: withBook(bookName, q.range) }))
  );

  const base = primary.narrowed.study;
  return {
    study: {
      ...base,
      title,
      themeOneLine: '',
      steps,
      interpretation: { ...base.interpretation, movements },
      application: { ...base.application, questions },
    },
    chapterScopedSteps,
    accounts: accounts.map((a) => a.display),
  };
}
