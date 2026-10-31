/**
 * WordChoiceChips renders inside the lexicon card, a gorhom BottomSheetModal that portals above the
 * ThemeProvider. A theme hook in it crashed the app on device ("useTheme must be used within a
 * ThemeProvider"), so this renders it with no provider at all.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { WordChoiceChips } from '@/components/bible/WordChoiceChips';
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
