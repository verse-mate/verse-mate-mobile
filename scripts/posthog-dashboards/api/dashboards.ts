/**
 * PostHog Dashboard API Operations
 *
 * CRUD operations for PostHog dashboards with idempotent helpers.
 */

import type { PostHogApiClient } from './client';
import type { PostHogDashboard, PostHogDashboardInput, PostHogDashboardTile } from './types';

/**
 * Dashboard API client
 */
export class DashboardsApi {
  constructor(private readonly client: PostHogApiClient) {}

  /**
   * List all dashboards in the project
   */
  async list(): Promise<PostHogDashboard[]> {
    return this.client.getAllPaginated<PostHogDashboard>('/dashboards/');
  }

  /**
   * Get a single dashboard by ID
   */
  async get(id: number): Promise<PostHogDashboard> {
    const response = await this.client.get<PostHogDashboard>(`/dashboards/${id}/`);
    return response.data;
  }

  /**
   * Create a new dashboard
   */
  async create(input: PostHogDashboardInput): Promise<PostHogDashboard> {
    const response = await this.client.post<PostHogDashboard>('/dashboards/', input);
    return response.data;
  }

  /**
   * Update an existing dashboard
   */
  async update(id: number, input: Partial<PostHogDashboardInput>): Promise<PostHogDashboard> {
    const response = await this.client.patch<PostHogDashboard>(`/dashboards/${id}/`, input);
    return response.data;
  }

  /**
   * Delete a dashboard
   */
  async delete(id: number): Promise<void> {
    await this.client.delete(`/dashboards/${id}/`);
  }

  /**
   * Find a dashboard by name
   *
   * @param name The exact dashboard name to search for
   * @returns The dashboard if found, null otherwise
   */
  async findByName(name: string): Promise<PostHogDashboard | null> {
    const dashboards = await this.list();
    return dashboards.find((d) => d.name === name && !d.deleted) ?? null;
  }

  /**
   * Add an insight to a dashboard
   *
   * @param dashboardId Dashboard ID
   * @param insightId Insight ID to add
   * @param layout Optional layout configuration
   */
  async addInsight(
    dashboardId: number,
    insightId: number,
    layout?: { x: number; y: number; w: number; h: number }
  ): Promise<PostHogDashboardTile> {
    const body: Record<string, unknown> = { insight: insightId };
    if (layout) {
      body.layouts = { sm: layout, xs: layout };
    }
    const response = await this.client.post<PostHogDashboardTile>(
      `/dashboards/${dashboardId}/tiles/`,
      body
    );
    return response.data;
  }

  /**
   * Remove an insight from a dashboard
   *
   * @param dashboardId Dashboard ID
   * @param tileId Tile ID to remove
   */
  async removeInsight(dashboardId: number, tileId: number): Promise<void> {
    await this.client.delete(`/dashboards/${dashboardId}/tiles/${tileId}/`);
  }

  /**
   * Find or create a dashboard by name (idempotent)
   *
   * @param input Dashboard input with required name
   * @returns The existing or newly created dashboard
   */
  async findOrCreate(
    input: PostHogDashboardInput
  ): Promise<{ dashboard: PostHogDashboard; created: boolean }> {
    const existing = await this.findByName(input.name);

    if (existing) {
      return { dashboard: existing, created: false };
    }

    const created = await this.create(input);
    return { dashboard: created, created: true };
  }

  /**
   * Create or update a dashboard by name (idempotent)
   *
   * This finds an existing dashboard by name and updates it if changed,
   * or creates a new one if it doesn't exist.
   *
   * @param input Dashboard input with required name
   * @returns The dashboard and operation performed
   */
  async createOrUpdate(
    input: PostHogDashboardInput
  ): Promise<{ dashboard: PostHogDashboard; operation: 'created' | 'updated' | 'unchanged' }> {
    const existing = await this.findByName(input.name);

    if (!existing) {
      const created = await this.create(input);
      return { dashboard: created, operation: 'created' };
    }

    // Check if update is needed
    const needsUpdate =
      (input.description !== undefined && input.description !== existing.description) ||
      (input.pinned !== undefined && input.pinned !== existing.pinned);

    if (!needsUpdate) {
      return { dashboard: existing, operation: 'unchanged' };
    }

    const updated = await this.update(existing.id, input);
    return { dashboard: updated, operation: 'updated' };
  }
}

/**
 * Create a dashboards API instance
 */
export function createDashboardsApi(client: PostHogApiClient): DashboardsApi {
  return new DashboardsApi(client);
}
