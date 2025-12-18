/**
 * useDeviceInfo Hook
 *
 * React hook for detecting device type, orientation, and determining
 * when to use split view layout. Automatically updates on orientation changes.
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { type DeviceInfoContextType, useDeviceInfoContext } from '@/contexts/DeviceInfoContext';

/**
 * Split View Mode Type
 */
export type SplitViewMode = 'split' | 'left-full' | 'right-full';

/**
 * Storage key for persisting split view mode
 */
export const SPLIT_VIEW_MODE_STORAGE_KEY = 'versemate:split-view-mode';

/**
 * Extended device info with split view state
 */
export type UseDeviceInfoResult = DeviceInfoContextType;

/**
 * Hook for device detection and split view state management
 *
 * Wraps the DeviceInfoContext to provide global state.
 */
export function useDeviceInfo(): UseDeviceInfoResult {
  return useDeviceInfoContext();
}

/**
 * Hook for simple orientation detection
 *
 * Lighter weight alternative when only orientation is needed.
 *
 * @returns Current orientation state
 *
 * @example
 * ```tsx
 * const { isLandscape } = useOrientation();
 * ```
 */
export function useOrientation(): { isLandscape: boolean; isPortrait: boolean } {
  const [isLandscape, setIsLandscape] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return width > height;
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsLandscape(window.width > window.height);
    });

    return () => subscription?.remove();
  }, []);

  return {
    isLandscape,
    isPortrait: !isLandscape,
  };
}
