/**
 * VerseJumpButton — UI behavior tests
 *
 * Verifies the quick-verse-jump control rendered above the By Line tab:
 * - hides itself when there are no verses to jump to
 * - opens a modal listing every verse on tap
 * - emits the chosen verse number on cell tap and dismisses the modal
 * - dismisses on backdrop tap without emitting
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { VerseJumpButton } from '@/components/bible/VerseJumpButton';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const renderWithProviders = (ui: React.ReactNode) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('VerseJumpButton', () => {
  it('renders nothing when verses list is empty', () => {
    const onSelect = jest.fn();
    renderWithProviders(<VerseJumpButton verses={[]} onSelect={onSelect} />);
    expect(screen.queryByTestId('verse-jump-button')).toBeNull();
  });

  it('renders nothing when visible=false', () => {
    const onSelect = jest.fn();
    renderWithProviders(<VerseJumpButton verses={[1, 2, 3]} onSelect={onSelect} visible={false} />);
    expect(screen.queryByTestId('verse-jump-button')).toBeNull();
  });

  it('opens the modal and lists every supplied verse on tap', () => {
    const onSelect = jest.fn();
    renderWithProviders(<VerseJumpButton verses={[1, 2, 17, 176]} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('verse-jump-button'));
    expect(screen.getByTestId('verse-jump-button-verse-1')).toBeTruthy();
    expect(screen.getByTestId('verse-jump-button-verse-2')).toBeTruthy();
    expect(screen.getByTestId('verse-jump-button-verse-17')).toBeTruthy();
    expect(screen.getByTestId('verse-jump-button-verse-176')).toBeTruthy();
  });

  it('emits the verse number on cell press and closes the modal', () => {
    jest.useFakeTimers();
    const onSelect = jest.fn();
    renderWithProviders(<VerseJumpButton verses={[1, 2, 3]} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('verse-jump-button'));
    fireEvent.press(screen.getByTestId('verse-jump-button-verse-2'));
    act(() => {
      jest.runAllTimers();
    });
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onSelect).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('dismisses on backdrop tap without emitting', () => {
    const onSelect = jest.fn();
    renderWithProviders(<VerseJumpButton verses={[1, 2, 3]} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('verse-jump-button'));
    fireEvent.press(screen.getByTestId('verse-jump-button-backdrop'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
