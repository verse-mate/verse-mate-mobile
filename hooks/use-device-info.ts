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
 * Split View Mode Type
 */
export type SplitViewMode = 'split' | 'left-full' | 'right-full';

/**
 * Storage key for persisting split view mode
 */
export const SPLIT_VIEW_MODE_STORAGE_KEY = 'versemate:split-view-mode';

/**
 * Module-level cache to prevent "flash of default content" on navigation
 * and ensure state persists across component remounts.
 */
let cachedSplitRatio: number | null = null;
let cachedSplitViewMode: SplitViewMode | null = null;
let isCacheLoaded = false;

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
  /** Current view mode */
  splitViewMode: SplitViewMode;
  /** Update view mode (persists to AsyncStorage) */
  setSplitViewMode: (mode: SplitViewMode) => void;
  /** Whether state has been loaded from storage */
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
 * - Persisted view mode preference (Split/Fullscreen)
 *
 * Automatically updates when device orientation changes.
 * Uses in-memory caching to prevent layout thrashing on navigation.
 *
 * @returns UseDeviceInfoResult with device info and split view state
 */
export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo());
  const [useSplitView, setUseSplitView] = useState(shouldUseSplitView());

  // Initialize with cached values if available to prevent animation glitches
  const [splitRatio, setSplitRatioState] = useState(cachedSplitRatio ?? DEFAULT_SPLIT_RATIO);
  const [splitViewMode, setSplitViewModeState] = useState<SplitViewMode>(
    cachedSplitViewMode ?? 'split'
  );
  const [isLoaded, setIsLoaded] = useState(isCacheLoaded);

  // Load persisted state on mount (only if not already loaded)
  useEffect(() => {
    async function loadState() {
      // If cache is already loaded, we don't need to read storage again
      // unless we want to ensure sync. For UI stability, cache is king.
      if (isCacheLoaded) {
        setIsLoaded(true);
        return;
      }

      try {
        const [storedRatio, storedMode] = await Promise.all([
          AsyncStorage.getItem(SPLIT_RATIO_STORAGE_KEY),
          AsyncStorage.getItem(SPLIT_VIEW_MODE_STORAGE_KEY),
        ]);

        if (storedRatio !== null) {
          const ratio = Number.parseFloat(storedRatio);
          if (!Number.isNaN(ratio) && ratio >= 0.1 && ratio <= 0.9) {
            cachedSplitRatio = ratio; // Update cache
            setSplitRatioState(ratio);
          }
        }

        if (storedMode !== null) {
          if (storedMode === 'split' || storedMode === 'left-full' || storedMode === 'right-full') {
            const mode = storedMode as SplitViewMode;
            cachedSplitViewMode = mode; // Update cache
            setSplitViewModeState(mode);
          }
        }
      } catch (error) {
        console.warn('Failed to load split view state:', error);
      } finally {
        isCacheLoaded = true;
        setIsLoaded(true);
      }
    }

    loadState();
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
    // Clamp ratio between 0.1 and 0.9
    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));

    // Update state and cache
    cachedSplitRatio = clampedRatio;
    setSplitRatioState(clampedRatio);

    // Persist to AsyncStorage
    AsyncStorage.setItem(SPLIT_RATIO_STORAGE_KEY, clampedRatio.toString()).catch((error) => {
      console.warn('Failed to save split ratio:', error);
    });
  }, []);

  // Update view mode and persist to storage
  const setSplitViewMode = useCallback((mode: SplitViewMode) => {
    // Update state and cache
    cachedSplitViewMode = mode;
    setSplitViewModeState(mode);

    AsyncStorage.setItem(SPLIT_VIEW_MODE_STORAGE_KEY, mode).catch((error) => {
      console.warn('Failed to save split view mode:', error);
    });
  }, []);

  return {
    ...deviceInfo,
    useSplitView,
    splitRatio,
    setSplitRatio,
    splitViewMode,
    setSplitViewMode,
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
