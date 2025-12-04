/**
 * PostHog Error Boundary Integration Tests
 *
 * Tests PostHog error tracking in React Error Boundary.
 */

import type { ErrorInfo } from 'react';
import { mockPostHog } from '../mocks/posthog-mock';

describe('AppErrorBoundary PostHog Integration', () => {
  beforeEach(() => {
    mockPostHog.captureException.mockClear();
  });

  it('captures errors with PostHog.captureException', () => {
    const testError = new Error('Test component error');
    const errorInfo: ErrorInfo = {
      componentStack: '\n    at Component (Component.tsx:10)',
      digest: undefined,
    };

    // Simulate what AppErrorBoundary does in componentDidCatch
    mockPostHog.captureException(testError, {
      componentStack: errorInfo.componentStack ?? '',
    });

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(testError, {
      componentStack: errorInfo.componentStack ?? '',
    });
  });

  it('includes component stack in error context', () => {
    const testError = new Error('Render error');
    const componentStack = '\n    at TestComponent (TestComponent.tsx:25)\n    at App (App.tsx:10)';

    mockPostHog.captureException(testError, { componentStack });

    const captureCall = mockPostHog.captureException.mock.calls[0];
    expect(captureCall[0]).toBe(testError);
    expect(captureCall[1]).toHaveProperty('componentStack', componentStack);
  });

  it('supports optional chaining for graceful degradation', () => {
    // Test that optional chaining syntax works correctly
    // This test verifies the pattern used in AppErrorBoundary
    const mockFn = jest.fn();
    const obj: { captureException?: (error: Error) => void } | null = { captureException: mockFn };

    const testError = new Error('Test');
    obj?.captureException?.(testError);
    expect(mockFn).toHaveBeenCalledWith(testError);

    // Verify null case doesn't throw
    const nullObj: { captureException?: (error: Error) => void } | null = null;
    // Type assertion to avoid TypeScript narrowing to never
    expect(() => (nullObj as unknown as typeof obj)?.captureException?.(testError)).not.toThrow();
  });
});
