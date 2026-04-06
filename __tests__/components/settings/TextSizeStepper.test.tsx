import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { TextSizeStepper } from '@/components/settings/TextSizeStepper';

jest.unmock('@/contexts/TextSizeContext');

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'LIGHT' },
}));

// Track mock state
let mockPreset = 'medium';
const mockSetPreset = jest.fn().mockImplementation(async (newPreset: string) => {
  mockPreset = newPreset;
});

jest.mock('@/contexts/TextSizeContext', () => ({
  useTextSize: () => ({
    preset: mockPreset,
    scaleFactor: { small: 0.85, medium: 1.0, large: 1.15, extraLarge: 1.3 }[mockPreset],
    setPreset: mockSetPreset,
    scaledFontSize: (base: number) =>
      Math.round(
        base *
          ({ small: 0.85, medium: 1.0, large: 1.15, extraLarge: 1.3 } as Record<string, number>)[
            mockPreset
          ]
      ),
    isLoading: false,
  }),
  PRESET_LABELS: { small: 'Small', medium: 'Medium', large: 'Large', extraLarge: 'Extra Large' },
  PRESET_ORDER: ['small', 'medium', 'large', 'extraLarge'],
}));

describe('TextSizeStepper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreset = 'medium';
  });

  it('renders current preset label', () => {
    render(<TextSizeStepper />);

    expect(screen.getByTestId('text-size-label')).toHaveTextContent('Medium');
  });

  it('renders decrease and increase buttons', () => {
    render(<TextSizeStepper />);

    expect(screen.getByTestId('text-size-decrease')).toBeTruthy();
    expect(screen.getByTestId('text-size-increase')).toBeTruthy();
  });

  it('calls setPreset with next preset on increase', async () => {
    render(<TextSizeStepper />);

    fireEvent.press(screen.getByTestId('text-size-increase'));

    await waitFor(() => {
      expect(mockSetPreset).toHaveBeenCalledWith('large');
    });
  });

  it('calls setPreset with previous preset on decrease', async () => {
    render(<TextSizeStepper />);

    fireEvent.press(screen.getByTestId('text-size-decrease'));

    await waitFor(() => {
      expect(mockSetPreset).toHaveBeenCalledWith('small');
    });
  });

  it('triggers haptic feedback on press', async () => {
    render(<TextSizeStepper />);

    fireEvent.press(screen.getByTestId('text-size-increase'));

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  it('disables decrease button at minimum (small)', () => {
    mockPreset = 'small';
    render(<TextSizeStepper />);

    const decreaseBtn = screen.getByTestId('text-size-decrease');
    expect(decreaseBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables increase button at maximum (extraLarge)', () => {
    mockPreset = 'extraLarge';
    render(<TextSizeStepper />);

    const increaseBtn = screen.getByTestId('text-size-increase');
    expect(increaseBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows preview text in non-compact mode', () => {
    render(<TextSizeStepper />);

    expect(screen.getByText(/The Lord is my shepherd/)).toBeTruthy();
  });

  it('hides preview text in compact mode', () => {
    render(<TextSizeStepper compact />);

    expect(screen.queryByText(/The Lord is my shepherd/)).toBeNull();
  });
});
