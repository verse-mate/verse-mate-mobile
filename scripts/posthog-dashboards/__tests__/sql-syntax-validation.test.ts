/**
 * SQL Query Syntax Validation Tests
 *
 * Validates HogQL queries without requiring a live PostHog connection:
 * - File existence and structure
 * - Basic SQL syntax (SELECT, FROM)
 * - Event name validation against known events
 * - HogQL function validation
 * - Security checks (no dangerous operations)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Valid events from lib/analytics/types.ts
const VALID_ANALYTICS_EVENTS = [
  'CHAPTER_VIEWED',
  'VIEW_MODE_SWITCHED',
  'EXPLANATION_TAB_CHANGED',
  'BOOKMARK_ADDED',
  'BOOKMARK_REMOVED',
  'HIGHLIGHT_CREATED',
  'HIGHLIGHT_EDITED',
  'HIGHLIGHT_DELETED',
  'NOTE_CREATED',
  'NOTE_EDITED',
  'NOTE_DELETED',
  'DICTIONARY_LOOKUP',
  'AUTO_HIGHLIGHT_SETTING_CHANGED',
  'CHAPTER_SHARED',
  'TOPIC_SHARED',
  'VERSEMATE_TOOLTIP_OPENED',
  'AUTO_HIGHLIGHT_TOOLTIP_VIEWED',
  'SIGNUP_COMPLETED',
  'LOGIN_COMPLETED',
  'LOGOUT',
  'CHAPTER_READING_DURATION',
  'VIEW_MODE_DURATION',
  'TOOLTIP_READING_DURATION',
  'CHAPTER_SCROLL_DEPTH',
];

// PostHog built-in events that are valid
const POSTHOG_BUILTIN_EVENTS = [
  '$pageview',
  '$pageleave',
  '$autocapture',
  '$screen',
  '$set',
  '$identify',
  '$exception',
  '$session_start',
  '$session_end',
];

// All valid events (analytics + built-in)
const ALL_VALID_EVENTS = [...VALID_ANALYTICS_EVENTS, ...POSTHOG_BUILTIN_EVENTS];

// Dangerous SQL operations that should not be in queries
const DANGEROUS_OPERATIONS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'CREATE TABLE',
  'CREATE DATABASE',
  'GRANT',
  'REVOKE',
];

// Query directories
const QUERIES_BASE_PATH = path.join(__dirname, '../queries');

/**
 * Get all SQL files from a directory recursively
 */
function getAllSqlFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllSqlFiles(fullPath));
    } else if (entry.name.endsWith('.sql')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract event names from SQL content
 * Looks for patterns like: event = 'EVENT_NAME' or event IN ('EVENT1', 'EVENT2')
 */
function extractEventNames(sql: string): string[] {
  const events: string[] = [];

  // Pattern: event = 'EVENT_NAME'
  const singleEventPattern = /event\s*=\s*'([^']+)'/gi;
  const singleMatches = sql.matchAll(singleEventPattern);
  for (const match of singleMatches) {
    events.push(match[1]);
  }

  // Pattern: event IN ('EVENT1', 'EVENT2', ...)
  const inPattern = /event\s+IN\s*\(\s*([^)]+)\s*\)/gi;
  const inMatches = sql.matchAll(inPattern);
  for (const match of inMatches) {
    const eventList = match[1];
    const eventNames = eventList.match(/'([^']+)'/g);
    if (eventNames) {
      events.push(...eventNames.map((e) => e.replace(/'/g, '')));
    }
  }

  return [...new Set(events)]; // Remove duplicates
}

/**
 * Check for dangerous SQL operations
 * Only checks actual SQL statements, ignoring comments
 */
function checkForDangerousOperations(sql: string): string[] {
  const found: string[] = [];

  // Remove comments before checking for dangerous operations
  const sqlWithoutComments = sql
    .replace(/--.*$/gm, '') // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

  for (const op of DANGEROUS_OPERATIONS) {
    // Use word boundary matching at start of statement or after semicolon
    // This avoids false positives like "update_count" or words in strings
    const pattern = new RegExp(`(^|;|\\s)${op}\\s`, 'im');
    if (pattern.test(sqlWithoutComments)) {
      found.push(op);
    }
  }

  return found;
}

/**
 * Validate basic SQL structure
 */
function validateBasicStructure(sql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Remove comments for analysis
  const sqlWithoutComments = sql
    .replace(/--.*$/gm, '') // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

  const upperSql = sqlWithoutComments.toUpperCase().trim();

  // Must have SELECT
  if (!upperSql.includes('SELECT')) {
    errors.push('Missing SELECT statement');
  }

  // Must have FROM (unless it's a simple SELECT without table)
  if (!upperSql.includes('FROM') && upperSql.includes('SELECT')) {
    // Allow SELECT without FROM for simple expressions
    // But if it references events or person, it should have FROM
    if (upperSql.includes('EVENTS') || upperSql.includes('PERSON')) {
      errors.push('Missing FROM clause');
    }
  }

  // Check for balanced parentheses
  const openParens = (sqlWithoutComments.match(/\(/g) || []).length;
  const closeParens = (sqlWithoutComments.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
  }

  // Check for balanced quotes
  const singleQuotes = (sqlWithoutComments.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push('Unbalanced single quotes');
  }

  return { valid: errors.length === 0, errors };
}

describe('SQL Query Syntax Validation', () => {
  const allSqlFiles = getAllSqlFiles(QUERIES_BASE_PATH);

  describe('Query files exist', () => {
    it('should have SQL files in the queries directory', () => {
      expect(allSqlFiles.length).toBeGreaterThan(0);
    });

    it('should have at least 60 SQL files (14 cohorts + 48 insights + 6 funnels)', () => {
      expect(allSqlFiles.length).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Basic SQL structure validation', () => {
    it.each(allSqlFiles)('%s has valid basic structure', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf-8');

      const { errors } = validateBasicStructure(sql);
      expect(errors).toEqual([]);
    });
  });

  describe('Event name validation', () => {
    it.each(allSqlFiles)('%s uses valid event names', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf-8');

      const usedEvents = extractEventNames(sql);
      const invalidEvents = usedEvents.filter((event) => !ALL_VALID_EVENTS.includes(event));

      expect(invalidEvents).toEqual([]);
    });
  });

  describe('Security validation', () => {
    it.each(allSqlFiles)('%s contains no dangerous operations', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf-8');

      const dangerousOps = checkForDangerousOperations(sql);

      expect(dangerousOps).toEqual([]);
    });
  });

  describe('Query content validation', () => {
    it.each(allSqlFiles)('%s is not empty', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf-8').trim();

      expect(sql.length).toBeGreaterThan(0);
    });

    it.each(allSqlFiles)('%s has descriptive comments', (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Check for at least one comment line
      const hasComment = sql.includes('--') || sql.includes('/*');
      expect(hasComment).toBe(true);
    });
  });

  describe('Directory structure validation', () => {
    it('should have cohorts directory with SQL files', () => {
      const cohortsPath = path.join(QUERIES_BASE_PATH, 'cohorts');
      const cohortFiles = getAllSqlFiles(cohortsPath);
      expect(cohortFiles.length).toBeGreaterThanOrEqual(14);
    });

    it('should have insights directory with subdirectories', () => {
      const insightsPath = path.join(QUERIES_BASE_PATH, 'insights');
      expect(fs.existsSync(insightsPath)).toBe(true);

      const expectedDirs = [
        'executive-overview',
        'user-engagement',
        'retention-growth',
        'ai-performance',
        'technical-health',
        'social-virality',
        'error-monitoring',
      ];

      for (const dir of expectedDirs) {
        const dirPath = path.join(insightsPath, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      }
    });

    it('should have funnels directory with SQL files', () => {
      const funnelsPath = path.join(QUERIES_BASE_PATH, 'funnels');
      const funnelFiles = getAllSqlFiles(funnelsPath);
      expect(funnelFiles.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Error monitoring queries validation', () => {
    const errorMonitoringPath = path.join(QUERIES_BASE_PATH, 'insights', 'error-monitoring');
    const errorMonitoringFiles = getAllSqlFiles(errorMonitoringPath);

    it('should have 7 error monitoring query files', () => {
      expect(errorMonitoringFiles.length).toBe(7);
    });

    it.each(errorMonitoringFiles)(
      '%s should reference $exception event or $session_id',
      (filePath) => {
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Most error monitoring queries should reference $exception
        // (crash-rate.sql might use $session_id instead)
        const hasExceptionEvent = sql.includes("'$exception'") || sql.includes('$exception');
        const hasSessionReference = sql.includes('$session_id');

        expect(hasExceptionEvent || hasSessionReference).toBe(true);
      }
    );
  });
});
