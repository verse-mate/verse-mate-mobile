/**
 * Funnel Definitions
 *
 * All 6 funnel definitions for PostHog analytics.
 * Each funnel follows the naming convention: Funnel - Name
 *
 * Funnels track user progression through multi-step processes:
 * - Activation Funnel: New user onboarding journey
 * - Core Reading Funnel: Session to completed reading
 * - AI Engagement Funnel: Chapter view to AI feature usage
 * - Feature Adoption Funnel: Progressive feature adoption
 * - Sharing Funnel: Path to sharing content
 * - Feature Depth Funnel: Feature creation to refinement
 */

import type { FunnelConfig } from '../api/funnels';
import type { DashboardId } from './insights';

/**
 * Extended funnel definition with dashboard assignments
 */
export interface FunnelDefinition extends Omit<FunnelConfig, 'dashboards'> {
  /** Dashboard IDs where this funnel should appear */
  dashboards: DashboardId[];
  /** Path to HogQL reference query file */
  queryFile: string;
}

/**
 * Time window presets
 */
const TIME_WINDOWS = {
  ACTIVATION: { value: 7, unit: 'day' as const },
  READING: { value: 30, unit: 'minute' as const },
  AI_ENGAGEMENT: { value: 30, unit: 'minute' as const },
  FEATURE_ADOPTION: { value: 30, unit: 'day' as const },
  SHARING: { value: 30, unit: 'day' as const },
  FEATURE_DEPTH: { value: 30, unit: 'day' as const },
};

/**
 * Activation Funnel
 *
 * Tracks: SIGNUP_COMPLETED -> CHAPTER_VIEWED (24h) -> feature event (7d) -> D1 return
 * Expected conversions: 60% signup->chapter, 30% chapter->feature, 50% feature->return
 */
const ACTIVATION_FUNNEL: FunnelDefinition = {
  name: 'Funnel - Activation',
  description:
    'Tracks user activation journey from signup to engaged user. ' +
    'Measures conversion through: signup -> first chapter view (within 24h) -> ' +
    'any feature event (within 7d) -> return visit on day 1. ' +
    'Low conversion at any step indicates onboarding friction.',
  steps: [
    {
      event: 'SIGNUP_COMPLETED',
      name: 'Signed Up',
    },
    {
      event: 'CHAPTER_VIEWED',
      name: 'Viewed First Chapter',
    },
    {
      event: 'BOOKMARK_ADDED',
      name: 'Used a Feature',
      // Note: In PostHog, we would use OR logic for multiple events
      // This step represents any of: BOOKMARK_ADDED, HIGHLIGHT_CREATED, NOTE_CREATED, VERSEMATE_TOOLTIP_OPENED
    },
    {
      event: 'CHAPTER_VIEWED',
      name: 'Returned Day 1',
    },
  ],
  conversionWindow: TIME_WINDOWS.ACTIVATION,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['retention-growth'],
  queryFile: 'funnels/activation-funnel.sql',
};

/**
 * Core Reading Funnel
 *
 * Tracks: Session start -> CHAPTER_VIEWED -> scroll_depth >= 90%
 * Measures completion of reading sessions
 */
const CORE_READING_FUNNEL: FunnelDefinition = {
  name: 'Funnel - Core Reading',
  description:
    'Tracks user reading completion from session start to full chapter read. ' +
    'App session -> chapter viewed -> scrolled to 90%+. ' +
    'Measures how many users complete their reading sessions.',
  steps: [
    {
      event: '$pageview',
      name: 'Session Started',
    },
    {
      event: 'CHAPTER_VIEWED',
      name: 'Viewed Chapter',
    },
    {
      event: 'CHAPTER_SCROLL_DEPTH',
      name: 'Completed Reading (90%+)',
      properties: [
        {
          key: 'maxScrollDepthPercent',
          value: 90,
          operator: 'gte',
          type: 'event',
        },
      ],
    },
  ],
  conversionWindow: TIME_WINDOWS.READING,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['user-engagement'],
  queryFile: 'funnels/core-reading-funnel.sql',
};

/**
 * AI Engagement Funnel
 *
 * Tracks: CHAPTER_VIEWED -> TOOLTIP_OPENED -> EXPLANATION_TAB_CHANGED
 * Measures AI feature discovery and exploration
 */
