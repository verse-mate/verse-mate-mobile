/**
 * SplitView Component
 *
 * Reusable split-screen layout for landscape/tablet view.
 * Used for both Bible reading and Topics screens.
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSplitViewSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { BREAKPOINTS, calculatePanelWidths } from '@/utils/device-detection';

/**
 * View mode for panel layout
 */
export type SplitViewMode = 'split' | 'left-full' | 'right-full';

/**
 * Props for SplitView component
 */
export interface SplitViewProps {
  /** Left panel content */
  leftContent: React.ReactNode;

  /** Right panel content */
  rightContent: React.ReactNode;

  /** Current split ratio (0-1, left panel proportion) */
  splitRatio: number;

  /** Callback when split ratio changes (for persistence) */
  onSplitRatioChange: (ratio: number) => void;

  /** Current view mode (split, left-full, or right-full) */
  viewMode?: SplitViewMode;

  /** Callback when view mode changes */
  onViewModeChange?: (mode: SplitViewMode) => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * SplitView Component
 *
 * Renders a two-panel layout with a resizable divider.
 * Generic component used by both Bible and Topics screens.
 */
export function SplitView({
  leftContent,
  rightContent,
  splitRatio,
  onSplitRatioChange,
  viewMode = 'split',
  onViewModeChange,
  testID = 'split-view',
}: SplitViewProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(specs, colors, insets), [specs, colors, insets]);

  // Track container width and X position for calculating panel sizes and hover detection
  const [containerWidth, setContainerWidth] = useState(0);
  const containerXRef = useRef(0);

  // Track if divider is being dragged
  const [isDragging, setIsDragging] = useState(false);

  // Track if user is in long-press mode with target buttons visible
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Track which target is being hovered over during long-press
  const [hoveredTarget, setHoveredTarget] = useState<'left' | 'right' | null>(null);

  // Store the drag start width for tracking during drag
  const dragStartWidthRef = useRef(0);

  // Store the long-press timer ID
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reanimated shared value for smooth divider position updates (runs on UI thread)
  const dividerPosition = useSharedValue(0);

  // Reanimated shared values for target buttons fade-in
  const leftTargetOpacity = useSharedValue(0);
  const rightTargetOpacity = useSharedValue(0);

  // Reanimated shared values for edge tab slide-in (separate for left and right)
  const leftEdgeTabSlideAnim = useSharedValue(-50); // Start off-screen left
  const rightEdgeTabSlideAnim = useSharedValue(50); // Start off-screen right

