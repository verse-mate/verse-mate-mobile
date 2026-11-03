/**
 * The Jesus Study tab fetches the chapter study in the reader's language and
 * renders it narrowed to the event.
 *
 * It used to call useStudy with no language, which keys and fetches `en-US`
 * for everyone and misses the reader's own Study cache (StudyPanel passes the
 * preferred language). The other Jesus tab tests mock useStudy to return null,
 * so the narrowing was never rendered at all; this one gives it a real study.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import type { JesusEventDetail } from '@/types/jesus';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('@/hooks/use-preferred-language', () => ({ usePreferredLanguage: () => 'de-DE' }));

const mockStudyArgs = jest.fn();
const mockStudiesArgs = jest.fn();
const mockStudy = () => ({
  title: 'Luke 2',
  themeOneLine: 'Today in the city of David there has been born for you a Savior.',
  steps: [
    { number: 1, kind: 'prose', title: 'Begin with prayer', body: 'Pray.' },
    {
      number: 3,
      kind: 'keywords',
      inventory: [
        { word: 'manger', verses: '2:7' },
        { word: 'temple', verses: '2:46' },
      ],
    },
  ],
  interpretation: {
    movements: [
      { range: '2:1-7', title: 'The birth' },
      { range: '2:41-52', title: 'The boy in the temple' },
    ],
  },
  application: { questions: [] },
});
jest.mock('@/src/api', () => ({
  useBibleByLine: () => ({ data: null, isPending: false }),
  useStudy: (bookId: number, chapter: number, language?: string) => {
    mockStudyArgs(bookId, chapter, language);
    return { data: mockStudy(), isPending: false };
  },
  useStudies: (chapters: { bookId: number; chapter: number }[], language?: string) => {
    mockStudiesArgs(chapters, language);
    return { pending: false, data: chapters.map(() => mockStudy()) };
  },
}));

const mockPanel = jest.fn();
jest.mock('@/components/bible/StudyPanel', () => ({
  StudyPanel: (props: { study: unknown; header?: unknown }) => {
    mockPanel(props);
    const { View } = require('react-native');
    return <View testID="jesus-study-panel">{props.header as never}</View>;
  },
}));

const DETAIL = {
  event: { slug: 'event-boy-in-temple', title: 'The boy Jesus in the temple' },
  passages: [
    {
      book_id: 42,
      book_name: 'Luke',
      chapter: 2,
      display: 'Luke 2:41-52',
      is_primary: true,
      verse_start: 41,
      verse_end: 52,
      verses: [],
    },
  ],
  words: [],
} as unknown as JesusEventDetail;

it("fetches the study in the reader's language and renders it narrowed to the event", () => {
  render(<JesusTabBodies tab="study" detail={DETAIL} />);
  expect(mockStudyArgs).toHaveBeenCalledWith(42, 2, 'de-DE');
  expect(screen.getByTestId('jesus-study-panel')).toBeTruthy();
  const study = (
    mockPanel.mock.calls.at(-1)?.[0] as {
      study: { interpretation: { movements: { title: string }[] } };
    }
  ).study;
  expect(study.interpretation.movements.map((m) => m.title)).toEqual(['The boy in the temple']);
  expect(screen.getByTestId('jesus-study-scope')).toBeTruthy();
});

it("titles the narrowed study with the event's passage, not the chapter's theme verse", () => {
  render(<JesusTabBodies tab="study" detail={DETAIL} />);
  const study = (
    mockPanel.mock.calls.at(-1)?.[0] as { study: { title: string; themeOneLine?: string } }
  ).study;
  expect(study.title).toBe('Luke 2:41-52');
  expect(study.themeOneLine).toBeFalsy();
});

it('flags the steps it could not scope as chapter context', () => {
  render(<JesusTabBodies tab="study" detail={DETAIL} />);
  const props = mockPanel.mock.calls.at(-1)?.[0] as {
    study: { steps: { number: number; inventory?: { word: string }[] }[] };
    chapterContext?: { steps: Set<number>; label: string };
  };
  // The prose step can't be scoped, so it is shown whole and labelled...
  expect([...(props.chapterContext?.steps ?? [])]).toEqual([1]);
  expect(props.chapterContext?.label).toBe('Chapter context');
  // ...while the keyword step is narrowed to the event's verses.
  expect(props.study.steps[1].inventory?.map((r) => r.word)).toEqual(['temple']);
});

const TEMPTATION = {
  event: { slug: 'event-temptation', title: 'The temptation' },
  passages: [
    {
      book_id: 40,
      book_name: 'Matthew',
      chapter: 4,
      display: 'Matthew 4:1-11',
      is_primary: true,
      verse_start: 1,
      verse_end: 11,
    },
    {
      book_id: 41,
      book_name: 'Mark',
      chapter: 1,
      display: 'Mark 1:12-13',
      is_primary: false,
      verse_start: 12,
      verse_end: 13,
    },
    {
      book_id: 42,
      book_name: 'Luke',
      chapter: 4,
      display: 'Luke 4:1-13',
      is_primary: false,
      verse_start: 1,
      verse_end: 13,
    },
  ],
  words: [],
} as unknown as JesusEventDetail;

it('studies every Gospel account at once by default', () => {
  // "Cleansing of the temple study also only shows Matthew detail": with
  // several accounts the tab opens on all of them, not on the primary alone.
  render(<JesusTabBodies tab="study" detail={TEMPTATION} />);
  expect(screen.getByTestId('jesus-study-account-all')).toBeTruthy();
  expect(mockStudiesArgs).toHaveBeenLastCalledWith(
    [
      { bookId: 40, chapter: 4 },
      { bookId: 41, chapter: 1 },
      { bookId: 42, chapter: 4 },
    ],
    'de-DE'
  );
  const props = mockPanel.mock.calls.at(-1)?.[0] as { study: { title: string } };
  expect(props.study.title).toBe('The temptation');
  expect(screen.getByTestId('jesus-study-scope').props.children).toContain(
    'Matthew 4:1-11 · Mark 1:12-13 · Luke 4:1-13'
  );
});

it('still opens one account on its own from its chip', () => {
  render(<JesusTabBodies tab="study" detail={TEMPTATION} />);
  expect(screen.getByTestId('jesus-study-account-Matthew 4:1-11')).toBeTruthy();
  fireEvent.press(screen.getByTestId('jesus-study-account-Mark 1:12-13'));
  expect(mockStudyArgs).toHaveBeenLastCalledWith(41, 1, 'de-DE');
  const props = mockPanel.mock.calls.at(-1)?.[0] as { bookId: number; chapter: number };
  expect([props.bookId, props.chapter]).toEqual([41, 1]);
  fireEvent.press(screen.getByTestId('jesus-study-account-all'));
  expect(mockStudiesArgs).toHaveBeenCalled();
});

it('shows no picker for an event told once', () => {
  render(<JesusTabBodies tab="study" detail={DETAIL} />);
  expect(screen.queryByTestId('jesus-study-accounts')).toBeNull();
});

it("prefers the backend's generated study across the accounts when the event has one", () => {
  const generated = {
    title: 'The temptation',
    steps: [{ number: 1, kind: 'prose', title: 'Begin with prayer', summary: '', body: 'Pray.' }],
    interpretation: {
      movements: [{ number: 1, title: 'How the accounts relate', range: 'Mark 1:12-13', body: '' }],
    },
    application: { questions: [] },
  };
  mockStudiesArgs.mockClear();
  render(<JesusTabBodies tab="study" detail={{ ...TEMPTATION, study: generated } as never} />);
  // Rendered as is — no chapter studies fetched to merge.
  expect(mockStudiesArgs).not.toHaveBeenCalled();
  const props = mockPanel.mock.calls.at(-1)?.[0] as { study: unknown };
  expect(props.study).toBe(generated);
});

it('falls back to the merge when the generated study is malformed', () => {
  mockStudiesArgs.mockClear();
  render(
    <JesusTabBodies tab="study" detail={{ ...TEMPTATION, study: { steps: 'nope' } } as never} />
  );
  expect(mockStudiesArgs).toHaveBeenCalled();
});
