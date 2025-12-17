/**
 * PostHog Insight API Operations
 *
 * CRUD operations for PostHog insights with idempotent helpers.
 * Insights include trends, funnels, retention, and other chart types.
 */

import type { PostHogApiClient } from './client';
import type { PostHogInsight, PostHogInsightInput } from './types';

/**
 * Insights API client
 */
export class InsightsApi {
  constructor(private readonly client: PostHogApiClient) {}

  /**
   * List all insights in the project
   *
   * @param savedOnly If true, only return saved insights
   */
  async list(savedOnly = true): Promise<PostHogInsight[]> {
    const path = savedOnly ? '/insights/?saved=true' : '/insights/';
    return this.client.getAllPaginated<PostHogInsight>(path);
  }

  /**
   * Get a single insight by ID
   */
  async get(id: number): Promise<PostHogInsight> {
    const response = await this.client.get<PostHogInsight>(`/insights/${id}/`);
    return response.data;
  }

  /**
   * Get a single insight by short ID
   */
  async getByShortId(shortId: string): Promise<PostHogInsight> {
    const response = await this.client.get<PostHogInsight>(`/insights/${shortId}/`);
    return response.data;
  }

  /**
   * Create a new insight
   */
  async create(input: PostHogInsightInput): Promise<PostHogInsight> {
    // Ensure saved is true by default for managed insights
    const payload = { saved: true, ...input };
    const response = await this.client.post<PostHogInsight>('/insights/', payload);
    return response.data;
  }

  /**
   * Update an existing insight
   */
  async update(id: number, input: Partial<PostHogInsightInput>): Promise<PostHogInsight> {
    const response = await this.client.patch<PostHogInsight>(`/insights/${id}/`, input);
    return response.data;
  }

  /**
   * Delete an insight
   */
  async delete(id: number): Promise<void> {
    await this.client.delete(`/insights/${id}/`);
  }

  /**
   * Find an insight by name
   *
   * @param name The exact insight name to search for
   * @returns The insight if found, null otherwise
   */
  async findByName(name: string): Promise<PostHogInsight | null> {
    const insights = await this.list();
    return insights.find((i) => i.name === name && !i.deleted) ?? null;
  }

  /**
   * Link an insight to a dashboard
   *
   * @param insightId Insight ID
   * @param dashboardId Dashboard ID to link
   */
  async linkToDashboard(insightId: number, dashboardId: number): Promise<PostHogInsight> {
    const insight = await this.get(insightId);
    const dashboards = [...new Set([...insight.dashboards, dashboardId])];
    return this.update(insightId, { dashboards });
  }

  /**
   * Unlink an insight from a dashboard
   *
   * @param insightId Insight ID
   * @param dashboardId Dashboard ID to unlink
   */
  async unlinkFromDashboard(insightId: number, dashboardId: number): Promise<PostHogInsight> {
    const insight = await this.get(insightId);
    const dashboards = insight.dashboards.filter((id) => id !== dashboardId);
    return this.update(insightId, { dashboards });
  }

  /**
   * Find or create an insight by name (idempotent)
   *
   * @param input Insight input with required name
   * @returns The existing or newly created insight
   */
  async findOrCreate(
    input: PostHogInsightInput
  ): Promise<{ insight: PostHogInsight; created: boolean }> {
    const existing = await this.findByName(input.name);

    if (existing) {
      return { insight: existing, created: false };
    }

    const created = await this.create(input);
    return { insight: created, created: true };
  }

  /**
   * Create or update an insight by name (idempotent)
   *
   * This finds an existing insight by name and updates it if changed,
   * or creates a new one if it doesn't exist.
   *
   * @param input Insight input with required name
   * @returns The insight and operation performed
   */
  async createOrUpdate(
    input: PostHogInsightInput
  ): Promise<{ insight: PostHogInsight; operation: 'created' | 'updated' | 'unchanged' }> {
    const existing = await this.findByName(input.name);

    if (!existing) {
      const created = await this.create(input);
      return { insight: created, operation: 'created' };
    }

    // Check if update is needed by comparing relevant fields
    const needsUpdate =
      (input.description !== undefined && input.description !== existing.description) ||
      (input.filters !== undefined &&
        JSON.stringify(input.filters) !== JSON.stringify(existing.filters)) ||
      (input.query !== undefined && JSON.stringify(input.query) !== JSON.stringify(existing.query));

    if (!needsUpdate) {
      return { insight: existing, operation: 'unchanged' };
    }

    const updated = await this.update(existing.id, input);
    return { insight: updated, operation: 'updated' };
  }

  /**
   * Ensure an insight is linked to specified dashboards
   *
   * @param insightId Insight ID
   * @param dashboardIds Dashboard IDs to ensure linkage
   */
  async ensureDashboardLinks(insightId: number, dashboardIds: number[]): Promise<PostHogInsight> {
    const insight = await this.get(insightId);
    const currentDashboards = new Set(insight.dashboards);
    const _targetDashboards = new Set(dashboardIds);

    // Check if any changes needed
    const hasAllLinks = dashboardIds.every((id) => currentDashboards.has(id));
    if (hasAllLinks) {
      return insight;
    }

    // Add missing dashboard links
    const dashboards = [...new Set([...insight.dashboards, ...dashboardIds])];
    return this.update(insightId, { dashboards });
  }
}

/**
 * Create an insights API instance
 */
export function createInsightsApi(client: PostHogApiClient): InsightsApi {
  return new InsightsApi(client);
}
