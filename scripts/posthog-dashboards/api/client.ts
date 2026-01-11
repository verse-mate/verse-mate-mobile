/**
 * PostHog API Client
 *
 * Base HTTP client wrapper for PostHog API with:
 * - Authentication via API key
 * - Rate limiting and retry logic
 * - Dry-run mode support
 * - Error handling with clear feedback
 */

import type { PostHogConfig } from '../config';
import type { Logger } from '../utils/logger';

/**
 * PostHog API error response structure
 */
export interface PostHogApiError {
  type: string;
  code: string;
  detail: string;
  attr?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Paginated response from PostHog API
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Error thrown when API requests fail
 */
export class PostHogApiClientError extends Error {
  public readonly statusCode: number;
  public readonly apiError?: PostHogApiError;

  constructor(message: string, statusCode: number, apiError?: PostHogApiError) {
    super(message);
    this.name = 'PostHogApiClientError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}

/**
 * Client options
 */
export interface PostHogClientOptions {
  /** PostHog configuration */
  config: PostHogConfig;
  /** Logger instance */
  logger: Logger;
  /** Enable dry-run mode (no actual API calls) */
  dryRun: boolean;
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs?: number;
}

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * PostHog API Client
 *
 * Handles all HTTP communication with PostHog API including:
 * - Authentication
 * - Rate limiting
 * - Retry logic
 * - Dry-run support
 */
export class PostHogApiClient {
  private readonly config: PostHogConfig;
  private readonly logger: Logger;
  private readonly dryRun: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: PostHogClientOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.dryRun = options.dryRun;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Get the base URL for API requests
   */
  private getBaseUrl(): string {
    return `${this.config.host}/api/projects/${this.config.projectId}`;
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable (rate limit or server error)
   */
  private isRetryableError(statusCode: number): boolean {
    // Rate limit (429) or server errors (5xx)
    return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
  }

  /**
   * Execute an HTTP request with retry logic
   *
   * @param method HTTP method
   * @param path API path (relative to base URL)
   * @param body Optional request body
   * @param retryCount Current retry attempt
   * @returns API response
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.getBaseUrl()}${path}`;

    // In dry-run mode, log and return mock response
    if (this.dryRun) {
      this.logger.debug(`[DRY-RUN] ${method} ${url}`);
      if (body) {
        this.logger.debug(`[DRY-RUN] Body: ${JSON.stringify(body, null, 2)}`);
      }
      // Return a mock response for dry-run mode
      return {
        data: {} as T,
        status: method === 'POST' ? 201 : 200,
      };
    }

    this.logger.debug(`${method} ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle rate limiting with exponential backoff
      if (this.isRetryableError(response.status) && retryCount < this.maxRetries) {
        const delay = this.retryDelayMs * 2 ** retryCount;
        this.logger.warn(
          `Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await this.sleep(delay);
        return this.request<T>(method, path, body, retryCount + 1);
      }

      // Handle errors
      if (!response.ok) {
        let apiError: PostHogApiError | undefined;
        try {
          apiError = (await response.json()) as PostHogApiError;
        } catch {
          // Response might not be JSON
        }

        throw new PostHogApiClientError(
          apiError?.detail || `Request failed with status ${response.status}`,
          response.status,
          apiError
        );
      }

      // Parse response
      const data = (await response.json()) as T;
      return { data, status: response.status };
    } catch (error) {
      // Re-throw PostHogApiClientError
      if (error instanceof PostHogApiClientError) {
        throw error;
      }

      // Wrap other errors
      throw new PostHogApiClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        0
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  /**
   * Fetch all pages of a paginated endpoint
   *
   * @param path API path
   * @returns All results from all pages
   */
  async getAllPaginated<T>(path: string): Promise<T[]> {
    const allResults: T[] = [];
    let nextUrl: string | null = path;

    while (nextUrl) {
      // In dry-run mode, return empty array
      if (this.dryRun) {
        this.logger.debug(`[DRY-RUN] GET ${this.getBaseUrl()}${nextUrl}`);
        return [];
      }

      const response: ApiResponse<PaginatedResponse<T>> =
        await this.get<PaginatedResponse<T>>(nextUrl);
      allResults.push(...response.data.results);

      // Handle next URL - it might be a full URL or just a path
      if (response.data.next) {
        // Extract path from full URL if needed
        const nextUrlObj: URL = new URL(response.data.next, this.config.host);
        nextUrl =
          nextUrlObj.pathname.replace(`/api/projects/${this.config.projectId}`, '') +
          nextUrlObj.search;
      } else {
        nextUrl = null;
      }
    }

    return allResults;
  }

  /**
   * Check if client is in dry-run mode
   */
  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.config.projectId;
  }
}

/**
 * Create a new PostHog API client instance
 */
export function createPostHogApiClient(options: PostHogClientOptions): PostHogApiClient {
  return new PostHogApiClient(options);
}
