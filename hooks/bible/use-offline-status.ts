/**
 * useOfflineStatus Hook
 *
 * Detects network connectivity status using @react-native-community/netinfo.
 * Returns whether the device is offline and additional network information.
 *
 * Features:
 * - Real-time network status updates
 * - Detects offline/online transitions
 * - Provides network type information (wifi, cellular, etc.)
 * - Auto-cleanup on unmount
 *
 * @see Spec lines 76-81, 849-869 (Offline indicator)
 * @see Task Group 8.6
 *
 * @example
 * const { isOffline, isConnected, networkType } = useOfflineStatus();
 * // Returns: { isOffline: false, isConnected: true, networkType: 'wifi' }
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import type { UseOfflineStatusResult } from '@/types/bible';

export function useOfflineStatus(): UseOfflineStatusResult {
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState(state);
    });

    // Fetch initial network state
    NetInfo.fetch().then((state) => {
      setNetworkState(state);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Extract network information
  const isConnected = networkState?.isConnected ?? true; // Default to connected if unknown
  const isOffline = !isConnected;
  const networkType = networkState?.type ?? null;

  return {
    isOffline,
    isConnected,
    networkType,
  };
}
