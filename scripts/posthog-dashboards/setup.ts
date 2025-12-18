/**
 * PostHog Dashboard Setup Script
 *
 * Main entry point for creating/updating PostHog dashboards, insights,
 * cohorts, and funnels. Implements idempotent execution for safe re-runs.
 *
 * Usage:
 *   npx ts-node scripts/posthog-dashboards/setup.ts [options]
 *
 * Options:
 *   --dry-run, -n          Preview changes without making API calls
 *   --verbose, -v          Enable verbose logging
 *   --dashboard=NAME       Create/update only the specified dashboard
 *   --help, -h             Show help message
 *
 * Environment Variables:
 *   POSTHOG_API_KEY        PostHog personal API key (required)
 *   POSTHOG_PROJECT_ID     PostHog project ID (required)
 *   POSTHOG_HOST           PostHog instance URL (optional, defaults to cloud)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPostHogApiClient, type PostHogApiClient } from './api/client';
import { CohortsApi } from './api/cohorts';
import { DashboardsApi } from './api/dashboards';
import { type FunnelConfig, FunnelsApi } from './api/funnels';
import { InsightsApi } from './api/insights';
import type { PostHogCohortInput, PostHogDashboardInput, PostHogInsightInput } from './api/types';
import {
  type ExecutionOptions,
  getConfigForExecution,
  type PostHogConfig,
  parseExecutionOptions,
} from './config';
import { COHORT_DEFINITIONS, type CohortDefinition } from './definitions/cohorts';
import { DASHBOARD_DEFINITIONS, type DashboardDefinition } from './definitions/dashboards';
import {
  FUNNEL_DEFINITIONS,
  type FunnelDefinition,
  getFunnelsForDashboard,
} from './definitions/funnels';
import {
  type DashboardId,
  getInsightsForDashboard,
  INSIGHT_DEFINITIONS,
  type InsightDefinition,
} from './definitions/insights';
import { SyncStats } from './utils/idempotent';
import { createLogger, type Logger } from './utils/logger';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate all definitions for required fields and naming conventions
 */
