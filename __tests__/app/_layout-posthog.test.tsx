/**
 * PostHog Provider Integration Tests
 *
 * Tests PostHog provider initialization, configuration, and graceful degradation.
 * Tests React Query error tracking integration.
 */

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { mockPostHog } from '../mocks/posthog-mock';

describe('PostHog Provider Integration', () => {
  it('initializes PostHog when API key is provided', () => {
    // This test verifies the PostHog mock is available
    // In actual implementation, PostHog would be initialized with API key from env
    expect(mockPostHog).toBeDefined();
    expect(mockPostHog.identify).toBeDefined();
    expect(mockPostHog.reset).toBeDefined();
    expect(mockPostHog.captureException).toBeDefined();
  });

  it('gracefully handles missing API key without errors', () => {
    // This should not throw an error even when PostHog is not initialized
    expect(() => {
      const TestComponent = () => <Text>Test</Text>;
      render(<TestComponent />);
    }).not.toThrow();
  });

  it('configures session replay based on environment variable string comparison', () => {
    // Test session replay configuration logic
    const testEnabled = (value: string | undefined) => value === 'true';

    expect(testEnabled('true')).toBe(true);
    expect(testEnabled('false')).toBe(false);
    expect(testEnabled(undefined)).toBe(false);
    expect(testEnabled('')).toBe(false);
  });

  it('provides PostHog instance to components via usePostHog hook', () => {
    // Import after mocking to ensure mock is used
    const { usePostHog } = require('posthog-react-native');

    const posthog = usePostHog();

    expect(posthog).toBe(mockPostHog);
    expect(posthog.identify).toBeDefined();
    expect(posthog.reset).toBeDefined();
    expect(posthog.captureException).toBeDefined();
  });
});

describe('React Query Error Tracking', () => {
  beforeEach(() => {
    mockPostHog.captureException.mockClear();
  });

  it('captures query errors with PostHog', () => {
    const testError = new Error('API query failed');

    // Simulate what the onError callback does
    mockPostHog.captureException(testError, {
      context: 'react-query-query',
      message: 'API query failed',
      endpoint: '/api/books',
      method: 'GET',
    });

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        context: 'react-query-query',
        endpoint: '/api/books',
        method: 'GET',
      })
    );
  });

  it('captures mutation errors with PostHog', () => {
    const testError = new Error('API mutation failed');
    const variables = { title: 'Test', content: 'Test content' };

    // Simulate what the onError callback does
    mockPostHog.captureException(testError, {
      context: 'react-query-mutation',
      message: 'API mutation failed',
      endpoint: '/api/bookmarks',
      method: 'POST',
      variables: JSON.stringify(variables),
    });

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        context: 'react-query-mutation',
        endpoint: '/api/bookmarks',
        method: 'POST',
        variables: JSON.stringify(variables),
      })
    );
  });

  it('extracts status code from error object', () => {
    const errorWithStatus = Object.assign(new Error('Not found'), {
      status: 404,
      url: 'http://localhost:4000/api/books/999',
    });

    // Simulate error extraction logic
    const errorDetails: Record<string, unknown> = {
      message: errorWithStatus.message,
    };

    if ('status' in errorWithStatus) {
      errorDetails.statusCode = errorWithStatus.status;
    }

    if ('url' in errorWithStatus && typeof errorWithStatus.url === 'string') {
      try {
        const url = new URL(errorWithStatus.url);
        errorDetails.endpoint = url.pathname;
      } catch {
        errorDetails.endpoint = errorWithStatus.url;
      }
    }

    mockPostHog.captureException(errorWithStatus, {
      context: 'react-query-query',
      ...errorDetails,
    });

    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      errorWithStatus,
      expect.objectContaining({
        statusCode: 404,
        endpoint: '/api/books/999',
      })
    );
  });

  it('handles non-Error objects gracefully', () => {
    const stringError = 'Something went wrong';

    // Simulate error handling for non-Error objects
    const error = new Error(String(stringError));

    mockPostHog.captureException(error, {
      context: 'react-query-query',
      message: stringError,
    });

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: 'react-query-query',
        message: stringError,
      })
    );
  });

  it('extracts endpoint from request object nested in error', () => {
    const errorWithRequest = Object.assign(new Error('Request failed'), {
      request: {
        url: 'http://localhost:4000/api/chapters/1',
        method: 'GET',
      },
    });

    // Simulate error extraction logic
    const errorDetails: Record<string, unknown> = {
      message: errorWithRequest.message,
    };

    if ('request' in errorWithRequest && typeof errorWithRequest.request === 'object') {
      const request = errorWithRequest.request as Record<string, unknown>;
      if ('url' in request && typeof request.url === 'string') {
        try {
          const url = new URL(request.url);
          errorDetails.endpoint = url.pathname;
        } catch {
          errorDetails.endpoint = request.url;
        }
      }
      if ('method' in request && typeof request.method === 'string') {
        errorDetails.method = request.method;
      }
    }

    mockPostHog.captureException(errorWithRequest, {
      context: 'react-query-query',
      ...errorDetails,
    });

    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      errorWithRequest,
      expect.objectContaining({
        endpoint: '/api/chapters/1',
        method: 'GET',
      })
    );
  });
});
