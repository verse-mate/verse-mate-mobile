/**
 * Logger Utility
 *
 * Provides structured logging with support for verbose mode and dry-run indicators.
 * Follows consistent output patterns for setup script execution.
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Enable verbose logging (includes debug messages) */
  verbose: boolean;
  /** Prefix messages with [DRY-RUN] indicator */
  dryRun: boolean;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

/**
 * Logger class with verbose and dry-run support
 */
export class Logger {
  private options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      verbose: options.verbose ?? false,
      dryRun: options.dryRun ?? false,
    };
  }

  /**
   * Format a message with optional dry-run prefix
   */
  private formatMessage(message: string): string {
    if (this.options.dryRun) {
      return `${COLORS.cyan}[DRY-RUN]${COLORS.reset} ${message}`;
    }
    return message;
  }

  /**
   * Log a debug message (only shown in verbose mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.options.verbose) {
      console.log(`${COLORS.dim}[DEBUG]${COLORS.reset} ${this.formatMessage(message)}`, ...args);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage(message), ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`${COLORS.yellow}[WARN]${COLORS.reset} ${this.formatMessage(message)}`, ...args);
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${this.formatMessage(message)}`, ...args);
  }

  /**
   * Log a success message
   */
  success(message: string, ...args: unknown[]): void {
    console.log(`${COLORS.green}[OK]${COLORS.reset} ${this.formatMessage(message)}`, ...args);
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    console.log('');
    console.log(`${COLORS.blue}=== ${title} ===${COLORS.reset}`);
    console.log('');
  }

  /**
   * Log an action being taken
   */
  action(action: string, target: string): void {
    const actionText = this.options.dryRun
      ? `${COLORS.cyan}Would ${action.toLowerCase()}${COLORS.reset}`
      : `${action}`;
    console.log(`  ${actionText}: ${target}`);
  }

  /**
   * Log a skip message
   */
  skip(message: string): void {
    console.log(`  ${COLORS.dim}[SKIP]${COLORS.reset} ${message}`);
  }

  /**
   * Log resource creation
   */
  creating(resourceType: string, name: string): void {
    this.action('Creating', `${resourceType} "${name}"`);
  }

  /**
   * Log resource update
   */
  updating(resourceType: string, name: string): void {
    this.action('Updating', `${resourceType} "${name}"`);
  }

  /**
   * Log resource unchanged
   */
  unchanged(resourceType: string, name: string): void {
    if (this.options.verbose) {
      this.skip(`${resourceType} "${name}" (unchanged)`);
    }
  }

  /**
   * Log a summary table
   */
  summary(stats: { created: number; updated: number; unchanged: number; errors: number }): void {
    console.log('');
    console.log(`${COLORS.blue}=== Summary ===${COLORS.reset}`);
    console.log('');
    console.log(`  ${COLORS.green}Created:${COLORS.reset}   ${stats.created}`);
    console.log(`  ${COLORS.yellow}Updated:${COLORS.reset}   ${stats.updated}`);
    console.log(`  ${COLORS.dim}Unchanged:${COLORS.reset} ${stats.unchanged}`);

    if (stats.errors > 0) {
      console.log(`  ${COLORS.red}Errors:${COLORS.reset}    ${stats.errors}`);
    }

    console.log('');

    if (this.options.dryRun) {
      console.log(
        `${COLORS.cyan}Note: This was a dry-run. No changes were made to PostHog.${COLORS.reset}`
      );
      console.log('');
    }
  }

  /**
   * Log configuration details
   */
  config(config: { projectId: string; host: string; dryRun: boolean }): void {
    console.log('');
    console.log(`${COLORS.blue}Configuration:${COLORS.reset}`);
    console.log(`  Project ID: ${config.projectId}`);
    console.log(`  Host: ${config.host}`);
    console.log(`  Mode: ${config.dryRun ? 'Dry-run' : 'Live'}`);
    console.log('');
  }
}

/**
 * Create a new logger instance
 *
 * @param options Logger options
 * @returns Logger instance
 */
export function createLogger(options: Partial<LoggerOptions> = {}): Logger {
  return new Logger(options);
}

/**
 * Default logger instance (non-verbose, non-dry-run)
 */
export const defaultLogger = createLogger();
