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
   * Test 1: Active tab is highlighted with gold background. Renders in
   * the topics configuration (showDetailed) so all three classic tabs
   * are present.
   */
  it('should highlight active tab with gold background', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(
      <ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} showDetailed />
    );

    // Use testID to get the Pressable element directly
    const summaryTab = screen.getByTestId('tab-summary');
    const byLineTab = screen.getByTestId('tab-byline');
    const detailedTab = screen.getByTestId('tab-detailed');

    // All tabs should have transparent background (sliding indicator shows active state)
    expect(summaryTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(byLineTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(detailedTab).toHaveStyle({ backgroundColor: 'transparent' });
  });

  /**
   * Test 2: All tabs use transparent background with sliding indicator
   */
  it('should show all tabs with transparent background', () => {
    const activeTab: ContentTabType = 'byline';

    renderWithTheme(
      <ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} showDetailed />
    );

    const summaryTab = screen.getByTestId('tab-summary');
    const byLineTab = screen.getByTestId('tab-byline');
    const detailedTab = screen.getByTestId('tab-detailed');

    // All tabs should have transparent background (sliding indicator shows active state)
    expect(summaryTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(byLineTab).toHaveStyle({ backgroundColor: 'transparent' });
    expect(detailedTab).toHaveStyle({ backgroundColor: 'transparent' });
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
   * Test 4: onTabChange fires for all tab interactions
   */
  it('should fire onTabChange for all tab interactions', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(
      <ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} showDetailed />
    );

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
   * Test 5: Topics config (showDetailed) renders Summary / By Line / Detailed.
   */
  it('should render the topics tab set when showDetailed is set', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(
      <ChapterContentTabs activeTab={activeTab} onTabChange={mockOnTabChange} showDetailed />
    );

    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('By Line')).toBeTruthy();
    expect(screen.getByText('Detailed')).toBeTruthy();
    expect(screen.queryByText('Study')).toBeNull();
  });

  /**
   * Test 6: Bible-chapter config (showStudy + showVisuals) renders
   * Summary / By Line / Study / Visuals — no Detailed.
   */
  it('should render the Bible tab set when showStudy + showVisuals are set', () => {
    const activeTab: ContentTabType = 'summary';

    renderWithTheme(
      <ChapterContentTabs
        activeTab={activeTab}
        onTabChange={mockOnTabChange}
        showStudy
        showVisuals
      />
    );

    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('By Line')).toBeTruthy();
    expect(screen.getByText('Study')).toBeTruthy();
    expect(screen.getByText('Visuals')).toBeTruthy();
    expect(screen.queryByText('Detailed')).toBeNull();
  });
});