  // Handle container layout to get available width and position
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, x } = event.nativeEvent.layout;
      setContainerWidth(width);
      containerXRef.current = x;
      // Update shared value to match current ratio
      const { leftWidth } = calculatePanelWidths(width, splitRatio);
      dividerPosition.value = leftWidth;
      dragStartWidthRef.current = leftWidth;
    },
    [splitRatio, dividerPosition]
  );

  // Pan responder for divider drag and long-press detection
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          setIsDragging(true);
          // Store the current position at drag start (prevents snapping)
          dragStartWidthRef.current = dividerPosition.value;
          // Haptic feedback on drag start
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          // Start long-press detection timer (500ms)
          longPressTimerRef.current = setTimeout(() => {
            setIsLongPressing(true);
            // Fade in target buttons with Reanimated
            leftTargetOpacity.value = withTiming(1, { duration: 300 });
            rightTargetOpacity.value = withTiming(1, { duration: 300 });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, 500);
        },

        onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          if (containerWidth === 0) return;

          // Check if horizontal movement is significant (>10px threshold)
          // Reduced from 30px to make dragging more responsive
          const dragThreshold = 10;
          const isDraggingHorizontally = Math.abs(gestureState.dx) > dragThreshold;

          // If dragging horizontally and long-press NOT yet active, cancel the timer
          if (isDraggingHorizontally && !isLongPressing) {
            // Clear long-press timer if still running (hasn't fired yet)
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }

            // Normal drag mode - resize divider
            // Calculate new left panel width based on drag offset from start
            const newLeftWidth = dragStartWidthRef.current + gestureState.dx;

            // Clamp to valid range with separate minimums for each panel
            const minLeftWidth = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
            const minRightWidth = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
            const maxLeftWidth = containerWidth - minRightWidth;
            const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));

            // Update position directly (Reanimated updates on UI thread for smooth performance)
            dividerPosition.value = clampedWidth;
          } else if (isLongPressing) {
            // Long-press is active - only update target zone highlighting, never drag divider
            // Check for target zones based on CURRENT touch position (where finger is now)

            // Target buttons are positioned relative to the divider:
            // - Left button: 60px to the left of divider (left: -60)
            // - Right button: 60px to the right of divider (right: -60)
            // Different radii to balance detection feel
            const leftTargetZoneRadius = 40; // 10px smaller for left button
            const rightTargetZoneRadius = 50; // Standard radius for right button

            // Convert absolute screen coordinates to container-relative coordinates
            const containerRelativeX = gestureState.moveX - containerXRef.current;

            // Get current divider position from shared value
            const currentDividerX = dividerPosition.value;

            // Divider is 20px wide, so center is at currentDividerX + 10
            const dividerCenterX = currentDividerX + 10;

            // Calculate button center positions relative to divider CENTER
            const leftButtonCenterX = dividerCenterX - 60; // 60px left of divider center
            const rightButtonCenterX = dividerCenterX + 60; // 60px right of divider center

            // Calculate distances from finger to each button center
            const distanceToLeftButton = Math.abs(containerRelativeX - leftButtonCenterX);
            const distanceToRightButton = Math.abs(containerRelativeX - rightButtonCenterX);

            if (
              distanceToLeftButton < leftTargetZoneRadius &&
              distanceToLeftButton < distanceToRightButton
            ) {
              // Closer to left target zone
              if (hoveredTarget !== 'left') {
                setHoveredTarget('left');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } else if (distanceToRightButton < rightTargetZoneRadius) {
              // Closer to right target zone
              if (hoveredTarget !== 'right') {
                setHoveredTarget('right');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } else if (hoveredTarget !== null) {
              // Not in any target zone
              setHoveredTarget(null);
            }
          }
        },

        onPanResponderRelease: (
          _: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Clear long-press timer if still running
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          setIsDragging(false);

          if (containerWidth === 0) return;

          // Check if horizontal movement is significant (must match threshold above)
          const dragThreshold = 10;
          const wasDraggedHorizontally = Math.abs(gestureState.dx) > dragThreshold;

          // If was in long-press mode, check for target selection
          if (isLongPressing) {
            if (hoveredTarget) {
              // Transition to fullscreen mode
              // Left button (drag left) → divider goes left → RIGHT panel expands to fullscreen
              // Right button (drag right) → divider goes right → LEFT panel expands to fullscreen
              if (hoveredTarget === 'left') {
                onViewModeChange?.('right-full'); // Expand RIGHT panel
              } else {
                onViewModeChange?.('left-full'); // Expand LEFT panel
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }

            // Fade out target buttons with Reanimated
            leftTargetOpacity.value = withTiming(0, { duration: 200 });
            rightTargetOpacity.value = withTiming(0, { duration: 200 });

            setIsLongPressing(false);
            setHoveredTarget(null);
          } else if (wasDraggedHorizontally) {
            // Normal drag release - calculate new ratio
            // Calculate final width from drag
            const newLeftWidth = dragStartWidthRef.current + gestureState.dx;

            // Clamp to valid range with separate minimums for each panel
            const minLeftWidth = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
            const minRightWidth = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
            const maxLeftWidth = containerWidth - minRightWidth;
            const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));

            // Calculate new ratio
            const newRatio = clampedWidth / containerWidth;

            // Haptic feedback on drag end
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Notify parent of ratio change (for persistence)
            onSplitRatioChange(newRatio);
          }
        },

        onPanResponderTerminate: () => {
          // Clear long-press timer if still running
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
          }

          setIsDragging(false);
          setIsLongPressing(false);
          setHoveredTarget(null);

          // Fade out target buttons if visible with Reanimated
          leftTargetOpacity.value = withTiming(0, { duration: 200 });
          rightTargetOpacity.value = withTiming(0, { duration: 200 });

          // Reset to current ratio if cancelled
          const { leftWidth: resetWidth } = calculatePanelWidths(containerWidth, splitRatio);
          dividerPosition.value = resetWidth;
        },
      }),
    [
      containerWidth,
      splitRatio,
      onSplitRatioChange,
      dividerPosition,
      isLongPressing,
      hoveredTarget,
      onViewModeChange,
      leftTargetOpacity,
      rightTargetOpacity,
    ]
  );

  // Handle double-tap on divider to reset to default ratio
  const handleDividerDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSplitRatioChange(specs.defaultSplitRatio);
  }, [onSplitRatioChange, specs.defaultSplitRatio]);

  const shouldShowLeftPanel = viewMode === 'split' || viewMode === 'left-full';
  const shouldShowRightPanel = viewMode === 'split' || viewMode === 'right-full';
  const isFullscreen = viewMode !== 'split';

  // Animated styles for panels (runs on UI thread for smooth performance)
  const leftPanelStyle = useAnimatedStyle(() => ({
    width: isFullscreen ? '100%' : dividerPosition.value,
  }));

  const rightPanelStyle = useAnimatedStyle(() => ({
    width: isFullscreen ? '100%' : containerWidth - dividerPosition.value,
  }));

  const leftTargetButtonStyle = useAnimatedStyle(() => ({
    opacity: leftTargetOpacity.value,
  }));

  const rightTargetButtonStyle = useAnimatedStyle(() => ({
    opacity: rightTargetOpacity.value,
  }));

  const leftEdgeTabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftEdgeTabSlideAnim.value }],
  }));

  const rightEdgeTabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightEdgeTabSlideAnim.value }],
  }));

  // Update edge tab slide animations when view mode changes
  useEffect(() => {
    if (viewMode === 'left-full') {
      // Bible fullscreen - show right edge tab, hide left
      rightEdgeTabSlideAnim.value = withTiming(0, { duration: 300 });
      leftEdgeTabSlideAnim.value = withTiming(-50, { duration: 300 });
    } else if (viewMode === 'right-full') {
      // Commentary fullscreen - show left edge tab, hide right
      leftEdgeTabSlideAnim.value = withTiming(0, { duration: 300 });
      rightEdgeTabSlideAnim.value = withTiming(50, { duration: 300 });
    } else {
      // Split mode - hide both edge tabs and reset target button opacities
      leftEdgeTabSlideAnim.value = withTiming(-50, { duration: 200 });
      rightEdgeTabSlideAnim.value = withTiming(50, { duration: 200 });
      leftTargetOpacity.value = withTiming(0, { duration: 200 });
      rightTargetOpacity.value = withTiming(0, { duration: 200 });
      // Also reset the long-press state
      setIsLongPressing(false);
      setHoveredTarget(null);
    }
  }, [
    viewMode,
    leftEdgeTabSlideAnim,
    rightEdgeTabSlideAnim,
    leftTargetOpacity,
    rightTargetOpacity,
  ]);

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      {containerWidth > 0 && (
        <>
          {/* Left Panel - Hidden when right fullscreen */}
          {shouldShowLeftPanel && (
            <Reanimated.View
              style={[styles.panel, isFullscreen && { flex: 1 }, !isFullscreen && leftPanelStyle]}
              testID={`${testID}-left-panel`}
            >
              {leftContent}
            </Reanimated.View>
          )}

          {/* Left Edge Tab - Shows when viewing right panel fullscreen (commentary) */}
          <Reanimated.View
            style={[styles.edgeTab, styles.leftEdgeTab, leftEdgeTabStyle]}
            pointerEvents={viewMode === 'right-full' ? 'box-none' : 'none'}
          >
            <Pressable
              style={[
                styles.edgeTabButton,
                styles.leftEdgeTabButton,
                { backgroundColor: colors.backgroundElevated },
              ]}
              onPress={() => onViewModeChange?.('split')}
              accessibilityRole="button"
              accessibilityLabel="Return to split view"
              testID={`${testID}-left-edge-tab`}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          </Reanimated.View>

          {/* Resizable Divider - Hidden when fullscreen */}
          {viewMode === 'split' && (
            <View
              style={[styles.dividerContainer, isDragging && styles.dividerContainerActive]}
              {...panResponder.panHandlers}
              testID={`${testID}-divider`}
            >
              <View style={styles.dividerLine} />

              {/* Long-Press Target Buttons - Fade in during long-press */}
              <Reanimated.View
                style={[
                  styles.targetButton,
                  styles.targetButtonLeft,
                  leftTargetButtonStyle,
                  {
                    backgroundColor:
                      hoveredTarget === 'left' ? colors.gold : colors.backgroundElevated,
                  },
                ]}
                pointerEvents={isLongPressing ? 'auto' : 'none'}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={hoveredTarget === 'left' ? colors.white : colors.textSecondary}
                />
              </Reanimated.View>

              <Reanimated.View
                style={[
                  styles.targetButton,
                  styles.targetButtonRight,
                  rightTargetButtonStyle,
                  {
                    backgroundColor:
                      hoveredTarget === 'right' ? colors.gold : colors.backgroundElevated,
                  },
                ]}
                pointerEvents={isLongPressing ? 'auto' : 'none'}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={hoveredTarget === 'right' ? colors.white : colors.textSecondary}
                />
              </Reanimated.View>

              <Pressable
                style={[styles.dividerHandle, isDragging && styles.dividerHandleActive]}
                onPress={handleDividerDoubleTap}
                accessibilityRole="adjustable"
                accessibilityLabel="Resize panels or long-press for fullscreen"
                accessibilityHint="Drag to adjust panel sizes, double tap to reset, long-press for fullscreen options"
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={16}
                  color={isDragging ? colors.textPrimary : colors.textTertiary}
                />
              </Pressable>
            </View>
          )}

          {/* Right Panel - Hidden when left fullscreen */}
          {shouldShowRightPanel && (
            <Reanimated.View
              style={[styles.panel, isFullscreen && { flex: 1 }, !isFullscreen && rightPanelStyle]}
              testID={`${testID}-right-panel`}
            >
              {rightContent}
            </Reanimated.View>
          )}

          {/* Right Edge Tab - Shows when viewing left panel fullscreen (Bible) */}
          <Reanimated.View
            style={[styles.edgeTab, styles.rightEdgeTab, rightEdgeTabStyle]}
            pointerEvents={viewMode === 'left-full' ? 'box-none' : 'none'}
          >
            <Pressable
              style={[
                styles.edgeTabButton,
                styles.rightEdgeTabButton,
                { backgroundColor: colors.backgroundElevated },
              ]}
              onPress={() => onViewModeChange?.('split')}
              accessibilityRole="button"
              accessibilityLabel="Return to split view"
              testID={`${testID}-right-edge-tab`}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
          </Reanimated.View>
        </>
      )}
    </View>
  );
}