export function validateDefinitions(): ValidationResult {
  const errors: string[] = [];

  // Validate cohorts
  for (const cohort of COHORT_DEFINITIONS) {
    if (!cohort.name.match(/^(Behavioral|Lifecycle|Engagement|Demographic|Social) - /)) {
      errors.push(`Cohort "${cohort.name}" does not follow naming convention [Category] - Name`);
    }
    if (!cohort.description) {
      errors.push(`Cohort "${cohort.name}" is missing description`);
    }
    if (!cohort.queryFile) {
      errors.push(`Cohort "${cohort.name}" is missing queryFile`);
    }
  }

  // Validate insights
  for (const insight of INSIGHT_DEFINITIONS) {
    if (!insight.name.match(/^(Trend|Number|Distribution|Table|Pie|Bar|Line) - /)) {
      errors.push(`Insight "${insight.name}" does not follow naming convention [Type] - Name`);
    }
    if (!insight.description) {
      errors.push(`Insight "${insight.name}" is missing description`);
    }
    if (!insight.queryFile) {
      errors.push(`Insight "${insight.name}" is missing queryFile`);
    }
    if (!insight.dashboards || insight.dashboards.length === 0) {
      errors.push(`Insight "${insight.name}" is not assigned to any dashboard`);
    }
  }

  // Validate funnels
  for (const funnel of FUNNEL_DEFINITIONS) {
    if (!funnel.name.match(/^Funnel - /)) {
      errors.push(`Funnel "${funnel.name}" does not follow naming convention Funnel - Name`);
    }
    if (!funnel.description) {
      errors.push(`Funnel "${funnel.name}" is missing description`);
    }
    if (!funnel.steps || funnel.steps.length < 2) {
      errors.push(`Funnel "${funnel.name}" must have at least 2 steps`);
    }
    if (!funnel.conversionWindow) {
      errors.push(`Funnel "${funnel.name}" is missing conversionWindow`);
    }
  }

  // Validate dashboards
  for (const dashboard of DASHBOARD_DEFINITIONS) {
    if (!dashboard.name.match(/^(All|Product|Engineering|Marketing) - /)) {
      errors.push(`Dashboard "${dashboard.name}" does not follow naming convention [Team] - Name`);
    }
    if (!dashboard.description) {
      errors.push(`Dashboard "${dashboard.name}" is missing description`);
    }
    if (!dashboard.refreshInterval) {
      errors.push(`Dashboard "${dashboard.name}" is missing refreshInterval`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Filter dashboard definitions based on --dashboard flag
 */
export function filterDashboardDefinitions(
  dashboards: DashboardDefinition[],
  filter?: string
): DashboardDefinition[] {
  if (!filter) {
    return dashboards;
  }
  return dashboards.filter((d) => d.name === filter);
}

/**
 * Convert cohort definition to PostHog API input
 */
function cohortToInput(definition: CohortDefinition): PostHogCohortInput {
  return {
    name: definition.name,
    description: definition.description,
    is_static: !definition.isDynamic,
    // Note: HogQL query would be loaded from file in production
    // For now, we use the behavioral filter format
  };
}

/**
 * Base path for SQL query files
 */
const QUERIES_BASE_PATH = path.join(__dirname, 'queries', 'insights');

/**
 * Load SQL query from file
 *
 * @param queryFile Path relative to queries/insights/
 * @returns SQL query string
 */
function loadSqlQuery(queryFile: string): string {
  const filePath = path.join(QUERIES_BASE_PATH, queryFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL query file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8').trim();
}

/**
 * Extract the first SQL statement from a file (ignores additional statements)
 *
 * PostHog HogQL only accepts single statements. SQL files may contain multiple
 * queries for documentation, but only the first is used for the insight.
 */
function extractFirstStatement(sql: string): string {
  // Remove SQL comments
  const withoutComments = sql
    .replace(/--.*$/gm, '') // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

  // Split by semicolon and get first non-empty statement
  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    throw new Error('No SQL statement found');
  }

  return statements[0];
}

/**
 * Convert insight definition to PostHog API input
 *
 * Loads the HogQL query from the SQL file and formats it for the PostHog API.
 * Uses DataTableNode with HogQLQuery source for proper visualization support.
 */
function insightToInput(definition: InsightDefinition): PostHogInsightInput {
  // Load the SQL query from file
  const sqlContent = loadSqlQuery(definition.queryFile);

  // Extract first statement (PostHog only accepts single statements)
  const sqlQuery = extractFirstStatement(sqlContent);

  return {
    name: definition.name,
    description: definition.description,
    // Use DataTableNode wrapper for proper insight visualization
    query: {
      kind: 'DataTableNode',
      source: {
        kind: 'HogQLQuery',
        query: sqlQuery,
      },
    },
    saved: true,
  };
}

/**
 * Convert funnel definition to PostHog funnel config
 */
function funnelToConfig(definition: FunnelDefinition): FunnelConfig {
  return {
    name: definition.name,
    description: definition.description,
    steps: definition.steps,
    conversionWindow: definition.conversionWindow,
    orderType: definition.orderType,
    vizType: definition.vizType,
  };
}

/**
 * Convert dashboard definition to PostHog API input
 */
function dashboardToInput(definition: DashboardDefinition): PostHogDashboardInput {
  return {
    name: definition.name,
    description: definition.description,
    pinned: definition.pinned,
    tags: definition.tags,
  };
}

/**
 * Setup orchestrator class
 */
export class SetupOrchestrator {
  private readonly logger: Logger;
  private readonly client: PostHogApiClient;
  private readonly dashboardsApi: DashboardsApi;
  private readonly insightsApi: InsightsApi;
  private readonly cohortsApi: CohortsApi;
  private readonly funnelsApi: FunnelsApi;
  private readonly dryRun: boolean;

  // Track created resource IDs for linking
  private cohortIdMap: Map<string, number> = new Map();
  private insightIdMap: Map<string, number> = new Map();
  private funnelIdMap: Map<string, number> = new Map();
  private dashboardIdMap: Map<string, number> = new Map();

  constructor(config: PostHogConfig, options: ExecutionOptions) {
    this.dryRun = options.dryRun;
    this.logger = createLogger({
      verbose: options.verbose,
      dryRun: options.dryRun,
    });
    this.client = createPostHogApiClient({
      config,
      logger: this.logger,
      dryRun: options.dryRun,
    });
    this.dashboardsApi = new DashboardsApi(this.client);
    this.insightsApi = new InsightsApi(this.client);
    this.cohortsApi = new CohortsApi(this.client);
    this.funnelsApi = new FunnelsApi(this.client);
  }

  /**
   * Sync all cohorts
   */
  async syncCohorts(): Promise<SyncStats> {
    this.logger.section('Syncing Cohorts');
    const stats = new SyncStats();

    for (const definition of COHORT_DEFINITIONS) {
      try {
        const input = cohortToInput(definition);
        const result = await this.cohortsApi.createOrUpdate(input);

        stats.record(result.operation);

        if (result.operation === 'created') {
          this.logger.success(`Created cohort: ${definition.name}`);
        } else if (result.operation === 'updated') {
          this.logger.success(`Updated cohort: ${definition.name}`);
        } else {
          this.logger.unchanged('Cohort', definition.name);
        }

        // Store ID for potential future reference
        if (result.cohort.id) {
          this.cohortIdMap.set(definition.name, result.cohort.id);
        }
      } catch (error) {
        stats.recordError();
        this.logger.error(
          `Failed to sync cohort "${definition.name}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return stats;
  }

  /**
   * Sync insights for specified dashboards
   */
  async syncInsights(dashboardIds: DashboardId[]): Promise<SyncStats> {
    this.logger.section('Syncing Insights');
    const stats = new SyncStats();

    // Get unique insights for the selected dashboards
    const insightsToSync = new Set<InsightDefinition>();
    for (const dashboardId of dashboardIds) {
      const insights = getInsightsForDashboard(dashboardId);
      for (const insight of insights) {
        insightsToSync.add(insight);
      }
    }

    for (const definition of insightsToSync) {
      try {
        this.logger.debug(`Loading SQL from: queries/insights/${definition.queryFile}`);
        const input = insightToInput(definition);

        // Log the query structure being sent
        this.logger.debug(
          `Query format: ${input.query?.kind} > ${(input.query as any)?.source?.kind}`
        );
        const queryPreview = (input.query as any)?.source?.query?.slice(0, 100) || '';
        this.logger.debug(`Query preview: ${queryPreview.replace(/\n/g, ' ')}...`);

        const result = await this.insightsApi.createOrUpdate(input);

        stats.record(result.operation);

        if (result.operation === 'created') {
          this.logger.success(`Created insight: ${definition.name}`);
          this.logger.info(
            `  → New insight ID: ${result.insight.id}, short_id: ${result.insight.short_id}`
          );
        } else if (result.operation === 'updated') {
          this.logger.success(`Updated insight: ${definition.name}`);
          this.logger.info(
            `  → Insight ID: ${result.insight.id}, short_id: ${result.insight.short_id}`
          );
        } else {
          this.logger.unchanged('Insight', definition.name);
        }

        // Store ID for dashboard linking
        if (result.insight.id) {
          this.insightIdMap.set(definition.name, result.insight.id);
        }
      } catch (error) {
        stats.recordError();
        this.logger.error(
          `Failed to sync insight "${definition.name}": ${error instanceof Error ? error.message : String(error)}`
        );
        // Log more details for debugging
        if (error instanceof Error && 'apiError' in error) {
          this.logger.error(`  → API Error: ${JSON.stringify((error as any).apiError)}`);
        }
      }
    }

    return stats;
  }

  /**
   * Sync funnels for specified dashboards
   */
  async syncFunnels(dashboardIds: DashboardId[]): Promise<SyncStats> {
    this.logger.section('Syncing Funnels');
    const stats = new SyncStats();

    // Get unique funnels for the selected dashboards
    const funnelsToSync = new Set<FunnelDefinition>();
    for (const dashboardId of dashboardIds) {
      const funnels = getFunnelsForDashboard(dashboardId);
      for (const funnel of funnels) {
        funnelsToSync.add(funnel);
      }
    }

    for (const definition of funnelsToSync) {
      try {
        const config = funnelToConfig(definition);
        const result = await this.funnelsApi.createOrUpdate(config);

        stats.record(result.operation);

        if (result.operation === 'created') {
          this.logger.success(`Created funnel: ${definition.name}`);
        } else if (result.operation === 'updated') {
          this.logger.success(`Updated funnel: ${definition.name}`);
        } else {
          this.logger.unchanged('Funnel', definition.name);
        }

        // Store ID for dashboard linking
        if (result.funnel.id) {
          this.funnelIdMap.set(definition.name, result.funnel.id);
        }
      } catch (error) {
        stats.recordError();
        this.logger.error(
          `Failed to sync funnel "${definition.name}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return stats;
  }

  /**
   * Sync dashboards
   */
  async syncDashboards(dashboards: DashboardDefinition[]): Promise<SyncStats> {
    this.logger.section('Syncing Dashboards');
    const stats = new SyncStats();

    for (const definition of dashboards) {
      try {
        const input = dashboardToInput(definition);
        const result = await this.dashboardsApi.createOrUpdate(input);

        stats.record(result.operation);

        if (result.operation === 'created') {
          this.logger.success(`Created dashboard: ${definition.name}`);
        } else if (result.operation === 'updated') {
          this.logger.success(`Updated dashboard: ${definition.name}`);
        } else {
          this.logger.unchanged('Dashboard', definition.name);
        }

        // Store ID for insight linking
        if (result.dashboard.id) {
          this.dashboardIdMap.set(definition.name, result.dashboard.id);
        }
      } catch (error) {
        stats.recordError();
        this.logger.error(
          `Failed to sync dashboard "${definition.name}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return stats;
  }

  /**
   * Link insights to their dashboards
   */
  async linkInsightsToDashboards(dashboards: DashboardDefinition[]): Promise<void> {
    this.logger.section('Linking Insights to Dashboards');

    for (const dashboard of dashboards) {
      const dashboardId = this.dashboardIdMap.get(dashboard.name);
      if (!dashboardId && !this.dryRun) {
        this.logger.warn(`Dashboard ID not found for "${dashboard.name}", skipping linking`);
        continue;
      }

      // Get insights for this dashboard
      const insights = getInsightsForDashboard(dashboard.id);
      for (const insight of insights) {
        const insightId = this.insightIdMap.get(insight.name);
        if (!insightId && !this.dryRun) {
          this.logger.debug(`Insight ID not found for "${insight.name}", skipping`);
          continue;
        }

        if (this.dryRun) {
          this.logger.action('Link', `"${insight.name}" to "${dashboard.name}"`);
        } else if (dashboardId && insightId) {
          try {
            await this.insightsApi.ensureDashboardLinks(insightId, [dashboardId]);
            this.logger.debug(`Linked "${insight.name}" to "${dashboard.name}"`);
          } catch (error) {
            this.logger.warn(
              `Failed to link "${insight.name}" to "${dashboard.name}": ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      // Get funnels for this dashboard
      const funnels = getFunnelsForDashboard(dashboard.id);
      for (const funnel of funnels) {
        const funnelId = this.funnelIdMap.get(funnel.name);
        if (!funnelId && !this.dryRun) {
          this.logger.debug(`Funnel ID not found for "${funnel.name}", skipping`);
          continue;
        }

        if (this.dryRun) {
          this.logger.action('Link', `"${funnel.name}" to "${dashboard.name}"`);
        } else if (dashboardId && funnelId) {
          try {
            await this.funnelsApi.linkToDashboard(funnelId, dashboardId);
            this.logger.debug(`Linked "${funnel.name}" to "${dashboard.name}"`);
          } catch (error) {
            this.logger.warn(
              `Failed to link "${funnel.name}" to "${dashboard.name}": ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    }
  }

  /**
   * Run the full setup process
   */
  async run(dashboardFilter?: string): Promise<SyncStats> {
    const totalStats = new SyncStats();

    // Validate definitions
    this.logger.section('Validating Definitions');
    const validation = validateDefinitions();
    if (!validation.valid) {
      this.logger.error('Definition validation failed:');
      for (const error of validation.errors) {
        this.logger.error(`  - ${error}`);
      }
      throw new Error('Definition validation failed');
    }
    this.logger.success('All definitions validated');

    // Filter dashboards
    const dashboards = filterDashboardDefinitions(DASHBOARD_DEFINITIONS, dashboardFilter);
    if (dashboards.length === 0) {
      this.logger.warn(`No dashboards found matching filter: ${dashboardFilter}`);
      return totalStats;
    }

    this.logger.info(
      `Processing ${dashboards.length} dashboard(s): ${dashboards.map((d) => d.name).join(', ')}`
    );

    // Get dashboard IDs for insight/funnel filtering
    const dashboardIds = dashboards.map((d) => d.id);

    // Step 1: Sync cohorts (always sync all cohorts as they may be used across dashboards)
    const cohortStats = await this.syncCohorts();
    totalStats.merge(cohortStats);

    // Step 2: Sync insights for selected dashboards
    const insightStats = await this.syncInsights(dashboardIds);
    totalStats.merge(insightStats);

    // Step 3: Sync funnels for selected dashboards
    const funnelStats = await this.syncFunnels(dashboardIds);
    totalStats.merge(funnelStats);

    // Step 4: Sync dashboards
    const dashboardStats = await this.syncDashboards(dashboards);
    totalStats.merge(dashboardStats);

    // Step 5: Link insights and funnels to dashboards
    await this.linkInsightsToDashboards(dashboards);

    return totalStats;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseExecutionOptions(args);

  // Create logger early for config output
  const logger = createLogger({
    verbose: options.verbose,
    dryRun: options.dryRun,
  });

  try {
    // Get configuration (mock in dry-run mode)
    const config = getConfigForExecution(options);

    // Log configuration
    logger.config({
      projectId: config.projectId,
      host: config.host,
      dryRun: options.dryRun,
    });

    // Create orchestrator and run
    const orchestrator = new SetupOrchestrator(config, options);
    const stats = await orchestrator.run(options.dashboard);

    // Print summary
    logger.summary(stats.toSummary());

    // Exit with error code if there were failures
    if (stats.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
