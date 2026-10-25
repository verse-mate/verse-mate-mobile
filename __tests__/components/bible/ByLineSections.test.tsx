/**
 * Collapsible By Line sections (Andy, App Store build: "expand/contract all missing on line by line").
 *
 * The reader's By Line, the landscape split view and the Jesus By-Line tab all render through these,
 * so the contract is pinned once here: rows arrive OPEN, a reference folds its own verse, the
 * control folds or unfolds everything, and a new chapter starts unfolded again.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { translateFallback as mockTranslate } from '@/__tests__/mocks/i18n';
import {
  ByLineSection,
  ByLineToggleAll,
  splitByLineHeading,
  useByLineExpansion,
} from '@/components/bible/ByLineSections';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const SECTIONS = [
  { id: '1', markdown: '## Amos 2:1\n\n> Thus says the Lord.\n\nMoab is judged.' },
  { id: '2', markdown: '## Amos 2:2\n\n> So I will send fire.\n\nThe fire is the judgment.' },
];

function Harness({ chapter }: { chapter: string }) {
  const expansion = useByLineExpansion(chapter);
  return (
    <>
      <Text testID="chapter">{chapter}</Text>
      <ByLineToggleAll
        allOpen={expansion.allOpen}
        onPress={() => expansion.setAll(!expansion.allOpen)}
        testID="toggle-all"
      />
      {SECTIONS.map((s) => (
        <ByLineSection
          key={s.id}
          markdown={s.markdown}
          open={expansion.isOpen(s.id)}
          onToggle={() => expansion.toggle(s.id)}
          markdownStyles={{}}
          testID={`section-${s.id}`}
        />
      ))}
    </>
  );
}

describe('splitByLineHeading', () => {
  it('separates the reference heading from the commentary', () => {
    expect(splitByLineHeading('## Amos 2:1\n\n> Thus says.\n\nBody.')).toEqual({
      heading: '## Amos 2:1',
      body: '> Thus says.\n\nBody.',
    });
  });

  it('leaves a section without a heading whole, so the preamble is never foldable', () => {
    expect(splitByLineHeading('Intro text.')).toEqual({ heading: null, body: 'Intro text.' });
  });
});

describe('ByLineSection + useByLineExpansion', () => {
  it('arrives open, with the control offering to collapse', () => {
    render(<Harness chapter="30:2" />);
    expect(screen.getByText(/Moab is judged/)).toBeTruthy();
    expect(screen.getByText(/The fire is the judgment/)).toBeTruthy();
    expect(screen.getByText('Collapse All')).toBeTruthy();
  });

  it('folds one verse from its reference, keeping the reference on screen', () => {
    render(<Harness chapter="30:2" />);
    fireEvent.press(screen.getByTestId('section-1-toggle'));

    expect(screen.queryByText(/Moab is judged/)).toBeNull();
    expect(screen.getByText('Amos 2:1')).toBeTruthy();
    expect(screen.getByText(/The fire is the judgment/)).toBeTruthy();
    expect(screen.getByText('Expand All')).toBeTruthy();

    fireEvent.press(screen.getByTestId('section-1-toggle'));
    expect(screen.getByText(/Moab is judged/)).toBeTruthy();
    expect(screen.getByText('Collapse All')).toBeTruthy();
  });

  it('folds and unfolds everything from the control', () => {
    render(<Harness chapter="30:2" />);
    fireEvent.press(screen.getByTestId('toggle-all'));
    expect(screen.queryByText(/Moab is judged/)).toBeNull();
    expect(screen.queryByText(/The fire is the judgment/)).toBeNull();

    // A row opened by hand while everything is folded is an exception to "all folded".
    fireEvent.press(screen.getByTestId('section-2-toggle'));
    expect(screen.getByText(/The fire is the judgment/)).toBeTruthy();
    expect(screen.queryByText(/Moab is judged/)).toBeNull();

    fireEvent.press(screen.getByTestId('toggle-all'));
    expect(screen.getByText(/Moab is judged/)).toBeTruthy();
    expect(screen.getByText(/The fire is the judgment/)).toBeTruthy();
  });

  it('opens a new chapter unfolded, whatever the last one was left as', () => {
    const { rerender } = render(<Harness chapter="30:2" />);
    fireEvent.press(screen.getByTestId('toggle-all'));
    expect(screen.queryByText(/Moab is judged/)).toBeNull();

    rerender(<Harness chapter="30:3" />);
    expect(screen.getByText(/Moab is judged/)).toBeTruthy();
    expect(screen.getByText('Collapse All')).toBeTruthy();
  });
});
