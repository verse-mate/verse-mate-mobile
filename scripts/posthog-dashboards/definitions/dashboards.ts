/**
 * Dashboard Definitions
 *
 * All 6 dashboard definitions for PostHog analytics.
 * Each dashboard follows the naming convention: [Team] - Dashboard Name
 *
 * Teams:
 * - All: Cross-functional dashboards (Executive Overview)
 * - Product: Product team dashboards (Engagement, Retention, AI)
 * - Engineering: Technical health dashboards
 * - Marketing: Growth and virality dashboards
 *
 * Layout conventions:
 * - Critical metrics positioned in top-left quadrant (following eye-tracking best practices)
 * - Executive Overview limited to 6-8 insights
 * - Refresh intervals: hourly for Executive, daily for others
 */

import type { DashboardId } from './insights';

/**
 * Refresh interval options
 */
export type RefreshInterval = 'hourly' | 'daily' | 'weekly';

/**
 * Dashboard team category
 */
export type DashboardTeam = 'All' | 'Product' | 'Engineering' | 'Marketing';

/**
 * Dashboard definition interface
 */
export interface DashboardDefinition {
  /** Dashboard ID for internal reference */
  id: DashboardId;
  /** Dashboard name following convention: [Team] - Dashboard Name */
  name: string;
  /** Dashboard description */
  description: string;
  /** Team that owns this dashboard */
  team: DashboardTeam;
  /** Refresh interval for the dashboard */
  refreshInterval: RefreshInterval;
  /** Default time range for the dashboard */
  defaultTimeRange: '7d' | '30d' | '90d';
  /** Whether to pin this dashboard */
  pinned: boolean;
  /** Tags for organization */
  tags: string[];
}

/**
 * Dashboard 1: Executive Overview
 */
const EXECUTIVE_OVERVIEW: DashboardDefinition = {
  id: 'executive-overview',
  name: 'All - Executive Overview',
  description:
    'High-level metrics for executive review. Includes DAU/WAU/MAU, retention headlines, ' +
    'activation rate, and error rate health indicator. Limited to 6-8 key insights. ' +
    'Critical metrics positioned top-left following eye-tracking best practices.',
  team: 'All',
  refreshInterval: 'hourly',
  defaultTimeRange: '30d',
  pinned: true,
  tags: ['executive', 'overview', 'key-metrics'],
};

/**
 * Dashboard 2: User Engagement
 */
const USER_ENGAGEMENT: DashboardDefinition = {
  id: 'user-engagement',
  name: 'Product - User Engagement',
  description:
    'Detailed user engagement metrics including reading behavior, feature usage, and content preferences. ' +
    'Tracks chapters per user, reading duration, scroll depth, view modes, feature usage rates, ' +
    'Bible version popularity, and book popularity. Includes engagement segmentation by theme and language.',
  team: 'Product',
  refreshInterval: 'daily',
  defaultTimeRange: '7d',
  pinned: false,
  tags: ['product', 'engagement', 'behavior', 'features'],
};

/**
 * Dashboard 3: Retention & Growth
 */
const RETENTION_GROWTH: DashboardDefinition = {
  id: 'retention-growth',
  name: 'Product - Retention & Growth',
  description:
    'Retention and growth metrics including retention curves, cohort analysis, lifecycle distribution, ' +
    'streak tracking, activation trends, and resurrection rates. Essential for understanding long-term ' +
    'product health and user lifecycle progression.',
  team: 'Product',
  refreshInterval: 'daily',
  defaultTimeRange: '30d',
  pinned: false,
  tags: ['product', 'retention', 'growth', 'lifecycle'],
};

/**
 * Dashboard 4: AI Feature Performance
 */
