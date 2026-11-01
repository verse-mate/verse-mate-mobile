/**
 * WordChoiceChips renders inside the lexicon card, a gorhom BottomSheetModal that portals above the
 * ThemeProvider. A theme hook in it crashed the app on device ("useTheme must be used within a
 * ThemeProvider"), so this renders it with no provider at all.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { chipScrollTarget, WordChoiceChips } from '@/components/bible/WordChoiceChips';
import { getColors } from '@/theme/tokens';

describe('WordChoiceChips', () => {
  it('renders without a ThemeProvider, using the colours it is given', () => {
    const onChoose = jest.fn();
    render(
      <WordChoiceChips
        colors={getColors('dark')}
        words={['beginning', 'God', 'created']}
        active={0}
        onChoose={onChoose}
      />
    );
    fireEvent.press(screen.getByTestId('word-choice-chips-2'));
    expect(onChoose).toHaveBeenCalledWith(2);
  });

  it('does not re-choose the word that is already showing, and hides for one word', () => {
    const onChoose = jest.fn();
    const { rerender } = render(
      <WordChoiceChips
        colors={getColors('dark')}
        words={['a', 'b']}
        active={0}
        onChoose={onChoose}
      />
    );
    fireEvent.press(screen.getByTestId('word-choice-chips-0'));
    expect(onChoose).not.toHaveBeenCalled();
    rerender(
      <WordChoiceChips colors={getColors('dark')} words={['a']} active={0} onChoose={onChoose} />
    );
    expect(screen.queryByTestId('word-choice-chips')).toBeNull();
  });
});

describe('WordChoiceChips: more chips than fit', () => {
  const WORDS = ['In the beginning', 'God', 'created', 'the heavens', 'earth', 'formless', 'void'];
  const renderRow = () =>
    render(
      <WordChoiceChips colors={getColors('dark')} words={WORDS} active={0} onChoose={jest.fn()} />
    );
  const layout = (viewport: number, content: number) => {
    const scroll = screen.getByTestId('word-choice-chips-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { width: viewport, height: 48, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', content, 48);
    return scroll;
  };
  const scrollTo = (scroll: ReturnType<typeof layout>, x: number) =>
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x, y: 0 } } });

  it('shows no arrow while everything fits', () => {
    renderRow();
    layout(390, 380);
    expect(screen.queryByTestId('word-choice-chips-scroll-right')).toBeNull();
    expect(screen.queryByTestId('word-choice-chips-scroll-left')).toBeNull();
  });

  it('fades the right edge with an arrow when chips continue there, and the left once scrolled', () => {
    renderRow();
    const scroll = layout(300, 700);
    expect(screen.getByTestId('word-choice-chips-scroll-right')).toBeTruthy();
    expect(screen.queryByTestId('word-choice-chips-scroll-left')).toBeNull();

    scrollTo(scroll, 150);
    expect(screen.getByTestId('word-choice-chips-scroll-left')).toBeTruthy();
    expect(screen.getByTestId('word-choice-chips-scroll-right')).toBeTruthy();

    scrollTo(scroll, 400); // the end: 700 - 300
    expect(screen.queryByTestId('word-choice-chips-scroll-right')).toBeNull();
    expect(screen.getByTestId('word-choice-chips-scroll-left')).toBeTruthy();
  });

  it('scrolls 70% of the visible row per press, never past either end', () => {
    expect(chipScrollTarget(0, 300, 700, 1)).toBe(210);
    expect(chipScrollTarget(210, 300, 700, 1)).toBe(400); // clamped to the end
    expect(chipScrollTarget(400, 300, 700, -1)).toBe(190);
    expect(chipScrollTarget(100, 300, 700, -1)).toBe(0); // clamped to the start
  });
});
