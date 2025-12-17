/**
 * PostHog Dashboard Integration Tests
 *
 * Additional tests to fill critical coverage gaps:
 * - Full create-update-verify cycle
 * - Dry-run with verbose output
 * - Paginated response handling
 * - Partial failure scenarios
 * - Deep equality comparison in idempotent module
 *
 * Note: These tests complement the existing tests in api-client.test.ts and setup.test.ts
 */

import { HttpResponse, http } from 'msw';
import { server } from '../../../__tests__/mocks/server';
import { createPostHogApiClient } from '../api/client';
import { CohortsApi } from '../api/cohorts';
import { DashboardsApi } from '../api/dashboards';
import { InsightsApi } from '../api/insights';
import type { PostHogConfig } from '../config';
import { deepEqual, getChangedFields, SyncStats } from '../utils/idempotent';
import { createLogger } from '../utils/logger';

// Test configuration
const testConfig: PostHogConfig = {
  apiKey: 'phx_test_api_key',
  projectId: '12345',
  host: 'https://app.posthog.com',
};

// Base URL for mocking
const BASE_URL = `${testConfig.host}/api/projects/${testConfig.projectId}`;

describe('PostHog Dashboard Integration Tests', () => {
  describe('paginated response handling', () => {
    it('should fetch all pages of results from paginated endpoint', async () => {
      const mockDashboard1 = {
        id: 1,
        name: 'Dashboard 1',
        description: 'First dashboard',
        pinned: false,
        deleted: false,
      };

      const mockDashboard2 = {
        id: 2,
        name: 'Dashboard 2',
        description: 'Second dashboard',
        pinned: true,
        deleted: false,
      };

      let pageRequests = 0;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, ({ request }) => {
          pageRequests++;
          const url = new URL(request.url);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);

          if (offset === 0) {
            // First page
            return HttpResponse.json({
              count: 2,
              next: `${BASE_URL}/dashboards/?offset=1`,
              previous: null,
              results: [mockDashboard1],
            });
          } else {
            // Second page
            return HttpResponse.json({
              count: 2,
              next: null,
              previous: `${BASE_URL}/dashboards/`,
              results: [mockDashboard2],
            });
          }
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const results = await client.getAllPaginated<{ id: number; name: string }>('/dashboards/');

      expect(pageRequests).toBe(2);
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Dashboard 1');
      expect(results[1].name).toBe('Dashboard 2');
    });
  });

  describe('full create-update-verify cycle', () => {
    it('should handle full lifecycle: create -> verify -> update -> verify unchanged', async () => {
      const mockDashboard = {
        id: 1,
        name: 'Lifecycle Test Dashboard',
        description: 'Initial description',
        pinned: false,
        deleted: false,
        tiles: [],
        filters: {},
        tags: [],
      };

      let dashboardState = { ...mockDashboard };
      let listCalls = 0;
      let createCalls = 0;
      let updateCalls = 0;

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          listCalls++;
          // First call returns empty (for create), subsequent calls return the dashboard
          if (listCalls === 1) {
            return HttpResponse.json({
              count: 0,
              next: null,
              previous: null,
              results: [],
            });
          }
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [dashboardState],
          });
        }),
        http.post(`${BASE_URL}/dashboards/`, () => {
          createCalls++;
          return HttpResponse.json(dashboardState, { status: 201 });
        }),
        http.patch(`${BASE_URL}/dashboards/1/`, async ({ request }) => {
          updateCalls++;
          const body = (await request.json()) as Record<string, unknown>;
          dashboardState = { ...dashboardState, ...body };
          return HttpResponse.json(dashboardState);
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const dashboardsApi = new DashboardsApi(client);

      // Step 1: Create
      const createResult = await dashboardsApi.createOrUpdate({
        name: 'Lifecycle Test Dashboard',
        description: 'Initial description',
      });
      expect(createResult.operation).toBe('created');
      expect(createCalls).toBe(1);

      // Step 2: Update with new description
      const updateResult = await dashboardsApi.createOrUpdate({
        name: 'Lifecycle Test Dashboard',
        description: 'Updated description',
      });
      expect(updateResult.operation).toBe('updated');
      expect(updateCalls).toBe(1);

      // Step 3: Verify unchanged when same data
      const unchangedResult = await dashboardsApi.createOrUpdate({
        name: 'Lifecycle Test Dashboard',
        description: 'Updated description',
      });
      expect(unchangedResult.operation).toBe('unchanged');
      // No additional update calls
      expect(updateCalls).toBe(1);
    });
  });

  describe('partial failure scenarios', () => {
    it('should continue processing after individual resource failure', async () => {
      let cohort1Calls = 0;
      let cohort2Calls = 0;

      server.use(
        http.get(`${BASE_URL}/cohorts/`, () => {
          return HttpResponse.json({
            count: 0,
            next: null,
            previous: null,
            results: [],
          });
        }),
        http.post(`${BASE_URL}/cohorts/`, async ({ request }) => {
          const body = (await request.json()) as { name: string };

          if (body.name === 'Failing Cohort') {
            cohort1Calls++;
            return HttpResponse.json({ detail: 'Validation error' }, { status: 400 });
          }

          cohort2Calls++;
          return HttpResponse.json(
            {
              id: 2,
              name: body.name,
              description: 'Success',
              groups: [],
              deleted: false,
              filters: {},
            },
            { status: 201 }
          );
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });

      const cohortsApi = new CohortsApi(client);
      const stats = new SyncStats();

      // First cohort fails
      try {
        await cohortsApi.createOrUpdate({
          name: 'Failing Cohort',
          description: 'This will fail',
        });
        stats.record('created');
      } catch {
        stats.recordError();
      }

      // Second cohort succeeds
      try {
        const result = await cohortsApi.createOrUpdate({
          name: 'Success Cohort',
          description: 'This will succeed',
        });
        stats.record(result.operation);
      } catch {
        stats.recordError();
      }

      expect(cohort1Calls).toBe(1);
      expect(cohort2Calls).toBe(1);
      expect(stats.toSummary().errors).toBe(1);
      expect(stats.toSummary().created).toBe(1);
    });
  });

  describe('deep equality comparison', () => {
    it('should correctly compare primitive values', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual('test', 'other')).toBe(false);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should correctly compare arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('should correctly compare nested objects', () => {
      const obj1 = { a: 1, b: { c: 2, d: [1, 2] } };
      const obj2 = { a: 1, b: { c: 2, d: [1, 2] } };
      const obj3 = { a: 1, b: { c: 3, d: [1, 2] } };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should identify changed fields correctly', () => {
      const existing = {
        name: 'Test',
        description: 'Original',
        pinned: false,
        tags: ['tag1'],
      };

      const desired = {
        name: 'Test',
        description: 'Updated',
        pinned: true,
      };

      const changed = getChangedFields(existing, desired);

      expect(changed).toContain('description');
      expect(changed).toContain('pinned');
      expect(changed).not.toContain('name');
      expect(changed).not.toContain('tags'); // Not in desired, so not compared
    });
  });

  describe('dry-run verbose output', () => {
    it('should log detailed information in verbose dry-run mode without API calls', async () => {
      let apiCalled = false;

      server.use(
        http.get(`${BASE_URL}/insights/`, () => {
          apiCalled = true;
          return HttpResponse.json({
            count: 0,
            next: null,
            previous: null,
            results: [],
          });
        }),
        http.post(`${BASE_URL}/insights/`, () => {
          apiCalled = true;
          return HttpResponse.json({}, { status: 201 });
        })
      );

      const logger = createLogger({ verbose: true, dryRun: true });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: true,
      });

      const insightsApi = new InsightsApi(client);
      const result = await insightsApi.createOrUpdate({
        name: 'Verbose Test Insight',
        description: 'Testing verbose dry-run mode',
      });

      // Verify no API calls were made
      expect(apiCalled).toBe(false);

      // In dry-run mode, it should report as created (simulated)
      expect(result.operation).toBe('created');
    });
  });
});
