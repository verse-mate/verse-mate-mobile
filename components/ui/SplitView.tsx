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
 * - PERFORMANCE OPTIMIZED: Uses deferred resizing (ghost divider) to prevent layout thrashing
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 * @see Figma: https://www.figma.com/design/GOiiI0yRby5mWqCji8e4pp/VerseMate?node-id=3367-16156
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

  // Container dimensions as shared values (avoid JS thread access in worklets)
  const containerWidth = useSharedValue(0);
  const containerX = useSharedValue(0);

  // Track if layout is ready (for conditional rendering)
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Track if divider is being dragged (only for visual feedback, not checked in worklets)
  const [isDragging, setIsDragging] = useState(false);

  // Track if user is in long-press mode with target buttons visible
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Track which target is being hovered over during long-press
  const [hoveredTarget, setHoveredTarget] = useState<'left' | 'right' | null>(null);

  // Reanimated shared value for the committed panel width (layout width)
  // This ONLY updates on drag end to prevent layout thrashing
  const dividerPosition = useSharedValue(0);

  // Reanimated shared value for the temporary divider visual offset during drag
  // This updates on every frame of the drag for 60fps smoothness
  const dividerTranslation = useSharedValue(0);

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
      containerWidth.value = width;
      containerX.value = x;

      // Only set initial position if not already set or if width changed significantly
      if (!isLayoutReady || Math.abs(containerWidth.value - width) > 1) {
        const { leftWidth } = calculatePanelWidths(width, splitRatio);
        dividerPosition.value = leftWidth;
      }

      // Mark layout as ready
      if (!isLayoutReady && width > 0) {
        setIsLayoutReady(true);
      }
    },
    [splitRatio, dividerPosition, containerWidth, containerX, isLayoutReady]
  );

  // Sync divider position when splitRatio prop changes externally
  useEffect(() => {
    if (isLayoutReady && containerWidth.value > 0) {
      const { leftWidth } = calculatePanelWidths(containerWidth.value, splitRatio);
      // Avoid snapping if difference is negligible (prevents loops with parent state)
      if (Math.abs(dividerPosition.value - leftWidth) > 1) {
        dividerPosition.value = withTiming(leftWidth, { duration: 300 });
      }
    }
  }, [splitRatio, isLayoutReady, containerWidth, dividerPosition]);

  // Shared values for tracking drag state (used in worklets, don't cause re-renders)
  const isDraggingShared = useSharedValue(false);
  const isLongPressingShared = useSharedValue(false);
  const hoveredTargetShared = useSharedValue<'left' | 'right' | null>(null);
  const dragStartX = useSharedValue(0);
  const absoluteStartX = useSharedValue(0);
  const gestureStartTime = useSharedValue(0);
  const hasMovedHorizontally = useSharedValue(false);

  // Store min/max constraints as shared values (avoid JS constant access in worklets)
  const minLeftWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH);
  const minRightWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH);
  const maxPanelWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH);

  // Sync shared values with constants (critical for hot-reloading and dynamic updates)
  useEffect(() => {
    minLeftWidth.value = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
    minRightWidth.value = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
    maxPanelWidth.value = BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH;
  }, [minLeftWidth, minRightWidth, maxPanelWidth]);

  // Haptic callbacks (must run on JS thread)
  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const triggerHeavyHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Batch state updates - only called at gesture begin/end, not during drag
  const updateDragState = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  const updateLongPressState = useCallback(
    (longPressing: boolean, target: 'left' | 'right' | null) => {
      setIsLongPressing(longPressing);
      setHoveredTarget(target);
    },
    []
  );

  // Pan gesture for divider drag with long-press detection
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          isDraggingShared.value = true;

          // Store the current WIDTH at drag start
          dragStartX.value = dividerPosition.value;
          // Reset translation offset
          dividerTranslation.value = 0;

          // Track gesture start time for long-press detection
          gestureStartTime.value = Date.now();
          hasMovedHorizontally.value = false;

          // Trigger haptic and state update
          runOnJS(triggerLightHaptic)();
          runOnJS(updateDragState)(true);
        })
        .onChange((event) => {
          'worklet';
          if (containerWidth.value === 0) return;

          const dragThreshold = 10;
          const isDraggingHorizontally = Math.abs(event.translationX) > dragThreshold;

          // Track if we've moved horizontally
          if (isDraggingHorizontally && !hasMovedHorizontally.value) {
            hasMovedHorizontally.value = true;
          }

          // Check for long-press: no horizontal movement and 500ms elapsed
          const elapsed = Date.now() - gestureStartTime.value;
          if (!hasMovedHorizontally.value && elapsed > 500 && !isLongPressingShared.value) {
            // Long-press detected
            isLongPressingShared.value = true;

            // Fade in target buttons
            leftTargetOpacity.value = withTiming(1, { duration: 300 });
            rightTargetOpacity.value = withTiming(1, { duration: 300 });

            runOnJS(triggerSuccessHaptic)();
            runOnJS(updateLongPressState)(true, null);
            absoluteStartX.value = event.absoluteX;
          }

          // If dragging horizontally and long-press NOT yet active, do normal drag
          if (isDraggingHorizontally && !isLongPressingShared.value) {
            // Normal drag mode
            const targetLeftWidth = dragStartX.value + event.translationX;
            const totalWidth = containerWidth.value;

            // CALCULATE ROBUST CONSTRAINTS TO MATCH device-detection.ts LOGIC
            // This prevents "snapping" when the committed value is re-processed by the system.
            // Note: We ignore ratio constraints here and rely purely on pixel constraints,
            // as device-detection.ts now prioritizes pixel limits (0.1-0.9 ratio is very permissive).

            // 2. Fixed Min/Max Width Constraints
            // Effective Min: Fixed Min
            const effectiveMinLeft = minLeftWidth.value;

            // Effective Max: Min of (Total - Fixed Right Min, Fixed Max Panel)
            const effectiveMaxLeft = Math.min(
              totalWidth - minRightWidth.value,
              maxPanelWidth.value
            );

            // Clamp to valid range
            const clampedWidth = Math.max(
              effectiveMinLeft,
              Math.min(effectiveMaxLeft, targetLeftWidth)
            );

            // Calculate the translation required to visually represent this width
            dividerTranslation.value = clampedWidth - dragStartX.value;
          } else if (isLongPressingShared.value) {
            // Long-press active - update target zone highlighting
            const leftTargetZoneRadius = 40;
            const rightTargetZoneRadius = 50;

            // Container-relative X position using shared value
            const containerRelativeX = event.absoluteX - containerX.value;

            // Current VISUAL divider center (includes translation if any)
            const currentVisualX = dividerPosition.value + dividerTranslation.value;
            const dividerCenterX = currentVisualX + 10; // Divider is 20px wide

            // Button center positions
            const leftButtonCenterX = dividerCenterX - 60;
            const rightButtonCenterX = dividerCenterX + 60;

            // Distances from finger to each button
            const distanceToLeftButton = Math.abs(containerRelativeX - leftButtonCenterX);
            const distanceToRightButton = Math.abs(containerRelativeX - rightButtonCenterX);

            let newTarget: 'left' | 'right' | null = null;

            if (
              distanceToLeftButton < leftTargetZoneRadius &&
              distanceToLeftButton < distanceToRightButton
            ) {
              newTarget = 'left';
            } else if (distanceToRightButton < rightTargetZoneRadius) {
              newTarget = 'right';
            }

            // Only update if target changed (reduce runOnJS calls)
            if (hoveredTargetShared.value !== newTarget) {
              hoveredTargetShared.value = newTarget;
              runOnJS(updateLongPressState)(true, newTarget);
              if (newTarget !== null) {
                runOnJS(triggerLightHaptic)();
              }
            }
          }
        })
        .onEnd((event) => {
          'worklet';
          isDraggingShared.value = false;
          runOnJS(updateDragState)(false);

          if (containerWidth.value === 0) return;

          const dragThreshold = 10;
          const wasDraggedHorizontally = Math.abs(event.translationX) > dragThreshold;

          // If was in long-press mode, check for target selection
          if (isLongPressingShared.value) {
            const target = hoveredTargetShared.value;
            if (target && onViewModeChange) {
              // Transition to fullscreen mode
              if (target === 'left') {
                runOnJS(onViewModeChange)('right-full');
              } else {
                runOnJS(onViewModeChange)('left-full');
              }
              runOnJS(triggerHeavyHaptic)();
            }

            // Fade out target buttons
            leftTargetOpacity.value = withTiming(0, { duration: 200 });
            rightTargetOpacity.value = withTiming(0, { duration: 200 });

            isLongPressingShared.value = false;
            hoveredTargetShared.value = null;
            runOnJS(updateLongPressState)(false, null);

            // Reset translation
            dividerTranslation.value = withTiming(0);
          } else if (wasDraggedHorizontally) {
            // Normal drag release - COMMIT THE NEW WIDTH
            const finalWidth = dragStartX.value + dividerTranslation.value;

            // Update panel width (layout triggers now)
            dividerPosition.value = finalWidth;

            // Reset translation (it's now part of the width)
            dividerTranslation.value = 0;

            // Calculate new ratio
            const newRatio = finalWidth / containerWidth.value;

            // Haptic feedback
            runOnJS(triggerMediumHaptic)();

            // Notify parent of ratio change
            runOnJS(onSplitRatioChange)(newRatio);
          } else {
            // Small jitter, just reset
            dividerTranslation.value = withTiming(0);
          }
        })
        .onFinalize(() => {
          'worklet';
          // Clean up state if gesture was cancelled
          if (isDraggingShared.value || isLongPressingShared.value) {
            isDraggingShared.value = false;
            isLongPressingShared.value = false;
            hoveredTargetShared.value = null;

            runOnJS(updateDragState)(false);
            runOnJS(updateLongPressState)(false, null);

            // Fade out target buttons
            leftTargetOpacity.value = withTiming(0, { duration: 200 });
            rightTargetOpacity.value = withTiming(0, { duration: 200 });

            // Reset translation without committing width
            dividerTranslation.value = withTiming(0);
          }
        }),
    [
      onSplitRatioChange,
      onViewModeChange,
      containerWidth,
      containerX,
      dividerPosition,
      dividerTranslation,
      minLeftWidth,
      minRightWidth,
      maxPanelWidth,
      isDraggingShared,
      isLongPressingShared,
      hoveredTargetShared,
      dragStartX,
      absoluteStartX,
      gestureStartTime,
      hasMovedHorizontally,
      leftTargetOpacity,
      rightTargetOpacity,
      updateDragState,
      updateLongPressState,
      triggerLightHaptic,
      triggerMediumHaptic,
      triggerHeavyHaptic,
      triggerSuccessHaptic,
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

  // Animated styles for panel widths
  const leftPanelStyle = useAnimatedStyle(() => {
    if (isFullscreen) {
      return { width: '100%' };
    }
    return {
      width: dividerPosition.value,
    };
  });

  const rightPanelStyle = useAnimatedStyle(() => {
    if (isFullscreen) {
      return { width: '100%' };
    }
    return {
      width: containerWidth.value - dividerPosition.value,
    };
  });

  // Animated style for the divider itself (allows ghost-dragging)
  const dividerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: dividerTranslation.value }],
    };
  });

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
      {isLayoutReady && (
        <>
          {/* Left Panel - Hidden when right fullscreen */}
          {shouldShowLeftPanel && (
            <Reanimated.View style={[styles.panel, leftPanelStyle]} testID={`${testID}-left-panel`}>
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
            <GestureDetector gesture={panGesture}>
              <Reanimated.View
                style={[
                  styles.dividerContainer,
                  isDragging && styles.dividerContainerActive,
                  dividerAnimatedStyle,
                ]}
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
              </Reanimated.View>
            </GestureDetector>
          )}

          {/* Right Panel - Hidden when left fullscreen */}
          {shouldShowRightPanel && (
            <Reanimated.View
              style={[styles.panel, rightPanelStyle]}
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
