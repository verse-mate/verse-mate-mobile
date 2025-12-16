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

  // Live left panel width during drag for dynamic updates
  const [liveLeftWidth, setLiveLeftWidth] = useState<number | null>(null);

  // Store the drag start width for tracking during drag
  const dragStartWidthRef = useRef(0);

  // Store the initial Y position of long-press to validate vertical movement
  const longPressStartYRef = useRef(0);

  // Store the long-press timer ID
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated value for smooth divider position updates
  const dividerPosition = useRef(new Animated.Value(0)).current;

  // Animated values for target buttons fade-in
  const leftTargetOpacity = useRef(new Animated.Value(0)).current;
  const rightTargetOpacity = useRef(new Animated.Value(0)).current;

  // Animated values for edge tab slide-in (separate for left and right)
  const leftEdgeTabSlideAnim = useRef(new Animated.Value(-50)).current; // Start off-screen left
  const rightEdgeTabSlideAnim = useRef(new Animated.Value(50)).current; // Start off-screen right

  // Handle container layout to get available width and position
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, x } = event.nativeEvent.layout;
      setContainerWidth(width);
      containerXRef.current = x;
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

  // Pan responder for divider drag and long-press detection
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (_, gestureState) => {
          setIsDragging(true);
          // Store the width at drag start
          dragStartWidthRef.current = leftWidth;
          // Initialize live width for dynamic rendering
          setLiveLeftWidth(leftWidth);
          // Store initial Y position for long-press validation
          longPressStartYRef.current = gestureState.y0;
          // Haptic feedback on drag start
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          // Start long-press detection timer (500ms)
          longPressTimerRef.current = setTimeout(() => {
            setIsLongPressing(true);
            // Fade in target buttons
            Animated.parallel([
              Animated.timing(leftTargetOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(rightTargetOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, 500);
        },

        onPanResponderMove: (_, gestureState) => {
          if (containerWidth === 0) return;

          // Check if horizontal movement is significant (>30px threshold)
          // Higher threshold = less sensitive, easier to hold without canceling long-press
          const dragThreshold = 30;
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

            // Clamp to valid range
            const minWidth = BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH;
            const maxWidth = containerWidth - minWidth;
            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));

            // Update animated position for smooth visual feedback
            dividerPosition.setValue(clampedWidth);
            // Update live width for immediate UI response
            setLiveLeftWidth(clampedWidth);
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

            // Calculate current divider position (use live width if dragging, otherwise use leftWidth)
            const currentDividerX = liveLeftWidth !== null ? liveLeftWidth : leftWidth;

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

        onPanResponderRelease: (_, gestureState) => {
          // Clear long-press timer if still running
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          setIsDragging(false);

          if (containerWidth === 0) return;

          // Check if horizontal movement is significant (must match threshold above)
          const dragThreshold = 30;
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

            // Fade out target buttons
            Animated.parallel([
              Animated.timing(leftTargetOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(rightTargetOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();

            setIsLongPressing(false);
            setHoveredTarget(null);
          } else if (wasDraggedHorizontally) {
            // Normal drag release - calculate new ratio
            // Calculate final width from drag
            const newLeftWidth = dragStartWidthRef.current + gestureState.dx;

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
          }

          // Clear live width, rendering will use persisted ratio
          setLiveLeftWidth(null);
        },

        onPanResponderTerminate: () => {
          // Clear long-press timer if still running
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
          }

          setIsDragging(false);
          setIsLongPressing(false);
          setHoveredTarget(null);

          // Fade out target buttons if visible
          Animated.parallel([
            Animated.timing(leftTargetOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(rightTargetOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();

          // Reset to current ratio if cancelled
          const { leftWidth: resetWidth } = calculatePanelWidths(containerWidth, splitRatio);
          dividerPosition.setValue(resetWidth);
          setLiveLeftWidth(null);
        },
      }),
    [
      containerWidth,
      splitRatio,
      onSplitRatioChange,
      dividerPosition,
      leftWidth,
      isLongPressing,
      hoveredTarget,
      onViewModeChange,
      leftTargetOpacity,
      rightTargetOpacity,
      liveLeftWidth,
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

  // Update edge tab slide animations when view mode changes
  useEffect(() => {
    if (viewMode === 'left-full') {
      // Bible fullscreen - show right edge tab, hide left
      Animated.parallel([
        Animated.timing(rightEdgeTabSlideAnim, {
          toValue: 0, // Slide in to visible position
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(leftEdgeTabSlideAnim, {
          toValue: -50, // Keep off-screen
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (viewMode === 'right-full') {
      // Commentary fullscreen - show left edge tab, hide right
      Animated.parallel([
        Animated.timing(leftEdgeTabSlideAnim, {
          toValue: 0, // Slide in to visible position
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rightEdgeTabSlideAnim, {
          toValue: 50, // Keep off-screen
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Split mode - hide both tabs
      Animated.parallel([
        Animated.timing(leftEdgeTabSlideAnim, {
          toValue: -50, // Slide out left
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rightEdgeTabSlideAnim, {
          toValue: 50, // Slide out right
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [viewMode, leftEdgeTabSlideAnim, rightEdgeTabSlideAnim]);

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      {containerWidth > 0 && (
        <>
          {/* Left Panel - Hidden when right fullscreen */}
          {shouldShowLeftPanel && (
            <View
              style={[
                styles.panel,
                isFullscreen && { flex: 1, width: '100%' },
                !isFullscreen && { width: liveLeftWidth != null ? liveLeftWidth : leftWidth },
              ]}
              testID={`${testID}-left-panel`}
            >
              {leftContent}
            </View>
          )}

          {/* Left Edge Tab - Shows when viewing right panel fullscreen (commentary) */}
          <Animated.View
            style={[
              styles.edgeTab,
              styles.leftEdgeTab,
              {
                transform: [{ translateX: leftEdgeTabSlideAnim }],
              },
            ]}
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
          </Animated.View>

          {/* Resizable Divider - Hidden when fullscreen */}
          {viewMode === 'split' && (
            <View
              style={[styles.dividerContainer, isDragging && styles.dividerContainerActive]}
              {...panResponder.panHandlers}
              testID={`${testID}-divider`}
            >
              <View style={styles.dividerLine} />

              {/* Long-Press Target Buttons - Fade in during long-press */}
              <Animated.View
                style={[
                  styles.targetButton,
                  styles.targetButtonLeft,
                  {
                    opacity: leftTargetOpacity,
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
              </Animated.View>

              <Animated.View
                style={[
                  styles.targetButton,
                  styles.targetButtonRight,
                  {
                    opacity: rightTargetOpacity,
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
              </Animated.View>

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
            <View
              style={[
                styles.panel,
                isFullscreen && { flex: 1, width: '100%' },
                !isFullscreen && {
                  width:
                    liveLeftWidth != null
                      ? Math.max(
                          BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH,
                          containerWidth - liveLeftWidth
                        )
                      : rightWidth,
                },
              ]}
              testID={`${testID}-right-panel`}
            >
              {rightContent}
            </View>
          )}

          {/* Right Edge Tab - Shows when viewing left panel fullscreen (Bible) */}
          <Animated.View
            style={[
              styles.edgeTab,
              styles.rightEdgeTab,
              {
                transform: [{ translateX: rightEdgeTabSlideAnim }],
              },
            ]}
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
          </Animated.View>
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
