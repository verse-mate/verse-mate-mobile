/**
 * Cohort Definitions
 *
 * All 14 cohort definitions for PostHog analytics.
 * Each cohort references a HogQL query file and follows the naming convention:
 * [Category] - Segment Name
 *
 * Categories:
 * - Behavioral: Based on user actions/events
 * - Lifecycle: Based on user lifecycle stage
 * - Engagement: Based on feature engagement
 * - Demographic: Based on user properties
 * - Social: Based on sharing behavior
 */

/**
 * Cohort definition interface
 */
export interface CohortDefinition {
  /** Cohort name following convention: [Category] - Segment Name */
  name: string;
  /** Description of what this cohort represents */
  description: string;
  /** Path to HogQL query file relative to queries/cohorts/ */
  queryFile: string;
  /** Category for organization */
  category: 'Behavioral' | 'Lifecycle' | 'Engagement' | 'Demographic' | 'Social';
  /** Whether this is a dynamic cohort (recalculated) or static */
  isDynamic: boolean;
}

/**
 * All cohort definitions
 */
export const COHORT_DEFINITIONS: CohortDefinition[] = [
  // Behavioral Cohorts
  {
    name: 'Behavioral - Power Users',
    description:
      'Users with >7 CHAPTER_VIEWED events in the last 7 days AND at least one feature event (bookmark, highlight, or note). Highly engaged users valuable for beta testing and understanding optimal engagement patterns.',
    queryFile: 'power-users.sql',
    category: 'Behavioral',
    isDynamic: true,
  },
  {
    name: 'Behavioral - Regular Readers',
    description:
      'Users with 3-7 CHAPTER_VIEWED events in the last 7 days. Consistent but moderate readers who are key for understanding healthy engagement patterns and potential power user conversion.',
    queryFile: 'regular-readers.sql',
    category: 'Behavioral',
    isDynamic: true,
  },
  {
    name: 'Behavioral - Casual Readers',
    description:
      'Users with 1-2 CHAPTER_VIEWED events in the last 7 days. Light users who may need engagement prompts or have specific use patterns worth understanding.',
    queryFile: 'casual-readers.sql',
    category: 'Behavioral',
    isDynamic: true,
  },

  // Lifecycle Cohorts
  {
    name: 'Lifecycle - Dormant Users',
    description:
      'Users with last activity >14 days ago based on last_seen_at. Target for re-engagement campaigns and understanding churn triggers.',
    queryFile: 'dormant-users.sql',
    category: 'Lifecycle',
    isDynamic: true,
  },
  {
    name: 'Lifecycle - New Users',
    description:
      'Users where first_seen_at is within the last 7 days. Critical for onboarding analysis and activation optimization.',
    queryFile: 'new-users.sql',
    category: 'Lifecycle',
    isDynamic: true,
  },
  {
    name: 'Lifecycle - Activated Users',
    description:
      'Users who completed the activation funnel (signup -> chapter view -> feature use -> D1 return) within their first 7 days. Key metric for product-market fit.',
    queryFile: 'activated-users.sql',
    category: 'Lifecycle',
    isDynamic: true,
  },

  // Engagement Cohorts
  {
    name: 'Engagement - Study Users',
    description:
      'Users with >3 combined bookmark/highlight/note events in the last 7 days. Deep study engagement indicates strong product value realization.',
    queryFile: 'study-users.sql',
    category: 'Engagement',
    isDynamic: true,
  },
  {
    name: 'Engagement - AI Users',
    description:
      'Users with >5 VERSEMATE_TOOLTIP_OPENED events in the last 7 days. Key segment for understanding AI feature adoption and value.',
    queryFile: 'ai-users.sql',
    category: 'Engagement',
    isDynamic: true,
  },
  {
    name: 'Engagement - Feature Refiners',
    description:
      'Users with any HIGHLIGHT_EDITED or NOTE_EDITED events. Indicates deep engagement where users return to refine their work.',
    queryFile: 'feature-refiners.sql',
    category: 'Engagement',
    isDynamic: true,
  },

  // Demographic Cohorts
  {
    name: 'Demographic - Dark Mode Users',
    description:
      'Users with theme_preference = dark. Useful for UI/UX analysis and potential correlation with engagement patterns.',
    queryFile: 'dark-mode-users.sql',
    category: 'Demographic',
    isDynamic: true,
  },
  {
    name: 'Demographic - Anonymous Users',
    description:
      'Users with is_registered = false. Important for understanding conversion potential and anonymous user behavior.',
    queryFile: 'anonymous-users.sql',
    category: 'Demographic',
    isDynamic: true,
  },
  {
    name: 'Demographic - Multi-Language Users',
    description:
      'Users who have viewed chapters in multiple bibleVersion values. Indicates diverse reading habits and potential for multilingual features.',
    queryFile: 'multi-language-users.sql',
    category: 'Demographic',
    isDynamic: true,
  },

  // Social Cohorts
  {
    name: 'Social - Sharers',
    description:
      'Users with any CHAPTER_SHARED or TOPIC_SHARED event in the last 30 days. Key for virality analysis and understanding sharing motivations.',
    queryFile: 'sharers.sql',
    category: 'Social',
    isDynamic: true,
  },
  {
    name: 'Social - Super Sharers',
    description:
      'Users with >3 shares in the last 30 days (top 10% sharing activity). Valuable for understanding power sharers and viral content patterns.',
    queryFile: 'super-sharers.sql',
    category: 'Social',
    isDynamic: true,
  },
];

/**
 * Get cohort definition by name
 */
export function getCohortByName(name: string): CohortDefinition | undefined {
  return COHORT_DEFINITIONS.find((c) => c.name === name);
}

/**
 * Get cohorts by category
 */
export function getCohortsByCategory(category: CohortDefinition['category']): CohortDefinition[] {
  return COHORT_DEFINITIONS.filter((c) => c.category === category);
}

/**
 * Get all cohort names
 */
export function getAllCohortNames(): string[] {
  return COHORT_DEFINITIONS.map((c) => c.name);
}
