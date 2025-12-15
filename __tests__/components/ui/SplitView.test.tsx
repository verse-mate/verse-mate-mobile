/**
 * SplitView Component Tests
 *
 * Tests for the shared split view layout component.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { SplitView } from '@/components/ui/SplitView';

// Mock dependencies
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'light',
    colors: {
      background: '#ffffff',
      textPrimary: '#000000',
      textTertiary: '#999999',
      backgroundElevated: '#f5f5f5',
      shadow: 'rgba(0,0,0,0.1)',
      border: '#e0e0e0',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

describe('SplitView', () => {
  const mockLeftContent = (
    <View testID="left-content">
      <Text>Left Panel Content</Text>
    </View>
  );

  const mockRightContent = (
    <View testID="right-content">
      <Text>Right Panel Content</Text>
    </View>
  );

  const defaultProps = {
    leftContent: mockLeftContent,
    rightContent: mockRightContent,
    splitRatio: 0.5,
    onSplitRatioChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to simulate layout event (SplitView only renders content when containerWidth > 0)
   */
  const simulateLayout = (testId: string, width = 1000) => {
    const container = screen.getByTestId(testId);
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width, height: 800 } },
    });
  };

  it('should render left and right panels after layout', () => {
    render(<SplitView {...defaultProps} />);

    simulateLayout('split-view');

    expect(screen.getByTestId('left-content')).toBeTruthy();
    expect(screen.getByTestId('right-content')).toBeTruthy();
  });

  it('should render with default testID', () => {
    render(<SplitView {...defaultProps} />);

    expect(screen.getByTestId('split-view')).toBeTruthy();

    simulateLayout('split-view');

    expect(screen.getByTestId('split-view-left-panel')).toBeTruthy();
    expect(screen.getByTestId('split-view-right-panel')).toBeTruthy();
  });

  it('should render with custom testID', () => {
    render(<SplitView {...defaultProps} testID="custom-split-view" />);

    expect(screen.getByTestId('custom-split-view')).toBeTruthy();
  });

  it('should render divider after layout', () => {
    render(<SplitView {...defaultProps} />);

    simulateLayout('split-view');

    const divider = screen.getByTestId('split-view-divider');
    expect(divider).toBeTruthy();
  });

  it('should not render panels before layout event', () => {
    render(<SplitView {...defaultProps} />);

    // Before layout, content should not be rendered
    expect(screen.queryByTestId('left-content')).toBeNull();
    expect(screen.queryByTestId('right-content')).toBeNull();
  });
});
