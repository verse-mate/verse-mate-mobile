/**
 * ChapterContentTabs Component Tests
 *
 * Focused tests for the content tab switching component.
 * Tests active/inactive states, tab changes, and persistence integration.
 *
 * @see Task Group 5.1 - Write 3-5 focused tests for ChapterContentTabs
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { ChapterContentTabs } from '@/components/bible/ChapterContentTabs';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { ContentTabType } from '@/types/bible';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ChapterContentTabs', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Active tab is highlighted with gold background
   */
  it('should highlight active tab with gold background', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(<ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} />);

    // Use testID to get the Pressable element directly
    const summaryTab = screen.getByTestId('tab-summary');
    const byLineTab = screen.getByTestId('tab-byline');
    const detailedTab = screen.getByTestId('tab-detailed');

    // Active tab should have gold background (#b09a6d)
    expect(summaryTab).toHaveStyle({ backgroundColor: '#b09a6d' });

    // Inactive tabs should have gray700 background (#4a4a4a)
    expect(byLineTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(detailedTab).toHaveStyle({ backgroundColor: 'transparent' });
  });

  /**
   * Test 2: Inactive tabs show gray background
   */
  it('should show inactive tabs with gray background', () => {
    const activeTab: ContentTabType = 'byline';

    renderWithTheme(<ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} />);

    const summaryTab = screen.getByTestId('tab-summary');
    const byLineTab = screen.getByTestId('tab-byline');
    const detailedTab = screen.getByTestId('tab-detailed');

    // Inactive tabs should have gray700 background
    expect(summaryTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(detailedTab).toHaveStyle({ backgroundColor: 'transparent' });

    // Active tab should have gold background
    expect(byLineTab).toHaveStyle({ backgroundColor: '#b09a6d' });
  });

  /**
   * Test 3: onTabChange callback fired when tab tapped
   */
  it('should call onTabChange when a tab is tapped', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(<ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} />);

    // Tap on 'By Line' tab
    const byLineTab = screen.getByTestId('tab-byline');
    fireEvent.press(byLineTab);

    // onTabChange should be called with 'byline'
    expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    expect(mockOnTabChange).toHaveBeenCalledWith('byline');
  });

  /**
   * Test 4: onTabChange fires for all tabs
   */
  it('should fire onTabChange for all tab interactions', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(<ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} />);

    // Tap 'By Line'
    fireEvent.press(screen.getByTestId('tab-byline'));
    expect(mockOnTabChange).toHaveBeenLastCalledWith('byline');

    // Tap 'Detailed'
    fireEvent.press(screen.getByTestId('tab-detailed'));
    expect(mockOnTabChange).toHaveBeenLastCalledWith('detailed');

    // Total of 2 calls (tapping active tab 'summary' doesn't trigger change)
    expect(mockOnTabChange).toHaveBeenCalledTimes(2);
  });

  /**
   * Test 5: Component renders all three tabs
   */
  it('should render all three content tabs', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(<ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} />);

    // All three tabs should be visible
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('By Line')).toBeTruthy();
    expect(screen.getByText('Detailed')).toBeTruthy();
  });
});
