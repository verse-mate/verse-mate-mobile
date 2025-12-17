/**
 * PostHog Dashboard Setup Script Tests
 *
 * Focused tests for setup script functionality:
 * - Definition loading and validation
 * - Idempotent execution (create if missing, update if changed)
 * - Dashboard filtering with --dashboard flag
 * - Summary reporting (created X, updated Y, unchanged Z)
 *
 * Note: These tests use mocked API responses and do not make real API calls.
 */

import { HttpResponse, http } from 'msw';
import { server } from '../../../__tests__/mocks/server';
import { createPostHogApiClient } from '../api/client';
import { CohortsApi } from '../api/cohorts';
import { DashboardsApi } from '../api/dashboards';
import { FunnelsApi } from '../api/funnels';
import { InsightsApi } from '../api/insights';
import type { PostHogConfig } from '../config';
import { COHORT_DEFINITIONS } from '../definitions/cohorts';
import { DASHBOARD_DEFINITIONS } from '../definitions/dashboards';
import { FUNNEL_DEFINITIONS } from '../definitions/funnels';
import { INSIGHT_DEFINITIONS } from '../definitions/insights';
import { filterDashboardDefinitions, SetupOrchestrator, validateDefinitions } from '../setup';
import { SyncStats } from '../utils/idempotent';
import { createLogger } from '../utils/logger';

// Test configuration
const testConfig: PostHogConfig = {
  apiKey: 'phx_test_api_key',
  projectId: '12345',
  host: 'https://app.posthog.com',
};

// Base URL for mocking
const BASE_URL = `${testConfig.host}/api/projects/${testConfig.projectId}`;

