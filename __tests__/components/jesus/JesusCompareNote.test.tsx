/**
 * The Compare note must be themed text.
 *
 * Andy, build 118: "Only thing I found was this black space?" — the Compare
 * tab's summary paragraph rendered black on black in dark mode. It was a bare
 * <Text> under a margin-only container style, so it inherited React Native's
 * default black. It now goes through the same markdown styles as Summary.
 */
import { render, screen } from '@testing-library/react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import { JesusTabBodies } from '@/components/jesus/JesusTabBodies';
import type { JesusEventDetail } from '@/types/jesus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('@/hooks/bible/use-font-size', () => ({
  useFontSize: () => ({ fontSize: 18 }),
}));

const NOTE = 'All three record Jesus’ arrival.';
const mockMarkdownCalls: { children: string; style: Record<string, { color?: string }> }[] = [];
jest.mock('@/lib/markdown/Markdown', () => ({
  Markdown: (props: { children: string; style: Record<string, { color?: string }> }) => {
    mockMarkdownCalls.push(props);
    const { Text } = require('react-native');
    return <Text>{props.children}</Text>;
  },
}));

jest.mock('@/hooks/jesus', () => ({
  ...jest.requireActual('@/hooks/jesus'),
  useJesusCompare: () => ({
    isPending: false,
    fetchStatus: 'idle',
    data: {
      note: NOTE,
      shared_by: [],
      accounts: [{ gospel: 'Matthew', records_it: true, passages: [] }],
    },
  }),
}));

const DETAIL = {
  event: { slug: 'event-gerasene', title: 'The Gerasene demoniac' },
  passages: [],
} as unknown as JesusEventDetail;

it('renders the note through the themed markdown styles, never default black', () => {
  render(<JesusTabBodies tab="compare" detail={DETAIL} />);
  expect(screen.getByTestId('jesus-compare-note')).toBeTruthy();
  const call = mockMarkdownCalls.find((c) => c.children === NOTE);
  expect(call).toBeDefined();
  expect(call?.style.body?.color).toEqual(expect.any(String));
});
