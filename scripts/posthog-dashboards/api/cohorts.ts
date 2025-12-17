/**
 * PostHog Cohort API Operations
 *
 * CRUD operations for PostHog cohorts with idempotent helpers.
 * Cohorts are used to segment users based on behavior or properties.
 */

import type { PostHogApiClient } from './client';
import type { PostHogCohort, PostHogCohortInput } from './types';

/**
 * Cohorts API client
 */
export class CohortsApi {
  constructor(private readonly client: PostHogApiClient) {}

  /**
   * List all cohorts in the project
   */
  async list(): Promise<PostHogCohort[]> {
    return this.client.getAllPaginated<PostHogCohort>('/cohorts/');
  }

  /**
   * Get a single cohort by ID
   */
  async get(id: number): Promise<PostHogCohort> {
    const response = await this.client.get<PostHogCohort>(`/cohorts/${id}/`);
    return response.data;
  }

  /**
   * Create a new cohort
   */
  async create(input: PostHogCohortInput): Promise<PostHogCohort> {
    const response = await this.client.post<PostHogCohort>('/cohorts/', input);
    return response.data;
  }

  /**
   * Update an existing cohort
   */
  async update(id: number, input: Partial<PostHogCohortInput>): Promise<PostHogCohort> {
    const response = await this.client.patch<PostHogCohort>(`/cohorts/${id}/`, input);
    return response.data;
  }

  /**
   * Delete a cohort
   */
  async delete(id: number): Promise<void> {
    await this.client.delete(`/cohorts/${id}/`);
  }

  /**
   * Find a cohort by name
   *
   * @param name The exact cohort name to search for
   * @returns The cohort if found, null otherwise
   */
  async findByName(name: string): Promise<PostHogCohort | null> {
    const cohorts = await this.list();
    return cohorts.find((c) => c.name === name && !c.deleted) ?? null;
  }

  /**
   * Find or create a cohort by name (idempotent)
   *
   * @param input Cohort input with required name
   * @returns The existing or newly created cohort
   */
  async findOrCreate(
    input: PostHogCohortInput
  ): Promise<{ cohort: PostHogCohort; created: boolean }> {
    const existing = await this.findByName(input.name);

    if (existing) {
      return { cohort: existing, created: false };
    }

    const created = await this.create(input);
    return { cohort: created, created: true };
  }

  /**
   * Create or update a cohort by name (idempotent)
   *
   * This finds an existing cohort by name and updates it if changed,
   * or creates a new one if it doesn't exist.
   *
   * @param input Cohort input with required name
   * @returns The cohort and operation performed
   */
  async createOrUpdate(
    input: PostHogCohortInput
  ): Promise<{ cohort: PostHogCohort; operation: 'created' | 'updated' | 'unchanged' }> {
    const existing = await this.findByName(input.name);

    if (!existing) {
      const created = await this.create(input);
      return { cohort: created, operation: 'created' };
    }

    // Check if update is needed by comparing relevant fields
    const needsUpdate =
      (input.description !== undefined && input.description !== existing.description) ||
      (input.groups !== undefined &&
        JSON.stringify(input.groups) !== JSON.stringify(existing.groups)) ||
      (input.filters !== undefined &&
        JSON.stringify(input.filters) !== JSON.stringify(existing.filters));

    if (!needsUpdate) {
      return { cohort: existing, operation: 'unchanged' };
    }

    const updated = await this.update(existing.id, input);
    return { cohort: updated, operation: 'updated' };
  }

  /**
   * Get the size/count of a cohort
   *
   * @param id Cohort ID
   * @returns Number of users in the cohort
   */
  async getCount(id: number): Promise<number | null> {
    const cohort = await this.get(id);
    return cohort.count;
  }

  /**
   * Check if a cohort is currently calculating
   *
   * @param id Cohort ID
   * @returns True if the cohort is being recalculated
   */
  async isCalculating(id: number): Promise<boolean> {
    const cohort = await this.get(id);
    return cohort.is_calculating;
  }
}

/**
 * Create a cohorts API instance
 */
export function createCohortsApi(client: PostHogApiClient): CohortsApi {
  return new CohortsApi(client);
}