/**
 * Create styles for SplitView
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
      overflow: 'visible', // Allow edge tabs to render outside container
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
      marginTop: -80, // Move up more to align with target buttons
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
    targetButton: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.1)',
      // Shadow for elevation
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    targetButtonLeft: {
      left: -60,
      top: '50%',
      marginTop: -22, // Bring down to align with divider and edge tabs
    },
    targetButtonRight: {
      right: -60,
      top: '50%',
      marginTop: -22, // Bring down to align with divider and edge tabs
    },
    edgeTab: {
      position: 'absolute',
      width: 50,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -80, // Move up more to align with target buttons (same as divider)
      zIndex: 100, // High z-index to be above all content
      pointerEvents: 'box-none', // Pass touches to children
    },
    leftEdgeTab: {
      left: 0,
      paddingLeft: insets.left,
      alignItems: 'flex-start', // Align button to left edge
    },
    rightEdgeTab: {
      right: 0,
      paddingRight: insets.right,
      alignItems: 'flex-end', // Align button to right edge
    },
    edgeTabButton: {
      width: 32,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.1)',
      // Shadow for elevation
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
      pointerEvents: 'box-only', // Only this element captures touches
    },
    leftEdgeTabButton: {
      // Half-circle glued to left edge (rounded on right side only)
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      paddingLeft: 0, // Flush against left edge
      paddingRight: 6, // Icon spacing from curved edge
    },
    rightEdgeTabButton: {
      // Half-circle glued to right edge (rounded on left side only)
      borderTopLeftRadius: 32,
      borderBottomLeftRadius: 32,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      paddingRight: 0, // Flush against right edge
      paddingLeft: 6, // Icon spacing from curved edge
    },
  });
}

export default SplitView;
