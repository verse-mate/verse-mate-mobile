/**
 * Device Info Context
 *
 * Provides global access to device information and split view state.
 * Replaces local state in useDeviceInfo to ensure all components stay in sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_SPLIT_RATIO,
  type DeviceInfo,
  findVerticalFold,
  foldSplitRatio,
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

export interface DeviceInfoContextType extends DeviceInfo {
  /** Whether split view layout should be used */
  useSplitView: boolean;
  /** Current split ratio (0-1, left panel proportion); on an open foldable, the fold's */
  splitRatio: number;
  /**
   * The divider sits on a foldable's fold (iPhone Duo open in landscape): split
   * view is on whatever the width, and the divider is not resizable.
   */
  foldLocked: boolean;
  /** Update split ratio (persists to AsyncStorage) */
  setSplitRatio: (ratio: number) => void;
  /** Current view mode */
  splitViewMode: SplitViewMode;
  /** Update view mode (persists to AsyncStorage) */
  setSplitViewMode: (mode: SplitViewMode) => void;
  /** Whether state has been loaded from storage */
  isLoaded: boolean;
}

const DeviceInfoContext = createContext<DeviceInfoContextType | null>(null);

/**
 * Module-level cache to ensure state persistence across hot reloads or unmounts
 * if the provider itself is unmounted (though it should be high in tree)
 */
let cachedSplitRatio: number | null = null;
let cachedSplitViewMode: SplitViewMode | null = null;
let isCacheLoaded = false;

export function DeviceInfoProvider({ children }: { children: React.ReactNode }) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo());
  const [useSplitView, setUseSplitView] = useState(shouldUseSplitView());
  
  // Initialize with cached values if available
  const [splitRatio, setSplitRatioState] = useState(cachedSplitRatio ?? DEFAULT_SPLIT_RATIO);
  const [splitViewMode, setSplitViewModeState] = useState<SplitViewMode>(cachedSplitViewMode ?? 'split');
  const [isLoaded, setIsLoaded] = useState(isCacheLoaded);

  // An open foldable splits along its fold even below the split-view width:
  // iPhone Duo open in landscape is about 950pt wide, its halves about 470pt.
  const reservedRegions = useReservedRegions();
  const insets = useSafeAreaInsets();
  const fold = findVerticalFold(reservedRegions);
  const foldRatio = fold ? foldSplitRatio(fold, deviceInfo.screenWidth, insets) : null;

  // Load persisted state on mount
  useEffect(() => {
    async function loadState() {
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
            cachedSplitRatio = ratio;
            setSplitRatioState(ratio);
          }
        }

        if (storedMode !== null) {
          if (storedMode === 'split' || storedMode === 'left-full' || storedMode === 'right-full') {
            const mode = storedMode as SplitViewMode;
            cachedSplitViewMode = mode;
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

  // Listen for dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setDeviceInfo(getDeviceInfo());
      setUseSplitView(shouldUseSplitView());
    });

    return () => subscription?.remove();
  }, []);

  // Update split ratio
  const setSplitRatio = (ratio: number) => {
    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
    cachedSplitRatio = clampedRatio;
    setSplitRatioState(clampedRatio);
    AsyncStorage.setItem(SPLIT_RATIO_STORAGE_KEY, clampedRatio.toString()).catch((error) => {
      console.warn('Failed to save split ratio:', error);
    });
  };

  // Update view mode
  const setSplitViewMode = (mode: SplitViewMode) => {
    cachedSplitViewMode = mode;
    setSplitViewModeState(mode);
    AsyncStorage.setItem(SPLIT_VIEW_MODE_STORAGE_KEY, mode).catch((error) => {
      console.warn('Failed to save split view mode:', error);
    });
  };

  const value = {
    ...deviceInfo,
    useSplitView: useSplitView || foldRatio !== null,
    splitRatio: foldRatio ?? splitRatio,
    foldLocked: foldRatio !== null,
    setSplitRatio,
    splitViewMode,
    setSplitViewMode,
    isLoaded,
  };

  return (
    <DeviceInfoContext.Provider value={value}>
      {children}
    </DeviceInfoContext.Provider>
  );
}

export function useDeviceInfoContext() {
  const context = useContext(DeviceInfoContext);
  if (!context) {
    throw new Error('useDeviceInfo must be used within a DeviceInfoProvider');
  }
  return context;
}
