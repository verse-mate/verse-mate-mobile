/**
 * Tests for PostHog provider web-awareness
 *
 * Verifies the provider sets platform: 'web' and disables
 * mobile-only features when running on web.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Platform } from 'react-native';

// Save original Platform.OS
const originalOS = Platform.OS;

// Mock posthog-react-native
const mockRegister = jest.fn();
const mockCapture = jest.fn();

jest.mock('posthog-react-native', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePostHog: () => ({
    register: mockRegister,
    capture: mockCapture,
    identify: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('@/lib/api/client-interceptors', () => ({
  setPostHogInstance: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'US' }],
}));

// Set POSTHOG_KEY so the provider renders
const originalEnv = process.env.EXPO_PUBLIC_POSTHOG_KEY;
process.env.EXPO_PUBLIC_POSTHOG_KEY = 'test-key';

describe('PostHog provider on web', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    // Ensure window is defined (SSR guard checks typeof window)
    if (typeof globalThis.window === 'undefined') {
      (globalThis as Record<string, unknown>).window = globalThis;
    }
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
    process.env.EXPO_PUBLIC_POSTHOG_KEY = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers platform as web', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppPostHogProvider>{children}</AppPostHogProvider>
    );

    renderHook(() => {}, { wrapper });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ platform: 'web' }));
    });
  });
});
