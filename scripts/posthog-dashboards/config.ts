/**
 * PostHog Dashboards Configuration
 *
 * Configuration for PostHog API authentication and environment settings.
 * Reads from environment variables with validation.
 *
 * Required Environment Variables:
 *   POSTHOG_API_KEY     - PostHog personal API key (not project key)
 *   POSTHOG_PROJECT_ID  - PostHog project ID
 *
 * Optional Environment Variables:
 *   POSTHOG_HOST        - PostHog instance URL (defaults to cloud)
 */

/**
 * PostHog configuration interface
 */
export interface PostHogConfig {
  /** PostHog personal API key (phx_...) */
  apiKey: string;
  /** PostHog project ID */
  projectId: string;
  /** PostHog API host URL */
  host: string;
}

/**
 * Script execution options
 */
export interface ExecutionOptions {
  /** Run in dry-run mode (no API calls) */
  dryRun: boolean;
  /** Enable verbose logging */
  verbose: boolean;
  /** Filter to specific dashboard name */
  dashboard?: string;
}

/**
 * Configuration error thrown when required environment variables are missing
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Default PostHog cloud host URL
 */
const DEFAULT_POSTHOG_HOST = 'https://app.posthog.com';

/**
 * Validates that a value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Load and validate PostHog configuration from environment variables
 *
 * @throws ConfigurationError if required environment variables are missing
 * @returns Validated PostHog configuration
 */
export function loadConfig(): PostHogConfig {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST;

  const missingVars: string[] = [];

  if (!isNonEmptyString(apiKey)) {
    missingVars.push('POSTHOG_API_KEY');
  }

  if (!isNonEmptyString(projectId)) {
    missingVars.push('POSTHOG_PROJECT_ID');
  }

  if (missingVars.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
        'Please set the following environment variables:\n' +
        '  POSTHOG_API_KEY=phx_...          # PostHog personal API key\n' +
        '  POSTHOG_PROJECT_ID=12345         # PostHog project ID\n' +
        '  POSTHOG_HOST=https://...         # (Optional) PostHog instance URL'
    );
  }

  // At this point, we've validated that apiKey and projectId are non-empty strings
  return {
    apiKey: apiKey as string,
    projectId: projectId as string,
    host,
  };
}

/**
 * Parse command line arguments for execution options
 *
 * @param args Command line arguments (process.argv.slice(2))
 * @returns Parsed execution options
 */
export function parseExecutionOptions(args: string[]): ExecutionOptions {
  const options: ExecutionOptions = {
    dryRun: false,
    verbose: false,
    dashboard: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--dashboard=')) {
      options.dashboard = arg.split('=').slice(1).join('=');
    } else if (arg === '--dashboard' && i + 1 < args.length) {
      options.dashboard = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print usage instructions
 */
function printUsage(): void {
  console.log(`
PostHog Dashboard Setup Script

Usage:
  npx ts-node scripts/posthog-dashboards/setup.ts [options]

Options:
  --dry-run, -n          Preview changes without making API calls
  --verbose, -v          Enable verbose logging
  --dashboard=NAME       Create/update only the specified dashboard
  --help, -h             Show this help message

Environment Variables:
  POSTHOG_API_KEY        PostHog personal API key (required)
  POSTHOG_PROJECT_ID     PostHog project ID (required)
  POSTHOG_HOST           PostHog instance URL (default: https://app.posthog.com)

Examples:
  # Preview what would be created
  npx ts-node scripts/posthog-dashboards/setup.ts --dry-run

  # Create/update all dashboards
  npx ts-node scripts/posthog-dashboards/setup.ts

  # Create only Executive Overview dashboard
  npx ts-node scripts/posthog-dashboards/setup.ts --dashboard="Executive Overview"

  # Verbose output
  npx ts-node scripts/posthog-dashboards/setup.ts --verbose
`);
}

/**
 * Validate configuration in dry-run mode
 * Returns a mock config for dry-run to avoid requiring real credentials
 *
 * @param options Execution options
 * @returns PostHog config (mock if dry-run, real otherwise)
 */
export function getConfigForExecution(options: ExecutionOptions): PostHogConfig {
  if (options.dryRun) {
    // In dry-run mode, allow missing credentials
    return {
      apiKey: process.env.POSTHOG_API_KEY || 'dry-run-mock-key',
      projectId: process.env.POSTHOG_PROJECT_ID || '00000',
      host: process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
    };
  }

  return loadConfig();
}
