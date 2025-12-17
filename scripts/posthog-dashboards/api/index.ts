/**
 * PostHog API Module Index
 *
 * Exports all API client functionality for PostHog dashboard management.
 */

// Import for local use
import type { PostHogClientOptions } from './client';
import { createPostHogApiClient } from './client';
import { CohortsApi } from './cohorts';
import { DashboardsApi } from './dashboards';
import { FunnelsApi } from './funnels';
import { InsightsApi } from './insights';

export type { ApiResponse, HttpMethod, PaginatedResponse, PostHogClientOptions } from './client';
// Client
export { createPostHogApiClient, PostHogApiClient, PostHogApiClientError } from './client';
// Cohort operations
export { CohortsApi, createCohortsApi } from './cohorts';

// Dashboard operations
export { createDashboardsApi, DashboardsApi } from './dashboards';
export type { FunnelConfig, FunnelStep } from './funnels';
// Funnel operations
export { createFunnelsApi, FunnelsApi } from './funnels';
// Insight operations
export { createInsightsApi, InsightsApi } from './insights';
// Types
export type {
  PostHogCohort,
  PostHogCohortFilters,
  PostHogCohortGroup,
  PostHogCohortInput,
  PostHogCohortProperty,
  PostHogDashboard,
  PostHogDashboardInput,
  PostHogDashboardText,
  PostHogDashboardTile,
  PostHogFunnelExclusion,
  PostHogInsight,
  PostHogInsightAction,
  PostHogInsightEvent,
  PostHogInsightFilters,
  PostHogInsightInput,
  PostHogInsightQuery,
  PostHogPropertyFilter,
  PostHogTileLayout,
  PostHogUser,
} from './types';

/**
 * Combined API client with all resource types
 */
export interface PostHogApi {
  dashboards: import('./dashboards').DashboardsApi;
  insights: import('./insights').InsightsApi;
  cohorts: import('./cohorts').CohortsApi;
  funnels: import('./funnels').FunnelsApi;
}

/**
 * Create a combined PostHog API client with all resource APIs
 *
 * @param options Client options
 * @returns Combined API client
 */
export function createPostHogApi(options: PostHogClientOptions): PostHogApi {
  const client = createPostHogApiClient(options);
  return {
    dashboards: new DashboardsApi(client),
    insights: new InsightsApi(client),
    cohorts: new CohortsApi(client),
    funnels: new FunnelsApi(client),
  };
}
