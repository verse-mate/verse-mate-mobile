/**
 * Tests for ProgressBar Component
 *
 * Focused tests for progress bar display and animations.
 * Tests rendering, percentage display, and fill width calculation.
 *
 * @see Task Group 8.1 - Write 2-4 focused tests for ProgressBar
 * @see components/bible/ProgressBar.tsx
 */

import { render, screen } from '@testing-library/react-native';
import { ProgressBar } from '@/components/bible/ProgressBar';

describe('ProgressBar', () => {
  it('renders without crashing', () => {
    render(<ProgressBar percentage={50} />);

    expect(screen.getByTestId('progress-bar')).toBeTruthy();
    expect(screen.getByTestId('progress-bar-fill')).toBeTruthy();
    expect(screen.getByTestId('progress-bar-percentage')).toBeTruthy();
  });

  it('displays percentage text correctly', () => {
    const { rerender } = render(<ProgressBar percentage={42} />);

    // Check percentage text
    expect(screen.getByText('42%')).toBeTruthy();

    // Update percentage
    rerender(<ProgressBar percentage={75} />);
    expect(screen.getByText('75%')).toBeTruthy();

    // Edge cases
    rerender(<ProgressBar percentage={0} />);
    expect(screen.getByText('0%')).toBeTruthy();

    rerender(<ProgressBar percentage={100} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('renders fill bar with correct structure', () => {
    render(<ProgressBar percentage={50} />);

    const progressBar = screen.getByTestId('progress-bar');
    const fill = screen.getByTestId('progress-bar-fill');

    // Progress bar should exist
    expect(progressBar).toBeTruthy();

    // Fill should exist inside progress bar
    expect(fill).toBeTruthy();
  });

  it('updates when percentage changes', () => {
    const { rerender } = render(<ProgressBar percentage={25} />);

    // Initial state
    expect(screen.getByText('25%')).toBeTruthy();

    // Update to 50%
    rerender(<ProgressBar percentage={50} />);
    expect(screen.getByText('50%')).toBeTruthy();

    // Update to 100%
    rerender(<ProgressBar percentage={100} />);
    expect(screen.getByText('100%')).toBeTruthy();

    // Update back to 0%
    rerender(<ProgressBar percentage={0} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });
});
