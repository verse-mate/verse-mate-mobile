/**
 * Idempotent Operation Helpers
 *
 * Utilities for implementing idempotent create/update operations.
 * These helpers enable safe re-running of the setup script without
 * creating duplicate resources.
 */

import type { Logger } from './logger';

/**
 * Result of a find-or-create operation
 */
export interface FindOrCreateResult<T> {
  /** The resource (existing or newly created) */
  resource: T;
  /** Whether the resource was created (true) or found existing (false) */
  created: boolean;
}

/**
 * Result of an update-if-changed operation
 */
export interface UpdateIfChangedResult<T> {
  /** The resource (updated or unchanged) */
  resource: T;
  /** Whether the resource was updated */
  updated: boolean;
  /** Fields that were changed (if updated) */
  changedFields?: string[];
}

/**
 * Result of a sync operation (find-or-create + update-if-changed)
 */
export type SyncResult<T> = {
  /** The final resource state */
  resource: T;
  /** Operation that was performed */
  operation: 'created' | 'updated' | 'unchanged';
  /** Fields that were changed (if updated) */
  changedFields?: string[];
};

/**
 * Options for idempotent operations
 */
export interface IdempotentOptions {
  /** Logger instance */
  logger: Logger;
  /** Run in dry-run mode */
  dryRun: boolean;
}

/**
 * Generic find-or-create function type
 */
export type FindFunction<T> = () => Promise<T | null>;
export type CreateFunction<T> = () => Promise<T>;

/**
 * Find an existing resource or create a new one
 *
 * @param find Function to find an existing resource (returns null if not found)
 * @param create Function to create a new resource
 * @param resourceName Human-readable name for logging
 * @param options Idempotent operation options
 * @returns The resource and whether it was created
 */
export async function findOrCreate<T>(
  find: FindFunction<T>,
  create: CreateFunction<T>,
  resourceName: string,
  options: IdempotentOptions
): Promise<FindOrCreateResult<T>> {
  const { logger, dryRun } = options;

  // Try to find existing resource
  logger.debug(`Looking for existing resource: ${resourceName}`);
  const existing = await find();

  if (existing) {
    logger.debug(`Found existing resource: ${resourceName}`);
    return { resource: existing, created: false };
  }

  // Create new resource
  if (dryRun) {
    logger.creating('resource', resourceName);
    // In dry-run mode, return a placeholder
    return { resource: {} as T, created: true };
  }

  logger.creating('resource', resourceName);
  const created = await create();
  return { resource: created, created: true };
}

/**
 * Deep comparison options
 */
export interface CompareOptions {
  /** Fields to ignore during comparison */
  ignoreFields?: string[];
  /** Only compare these specific fields */
  onlyFields?: string[];
}

/**
 * Compare two objects and return the list of changed fields
 *
 * @param existing The existing object
 * @param desired The desired object state
 * @param options Comparison options
 * @returns Array of changed field names, empty if objects are equivalent
 */
export function getChangedFields<T extends Record<string, unknown>>(
  existing: T,
  desired: Partial<T>,
  options: CompareOptions = {}
): string[] {
  const { ignoreFields = [], onlyFields } = options;
  const changedFields: string[] = [];

  const fieldsToCheck = onlyFields || Object.keys(desired);

  for (const field of fieldsToCheck) {
    if (ignoreFields.includes(field)) {
      continue;
    }

    const existingValue = existing[field];
    const desiredValue = desired[field];

    // Skip undefined desired values
    if (desiredValue === undefined) {
      continue;
    }

    // Deep comparison for objects and arrays
    if (!deepEqual(existingValue, desiredValue)) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

/**
 * Deep equality check for two values
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Primitive comparison
  if (a === b) {
    return true;
  }

  // Null/undefined check
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  // Type check
  if (typeof a !== typeof b) {
    return false;
  }

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Object comparison
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Update a resource if any fields have changed
 *
 * @param existing The existing resource
 * @param desired The desired resource state
 * @param updateFn Function to update the resource
 * @param resourceName Human-readable name for logging
 * @param options Idempotent operation options
 * @param compareOptions Comparison options
 * @returns The resource and whether it was updated
 */
export async function updateIfChanged<T extends Record<string, unknown>>(
  existing: T,
  desired: Partial<T>,
  updateFn: (updates: Partial<T>) => Promise<T>,
  resourceName: string,
  options: IdempotentOptions,
  compareOptions: CompareOptions = {}
): Promise<UpdateIfChangedResult<T>> {
  const { logger, dryRun } = options;

  const changedFields = getChangedFields(existing, desired, compareOptions);

  if (changedFields.length === 0) {
    logger.unchanged('resource', resourceName);
    return { resource: existing, updated: false };
  }

  logger.debug(`Fields to update for ${resourceName}: ${changedFields.join(', ')}`);

  if (dryRun) {
    logger.updating('resource', resourceName);
    return { resource: existing, updated: true, changedFields };
  }

  logger.updating('resource', resourceName);
  const updated = await updateFn(desired);
  return { resource: updated, updated: true, changedFields };
}

/**
 * Sync a resource: find existing, create if missing, update if changed
 *
 * This combines find-or-create and update-if-changed into a single operation.
 *
 * @param findFn Function to find an existing resource
 * @param createFn Function to create a new resource
 * @param updateFn Function to update an existing resource
 * @param desired The desired resource state
 * @param resourceName Human-readable name for logging
 * @param options Idempotent operation options
 * @param compareOptions Comparison options
 * @returns The resource and the operation performed
 */
export async function syncResource<T extends Record<string, unknown>>(
  findFn: FindFunction<T>,
  createFn: CreateFunction<T>,
  updateFn: (updates: Partial<T>) => Promise<T>,
  desired: Partial<T>,
  resourceName: string,
  options: IdempotentOptions,
  compareOptions: CompareOptions = {}
): Promise<SyncResult<T>> {
  const { logger } = options;

  // Try to find existing resource
  logger.debug(`Syncing resource: ${resourceName}`);
  const existing = await findFn();

  if (!existing) {
    // Create new resource
    const { resource, created } = await findOrCreate(findFn, createFn, resourceName, options);

    if (created) {
      return { resource, operation: 'created' };
    }

    // This shouldn't happen, but handle gracefully
    return { resource, operation: 'unchanged' };
  }

  // Update if changed
  const { resource, updated, changedFields } = await updateIfChanged(
    existing,
    desired,
    updateFn,
    resourceName,
    options,
    compareOptions
  );

  return {
    resource,
    operation: updated ? 'updated' : 'unchanged',
    changedFields,
  };
}

/**
 * Statistics tracker for batch operations
 */
export class SyncStats {
  created = 0;
  updated = 0;
  unchanged = 0;
  errors = 0;

  /**
   * Record a sync result
   */
  record(operation: 'created' | 'updated' | 'unchanged'): void {
    this[operation]++;
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errors++;
  }

  /**
   * Get summary object
   */
  toSummary(): { created: number; updated: number; unchanged: number; errors: number } {
    return {
      created: this.created,
      updated: this.updated,
      unchanged: this.unchanged,
      errors: this.errors,
    };
  }

  /**
   * Merge stats from another instance
   */
  merge(other: SyncStats): void {
    this.created += other.created;
    this.updated += other.updated;
    this.unchanged += other.unchanged;
    this.errors += other.errors;
  }
}
