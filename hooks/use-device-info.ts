/**
 * useDeviceInfo Hook
 *
 * React hook for detecting device type, orientation, and determining
 * when to use split view layout. Automatically updates on orientation changes.
 *
 * @see Spec: agent-os/specs/landscape-tablet-optimization/plan.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import {
  DEFAULT_SPLIT_RATIO,
  type DeviceInfo,
  getDeviceInfo,
  SPLIT_RATIO_STORAGE_KEY,
  shouldUseSplitView,
} from '@/utils/device-detection';

/**
 * Extended device info with split view state
 */
export interface UseDeviceInfoResult extends DeviceInfo {
  /** Whether split view layout should be used */
  useSplitView: boolean;
  /** Current split ratio (0-1, left panel proportion) */
  splitRatio: number;
  /** Update split ratio (persists to AsyncStorage) */
  setSplitRatio: (ratio: number) => void;
  /** Whether split ratio has been loaded from storage */
  isLoaded: boolean;
}

/**
 * Hook for device detection and split view state management
 *
 * Provides:
 * - Device type detection (tablet vs phone)
 * - Orientation detection (landscape vs portrait)
 * - Split view determination based on screen size
 * - Persisted split ratio preference
 *
 * Automatically updates when device orientation changes.
 *
 * @returns UseDeviceInfoResult with device info and split view state
 *
 * @example
 * ```tsx
 * function TopicDetailScreen() {
 *   const { useSplitView, splitRatio, setSplitRatio } = useDeviceInfo();
 *
 *   if (useSplitView) {
 *     return (
 *       <TopicSplitView
 *         splitRatio={splitRatio}
 *         onSplitRatioChange={setSplitRatio}
 *       />
 *     );
 *   }
 *
 *   return <TopicPagerView />;
 * }
 * ```
 */
export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo());
  const [useSplitView, setUseSplitView] = useState(shouldUseSplitView());
  const [splitRatio, setSplitRatioState] = useState(DEFAULT_SPLIT_RATIO);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted split ratio on mount
  useEffect(() => {
    async function loadSplitRatio() {
      try {
        const stored = await AsyncStorage.getItem(SPLIT_RATIO_STORAGE_KEY);
        if (stored !== null) {
          const ratio = Number.parseFloat(stored);
          if (!Number.isNaN(ratio) && ratio >= 0.3 && ratio <= 0.7) {
            setSplitRatioState(ratio);
          }
        }
      } catch (error) {
        // Silently fail - use default ratio
        console.warn('Failed to load split ratio:', error);
      } finally {
        setIsLoaded(true);
      }
    }

    loadSplitRatio();
  }, []);

  // Listen for dimension changes (orientation changes)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setDeviceInfo(getDeviceInfo());
      setUseSplitView(shouldUseSplitView());
    });

    return () => subscription?.remove();
  }, []);

  // Update split ratio and persist to storage
  const setSplitRatio = useCallback((ratio: number) => {
    // Clamp ratio between 0.3 and 0.7
    const clampedRatio = Math.max(0.3, Math.min(0.7, ratio));
    setSplitRatioState(clampedRatio);

    // Persist to AsyncStorage (fire and forget)
    AsyncStorage.setItem(SPLIT_RATIO_STORAGE_KEY, clampedRatio.toString()).catch((error) => {
      console.warn('Failed to save split ratio:', error);
    });
  }, []);

  return {
    ...deviceInfo,
    useSplitView,
    splitRatio,
    setSplitRatio,
    isLoaded,
  };
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
