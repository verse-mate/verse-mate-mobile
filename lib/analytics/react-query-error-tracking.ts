/**
 * React Query Error Tracking
 *
 * Extracts error details from React Query errors and tracks them with PostHog.
 * Handles both query and mutation errors globally.
 */

import { type Mutation, onlineManager, type Query } from '@tanstack/react-query';
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
        errorDetails.endpoint = err.url.split(/[?#]/)[0];
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
          errorDetails.endpoint = request.url.split(/[?#]/)[0];
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

const KEY_WORD = /^[a-z][a-z-]*$/;
const NETWORK_FAILURE = /network request failed|failed to fetch|network error/i;

function isNetworkFailure(error: Error): boolean {
  return 'request' in error || NETWORK_FAILURE.test(error.message);
}

function keyName(key: readonly unknown[] | undefined): string | undefined {
  const [first, second] = key ?? [];
  const name = typeof first === 'string' ? first : (first as { _id?: unknown } | null)?._id;
  if (typeof name !== 'string') return undefined;
  return typeof second === 'string' && KEY_WORD.test(second) ? `${name}/${second}` : name;
}

function handleReactQueryError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!(error instanceof Error)) return;
  if (!onlineManager.isOnline() && isNetworkFailure(error)) return;
  const posthogInstance = getPostHogInstance();
  if (!posthogInstance) return;

  posthogInstance.captureException(error, {
    ...extractErrorDetails(error),
    ...context,
    source: 'react-query',
  });
}

export function onQueryError(error: unknown, query: Query<unknown, unknown, unknown>): void {
  handleReactQueryError(error, { query_key: keyName(query.queryKey) });
}

export function onMutationError(
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown>
): void {
  handleReactQueryError(error, { mutation_key: keyName(mutation.options.mutationKey) });
}
