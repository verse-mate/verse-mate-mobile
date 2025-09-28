import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TestamentToggle } from '@/components/TestamentToggle';

describe('TestamentToggle', () => {
  const mockOnTestamentChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render both Old and New Testament options', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      expect(screen.getByText('Old Testament')).toBeTruthy();
      expect(screen.getByText('New Testament')).toBeTruthy();
    });

    it('should highlight the selected testament', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      const oldTestamentButton = screen.getByTestId('testament-old');
      const newTestamentButton = screen.getByTestId('testament-new');

      expect(oldTestamentButton.props.style).toMatchObject({
        backgroundColor: '#b09a6d',
      });
      expect(newTestamentButton.props.style).not.toMatchObject({
        backgroundColor: '#b09a6d',
      });
    });

    it('should show correct book counts for each testament', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
          bookCounts={{ old: 39, new: 27 }}
        />
      );

      expect(screen.getByText('39 books')).toBeTruthy();
      expect(screen.getByText('27 books')).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should call onTestamentChange when Old Testament is selected', () => {
      render(
        <TestamentToggle
          selectedTestament="new"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      fireEvent.press(screen.getByTestId('testament-old'));

      expect(mockOnTestamentChange).toHaveBeenCalledWith('old');
    });

    it('should call onTestamentChange when New Testament is selected', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      fireEvent.press(screen.getByTestId('testament-new'));

      expect(mockOnTestamentChange).toHaveBeenCalledWith('new');
    });

    it('should not call onTestamentChange when already selected testament is pressed', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      fireEvent.press(screen.getByTestId('testament-old'));

      expect(mockOnTestamentChange).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when book counts are not available', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
          loading={true}
        />
      );

      expect(screen.getByTestId('testament-loading')).toBeTruthy();
      expect(screen.queryByText('Old Testament')).toBeNull();
    });

    it('should disable interaction during loading', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
          loading={true}
        />
      );

      const toggleContainer = screen.getByTestId('testament-toggle');
      expect(toggleContainer.props.pointerEvents).toBe('none');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      expect(screen.getByLabelText('Select Old Testament')).toBeTruthy();
      expect(screen.getByLabelText('Select New Testament')).toBeTruthy();
    });

    it('should indicate selected state for screen readers', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      const oldTestamentButton = screen.getByTestId('testament-old');
      expect(oldTestamentButton.props.accessibilityState.selected).toBe(true);

      const newTestamentButton = screen.getByTestId('testament-new');
      expect(newTestamentButton.props.accessibilityState.selected).toBe(false);
    });

    it('should have proper accessibility role', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      const oldTestamentButton = screen.getByTestId('testament-old');
      expect(oldTestamentButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing book counts gracefully', () => {
      render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      expect(screen.getByText('Old Testament')).toBeTruthy();
      expect(screen.getByText('New Testament')).toBeTruthy();
    });

    it('should handle invalid testament selection', () => {
      render(
        <TestamentToggle
          selectedTestament={'invalid' as any}
          onTestamentChange={mockOnTestamentChange}
        />
      );

      // Should default to no selection or first option
      expect(screen.getByText('Old Testament')).toBeTruthy();
      expect(screen.getByText('New Testament')).toBeTruthy();
    });
  });

  describe('Animation', () => {
    it('should have transition animation for selection changes', () => {
      const { rerender } = render(
        <TestamentToggle
          selectedTestament="old"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      rerender(
        <TestamentToggle
          selectedTestament="new"
          onTestamentChange={mockOnTestamentChange}
        />
      );

      const newTestamentButton = screen.getByTestId('testament-new');
      expect(newTestamentButton.props.style).toMatchObject({
        backgroundColor: '#b09a6d',
      });
    });
  });
});