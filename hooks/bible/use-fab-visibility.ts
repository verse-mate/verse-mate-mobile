/**
 * useFABVisibility Hook
 *
 * Manages visibility state for Floating Action Buttons based on user interaction.
 * Buttons fade out during reading (slow scroll or idle) and fade in during navigation.
 *
 * Show buttons when:
 * - User taps the screen
 * - User scrolls quickly (velocity > threshold)
 * - User reaches bottom of content
 * - Initial page load
 *
 * Hide buttons when:
 * - User is idle for 3 seconds
 * - User scrolls slowly (reading pace)
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll velocity threshold in pixels/second
 * Scrolling faster than this shows the buttons (user is navigating)
 * Scrolling slower hides the buttons (user is reading)
 * Lower threshold = easier to trigger button visibility
 */
export const SCROLL_VELOCITY_THRESHOLD = 300;

/**
 * Distance from bottom in pixels to trigger "at bottom" state
 * When user is within this distance, show the buttons
 */
export const BOTTOM_THRESHOLD = 20;

/**
 * Idle timeout in milliseconds before hiding buttons
 * After this duration of no interaction, buttons fade out
 */
export const IDLE_TIMEOUT_MS = 3000;

interface UseFABVisibilityOptions {
  /** Initial visibility state (default: true) */
  initialVisible?: boolean;
}

export function useFABVisibility(options: UseFABVisibilityOptions = {}) {
  const { initialVisible = true } = options;
  const [visible, setVisible] = useState(initialVisible);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(false);
  const visibleRef = useRef(visible);

  // Keep ref in sync with state
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  /**
   * Clear any pending idle timeout
   */
  const clearIdleTimeout = () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  };

  /**
   * Start idle timeout to hide buttons after delay
   * Only starts timeout if not at bottom
   */
  const startIdleTimeout = () => {
    clearIdleTimeout();
    // Don't start timeout if at bottom - keep buttons visible
    if (isAtBottomRef.current) {
      return;
    }
    idleTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, IDLE_TIMEOUT_MS);
  };

  /**
   * Show buttons and restart idle timeout
   */
  const showButtons = () => {
    setVisible(true);
    startIdleTimeout();
  };

  /**
   * Handle scroll events
   * Shows/hides buttons based on scroll velocity and position
   *
   * @param velocity - Scroll velocity in pixels/second (signed value: negative = up, positive = down)
   * @param isAtBottom - Whether user is at/near bottom of content
   */
  const handleScroll = (velocity: number, isAtBottom: boolean) => {
    // Update bottom state
    isAtBottomRef.current = isAtBottom;

    if (isAtBottom) {
      // At bottom - show buttons and keep them visible (no timeout)
      clearIdleTimeout();
      setVisible(true);
    } else if (velocity < -SCROLL_VELOCITY_THRESHOLD) {
      // Fast scroll UP - show buttons with 3s timeout
      if (!visibleRef.current) {
        setVisible(true);
      }
      startIdleTimeout();
    } else if (velocity > SCROLL_VELOCITY_THRESHOLD) {
      // Fast scroll DOWN - hide buttons immediately
      if (visibleRef.current) {
        setVisible(false);
      }
      clearIdleTimeout();
    }
    // Note: On slow scroll, let existing timeout continue (buttons will hide after 3s of inactivity)
  };

  /**
   * Handle tap events
   * Shows buttons and starts idle timeout
   */
  const handleTap = () => {
    showButtons();
  };

  /**
   * Cleanup timeout on unmount
   * Note: Dependencies intentionally empty - startIdleTimeout and clearIdleTimeout
   * are stable function references (React Compiler handles memoization)
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: Functions are stable, only run on mount/unmount
  useEffect(() => {
    // Start initial timeout
    startIdleTimeout();

    return () => {
      clearIdleTimeout();
    };
  }, []);

  return {
    visible,
    handleScroll,
    handleTap,
    showButtons,
  };
}
