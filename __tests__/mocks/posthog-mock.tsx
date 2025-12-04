/**
 * PostHog Mock for Testing
 *
 * Provides a mock implementation of PostHog methods for testing.
 * Tracks method calls and arguments for verification in tests.
 */

import type { ReactNode } from 'react';

// Mock PostHog instance with call tracking
export const mockPostHog = {
  identify: jest.fn(),
  reset: jest.fn(),
  capture: jest.fn(),
  captureException: jest.fn(),
  // Add other PostHog methods as needed
  screen: jest.fn(),
  group: jest.fn(),
  alias: jest.fn(),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
  getFeatureFlag: jest.fn().mockReturnValue(undefined),
  reloadFeatureFlags: jest.fn(),
  shutdown: jest.fn(),
};

/**
 * Reset all mock functions
 * Call this in afterEach to ensure test isolation
 */
export function resetPostHogMock() {
  Object.values(mockPostHog).forEach((mockFn) => {
    if (typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
  });
}

/**
 * Mock PostHogProvider component for testing
 * Renders children without actually initializing PostHog
 */
export function MockPostHogProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Mock the posthog-react-native module
jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePostHog: () => mockPostHog,
}));
