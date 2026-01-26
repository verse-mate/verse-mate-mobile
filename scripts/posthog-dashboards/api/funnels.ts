/**
 * PostHog Funnel API Operations
 *
 * Funnels are a type of insight in PostHog that track user progression
 * through a series of steps/events. This module provides helpers for
 * creating and managing funnel insights.
 */

import type { PostHogApiClient } from './client';
import { InsightsApi } from './insights';
import type {
  PostHogFunnelExclusion,
  PostHogInsight,
  PostHogInsightEvent,
  PostHogInsightFilters,
  PostHogInsightInput,
} from './types';

/**
 * Funnel step definition
 */
export interface FunnelStep {
  /** Event name (from AnalyticsEvent enum) */
  event: string;
  /** Custom display name for this step */
  name?: string;
  /** Optional property filters for this step */
  properties?: {
    key: string;
    value: string | number | boolean | string[];
    operator: string;
    type: string;
  }[];
}

/**
 * Funnel configuration
 */
export interface FunnelConfig {
  /** Funnel name */
  name: string;
  /** Funnel description */
  description?: string;
  /** Funnel steps in order */
  steps: FunnelStep[];
  /** Time window for funnel conversion */
  conversionWindow?: {
    value: number;
    unit: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  /** Funnel ordering type */
  orderType?: 'strict' | 'unordered' | 'ordered';
  /** Visualization type */
  vizType?: 'steps' | 'time_to_convert' | 'trends';
  /** Dashboard IDs to link this funnel to */
  dashboards?: number[];
  /** Exclusion steps */
  exclusions?: PostHogFunnelExclusion[];
  /** Tags */
  tags?: string[];
}

/**
 * Funnels API client
 *
 * Extends the InsightsApi to provide funnel-specific functionality.
 */
export class FunnelsApi {
  private readonly insightsApi: InsightsApi;

  constructor(readonly client: PostHogApiClient) {
    this.insightsApi = new InsightsApi(client);
  }

  /**
   * List all funnel insights in the project
   */
  async list(): Promise<PostHogInsight[]> {
    const insights = await this.insightsApi.list();
    // Filter to only funnel insights
    return insights.filter(
      (i) => i.filters?.insight === 'FUNNELS' || i.query?.kind === 'FunnelsQuery'
    );
  }

  /**
   * Get a single funnel by ID
   */
  async get(id: number): Promise<PostHogInsight> {
    return this.insightsApi.get(id);
  }

  /**
   * Build funnel events array from steps
   */
  private buildFunnelEvents(steps: FunnelStep[]): PostHogInsightEvent[] {
    return steps.map((step, index) => ({
      id: step.event,
      name: step.name || step.event,
      type: 'events' as const,
      order: index,
      properties: step.properties?.map((p) => ({
        key: p.key,
        value: p.value,
        operator: p.operator as 'exact' | 'is_not' | 'icontains' | 'gt' | 'gte' | 'lt' | 'lte',
        type: p.type as
          | 'event'
          | 'person'
          | 'element'
          | 'session'
          | 'cohort'
          | 'recording'
          | 'group'
          | 'hogql',
      })),
    }));
  }

  /**
   * Build funnel filters from config
   */
  private buildFunnelFilters(config: FunnelConfig): PostHogInsightFilters {
    const filters: PostHogInsightFilters = {
      insight: 'FUNNELS',
      events: this.buildFunnelEvents(config.steps),
      filter_test_accounts: true,
      funnel_order_type: config.orderType || 'ordered',
      funnel_viz_type: config.vizType || 'steps',
      date_from: '-7d',
    };

    // Add conversion window
    if (config.conversionWindow) {
      filters.funnel_window_interval = config.conversionWindow.value;
      filters.funnel_window_interval_unit = config.conversionWindow.unit;
    }

    // Add exclusions
    if (config.exclusions && config.exclusions.length > 0) {
      filters.exclusions = config.exclusions;
    }

    return filters;
  }