describe('PostHog Setup Script', () => {
  describe('definition loading and validation', () => {
    it('should load all cohort definitions with required fields', () => {
      expect(COHORT_DEFINITIONS).toBeDefined();
      expect(COHORT_DEFINITIONS.length).toBe(14);

      // Validate each cohort has required fields
      for (const cohort of COHORT_DEFINITIONS) {
        expect(cohort.name).toBeDefined();
        expect(cohort.name).toMatch(/^(Behavioral|Lifecycle|Engagement|Demographic|Social) - /);
        expect(cohort.description).toBeDefined();
        expect(cohort.queryFile).toBeDefined();
      }
    });

    it('should load all insight definitions with required fields', () => {
      expect(INSIGHT_DEFINITIONS).toBeDefined();
      expect(INSIGHT_DEFINITIONS.length).toBe(41);

      // Validate each insight has required fields
      for (const insight of INSIGHT_DEFINITIONS) {
        expect(insight.name).toBeDefined();
        expect(insight.name).toMatch(/^(Trend|Number|Distribution|Table|Pie|Bar|Line) - /);
        expect(insight.description).toBeDefined();
        expect(insight.queryFile).toBeDefined();
        expect(insight.dashboards).toBeDefined();
        expect(insight.dashboards.length).toBeGreaterThan(0);
      }
    });

    it('should load all funnel definitions with required fields', () => {
      expect(FUNNEL_DEFINITIONS).toBeDefined();
      expect(FUNNEL_DEFINITIONS.length).toBe(6);

      // Validate each funnel has required fields
      for (const funnel of FUNNEL_DEFINITIONS) {
        expect(funnel.name).toBeDefined();
        expect(funnel.name).toMatch(/^Funnel - /);
        expect(funnel.description).toBeDefined();
        expect(funnel.steps).toBeDefined();
        expect(funnel.steps.length).toBeGreaterThanOrEqual(2);
        expect(funnel.conversionWindow).toBeDefined();
        expect(funnel.dashboards).toBeDefined();
      }
    });

    it('should load all dashboard definitions with required fields', () => {
      expect(DASHBOARD_DEFINITIONS).toBeDefined();
      expect(DASHBOARD_DEFINITIONS.length).toBe(6);

      // Validate each dashboard has required fields
      for (const dashboard of DASHBOARD_DEFINITIONS) {
        expect(dashboard.name).toBeDefined();
        expect(dashboard.name).toMatch(/^(All|Product|Engineering|Marketing) - /);
        expect(dashboard.description).toBeDefined();
        expect(dashboard.refreshInterval).toBeDefined();
      }

      // Verify specific dashboard names from spec
      const dashboardNames = DASHBOARD_DEFINITIONS.map((d) => d.name);
      expect(dashboardNames).toContain('All - Executive Overview');
      expect(dashboardNames).toContain('Product - User Engagement');
      expect(dashboardNames).toContain('Product - Retention & Growth');
      expect(dashboardNames).toContain('Product - AI Feature Performance');
      expect(dashboardNames).toContain('Engineering - Technical Health');
      expect(dashboardNames).toContain('Marketing - Social & Virality');
    });

    it('should validate definitions and return errors for invalid data', () => {
      const result = validateDefinitions();

      // All definitions should be valid
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('dashboard filtering with --dashboard flag', () => {
    it('should filter definitions to single dashboard when flag provided', () => {
      const filtered = filterDashboardDefinitions(
        DASHBOARD_DEFINITIONS,
        'All - Executive Overview'
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('All - Executive Overview');
    });

    it('should return all dashboards when no filter provided', () => {
      const filtered = filterDashboardDefinitions(DASHBOARD_DEFINITIONS, undefined);

      expect(filtered).toHaveLength(6);
    });

    it('should return empty array for non-existent dashboard filter', () => {
      const filtered = filterDashboardDefinitions(DASHBOARD_DEFINITIONS, 'Non-Existent Dashboard');

      expect(filtered).toHaveLength(0);
    });
  });

  describe('idempotent execution', () => {
    it('should create resources when not found and report created count', async () => {
      // Mock empty responses for list endpoints
      server.use(
        http.get(`${BASE_URL}/cohorts/`, () => {
          return HttpResponse.json({
            count: 0,
            next: null,
            previous: null,
            results: [],
          });
        }),
        http.post(`${BASE_URL}/cohorts/`, () => {
          return HttpResponse.json(
            {
              id: 1,
              name: 'Behavioral - Power Users',
              description: 'Test',
              groups: [],
              deleted: false,
              filters: {},
              query: null,
              is_calculating: false,
              created_at: '2024-01-01T00:00:00Z',
              created_by: null,
              last_calculation: null,
              errors_calculating: 0,
              count: null,
              is_static: false,
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

      const result = await cohortsApi.createOrUpdate({
        name: 'Behavioral - Power Users',
        description: 'Test',
      });

      expect(result.operation).toBe('created');
    });

    it('should not update resources when unchanged and report unchanged count', async () => {
      const existingDashboard = {
        id: 1,
        name: 'All - Executive Overview',
        description: 'High-level metrics for executives',
        pinned: true,
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

      server.use(
        http.get(`${BASE_URL}/dashboards/`, () => {
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [existingDashboard],
          });
        })
      );

      const logger = createLogger({ verbose: false, dryRun: false });
      const client = createPostHogApiClient({
        config: testConfig,
        logger,
        dryRun: false,
      });
      const dashboardsApi = new DashboardsApi(client);

      const result = await dashboardsApi.createOrUpdate({
        name: 'All - Executive Overview',
        description: 'High-level metrics for executives', // Same description
        pinned: true, // Same pinned status
      });

      expect(result.operation).toBe('unchanged');
    });
  });

  describe('summary reporting', () => {
    it('should track created, updated, and unchanged counts correctly', () => {
      const stats = new SyncStats();

      stats.record('created');
      stats.record('created');
      stats.record('updated');
      stats.record('unchanged');
      stats.record('unchanged');
      stats.record('unchanged');

      const summary = stats.toSummary();

      expect(summary.created).toBe(2);
      expect(summary.updated).toBe(1);
      expect(summary.unchanged).toBe(3);
      expect(summary.errors).toBe(0);
    });

    it('should track errors separately', () => {
      const stats = new SyncStats();

      stats.record('created');
      stats.recordError();
      stats.recordError();

      const summary = stats.toSummary();

      expect(summary.created).toBe(1);
      expect(summary.errors).toBe(2);
    });

    it('should merge stats from multiple sources', () => {
      const cohortStats = new SyncStats();
      cohortStats.record('created');
      cohortStats.record('created');

      const insightStats = new SyncStats();
      insightStats.record('updated');
      insightStats.record('unchanged');

      const totalStats = new SyncStats();
      totalStats.merge(cohortStats);
      totalStats.merge(insightStats);

      const summary = totalStats.toSummary();

      expect(summary.created).toBe(2);
      expect(summary.updated).toBe(1);
      expect(summary.unchanged).toBe(1);
    });
  });
});
