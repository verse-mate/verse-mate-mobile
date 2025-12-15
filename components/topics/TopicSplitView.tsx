/**
 * TopicSplitView Component
 *
 * Split-screen layout for landscape/tablet view of topics.
 * Displays Bible references on the left and explanations on the right
 * with a resizable divider between them.
 *
 * Features:
 * - Two-panel horizontal layout
 * - Resizable divider with drag functionality
 * - Independent scroll containers for each panel
 * - Persisted split ratio preference
 * - Responsive sizing based on screen dimensions
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 * @see Figma: https://www.figma.com/design/GOiiI0yRby5mWqCji8e4pp/VerseMate?node-id=3367-16156
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSplitViewSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { BREAKPOINTS, calculatePanelWidths } from '@/utils/device-detection';

/**
 * Props for TopicSplitView component
 */
export interface TopicSplitViewProps {
  /** Left panel content (Bible references) */
  leftContent: React.ReactNode;

  /** Right panel content (Explanations) */
  rightContent: React.ReactNode;

  /** Current split ratio (0-1, left panel proportion) */
  splitRatio: number;

  /** Callback when split ratio changes (for persistence) */
  onSplitRatioChange: (ratio: number) => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * TopicSplitView Component
 *
 * Renders a two-panel layout with a resizable divider.
 * Left panel shows Bible content, right panel shows explanations.
 */
export function TopicSplitView({
  leftContent,
  rightContent,
  splitRatio,
  onSplitRatioChange,
  testID = 'topic-split-view',
}: TopicSplitViewProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(specs, colors, insets), [specs, colors, insets]);

  // Track container width for calculating panel sizes
  const [containerWidth, setContainerWidth] = useState(0);

  // Track if divider is being dragged
  const [isDragging, setIsDragging] = useState(false);

  // Animated value for smooth divider position updates
  const dividerPosition = useRef(new Animated.Value(0)).current;

  // Store the current ratio during drag
  const currentRatioRef = useRef(splitRatio);

  // Handle container layout to get available width
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      setContainerWidth(width);
      // Update animated value to match current ratio
      const { leftWidth } = calculatePanelWidths(width, splitRatio);
      dividerPosition.setValue(leftWidth);
    },
    [splitRatio, dividerPosition]
  );

  // Calculate panel widths based on container width and split ratio
  const { leftWidth, rightWidth } = useMemo(() => {
    if (containerWidth === 0) {
      return { leftWidth: 0, rightWidth: 0 };
    }
    return calculatePanelWidths(containerWidth, splitRatio);
  }, [containerWidth, splitRatio]);

  // Pan responder for divider drag
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          setIsDragging(true);
          currentRatioRef.current = splitRatio;
          // Haptic feedback on drag start
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },

        onPanResponderMove: (_, gestureState) => {
          if (containerWidth === 0) return;

          // Calculate new left panel width based on drag
          const currentLeftWidth = containerWidth * currentRatioRef.current;
          const newLeftWidth = currentLeftWidth + gestureState.dx;

          // Clamp to valid range
          const minWidth = BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH;
          const maxWidth = containerWidth - minWidth;
          const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));

          // Update animated position
          dividerPosition.setValue(clampedWidth);
        },

        onPanResponderRelease: (_, gestureState) => {
          setIsDragging(false);

          if (containerWidth === 0) return;

          // Calculate final ratio
          const currentLeftWidth = containerWidth * currentRatioRef.current;
          const newLeftWidth = currentLeftWidth + gestureState.dx;

          // Clamp to valid range
          const minWidth = BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH;
          const maxWidth = containerWidth - minWidth;
          const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));

          // Calculate new ratio
          const newRatio = clampedWidth / containerWidth;

          // Haptic feedback on drag end
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Notify parent of ratio change (for persistence)
          onSplitRatioChange(newRatio);
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          // Reset to current ratio if cancelled
          const { leftWidth: resetWidth } = calculatePanelWidths(containerWidth, splitRatio);
          dividerPosition.setValue(resetWidth);
        },
      }),
    [containerWidth, splitRatio, onSplitRatioChange, dividerPosition]
  );

  // Handle double-tap on divider to reset to default ratio
  const handleDividerDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSplitRatioChange(specs.defaultSplitRatio);
  }, [onSplitRatioChange, specs.defaultSplitRatio]);

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      {containerWidth > 0 && (
        <>
          {/* Left Panel - Bible References */}
          <View style={[styles.panel, { width: leftWidth }]} testID={`${testID}-left-panel`}>
            {leftContent}
          </View>

          {/* Resizable Divider */}
          <View
            style={[styles.dividerContainer, isDragging && styles.dividerContainerActive]}
            {...panResponder.panHandlers}
            testID={`${testID}-divider`}
          >
            <View style={styles.dividerLine} />
            <Pressable
              style={[styles.dividerHandle, isDragging && styles.dividerHandleActive]}
              onPress={handleDividerDoubleTap}
              accessibilityRole="adjustable"
              accessibilityLabel="Resize panels"
              accessibilityHint="Drag to adjust panel sizes, double tap to reset"
            >
              <Ionicons
                name="resize-outline"
                size={16}
                color={isDragging ? colors.textPrimary : colors.textTertiary}
              />
            </Pressable>
          </View>

          {/* Right Panel - Explanations */}
          <View style={[styles.panel, { width: rightWidth }]} testID={`${testID}-right-panel`}>
            {rightContent}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Create styles for TopicSplitView
 */
function createStyles(
  specs: ReturnType<typeof getSplitViewSpecs>,
  colors: ReturnType<typeof useTheme>['colors'],
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.background,
      // Account for safe area on landscape (notch on left/right)
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    panel: {
      flex: 0,
      height: '100%',
      overflow: 'hidden',
    },
    dividerContainer: {
      width: 20,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      // Offset to center the touch area over the visual divider line
      marginLeft: -10,
      marginRight: -10,
    },
    dividerContainerActive: {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    dividerLine: {
      position: 'absolute',
      width: specs.dividerWidth,
      height: '100%',
      backgroundColor: specs.dividerColor,
    },
    dividerHandle: {
      width: specs.dividerHandleSize,
      height: specs.dividerHandleSize,
      borderRadius: specs.dividerHandleSize / 2,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: specs.dividerColor,
      alignItems: 'center',
      justifyContent: 'center',
      // Shadow for elevation
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    dividerHandleActive: {
      backgroundColor: specs.dividerHandleActiveColor,
      transform: [{ scale: 1.1 }],
    },
  });
}

export default TopicSplitView;