const AI_ENGAGEMENT_FUNNEL: FunnelDefinition = {
  name: 'Funnel - AI Engagement',
  description:
    'Tracks user engagement with AI explanation features. ' +
    'Chapter viewed -> tooltip opened -> explanation tab changed. ' +
    'Measures AI feature discovery and depth of exploration.',
  steps: [
    {
      event: 'CHAPTER_VIEWED',
      name: 'Viewed Chapter',
    },
    {
      event: 'VERSEMATE_TOOLTIP_OPENED',
      name: 'Opened Tooltip',
    },
    {
      event: 'EXPLANATION_TAB_CHANGED',
      name: 'Explored Explanations',
    },
  ],
  conversionWindow: TIME_WINDOWS.AI_ENGAGEMENT,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['ai-performance'],
  queryFile: 'funnels/ai-engagement-funnel.sql',
};

/**
 * Feature Adoption Funnel
 *
 * Tracks: CHAPTER_VIEWED -> BOOKMARK_ADDED -> HIGHLIGHT_CREATED -> NOTE_CREATED
 * Measures progressive feature adoption
 */
const FEATURE_ADOPTION_FUNNEL: FunnelDefinition = {
  name: 'Funnel - Feature Adoption',
  description:
    'Tracks progressive adoption of study features. ' +
    'Chapter viewed -> bookmark added -> highlight created -> note created. ' +
    'Measures how users progress through feature discovery.',
  steps: [
    {
      event: 'CHAPTER_VIEWED',
      name: 'Viewed Chapter',
    },
    {
      event: 'BOOKMARK_ADDED',
      name: 'Added Bookmark',
    },
    {
      event: 'HIGHLIGHT_CREATED',
      name: 'Created Highlight',
    },
    {
      event: 'NOTE_CREATED',
      name: 'Created Note',
    },
  ],
  conversionWindow: TIME_WINDOWS.FEATURE_ADOPTION,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['user-engagement'],
  queryFile: 'funnels/feature-adoption-funnel.sql',
};

/**
 * Sharing Funnel
 *
 * Tracks: CHAPTER_VIEWED -> scroll_depth >= 50% -> CHAPTER_SHARED
 * Measures path to sharing content
 */
const SHARING_FUNNEL: FunnelDefinition = {
  name: 'Funnel - Sharing',
  description:
    'Tracks the path from reading to sharing content. ' +
    'Chapter viewed -> scrolled to 50%+ -> shared chapter. ' +
    'Measures what percentage of engaged readers share content.',
  steps: [
    {
      event: 'CHAPTER_VIEWED',
      name: 'Viewed Chapter',
    },
    {
      event: 'CHAPTER_SCROLL_DEPTH',
      name: 'Read Halfway (50%+)',
      properties: [
        {
          key: 'maxScrollDepthPercent',
          value: 50,
          operator: 'gte',
          type: 'event',
        },
      ],
    },
    {
      event: 'CHAPTER_SHARED',
      name: 'Shared Chapter',
    },
  ],
  conversionWindow: TIME_WINDOWS.SHARING,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['social-virality'],
  queryFile: 'funnels/sharing-funnel.sql',
};

/**
 * Feature Depth Funnel
 *
 * Tracks: HIGHLIGHT_CREATED -> HIGHLIGHT_EDITED
 * Measures users who refine their work
 */
const FEATURE_DEPTH_FUNNEL: FunnelDefinition = {
  name: 'Funnel - Feature Depth',
  description:
    'Tracks users who go beyond creation to refinement. ' +
    'Highlight created -> highlight edited. ' +
    'Measures deep engagement where users return to refine their work.',
  steps: [
    {
      event: 'HIGHLIGHT_CREATED',
      name: 'Created Highlight',
    },
    {
      event: 'HIGHLIGHT_EDITED',
      name: 'Edited Highlight',
    },
  ],
  conversionWindow: TIME_WINDOWS.FEATURE_DEPTH,
  orderType: 'ordered',
  vizType: 'steps',
  dashboards: ['user-engagement'],
  queryFile: 'funnels/feature-depth-funnel.sql',
};

/**
 * All funnel definitions
 */
export const FUNNEL_DEFINITIONS: FunnelDefinition[] = [
  ACTIVATION_FUNNEL,
  CORE_READING_FUNNEL,
  AI_ENGAGEMENT_FUNNEL,
  FEATURE_ADOPTION_FUNNEL,
  SHARING_FUNNEL,
  FEATURE_DEPTH_FUNNEL,
];

/**
 * Get funnel definition by name
 */
export function getFunnelByName(name: string): FunnelDefinition | undefined {
  return FUNNEL_DEFINITIONS.find((f) => f.name === name);
}

/**
 * Get funnels for a specific dashboard
 */
export function getFunnelsForDashboard(dashboardId: DashboardId): FunnelDefinition[] {
  return FUNNEL_DEFINITIONS.filter((f) => f.dashboards.includes(dashboardId));
}

/**
 * Get all funnel names
 */
export function getAllFunnelNames(): string[] {
  return FUNNEL_DEFINITIONS.map((f) => f.name);
}
