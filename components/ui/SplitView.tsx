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
 * - PERFORMANCE OPTIMIZED: Uses deferred resizing (ghost divider) for both drag AND animations
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 * @see Figma: https://www.figma.com/design/GOiiI0yRby5mWqCji8e4pp/VerseMate?node-id=3367-16156
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

  /** Whether edge tabs should be visible (fades in/out based on user interaction) */
  edgeTabsVisible?: boolean;

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
  edgeTabsVisible = true,
  testID = 'split-view',
}: SplitViewProps) {
  const { mode, colors } = useTheme();
  const specs = useMemo(() => getSplitViewSpecs(mode), [mode]);
  const insets = useSafeAreaInsets();
  const styles = createStyles(specs, colors, insets);

  // Container dimensions
  const containerWidth = useSharedValue(0);
  const containerX = useSharedValue(0);

  // Track if layout is ready
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [hoveredTarget, setHoveredTarget] = useState<'left' | 'right' | null>(null);

  // --- Shared Values for Logic ---

  // 1. Committed Split Position: The "resting" width of the left panel in split mode.
  // This DOES NOT animate during drag or transitions. It only changes on drag end or prop change.
  const committedSplitPosition = useSharedValue(0);

  // 2. Layout Mode: 0 = Split, 1 = Left Full, 2 = Right Full
  // Used to switch the actual DOM layout width instantly.
  // Initialize with correct mode to prevent flash/animation on mount
  const initialLayoutMode = viewMode === 'left-full' ? 1 : viewMode === 'right-full' ? 2 : 0;
  const layoutMode = useSharedValue(initialLayoutMode);

  // 3. Visual Offsets: The "Ghost" layer.
  // These animate smoothly to create the slide effect without resizing layout.
  const dividerTranslation = useSharedValue(0);
  const leftPanelTranslation = useSharedValue(0);
  const rightPanelTranslation = useSharedValue(0);

  // Target Button Opacities
  const leftTargetOpacity = useSharedValue(0);
  const rightTargetOpacity = useSharedValue(0);

  // Edge Tab Slide Animations
  const leftEdgeTabSlideAnim = useSharedValue(-50);
  const rightEdgeTabSlideAnim = useSharedValue(50);

  // Edge Tab Opacity (for fade in/out based on user interaction)
  const edgeTabsOpacity = useSharedValue(edgeTabsVisible ? 1 : 0);

  // --- Layout Handling ---

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, x } = event.nativeEvent.layout;
      containerWidth.value = width;
      containerX.value = x;

      // Initialize split position if needed
      if (!isLayoutReady || Math.abs(containerWidth.value - width) > 1) {
        const { leftWidth } = calculatePanelWidths(width, splitRatio);
        committedSplitPosition.value = leftWidth;
      }

      if (!isLayoutReady && width > 0) {
        setIsLayoutReady(true);
      }
    },
    [splitRatio, committedSplitPosition, containerWidth, containerX, isLayoutReady]
  );

  // --- Sync Props to Internal State ---

  // Sync splitRatio prop -> committedSplitPosition
  useEffect(() => {
    if (isLayoutReady && containerWidth.value > 0) {
      const { leftWidth } = calculatePanelWidths(containerWidth.value, splitRatio);
      // Only animate if significantly different (avoids loops)
      if (Math.abs(committedSplitPosition.value - leftWidth) > 1) {
        committedSplitPosition.value = withTiming(leftWidth, { duration: 300 });
      }
    }
  }, [splitRatio, isLayoutReady, containerWidth, committedSplitPosition]);

  // Track previous view mode to detect changes and prevent initial animation
  const prevViewMode = useRef(viewMode);

  // Handle View Mode Transitions (The "Ghost Slide" Animation)
  useEffect(() => {
    if (!isLayoutReady || containerWidth.value === 0) return;

    // Skip animation if viewMode hasn't changed (Initial Render / Re-renders due to other deps)
    if (viewMode === prevViewMode.current && isLayoutReady) {
      // Just ensure layoutMode matches (in case of HMR or weird state drift)
      // But don't trigger the animation sequence.
      const targetMode = viewMode === 'left-full' ? 1 : viewMode === 'right-full' ? 2 : 0;
      if (layoutMode.value !== targetMode) {
        layoutMode.value = targetMode;
      }
      return;
    }

    // Update ref for next run
    prevViewMode.current = viewMode;

    const splitWidth = committedSplitPosition.value;
    const rightWidth = containerWidth.value - splitWidth;

    if (viewMode === 'left-full') {
      // Transition: Split -> Left Full
      // 1. Keep Layout as Split (layoutMode = 0) initially?
      //    No, to look right, we need to slide the right panel away.
      //    So layout stays Split.
      layoutMode.value = 0;

      // 2. Animate elements offscreen
      // Divider goes to right edge (travel distance = rightWidth)
      dividerTranslation.value = withTiming(rightWidth, { duration: 300 });
      // Right Panel slides right (travel distance = rightWidth)
      rightPanelTranslation.value = withTiming(rightWidth, { duration: 300 });

      // 3. AFTER animation, snap layout to Full
      // We use a timeout to simulate "onFinish" since runOnJS in withTiming callback can be tricky
      setTimeout(() => {
        layoutMode.value = 1; // Snap to Left Full layout
        dividerTranslation.value = 0; // Reset offsets
        rightPanelTranslation.value = 0;
      }, 300);
    } else if (viewMode === 'right-full') {
      // Transition: Split -> Right Full
      layoutMode.value = 0; // Keep Split layout

      // Animate elements offscreen
      // Divider goes to left edge (travel distance = -splitWidth)
      dividerTranslation.value = withTiming(-splitWidth, { duration: 300 });
      // Left Panel slides left
      leftPanelTranslation.value = withTiming(-splitWidth, { duration: 300 });

      // Snap to Full
      setTimeout(() => {
        layoutMode.value = 2; // Snap to Right Full layout
        dividerTranslation.value = 0;
        leftPanelTranslation.value = 0;
      }, 300);
    } else {
      // Transition: Full -> Split
      // 1. Snap Layout to Split IMMEDIATELY
      layoutMode.value = 0;

      // 2. Set Initial Offsets to mimic the Full state (so it looks like we haven't moved yet)
      if (leftPanelTranslation.value === 0 && rightPanelTranslation.value === 0) {
        // Fix: Just animate everything to 0.
        dividerTranslation.value = withTiming(0, { duration: 300 });
        leftPanelTranslation.value = withTiming(0, { duration: 300 });
        rightPanelTranslation.value = withTiming(0, { duration: 300 });
      }
    }
  }, [
    viewMode,
    isLayoutReady,
    containerWidth,
    committedSplitPosition,
    layoutMode,
    dividerTranslation,
    leftPanelTranslation,
    rightPanelTranslation,
  ]);

  // --- Shared Values for Drag Logic ---
  const isDraggingShared = useSharedValue(false);
  const isLongPressingShared = useSharedValue(false);
  const isSnappedShared = useSharedValue<string | null>(null);
  const hoveredTargetShared = useSharedValue<'left' | 'right' | null>(null);
  const dragStartX = useSharedValue(0);
  const gestureStartTime = useSharedValue(0);
  const hasMovedHorizontally = useSharedValue(false);

  // Constraints
  const minLeftWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH);
  const minRightWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH);
  const maxPanelWidth = useSharedValue(BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH);
  const snapThreshold = useSharedValue(120);

  // Sync constraints
  useEffect(() => {
    minLeftWidth.value = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
    minRightWidth.value = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
    maxPanelWidth.value = BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH;
  }, [minLeftWidth, minRightWidth, maxPanelWidth]);

  // --- Callbacks ---
  const triggerLightHaptic = useCallback(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    []
  );
  const triggerMediumHaptic = useCallback(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    []
  );
  const triggerHeavyHaptic = useCallback(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    []
  );
  const triggerSuccessHaptic = useCallback(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    []
  );

  const updateDragState = useCallback((dragging: boolean) => setIsDragging(dragging), []);
  const updateLongPressState = useCallback(
    (longPressing: boolean, target: 'left' | 'right' | null) => {
      setIsLongPressing(longPressing);
      setHoveredTarget(target);
    },
    []
  );

  // --- Gestures ---

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(500)
        .onStart(() => {
          'worklet';
          if (!hasMovedHorizontally.value && !isLongPressingShared.value) {
            isLongPressingShared.value = true;
            leftTargetOpacity.value = withTiming(1, { duration: 300 });
            rightTargetOpacity.value = withTiming(1, { duration: 300 });
            runOnJS(triggerSuccessHaptic)();
            runOnJS(updateLongPressState)(true, null);
          }
        }),
    [
      hasMovedHorizontally,
      isLongPressingShared,
      leftTargetOpacity,
      rightTargetOpacity,
      triggerSuccessHaptic,
      updateLongPressState,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          isDraggingShared.value = true;
          isSnappedShared.value = null;
          dragStartX.value = committedSplitPosition.value;
          dividerTranslation.value = 0; // Reset any previous animation offset
          gestureStartTime.value = Date.now();
          hasMovedHorizontally.value = false;
          runOnJS(triggerLightHaptic)();
          runOnJS(updateDragState)(true);
        })
        .onChange((event) => {
          'worklet';
          if (containerWidth.value === 0) return;

          const isDraggingHorizontally = Math.abs(event.translationX) > 10;
          if (isDraggingHorizontally && !hasMovedHorizontally.value) {
            hasMovedHorizontally.value = true;
          }

          if (isDraggingHorizontally && !isLongPressingShared.value) {
            // Normal Drag Logic with Magnetic Snap
            const targetLeftWidth = dragStartX.value + event.translationX;
            const totalWidth = containerWidth.value;

            // Constants
            const EDGE_SNAP_THRESHOLD = snapThreshold.value;
            const LIMIT_SNAP_RADIUS_INNER = 60; // "Bigger inside" (towards edge/invalid)
            const LIMIT_SNAP_RADIUS_OUTER = 20; // "Small outside" (towards center/valid)

            // Calculate valid boundaries (The "Limits")
            const leftLimit = minLeftWidth.value;
            const rightLimit = Math.min(totalWidth - minRightWidth.value, maxPanelWidth.value);

            // Determine Target & State
            let targetVisualOffset = 0;
            let currentSnap: string | null = null;

            // 1. Edge Snaps (Highest Priority)
            if (targetLeftWidth < EDGE_SNAP_THRESHOLD) {
              // Snap to Fullscreen Left
              currentSnap = 'edge-left';
              targetVisualOffset = 0 - dragStartX.value;
            } else if (targetLeftWidth > totalWidth - EDGE_SNAP_THRESHOLD) {
              // Snap to Fullscreen Right
              currentSnap = 'edge-right';
              targetVisualOffset = totalWidth - dragStartX.value;
            }
            // 2. Limit Snaps (Checkpoints)
            else if (
              targetLeftWidth >= leftLimit - LIMIT_SNAP_RADIUS_INNER &&
              targetLeftWidth <= leftLimit + LIMIT_SNAP_RADIUS_OUTER
            ) {
              // Snap to Minimum Left Width
              currentSnap = 'limit-left';
              targetVisualOffset = leftLimit - dragStartX.value;
            } else if (
              targetLeftWidth >= rightLimit - LIMIT_SNAP_RADIUS_OUTER &&
              targetLeftWidth <= rightLimit + LIMIT_SNAP_RADIUS_INNER
            ) {
              // Snap to Maximum Left Width (Right Panel Min)
              currentSnap = 'limit-right';
              targetVisualOffset = rightLimit - dragStartX.value;
            }
            // 3. No Snap (Tracking)
            else {
              currentSnap = null;
              // Clamp to screen edges for visual tracking (don't go offscreen)
              const clampedWidth = Math.max(0, Math.min(totalWidth, targetLeftWidth));
              targetVisualOffset = clampedWidth - dragStartX.value;
            }

            // Trigger haptic on snap state change (Entering any snap zone)
            if (currentSnap !== isSnappedShared.value) {
              isSnappedShared.value = currentSnap;
              if (currentSnap !== null) {
                runOnJS(triggerLightHaptic)();
              }
            }

            // Always animate to target
            dividerTranslation.value = withSpring(targetVisualOffset, {
              damping: 15,
              stiffness: 200,
              mass: 0.5,
            });
          } else if (isLongPressingShared.value) {
            // Long Press Hover Logic
            const containerRelativeX = event.absoluteX - containerX.value;
            // Visual position includes translation
            const currentVisualX = committedSplitPosition.value + dividerTranslation.value;
            const dividerCenterX = currentVisualX + 10;

            const distLeft = Math.abs(containerRelativeX - (dividerCenterX - 60));
            const distRight = Math.abs(containerRelativeX - (dividerCenterX + 60));

            let newTarget: 'left' | 'right' | null = null;
            if (distLeft < 40 && distLeft < distRight) newTarget = 'left';
            else if (distRight < 50) newTarget = 'right';

            if (hoveredTargetShared.value !== newTarget) {
              hoveredTargetShared.value = newTarget;
              runOnJS(updateLongPressState)(true, newTarget);
              if (newTarget !== null) runOnJS(triggerLightHaptic)();
            }
          }
        })
        .onEnd((event) => {
          'worklet';
          isDraggingShared.value = false;
          runOnJS(updateDragState)(false);

          if (isLongPressingShared.value) {
            // Handle Long Press Action
            const target = hoveredTargetShared.value;
            if (target && onViewModeChange) {
              if (target === 'left') runOnJS(onViewModeChange)('right-full');
              else runOnJS(onViewModeChange)('left-full');
              runOnJS(triggerHeavyHaptic)();
            }
            // Reset UI
            leftTargetOpacity.value = withTiming(0, { duration: 200 });
            rightTargetOpacity.value = withTiming(0, { duration: 200 });
            isLongPressingShared.value = false;
            hoveredTargetShared.value = null;
            runOnJS(updateLongPressState)(false, null);
            dividerTranslation.value = withTiming(0);
          } else if (Math.abs(event.translationX) > 10) {
            // Handle Drag End - Check for Snap or Commit
            const totalWidth = containerWidth.value;
            const currentSnap = isSnappedShared.value;

            // 1. Edge Snaps (Trigger Fullscreen)
            if (currentSnap === 'edge-left' && onViewModeChange) {
              runOnJS(onViewModeChange)('right-full');
              runOnJS(triggerSuccessHaptic)();
            } else if (currentSnap === 'edge-right' && onViewModeChange) {
              runOnJS(onViewModeChange)('left-full');
              runOnJS(triggerSuccessHaptic)();
            }
            // 2. Limit Snaps (Commit exact limit)
            else if (currentSnap === 'limit-left' || currentSnap === 'limit-right') {
              let targetWidth = 0;
              if (currentSnap === 'limit-left') {
                targetWidth = minLeftWidth.value;
              } else {
                targetWidth = Math.min(totalWidth - minRightWidth.value, maxPanelWidth.value);
              }

              committedSplitPosition.value = targetWidth;
              dividerTranslation.value = 0;
              const newRatio = targetWidth / containerWidth.value;
              runOnJS(triggerMediumHaptic)();
              runOnJS(onSplitRatioChange)(newRatio);
            }
            // 3. Normal Commit (Clamp to valid constraints)
            else {
              const rawFinalWidth = dragStartX.value + event.translationX;
              const effectiveMinLeft = minLeftWidth.value;
              const effectiveMaxLeft = Math.min(
                totalWidth - minRightWidth.value,
                maxPanelWidth.value
              );

              // Bounce back to valid range if dropped in "forbidden zone"
              const finalWidth = Math.max(
                effectiveMinLeft,
                Math.min(effectiveMaxLeft, rawFinalWidth)
              );

              // Commit new position
              committedSplitPosition.value = finalWidth;

              // Reset visual offset
              dividerTranslation.value = 0;

              const newRatio = finalWidth / containerWidth.value;
              runOnJS(triggerMediumHaptic)();
              runOnJS(onSplitRatioChange)(newRatio);
            }
          } else {
            // Cancel Drag (Too small movement)
            dividerTranslation.value = withTiming(0);
          }

          isSnappedShared.value = null;
        }),
    [
      onSplitRatioChange,
      onViewModeChange,
      containerWidth,
      containerX,
      committedSplitPosition,
      dividerTranslation,
      minLeftWidth,
      minRightWidth,
      maxPanelWidth,
      isDraggingShared,
      isLongPressingShared,
      hoveredTargetShared,
      dragStartX,
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
      isSnappedShared,
      snapThreshold,
    ]
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, longPressGesture),
    [panGesture, longPressGesture]
  );

  // --- Styles ---

  const leftPanelStyle = useAnimatedStyle(() => {
    // LAYOUT LOGIC: Width snaps instantly based on mode
    let width: number;
    if (layoutMode.value === 1)
      width = containerWidth.value; // Left Full
    else if (layoutMode.value === 2)
      width = 0; // Right Full (Hidden)
    else width = committedSplitPosition.value; // Split

    return {
      width,
      transform: [{ translateX: leftPanelTranslation.value }],
    };
  });

  const rightPanelStyle = useAnimatedStyle(() => {
    // LAYOUT LOGIC: Width snaps instantly based on mode
    let width: number;
    if (layoutMode.value === 1)
      width = 0; // Left Full (Hidden)
    else if (layoutMode.value === 2)
      width = containerWidth.value; // Right Full
    else width = containerWidth.value - committedSplitPosition.value; // Split

    return {
      width,
      transform: [{ translateX: rightPanelTranslation.value }],
    };
  });

  const dividerWrapperStyle = useAnimatedStyle(() => {
    const isSplit = layoutMode.value === 0;
    // Fade out divider when not in split mode
    // Note: We use layoutMode to determine "resting state" visibility
    return {
      opacity: withTiming(isSplit ? 1 : 0, { duration: 300 }),
      transform: [{ translateX: dividerTranslation.value }],
      // Pointer events managed by parent container
    };
  });

  const leftTargetButtonStyle = useAnimatedStyle(() => ({ opacity: leftTargetOpacity.value }));
  const rightTargetButtonStyle = useAnimatedStyle(() => ({ opacity: rightTargetOpacity.value }));
  const leftEdgeTabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftEdgeTabSlideAnim.value }],
    opacity: edgeTabsOpacity.value,
  }));
  const rightEdgeTabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightEdgeTabSlideAnim.value }],
    opacity: edgeTabsOpacity.value,
  }));

  // Edge Tab Animations
  useEffect(() => {
    if (viewMode === 'left-full') {
      rightEdgeTabSlideAnim.value = withTiming(0, { duration: 300 });
      leftEdgeTabSlideAnim.value = withTiming(-50, { duration: 300 });
    } else if (viewMode === 'right-full') {
      leftEdgeTabSlideAnim.value = withTiming(0, { duration: 300 });
      rightEdgeTabSlideAnim.value = withTiming(50, { duration: 300 });
    } else {
      leftEdgeTabSlideAnim.value = withTiming(-50, { duration: 200 });
      rightEdgeTabSlideAnim.value = withTiming(50, { duration: 200 });
      leftTargetOpacity.value = withTiming(0, { duration: 200 });
      rightTargetOpacity.value = withTiming(0, { duration: 200 });
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

  // Edge Tab Opacity Animation (fade in/out based on user interaction)
  useEffect(() => {
    edgeTabsOpacity.value = withTiming(edgeTabsVisible ? 1 : 0, {
      duration: 300,
    });
  }, [edgeTabsVisible, edgeTabsOpacity]);

  const handleDividerDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSplitRatioChange(specs.defaultSplitRatio);
  }, [onSplitRatioChange, specs.defaultSplitRatio]);

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      {isLayoutReady && (
        <>
          <Reanimated.View style={[styles.panel, leftPanelStyle]} testID={`${testID}-left-panel`}>
            {leftContent}
          </Reanimated.View>

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
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          </Reanimated.View>

          <GestureDetector gesture={composedGesture}>
            <Reanimated.View
              style={[
                styles.dividerContainer,
                isDragging && styles.dividerContainerActive,
                dividerWrapperStyle,
              ]}
              testID={`${testID}-divider`}
              pointerEvents={viewMode === 'split' ? 'auto' : 'none'}
            >
              <View style={styles.dividerLine} />

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
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={16}
                  color={isDragging ? colors.textPrimary : colors.textTertiary}
                />
              </Pressable>
            </Reanimated.View>
          </GestureDetector>

          <Reanimated.View style={[styles.panel, rightPanelStyle]} testID={`${testID}-right-panel`}>
            {rightContent}
          </Reanimated.View>

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
      transform: [{ translateY: -80 }],
    },
    dividerHandleActive: {
      backgroundColor: specs.dividerHandleActiveColor,
      transform: [{ scale: 1.1 }, { translateY: -80 }],
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
      marginTop: -102, // -22 (center) - 80 (offset)
    },
    targetButtonRight: {
      right: -60,
      top: '50%',
      marginTop: -102, // -22 (center) - 80 (offset)
    },
    edgeTab: {
      position: 'absolute',
      width: 50,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
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
      transform: [{ translateY: -80 }],
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
