/**
 * SplitView Web Component
 *
 * CSS-based split view for web that matches the native Reanimated-based
 * component's API. Uses React state + CSS transitions instead of Reanimated
 * shared values, which don't work on react-native-web.
 *
 * @see SplitView.tsx (native version)
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { getSplitViewSpecs } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { BREAKPOINTS, calculatePanelWidths } from '@/utils/device-detection';

export type SplitViewMode = 'split' | 'left-full' | 'right-full';

export interface SplitViewProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  splitRatio: number;
  onSplitRatioChange: (ratio: number) => void;
  viewMode?: SplitViewMode;
  onViewModeChange?: (mode: SplitViewMode) => void;
  edgeTabsVisible?: boolean;
  testID?: string;
}

const EDGE_SNAP_THRESHOLD = 120;
const TRANSITION_MS = '300ms';

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

  const [containerWidth, setContainerWidth] = useState(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef<View>(null);
  const dragStartXRef = useRef(0);
  const dragStartLeftWidthRef = useRef(0);
  const [dragLeftWidth, setDragLeftWidth] = useState<number | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
      setIsLayoutReady(true);
    }
  }, []);

  // Compute panel widths
  const { leftWidth: computedLeftWidth } = useMemo(
    () => calculatePanelWidths(containerWidth, splitRatio),
    [containerWidth, splitRatio]
  );

  // During drag, override computed widths
  const leftWidth = dragLeftWidth !== null ? dragLeftWidth : computedLeftWidth;
  const rightWidth = containerWidth - leftWidth;

  // Clamp helper
  const clampLeftWidth = useCallback(
    (w: number) => {
      const minLeft = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
      const minRight = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
      const maxPanel = BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH;
      let clamped = Math.max(minLeft, Math.min(w, containerWidth - minRight));
      clamped = Math.min(clamped, maxPanel);
      return clamped;
    },
    [containerWidth]
  );

  // Attach mousedown to divider via ref (onMouseDown not in RN ViewProps)
  const leftWidthRef = useRef(leftWidth);
  leftWidthRef.current = leftWidth;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = dividerRef.current as any;
    if (!el) return;
    // react-native-web View refs are DOM elements
    const node: HTMLElement | null = el instanceof HTMLElement ? el : null;
    if (!node) return;

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true);
      dragStartXRef.current = e.clientX;
      dragStartLeftWidthRef.current = leftWidthRef.current;
    };
    node.addEventListener('mousedown', handleMouseDown);
    return () => node.removeEventListener('mousedown', handleMouseDown);
  }, [isLayoutReady]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      const newLeft = clampLeftWidth(dragStartLeftWidthRef.current + delta);
      setDragLeftWidth(newLeft);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      const delta = e.clientX - dragStartXRef.current;
      const rawLeft = dragStartLeftWidthRef.current + delta;

      // Edge-snap detection
      if (rawLeft < EDGE_SNAP_THRESHOLD) {
        setDragLeftWidth(null);
        onViewModeChange?.('right-full');
      } else if (containerWidth - rawLeft < EDGE_SNAP_THRESHOLD) {
        setDragLeftWidth(null);
        onViewModeChange?.('left-full');
      } else {
        const clamped = clampLeftWidth(rawLeft);
        const newRatio = clamped / containerWidth;
        setDragLeftWidth(null);
        onSplitRatioChange(newRatio);
      }
    };

    // Set cursor and prevent text selection during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, clampLeftWidth, containerWidth, onSplitRatioChange, onViewModeChange]);

  // Handle click resets to default ratio
  const handleDividerClick = useCallback(() => {
    onSplitRatioChange(specs.defaultSplitRatio);
  }, [onSplitRatioChange, specs.defaultSplitRatio]);

  // Width styles per view mode
  const isLeftFull = viewMode === 'left-full';
  const isRightFull = viewMode === 'right-full';
  const isSplit = viewMode === 'split';

  const leftPanelWidth = isLeftFull ? containerWidth : isRightFull ? 0 : leftWidth;
  const rightPanelWidth = isRightFull ? containerWidth : isLeftFull ? 0 : rightWidth;

  // Web-only CSS transition props — not in RN's ViewStyle types
  const transitionStyle = (
    isDragging
      ? { transitionProperty: 'width', transitionDuration: '0ms' }
      : { transitionProperty: 'width', transitionDuration: TRANSITION_MS }
  ) as any;

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      {isLayoutReady && (
        <>
          {/* Left Panel */}
          <View
            style={[styles.panel, { width: leftPanelWidth, ...transitionStyle }]}
            testID={`${testID}-left-panel`}
          >
            {leftContent}
          </View>

          {/* Divider */}
          <View
            ref={dividerRef}
            style={[
              styles.dividerContainer,
              isDragging && styles.dividerContainerActive,
              {
                opacity: isSplit ? 1 : 0,
                pointerEvents: isSplit ? 'auto' : 'none',
                transitionProperty: 'opacity',
                transitionDuration: TRANSITION_MS,
                cursor: 'col-resize',
              } as any,
            ]}
            testID={`${testID}-divider`}
          >
            <View style={[styles.dividerLine, { backgroundColor: specs.dividerColor }]} />
            <Pressable
              style={[
                styles.dividerHandle,
                {
                  backgroundColor: colors.backgroundElevated,
                  borderColor: specs.dividerColor,
                },
                isDragging && {
                  backgroundColor: specs.dividerHandleActiveColor,
                  transform: [{ scale: 1.1 }],
                },
              ]}
              onPress={handleDividerClick}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={isDragging ? colors.textPrimary : colors.textTertiary}
              />
            </Pressable>
          </View>

          {/* Right Panel */}
          <View
            style={[styles.panel, { width: rightPanelWidth, ...transitionStyle }]}
            testID={`${testID}-right-panel`}
          >
            {rightContent}
          </View>

          {/* Left Edge Tab (visible when right-full) */}
          <View
            style={[
              styles.edgeTab,
              styles.leftEdgeTab,
              {
                opacity: isRightFull && edgeTabsVisible ? 1 : 0,
                pointerEvents: isRightFull ? 'box-none' : 'none',
                transitionProperty: 'opacity',
                transitionDuration: TRANSITION_MS,
              } as any,
            ]}
            testID={`${testID}-left-edge-tab`}
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
          </View>

          {/* Right Edge Tab (visible when left-full) */}
          <View
            style={[
              styles.edgeTab,
              styles.rightEdgeTab,
              {
                opacity: isLeftFull && edgeTabsVisible ? 1 : 0,
                pointerEvents: isLeftFull ? 'box-none' : 'none',
                transitionProperty: 'opacity',
                transitionDuration: TRANSITION_MS,
              } as any,
            ]}
            testID={`${testID}-right-edge-tab`}
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
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    flexGrow: 0,
    flexShrink: 0,
    height: '100%',
    overflow: 'hidden',
  },
  dividerContainer: {
    width: 20,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    marginLeft: -10,
    marginRight: -10,
  },
  dividerContainerActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  dividerLine: {
    position: 'absolute',
    width: 1,
    height: '100%',
  },
  dividerHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  edgeTab: {
    position: 'absolute',
    width: 50,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  leftEdgeTab: {
    left: 0,
    alignItems: 'flex-start',
  },
  rightEdgeTab: {
    right: 0,
    alignItems: 'flex-end',
  },
  edgeTabButton: {
    width: 32,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  leftEdgeTabButton: {
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingRight: 6,
  },
  rightEdgeTabButton: {
    borderTopLeftRadius: 32,
    borderBottomLeftRadius: 32,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingLeft: 6,
  },
});

export default SplitView;
