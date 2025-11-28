/**
 * FloatingActionButtons Component Tests
 *
 * Focused tests for chapter navigation floating action buttons.
 * Tests visibility conditions and callback behavior.
 *
 * @see Task 6.1 - Write 3-5 focused tests for FloatingActionButtons
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { FloatingActionButtons } from '@/components/bible/FloatingActionButtons';
import { ThemeProvider } from '@/contexts/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('FloatingActionButtons', () => {
  const mockOnPrevious = jest.fn();
  const mockOnNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Previous button hidden when at chapter 1
   */
  it('hides previous button when showPrevious is false', () => {
    renderWithTheme(
      <FloatingActionButtons
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        showPrevious={false}
        showNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Previous chapter');
    expect(previousButton).toBeDisabled();
  });

  /**
   * Test 2: Next button hidden when at last chapter
   */
  it('hides next button when showNext is false', () => {
    renderWithTheme(
      <FloatingActionButtons
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        showPrevious={true}
        showNext={false}
      />
    );

    const nextButton = screen.getByLabelText('Next chapter');
    expect(nextButton).toBeDisabled();
  });

  /**
   * Test 3: Previous button fires onPrevious callback
   */
  it('calls onPrevious callback when previous button is tapped', () => {
    renderWithTheme(
      <FloatingActionButtons
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        showPrevious={true}
        showNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Previous chapter');
    fireEvent.press(previousButton);

    expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  /**
   * Test 4: Next button fires onNext callback
   */
  it('calls onNext callback when next button is tapped', () => {
    renderWithTheme(
      <FloatingActionButtons
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        showPrevious={true}
        showNext={true}
      />
    );

    const nextButton = screen.getByLabelText('Next chapter');
    fireEvent.press(nextButton);

    expect(mockOnNext).toHaveBeenCalledTimes(1);
    expect(mockOnPrevious).not.toHaveBeenCalled();
  });

  /**
   * Test 5: Both buttons shown when both props are true
   */
  it('shows both buttons when showPrevious and showNext are true', () => {
    renderWithTheme(
      <FloatingActionButtons
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        showPrevious={true}
        showNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Previous chapter');
    const nextButton = screen.getByLabelText('Next chapter');

    expect(previousButton).toBeTruthy();
    expect(nextButton).toBeTruthy();
  });
});
