/**
 * PostHog API Client Tests
 *
 * Focused tests for API client functionality:
 * - API client initialization with config
 * - Idempotent create-or-update logic
 * - Dry-run mode prevents API calls
 * - Error handling for API failures
 *
 * Note: These tests use the global MSW server from test-setup.ts
 * and add PostHog-specific handlers for each test.
 */

import { HttpResponse, http } from 'msw';
import { server } from '../../../../__tests__/mocks/server';
import type { PostHogConfig } from '../../config';
import { createLogger } from '../../utils/logger';
import { createPostHogApiClient, PostHogApiClient, PostHogApiClientError } from '../client';
import { DashboardsApi } from '../dashboards';
import { InsightsApi } from '../insights';

// Test configuration
const testConfig: PostHogConfig = {
  apiKey: 'phx_test_api_key',
  projectId: '12345',
  host: 'https://app.posthog.com',
};

// Base URL for mocking
const BASE_URL = `${testConfig.host}/api/projects/${testConfig.projectId}`;

// Mock data
const mockDashboard = {
  id: 1,
  name: 'Test Dashboard',
  description: 'Test description',
  pinned: false,
  created_at: '2024-01-01T00:00:00Z',
  created_by: null,
  is_shared: false,
  deleted: false,
  creation_mode: 'default',
  use_template: '',
  effective_restriction_level: 21,
  effective_privilege_level: 37,
  tiles: [],
  filters: {},
  tags: [],
};

const mockInsight = {
  id: 1,
  short_id: 'abc123',
  name: 'Test Insight',
  derived_name: null,
  description: 'Test insight description',
  filters: { insight: 'TRENDS', events: [] },
  query: null,
  order: null,
  deleted: false,
  dashboards: [],
  last_refresh: null,
  refreshing: false,
  created_at: '2024-01-01T00:00:00Z',
  created_by: null,
  updated_at: '2024-01-01T00:00:00Z',
  tags: [],
  favorited: false,
  saved: true,
  result: null,
  last_modified_at: '2024-01-01T00:00:00Z',
  last_modified_by: null,
};

describe('PostHog API Client', () => {
  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      expect(client).toBeInstanceOf(PostHogApiClient);
      expect(client.getProjectId()).toBe(testConfig.projectId);
      expect(client.isDryRun()).toBe(false);
    });

    it('should initialize in dry-run mode', () => {
      const logger = createLogger({ verbose: false, dryRun: true });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: true,
      });

      expect(client.isDryRun()).toBe(true);
    });
  });

  describe('dry-run mode', () => {
    it('should not make actual API calls in dry-run mode', async () => {
      let apiCalled = false;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          apiCalled = true;
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [mockDashboard],
          });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: true });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: true,
      });

      // Try to fetch dashboards - should not hit the API
      const result = await client.getAllPaginated('/dashboards/');

      expect(apiCalled).toBe(false);
      expect(result).toEqual([]);
    });

    it('should return mock response for POST in dry-run mode', async () => {
      const logger = createLogger({ verbose: false, dryRun: true });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: true,
      });

      const response = await client.post('/dashboards/', { name: 'Test' });

      expect(response.status).toBe(201);
      expect(response.data).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should throw PostHogApiClientError on API failure', async () => {
      server.use(
        http.get(`${BASE_URL}/dashboards/1/`, () => {
          return HttpResponse.json(
            {
              type: 'invalid_request',
              code: 'not_found',
              detail: 'Dashboard not found',
            },
            { status: 404 }
          );
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      await expect(client.get('/dashboards/1/')).rejects.toThrow(PostHogApiClientError);

      try {
        await client.get('/dashboards/1/');
      } catch (error) {
        expect(error).toBeInstanceOf(PostHogApiClientError);
        const apiError = error as PostHogApiClientError;
        expect(apiError.statusCode).toBe(404);
        expect(apiError.message).toBe('Dashboard not found');
      }
    });

    it('should retry on rate limit (429) errors', async () => {
      let attemptCount = 0;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          attemptCount++;
          if (attemptCount < 2) {
            return HttpResponse.json({ detail: 'Rate limited' }, { status: 429 });
          }
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [mockDashboard],
          });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
        maxRetries: 3,
        retryDelayMs: 10, // Fast for testing
      });

      const result = await client.getAllPaginated('/dashboards/');

      expect(attemptCount).toBe(2);
      expect(result).toHaveLength(1);
    });
  });

  describe('idempotent operations', () => {
    it('should find existing dashboard by name instead of creating duplicate', async () => {
      let createCalled = false;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [mockDashboard],
          });
        }),
        http.post(`${BASE_URL}/dashboards/`, () => {
          createCalled = true;
          return HttpResponse.json(mockDashboard, { status: 201 });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const dashboardsApi = new DashboardsApi(client);
      const result = await dashboardsApi.findOrCreate({
        name: 'Test Dashboard',
        description: 'Test description',
      });

      expect(createCalled).toBe(false);
      expect(result.created).toBe(false);
      expect(result.dashboard.name).toBe('Test Dashboard');
    });

    it('should create dashboard when not found by name', async () => {
      let createCalled = false;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          return HttpResponse.json({
            count: 0,
            next: null,
            previous: null,
            results: [],
          });
        }),
        http.post(`${BASE_URL}/dashboards/`, () => {
          createCalled = true;
          return HttpResponse.json(mockDashboard, { status: 201 });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const dashboardsApi = new DashboardsApi(client);
      const result = await dashboardsApi.findOrCreate({
        name: 'Test Dashboard',
        description: 'Test description',
      });

      expect(createCalled).toBe(true);
      expect(result.created).toBe(true);
    });

    it('should update insight only when changes detected', async () => {
      let updateCalled = false;
      const existingInsight = { ...mockInsight, description: 'Old description' };

      server.use(
        http.get(`${BASE_URL}/insights/`, () => {
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [existingInsight],
          });
        }),
        http.patch(`${BASE_URL}/insights/1/`, () => {
          updateCalled = true;
          return HttpResponse.json({ ...existingInsight, description: 'New description' });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const insightsApi = new InsightsApi(client);
      const result = await insightsApi.createOrUpdate({
        name: 'Test Insight',
        description: 'New description',
      });

      expect(updateCalled).toBe(true);
      expect(result.operation).toBe('updated');
    });

    it('should not update insight when no changes detected', async () => {
      let updateCalled = false;

      server.use(
        http.get(`${BASE_URL}/insights/`, () => {
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [mockInsight],
          });
        }),
        http.patch(`${BASE_URL}/insights/1/`, () => {
          updateCalled = true;
          return HttpResponse.json(mockInsight);
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const insightsApi = new InsightsApi(client);
      const result = await insightsApi.createOrUpdate({
        name: 'Test Insight',
        description: 'Test insight description', // Same as existing
      });

      expect(updateCalled).toBe(false);
      expect(result.operation).toBe('unchanged');
    });
  });
});
