/**
 * Tests for useSSOLogin composition hook
 *
 * @see Task Group 5: Login/Signup Screen Integration
 */

import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

import { useSSOLogin } from '@/hooks/auth/useSSOLogin';

// Mock the individual SSO hooks
const mockGoogleSignIn = jest.fn();
const mockGoogleReset = jest.fn();
const mockAppleSignIn = jest.fn();
const mockAppleReset = jest.fn();

jest.mock('@/hooks/auth/useGoogleSignIn', () => ({
  useGoogleSignIn: () => ({
    signIn: mockGoogleSignIn,
    isLoading: false,
    error: null,
    reset: mockGoogleReset,
    isAvailable: true,
  }),
}));

jest.mock('@/hooks/auth/useAppleSignIn', () => ({
  useAppleSignIn: () => ({
    signIn: mockAppleSignIn,
    isLoading: false,
    error: null,
    reset: mockAppleReset,
    isAvailable: true,
  }),
}));

// Mock AuthContext
const mockLoginWithSSO = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithSSO: mockLoginWithSSO,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    restoreSession: jest.fn(),
  }),
}));

describe('useSSOLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hook initialization', () => {
    it('returns signInWithGoogle and signInWithApple functions', () => {
      const { result } = renderHook(() => useSSOLogin());

      expect(result.current.signInWithGoogle).toBeDefined();
      expect(typeof result.current.signInWithGoogle).toBe('function');
      expect(result.current.signInWithApple).toBeDefined();
      expect(typeof result.current.signInWithApple).toBe('function');
    });

    it('returns loading states and error', () => {
      const { result } = renderHook(() => useSSOLogin());

      expect(result.current.isGoogleLoading).toBe(false);
      expect(result.current.isAppleLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('returns availability states', () => {
      const { result } = renderHook(() => useSSOLogin());

      expect(result.current.isGoogleAvailable).toBe(true);
      expect(result.current.isAppleAvailable).toBe(true);
    });
  });

  describe('signInWithGoogle', () => {
    it('calls Google sign-in and loginWithSSO on success', async () => {
      mockGoogleSignIn.mockResolvedValue('mock-google-token');
      mockLoginWithSSO.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(mockGoogleSignIn).toHaveBeenCalled();
      expect(mockLoginWithSSO).toHaveBeenCalledWith('google', 'mock-google-token');
    });

    it('does not call loginWithSSO when Google returns null (user cancelled)', async () => {
      mockGoogleSignIn.mockResolvedValue(null);

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(mockGoogleSignIn).toHaveBeenCalled();
      expect(mockLoginWithSSO).not.toHaveBeenCalled();
    });

    it('sets error when backend loginWithSSO fails', async () => {
      mockGoogleSignIn.mockResolvedValue('mock-google-token');
      mockLoginWithSSO.mockRejectedValue(new Error('Backend error'));

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(result.current.error).toBe('Backend error');
    });

    it('manages loading state during sign-in', async () => {
      let resolveGoogleSignIn: (value: string) => void;
      const googlePromise = new Promise<string>((resolve) => {
        resolveGoogleSignIn = resolve;
      });
      mockGoogleSignIn.mockReturnValue(googlePromise);
      mockLoginWithSSO.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSOLogin());

      // Start sign-in
      let signInPromise: Promise<void>;
      act(() => {
        signInPromise = result.current.signInWithGoogle();
      });

      expect(result.current.isGoogleLoading).toBe(true);

      // Resolve
      await act(async () => {
        resolveGoogleSignIn?.('token');
        await signInPromise;
      });

      expect(result.current.isGoogleLoading).toBe(false);
    });
  });

  describe('signInWithApple', () => {
    it('calls Apple sign-in and loginWithSSO on success', async () => {
      mockAppleSignIn.mockResolvedValue('mock-apple-token');
      mockLoginWithSSO.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithApple();
      });

      expect(mockAppleSignIn).toHaveBeenCalled();
      expect(mockLoginWithSSO).toHaveBeenCalledWith('apple', 'mock-apple-token');
    });

    it('does not call loginWithSSO when Apple returns null', async () => {
      mockAppleSignIn.mockResolvedValue(null);

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithApple();
      });

      expect(mockAppleSignIn).toHaveBeenCalled();
      expect(mockLoginWithSSO).not.toHaveBeenCalled();
    });

    it('sets error when backend loginWithSSO fails', async () => {
      mockAppleSignIn.mockResolvedValue('mock-apple-token');
      mockLoginWithSSO.mockRejectedValue(new Error('Apple backend error'));

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithApple();
      });

      expect(result.current.error).toBe('Apple backend error');
    });
  });

  describe('resetError', () => {
    it('clears error state and resets underlying hooks', async () => {
      mockGoogleSignIn.mockResolvedValue('token');
      mockLoginWithSSO.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useSSOLogin());

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(result.current.error).toBe('Error');

      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
      expect(mockGoogleReset).toHaveBeenCalled();
      expect(mockAppleReset).toHaveBeenCalled();
    });
  });
});
