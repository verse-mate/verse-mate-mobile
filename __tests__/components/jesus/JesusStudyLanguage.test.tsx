/**
 * The Jesus Study tab fetches the chapter study in the reader's language and
 * renders it narrowed to the event.
 *
 * It used to call useStudy with no language, which keys and fetches `en-US`
 * for everyone and misses the reader's own Study cache (StudyPanel passes the
 * preferred language). The other Jesus tab tests mock useStudy to return null,
 * so the narrowing was never rendered at all; this one gives it a real study.
 */
import { render, screen } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import type { JesusEventDetail } from '@/types/jesus';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('@/hooks/use-preferred-language', () => ({ usePreferredLanguage: () => 'de-DE' }));

const mockStudyArgs = jest.fn();
jest.mock('@/src/api', () => ({
  useBibleByLine: () => ({ data: null, isPending: false }),
  useStudy: (bookId: number, chapter: number, language?: string) => {
    mockStudyArgs(bookId, chapter, language);
    return {
      data: {
        steps: [{ number: 1, kind: 'keywords', inventory: [{ word: 'temple', verses: '2:46' }] }],
        interpretation: {
          movements: [
            { range: '2:1-7', title: 'The birth' },
            { range: '2:41-52', title: 'The boy in the temple' },
          ],
        },
        application: { questions: [] },
      },
      isPending: false,
    };
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