const AI_PERFORMANCE: DashboardDefinition = {
  id: 'ai-performance',
  name: 'Product - AI Feature Performance',
  description:
    'AI and explanation feature performance metrics. Tracks tooltip open rates, dwell time distribution, ' +
    'explanation tab preferences, auto-highlight engagement, dictionary lookups, and AI adoption trends. ' +
    'Critical for measuring AI feature value and adoption.',
  team: 'Product',
  refreshInterval: 'daily',
  defaultTimeRange: '7d',
  pinned: false,
  tags: ['product', 'ai', 'explanations', 'tooltips'],
};

/**
 * Dashboard 5: Technical Health
 */
const TECHNICAL_HEALTH: DashboardDefinition = {
  id: 'technical-health',
  name: 'Engineering - Technical Health',
  description:
    'Technical health monitoring including authentication success rates, platform distribution, ' +
    'session duration, app version adoption, geographic distribution, and login/logout patterns. ' +
    'Essential for identifying technical issues and monitoring infrastructure health.',
  team: 'Engineering',
  refreshInterval: 'daily',
  defaultTimeRange: '7d',
  pinned: false,
  tags: ['engineering', 'technical', 'health', 'monitoring'],
};

/**
 * Dashboard 6: Social & Virality
 */
const SOCIAL_VIRALITY: DashboardDefinition = {
  id: 'social-virality',
  name: 'Marketing - Social & Virality',
  description:
    'Social sharing and virality metrics. Tracks total shares, share rates, chapter and topic sharing patterns, ' +
    'sharing trends over time, and super sharer identification. Key for understanding organic growth potential ' +
    'and optimizing sharing features.',
  team: 'Marketing',
  refreshInterval: 'daily',
  defaultTimeRange: '30d',
  pinned: false,
  tags: ['marketing', 'social', 'sharing', 'virality'],
};

/**
 * All dashboard definitions
 */
export const DASHBOARD_DEFINITIONS: DashboardDefinition[] = [
  EXECUTIVE_OVERVIEW,
  USER_ENGAGEMENT,
  RETENTION_GROWTH,
  AI_PERFORMANCE,
  TECHNICAL_HEALTH,
  SOCIAL_VIRALITY,
];

/**
 * Get dashboard definition by ID
 */
export function getDashboardById(id: DashboardId): DashboardDefinition | undefined {
  return DASHBOARD_DEFINITIONS.find((d) => d.id === id);
}

/**
 * Get dashboard definition by name
 */
export function getDashboardByName(name: string): DashboardDefinition | undefined {
  return DASHBOARD_DEFINITIONS.find((d) => d.name === name);
}

/**
 * Get dashboards by team
 */
export function getDashboardsByTeam(team: DashboardTeam): DashboardDefinition[] {
  return DASHBOARD_DEFINITIONS.filter((d) => d.team === team);
}

/**
 * Get all dashboard names
 */
export function getAllDashboardNames(): string[] {
  return DASHBOARD_DEFINITIONS.map((d) => d.name);
}

/**
 * Get all dashboard IDs
 */
export function getAllDashboardIds(): DashboardId[] {
  return DASHBOARD_DEFINITIONS.map((d) => d.id);
}

/**
 * Dashboard ID to name mapping
 */
export const DASHBOARD_ID_TO_NAME: Record<DashboardId, string> = {
  'executive-overview': 'All - Executive Overview',
  'user-engagement': 'Product - User Engagement',
  'retention-growth': 'Product - Retention & Growth',
  'ai-performance': 'Product - AI Feature Performance',
  'technical-health': 'Engineering - Technical Health',
  'social-virality': 'Marketing - Social & Virality',
};

/**
 * Dashboard name to ID mapping
 */
export const DASHBOARD_NAME_TO_ID: Record<string, DashboardId> = {
  'All - Executive Overview': 'executive-overview',
  'Product - User Engagement': 'user-engagement',
  'Product - Retention & Growth': 'retention-growth',
  'Product - AI Feature Performance': 'ai-performance',
  'Engineering - Technical Health': 'technical-health',
  'Marketing - Social & Virality': 'social-virality',
};
