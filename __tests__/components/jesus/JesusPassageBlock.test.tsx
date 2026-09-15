/**
 * Jesus scripture has to behave like scripture.
 *
 * Two reports, one component: "these verses aren't clickable in Jesus feature.
 * Also font size changed."
 *
 * Both are about the same failure of nerve — the block rendered text that
 * LOOKS like the reader (same passage, same shape) but was inert and fixed at
 * one size. Scripture that reads like the reader and then does nothing when
 * touched is worse than scripture that plainly isn't the reader, because the
 * affordance is implied and withheld; and a reader who has scaled scripture up
 * gets it everywhere or the setting is a lie.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { JesusPassageBlock } from '@/components/jesus/JesusPassageBlock';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { JesusEventPassage } from '@/types/jesus';

let mockFontSize = 18;
jest.mock('@/hooks/bible/use-font-size', () => ({
  useFontSize: () => ({ fontSize: mockFontSize, setFontSize: jest.fn(), isLoading: false }),
}));

const passage: JesusEventPassage = {
  book_id: 42,
  book_name: 'Luke',
  chapter: 2,
  verse_start: 41,
  verse_end: 43,
  is_primary: true,
  display: 'Luke 2:41-52',
  verses: [
    { verse_number: 41, text: 'Now His parents went to Jerusalem every year' },
    { verse_number: 42, text: 'And when He became twelve' },
  ],
};

function renderBlock(props: Partial<React.ComponentProps<typeof JesusPassageBlock>> = {}) {
  const onOpen = jest.fn();
  const onOpenVerse = jest.fn();
  const view = render(
    <ThemeProvider>
      <JesusPassageBlock passage={passage} onOpen={onOpen} onOpenVerse={onOpenVerse} {...props} />
    </ThemeProvider>
  );
  return { onOpen, onOpenVerse, unmount: view.unmount };
}

describe('JesusPassageBlock', () => {
  beforeEach(() => {
    mockFontSize = 18;
  });

  it('renders the scripture that comes down with the event', () => {
    renderBlock();
    expect(screen.getByText(/Now His parents went to Jerusalem/)).toBeTruthy();
  });

  it('opens a tapped verse in the reader — the reported bug', () => {
    const { onOpenVerse } = renderBlock();
    fireEvent.press(screen.getByTestId('jesus-verse-42-2-41'));
    expect(onOpenVerse).toHaveBeenCalledWith(41);
  });

  it('routes each verse to its own number, not to the first', () => {
    const { onOpenVerse } = renderBlock();
    fireEvent.press(screen.getByTestId('jesus-verse-42-2-42'));
    expect(onOpenVerse).toHaveBeenCalledWith(42);
  });

  it('falls back to opening the passage when no verse handler is given', () => {
    // The block must never become inert again just because a caller did not
    // wire the newer prop.
    const onOpen = jest.fn();
    render(
      <ThemeProvider>
        <JesusPassageBlock passage={passage} onOpen={onOpen} />
      </ThemeProvider>
    );
    fireEvent.press(screen.getByTestId('jesus-verse-42-2-41'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('still opens the whole passage from the reference pill', () => {
    const { onOpen } = renderBlock();
    fireEvent.press(screen.getByTestId('jesus-passage-reference-Luke 2:41-52'));
    expect(onOpen).toHaveBeenCalled();
  });

  it("follows the reader's font-size preference rather than a fixed size", () => {
    // The size lives on the scripture container; the per-verse nodes inherit
    // it. Asserting the relationship rather than a literal keeps this honest
    // if the multiplier is ever retuned.
    const sizeOf = () => {
      const style = screen.getByTestId('jesus-scripture-Luke 2:41-52').props.style;
      return (Array.isArray(style) ? style.flat() : [style]).find(
        (s) => s && typeof s.fontSize === 'number'
      )?.fontSize as number;
    };

    mockFontSize = 18;
    const view = renderBlock();
    const defaultSize = sizeOf();
    expect(defaultSize).toBe(18);
    view.unmount();

    mockFontSize = 26;
    renderBlock();
    expect(sizeOf()).toBe(26);
    expect(sizeOf()).toBeGreaterThan(defaultSize);
  });

  it('says so when the passage arrived without verse text', () => {
    // Happens when bible_version was not sent; the screen must explain rather
    // than render an empty block.
    renderBlock({ passage: { ...passage, verses: [] } });
    expect(screen.getByText(/Open in the reader/)).toBeTruthy();
  });
});
