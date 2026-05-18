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

jest.mock('react-native-gesture-handler', () => {
  const actualGH = jest.requireActual('react-native-gesture-handler');

  const createMockGesture = () => ({
    minDuration: jest.fn().mockReturnThis(),
    onStart: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
    onBegin: jest.fn().mockReturnThis(),
    onChange: jest.fn().mockReturnThis(),
    onFinalize: jest.fn().mockReturnThis(),
    toGestureArray: jest.fn().mockReturnValue([]),
  });

  return {
    ...actualGH,
    Gesture: {
      ...actualGH.Gesture,
      LongPress: createMockGesture,
      Pan: createMockGesture,
    },
    GestureDetector: ({ children }: any) => children,
  };
});

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

  // Regression test for VER-103: the edge-tab Pressable hit area must stay reachable
  // even when edgeTabsVisible=false (i.e. opacity has faded to 0). The opacity
  // animation is intentionally scoped to an inner Reanimated.View so Pressable.onPress
  // still fires when the visual chrome is invisible. Mirrors the VER-46 / PR #311 fix.
  describe('edge-tab hit-test (VER-103 regression)', () => {
    it('fires left edge-tab onPress when edgeTabsVisible=false (right-full mode)', () => {
      const onViewModeChange = jest.fn();
      render(
        <SplitView
          {...defaultProps}
          viewMode="right-full"
          edgeTabsVisible={false}
          onViewModeChange={onViewModeChange}
        />
      );
      simulateLayout('split-view');

      const leftTabButton = screen.getByTestId('split-view-left-edge-tab-button');
      fireEvent.press(leftTabButton);

      expect(onViewModeChange).toHaveBeenCalledWith('split');
    });

    it('fires right edge-tab onPress when edgeTabsVisible=false (left-full mode)', () => {
      const onViewModeChange = jest.fn();
      render(
        <SplitView
          {...defaultProps}
          viewMode="left-full"
          edgeTabsVisible={false}
          onViewModeChange={onViewModeChange}
        />
      );
      simulateLayout('split-view');

      const rightTabButton = screen.getByTestId('split-view-right-edge-tab-button');
      fireEvent.press(rightTabButton);

      expect(onViewModeChange).toHaveBeenCalledWith('split');
    });

    it('does not put opacity on the outer edge-tab wrapper', () => {
      render(<SplitView {...defaultProps} viewMode="right-full" edgeTabsVisible={false} />);
      simulateLayout('split-view');

      // The outer wrapper carries slide-only animated style; opacity must live on the
      // inner visual chrome so the hit area remains active during fade.
      const leftEdgeTab = screen.getByTestId('split-view-left-edge-tab');
      const flatten = (style: unknown): Record<string, unknown> => {
        if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
        return (style as Record<string, unknown>) ?? {};
      };
      const merged = flatten(leftEdgeTab.props.style);
      expect(merged.opacity).toBeUndefined();
    });
  });
});