  /**
   * Create a new funnel insight
   *
   * @param config Funnel configuration
   * @returns Created funnel insight
   */
  async create(config: FunnelConfig): Promise<PostHogInsight> {
    const input: PostHogInsightInput = {
      name: config.name,
      description: config.description,
      filters: this.buildFunnelFilters(config),
      dashboards: config.dashboards,
      tags: config.tags,
      saved: true,
    };

    return this.insightsApi.create(input);
  }

  /**
   * Update an existing funnel insight
   *
   * @param id Funnel insight ID
   * @param config Funnel configuration updates
   */
  async update(id: number, config: Partial<FunnelConfig>): Promise<PostHogInsight> {
    const input: Partial<PostHogInsightInput> = {};

    if (config.name) {
      input.name = config.name;
    }

    if (config.description !== undefined) {
      input.description = config.description;
    }

    if (config.steps) {
      input.filters = this.buildFunnelFilters(config as FunnelConfig);
    }

    if (config.dashboards) {
      input.dashboards = config.dashboards;
    }

    if (config.tags) {
      input.tags = config.tags;
    }

    return this.insightsApi.update(id, input);
  }

  /**
   * Delete a funnel insight
   */
  async delete(id: number): Promise<void> {
    return this.insightsApi.delete(id);
  }

  /**
   * Find a funnel by name
   *
   * @param name The exact funnel name to search for
   * @returns The funnel if found, null otherwise
   */
  async findByName(name: string): Promise<PostHogInsight | null> {
    const funnels = await this.list();
    return funnels.find((f) => f.name === name && !f.deleted) ?? null;
  }

  /**
   * Find or create a funnel by name (idempotent)
   *
   * @param config Funnel configuration with required name
   * @returns The existing or newly created funnel
   */
  async findOrCreate(config: FunnelConfig): Promise<{ funnel: PostHogInsight; created: boolean }> {
    const existing = await this.findByName(config.name);

    if (existing) {
      return { funnel: existing, created: false };
    }

    const created = await this.create(config);
    return { funnel: created, created: true };
  }

  /**
   * Create or update a funnel by name (idempotent)
   *
   * This finds an existing funnel by name and updates it if changed,
   * or creates a new one if it doesn't exist.
   *
   * @param config Funnel configuration with required name
   * @returns The funnel and operation performed
   */
  async createOrUpdate(
    config: FunnelConfig
  ): Promise<{ funnel: PostHogInsight; operation: 'created' | 'updated' | 'unchanged' }> {
    const existing = await this.findByName(config.name);

    if (!existing) {
      const created = await this.create(config);
      return { funnel: created, operation: 'created' };
    }

    // Build expected filters to compare
    const expectedFilters = this.buildFunnelFilters(config);

    // Check if update is needed
    const needsUpdate =
      (config.description !== undefined && config.description !== existing.description) ||
      JSON.stringify(expectedFilters) !== JSON.stringify(existing.filters);

    if (!needsUpdate) {
      return { funnel: existing, operation: 'unchanged' };
    }

    const updated = await this.update(existing.id, config);
    return { funnel: updated, operation: 'updated' };
  }

  /**
   * Link a funnel to a dashboard
   */
  async linkToDashboard(funnelId: number, dashboardId: number): Promise<PostHogInsight> {
    return this.insightsApi.linkToDashboard(funnelId, dashboardId);
  }

  /**
   * Get conversion rates for a funnel
   *
   * Note: This returns the cached results from the funnel insight.
   * For fresh data, the funnel should be refreshed first.
   *
   * @param id Funnel insight ID
   * @returns The funnel result data (may be null if not yet calculated)
   */
  async getConversionRates(id: number): Promise<unknown> {
    const funnel = await this.get(id);
    return funnel.result;
  }
}

/**
 * Create a funnels API instance
 */
export function createFunnelsApi(client: PostHogApiClient): FunnelsApi {
  return new FunnelsApi(client);
}
