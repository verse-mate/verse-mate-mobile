/**
 * Device Detection Utilities
 *
 * Utilities for detecting device type, orientation, and determining
 * when to use split view layout for landscape/tablet optimization.
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import * as Device from 'expo-device';
import { Dimensions, Platform } from 'react-native';

/**
 * Device information structure
 */
export interface DeviceInfo {
  /** Whether the device is a tablet (iPad, Android tablet) */
  isTablet: boolean;
  /** Whether the device is in landscape orientation */
  isLandscape: boolean;
  /** Current screen width in points/dp */
  screenWidth: number;
  /** Current screen height in points/dp */
  screenHeight: number;
  /** Smaller dimension of the screen (for tablet detection) */
  smallerDimension: number;
  /** Larger dimension of the screen */
  largerDimension: number;
}

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  /** Minimum width for tablet detection (dp) */
  TABLET_MIN_WIDTH: 600,
  /** Minimum width for iPad detection (points) */
  IPAD_MIN_WIDTH: 768,
  /** Minimum width for enabling split view (dp) */
  SPLIT_VIEW_MIN_WIDTH: 1024,
  /** Comfortable width for split view (dp) */
  SPLIT_VIEW_COMFORTABLE_WIDTH: 1024,
  /** Maximum panel width in split view (dp) */
  SPLIT_VIEW_MAX_PANEL_WIDTH: 900,
  /** Minimum panel width in split view (dp) */
  SPLIT_VIEW_MIN_PANEL_WIDTH: 320,
  /** Minimum left panel (Bible) width in split view (dp) */
  SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH: 320,
  /** Minimum right panel (Commentary) width in split view (dp) - larger to prevent button squishing */
  SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH: 345,
} as const;

/**
 * Get current device information
 *
 * Detects whether the device is a tablet and current orientation
 * based on screen dimensions and expo-device type.
 *
 * @returns DeviceInfo object with device characteristics
 *
 * @example
 * ```tsx
 * const { isTablet, isLandscape } = getDeviceInfo();
 * if (isTablet && isLandscape) {
 *   // Render split view
 * }
 * ```
 */
export function getDeviceInfo(): DeviceInfo {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  const smallerDimension = Math.min(width, height);
  const largerDimension = Math.max(width, height);

  // Tablet detection logic:
  // We consider it a tablet if EITHER:
  // 1. expo-device explicitly says it's a tablet/desktop
  // 2. The screen dimensions match standard tablet thresholds (fallback/override)

  const isHardwareTablet =
    Device.deviceType === Device.DeviceType.TABLET ||
    Device.deviceType === Device.DeviceType.DESKTOP;

  // - iOS: smaller dimension >= 768 (iPad mini and up)
  // - Android: smaller dimension >= 600dp (common tablet threshold)
  const tabletThreshold =
    Platform.OS === 'ios' ? BREAKPOINTS.IPAD_MIN_WIDTH : BREAKPOINTS.TABLET_MIN_WIDTH;

  const isDimensionTablet = smallerDimension >= tabletThreshold;

  const isTablet = isHardwareTablet || isDimensionTablet;

  return {
    isTablet,
    isLandscape,
    screenWidth: width,
    screenHeight: height,
    smallerDimension,
    largerDimension,
  };
}

/**
 * Determine if split view layout should be used
 *
 * Split view is enabled when:
 * 1. Device is in landscape orientation
 * 2. Screen width meets minimum threshold (900dp)
 *
 * This typically applies to:
 * - Tablets in landscape mode
 * - Large phones in landscape mode (e.g., iPhone Pro Max, Galaxy Ultra)
 *
 * @returns true if split view should be rendered
 *
 * @example
 * ```tsx
 * if (shouldUseSplitView()) {
 *   return <SplitView leftContent={...} rightContent={...} />;
 * } else {
 *   return <PagerView />;
 * }
 * ```
 */
export function shouldUseSplitView(): boolean {
  const { isLandscape, screenWidth } = getDeviceInfo();

  // Only enable split view in landscape with sufficient width
  return isLandscape && screenWidth >= BREAKPOINTS.SPLIT_VIEW_MIN_WIDTH;
}

/**
 * Calculate optimal panel widths for split view
 *
 * Based on Figma design proportions:
 * - Left panel (content): 640px out of 1194px total (53.6%)
 * - Right panel (explanations): 554px out of 1194px total (46.4%)
 *
 * @param totalWidth - Available width for split view
 * @param splitRatio - Ratio of left panel width (0-1), defaults to 0.536
 * @returns Object with left and right panel widths
 */
export function calculatePanelWidths(
  totalWidth: number,
  splitRatio: number = 0.536
): { leftWidth: number; rightWidth: number } {
  // Clamp split ratio between 0.0 and 1.0 (allow full range, rely on pixel constraints)
  const clampedRatio = Math.max(0.0, Math.min(1.0, splitRatio));

  let leftWidth = Math.round(totalWidth * clampedRatio);
  let rightWidth = totalWidth - leftWidth;

  // Enforce minimum panel widths (separate minimums for each panel)
  if (leftWidth < BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH) {
    leftWidth = BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH;
    rightWidth = totalWidth - leftWidth;
  } else if (rightWidth < BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH) {
    rightWidth = BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH;
    leftWidth = totalWidth - rightWidth;
  }

  return { leftWidth, rightWidth };
}

/**
 * Get the default split ratio based on Figma design
 *
 * From the design:
 * - Left panel: 640px
 * - Right panel: 554px
 * - Total: 1194px
 * - Ratio: 640/1194 = 0.536
 */
export const DEFAULT_SPLIT_RATIO = 0.536;

/**
 * Storage key for persisting split ratio preference
 */
export const SPLIT_RATIO_STORAGE_KEY = 'versemate:split-ratio';
