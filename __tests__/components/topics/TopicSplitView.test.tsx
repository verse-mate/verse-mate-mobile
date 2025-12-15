/**
 * TopicSplitView Component Tests
 *
 * Tests for the split view layout component.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { TopicSplitView } from '@/components/topics/TopicSplitView';

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

describe('TopicSplitView', () => {
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

  it('should render both panels', () => {
    render(<TopicSplitView {...defaultProps} />);

    // Trigger layout event to set container width
    const container = screen.getByTestId('topic-split-view');
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width: 1000, height: 800 } },
    });

    expect(screen.getByTestId('topic-split-view-left-panel')).toBeTruthy();
    expect(screen.getByTestId('topic-split-view-right-panel')).toBeTruthy();
  });

  it('should render left and right content', () => {
    render(<TopicSplitView {...defaultProps} />);

    // Trigger layout event
    const container = screen.getByTestId('topic-split-view');
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width: 1000, height: 800 } },
    });

    expect(screen.getByTestId('left-content')).toBeTruthy();
    expect(screen.getByTestId('right-content')).toBeTruthy();
  });

  it('should render divider between panels', () => {
    render(<TopicSplitView {...defaultProps} />);

    // Trigger layout event
    const container = screen.getByTestId('topic-split-view');
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width: 1000, height: 800 } },
    });

    expect(screen.getByTestId('topic-split-view-divider')).toBeTruthy();
  });

  it('should have correct accessibility properties on divider', () => {
    render(<TopicSplitView {...defaultProps} />);

    // Trigger layout event
    const container = screen.getByTestId('topic-split-view');
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width: 1000, height: 800 } },
    });

    const divider = screen.getByLabelText('Resize panels');
    expect(divider).toBeTruthy();
  });

  it('should accept custom testID', () => {
    render(<TopicSplitView {...defaultProps} testID="custom-split-view" />);

    expect(screen.getByTestId('custom-split-view')).toBeTruthy();
  });

  it('should not render panels before layout measurement', () => {
    render(<TopicSplitView {...defaultProps} />);

    // Before layout event, panels should not be visible
    expect(screen.queryByTestId('left-content')).toBeNull();
    expect(screen.queryByTestId('right-content')).toBeNull();
  });

  it('should call onSplitRatioChange when divider is double-tapped', () => {
    const onSplitRatioChange = jest.fn();
    render(<TopicSplitView {...defaultProps} onSplitRatioChange={onSplitRatioChange} />);

    // Trigger layout event
    const container = screen.getByTestId('topic-split-view');
    fireEvent(container, 'layout', {
      nativeEvent: { layout: { width: 1000, height: 800 } },
    });

    // Press the divider handle (double-tap to reset)
    const dividerHandle = screen.getByLabelText('Resize panels');
    fireEvent.press(dividerHandle);

    // Should call with default ratio
    expect(onSplitRatioChange).toHaveBeenCalledWith(0.536);
  });
});
