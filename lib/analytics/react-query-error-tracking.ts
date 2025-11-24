/**
 * React Query Error Tracking
 *
 * Extracts error details from React Query errors and tracks them with PostHog.
 * Handles both query and mutation errors globally.
 */

import { getPostHogInstance } from './posthog-provider';

/**
 * Extract error details from React Query error object
 * Attempts to extract status code, URL, endpoint, and method from the error
 */
export function extractErrorDetails(error: Error): Record<string, string | number> {
  const errorDetails: Record<string, string | number> = {
    message: error.message,
  };

  // Try to extract additional context from error object
  if (error && typeof error === 'object') {
    const err = error as unknown as Record<string, unknown>;

    // Extract status code if available
    if ('status' in err && typeof err.status === 'number') {
      errorDetails.statusCode = err.status;
    }

    // Extract URL/endpoint if available
    if ('url' in err && typeof err.url === 'string') {
      try {
        const url = new URL(err.url);
        errorDetails.endpoint = url.pathname;
      } catch {
        errorDetails.endpoint = err.url;
      }
    }

    // Extract request details if available
    if ('request' in err && err.request && typeof err.request === 'object') {
      const request = err.request as Record<string, unknown>;
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

    // Extract response details if available
    if ('response' in err && err.response && typeof err.response === 'object') {
      const response = err.response as Record<string, unknown>;
      if ('status' in response && typeof response.status === 'number') {
        errorDetails.statusCode = response.status;
      }
    }
  }

  return errorDetails;
}

/**
 * Handle React Query errors by tracking them with PostHog
 * Used as a global error handler for queries and mutations
 */
export function handleReactQueryError(error: Error): void {
  const posthogInstance = getPostHogInstance();
  if (!posthogInstance) return;

  const errorDetails = extractErrorDetails(error);
  posthogInstance.captureException(error, {
    ...errorDetails,
    source: 'react-query',
  });
}
