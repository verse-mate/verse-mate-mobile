/**
 * Insight Definitions
 *
 * All 41 insight definitions for PostHog analytics dashboards.
 * Each insight references a HogQL query file and follows the naming convention:
 * [Type] - Metric Name
 *
 * Visualization Types:
 * - Trend: Line charts showing change over time
 * - Number: Single metric cards with comparison
 * - Distribution: Histograms showing value distribution
 * - Table: Tabular data displays
 * - Pie: Pie/donut charts for proportions
 * - Bar: Bar charts for comparisons
 * - Line: Multi-series line charts
 */

/**
 * Visualization type for insights
 */
export type VisualizationType =
  | 'Trend'
  | 'Number'
  | 'Distribution'
  | 'Table'
  | 'Pie'
  | 'Bar'
  | 'Line';

/**
 * Dashboard identifiers
 */
export type DashboardId =
  | 'executive-overview'
  | 'user-engagement'
  | 'retention-growth'
  | 'ai-performance'
  | 'technical-health'
  | 'social-virality'
  | 'error-monitoring';

/**
 * Insight definition interface
 */
export interface InsightDefinition {
  /** Insight name following convention: [Type] - Metric Name */
  name: string;
  /** Description of what this insight measures and why it matters */
  description: string;
  /** Path to HogQL query file relative to queries/insights/{dashboard}/ */
  queryFile: string;
  /** Visualization type for PostHog display */
  visualizationType: VisualizationType;
  /** Dashboard IDs where this insight should appear */
  dashboards: DashboardId[];
  /** Default time window for the insight */
  timeWindow: '7d' | '30d' | '90d';
  /** Optional layout position hint (row, col) for critical metrics */
  layoutHint?: { row: number; col: number };
}

/**
 * Executive Overview insights (Dashboard 1)
 */
const EXECUTIVE_OVERVIEW_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Trend - DAU/WAU/MAU',
    description:
      'Daily, Weekly, and Monthly active users with trend indicators. DAU = unique users per day, WAU = unique users per 7-day window, MAU = unique users per 30-day window. Key health metric for overall engagement.',
    queryFile: 'executive-overview/dau-wau-mau.sql',
    visualizationType: 'Line',
    dashboards: ['executive-overview'],
    timeWindow: '30d',
    layoutHint: { row: 0, col: 0 }, // Top-left for critical metric
  },
  {
    name: 'Number - Retention Headlines',
    description:
      'D1, D7, D30 retention rates with visual trend indicators. Shows percentage of users returning after initial visit. Critical for understanding product stickiness.',
    queryFile: 'executive-overview/retention-headlines.sql',
    visualizationType: 'Number',
    dashboards: ['executive-overview'],
    timeWindow: '30d',
    layoutHint: { row: 0, col: 1 },
  },
  {
    name: 'Number - Activation Rate',
    description:
      'Signup to first chapter viewed conversion rate. Measures how effectively new users are onboarded into the core product experience.',
    queryFile: 'executive-overview/activation-rate.sql',
    visualizationType: 'Number',
    dashboards: ['executive-overview'],
    timeWindow: '7d',
    layoutHint: { row: 1, col: 0 },
  },
  {
    name: 'Number - Error Rate',
    description:
      'Error rate health indicator with red/yellow/green status. Monitors technical health at a glance for executive review.',
    queryFile: 'executive-overview/error-rate.sql',
    visualizationType: 'Number',
    dashboards: ['executive-overview'],
    timeWindow: '7d',
    layoutHint: { row: 1, col: 1 },
  },
];

/**
 * User Engagement insights (Dashboard 2)
 */
const USER_ENGAGEMENT_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Number - Chapters Per User',
    description:
      'Average number of chapters viewed per unique active user per week. Formula: CHAPTER_VIEWED count / unique users. Healthy engagement: 5+ chapters/user/week.',
    queryFile: 'user-engagement/chapters-per-user.sql',
    visualizationType: 'Number',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Number - Median Reading Duration',
    description:
      'Median reading duration using CHAPTER_READING_DURATION event. Median used instead of average to reduce skew from outliers. Indicates depth of engagement.',
    queryFile: 'user-engagement/median-reading-duration.sql',
    visualizationType: 'Number',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Number - Reading Completion Rate',
    description:
      'Percentage of CHAPTER_SCROLL_DEPTH events where maxScrollDepthPercent >= 90. Indicates how many users read chapters to completion.',
    queryFile: 'user-engagement/reading-completion-rate.sql',
    visualizationType: 'Number',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Pie - View Mode Distribution',
    description:
      'Time distribution between bible and explanations view modes using VIEW_MODE_DURATION. Shows how users split their time between reading and studying.',
    queryFile: 'user-engagement/view-mode-distribution.sql',
    visualizationType: 'Pie',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Trend - View Mode Switching',
    description:
      'VIEW_MODE_SWITCHED frequency over time. Measures exploration behavior and how often users toggle between reading and explanation modes.',
    queryFile: 'user-engagement/view-mode-switching.sql',
    visualizationType: 'Trend',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Bar - Feature Usage Rates',
    description:
      'Bookmark rate, highlight rate, note creation rate per active user. Shows feature adoption as percentages of active users.',
    queryFile: 'user-engagement/feature-usage-rates.sql',
    visualizationType: 'Bar',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Pie - Bible Version Popularity',
    description:
      'Bible version distribution using bibleVersion property from CHAPTER_VIEWED. Shows which translations are most popular among users.',
    queryFile: 'user-engagement/bible-version-popularity.sql',
    visualizationType: 'Pie',
    dashboards: ['user-engagement'],
    timeWindow: '30d',
  },
  {
    name: 'Table - Book Popularity',
    description:
      'Top 10 most read books by bookId. Shows which Bible books have the highest engagement for content planning.',
    queryFile: 'user-engagement/book-popularity.sql',
    visualizationType: 'Table',
    dashboards: ['user-engagement'],
    timeWindow: '30d',
  },
  {
    name: 'Distribution - Scroll Depth',
    description:
      'Scroll depth distribution histogram with buckets: 0-25%, 25-50%, 50-75%, 75-100%. Shows reading depth patterns.',
    queryFile: 'user-engagement/scroll-depth-distribution.sql',
    visualizationType: 'Distribution',
    dashboards: ['user-engagement'],
    timeWindow: '7d',
  },
  {
    name: 'Bar - Feature Churn Rates',
    description:
      'Feature churn rates: BOOKMARK_REMOVED/BOOKMARK_ADDED, HIGHLIGHT_DELETED/HIGHLIGHT_CREATED, NOTE_DELETED/NOTE_CREATED. High ratios may indicate UX issues.',
    queryFile: 'user-engagement/feature-churn-rates.sql',
    visualizationType: 'Bar',
    dashboards: ['user-engagement'],
    timeWindow: '30d',
  },
  {
    name: 'Number - Feature Engagement Depth',
    description:
      'HIGHLIGHT_EDITED and NOTE_EDITED counts per user. Indicates users who refine their highlights and notes, showing deep engagement.',
    queryFile: 'user-engagement/feature-engagement-depth.sql',
    visualizationType: 'Number',
    dashboards: ['user-engagement'],
    timeWindow: '30d',
  },
];

/**
 * Retention & Growth insights (Dashboard 3)
 */
const RETENTION_GROWTH_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Line - Retention Curve',
    description:
      'Retention curve showing D1, D7, D14, D30, D60, D90 retention rates. Key metric for understanding long-term product stickiness.',
    queryFile: 'retention-growth/retention-curve.sql',
    visualizationType: 'Line',
    dashboards: ['retention-growth'],
    timeWindow: '90d',
  },
  {
    name: 'Table - Cohort Retention Matrix',
    description:
      'Cohort retention matrix grouping users by signup week, showing retention decay over 8 weeks. Essential for tracking retention improvements.',
    queryFile: 'retention-growth/cohort-retention-matrix.sql',
    visualizationType: 'Table',
    dashboards: ['retention-growth'],
    timeWindow: '90d',
  },
  {
    name: 'Pie - Lifecycle Distribution',
    description:
      'User lifecycle stage distribution pie chart using behavioral cohort membership counts (new, casual, regular, power, dormant).',
    queryFile: 'retention-growth/lifecycle-distribution.sql',
    visualizationType: 'Pie',
    dashboards: ['retention-growth'],
    timeWindow: '30d',
  },
  {
    name: 'Distribution - Streak Distribution',
    description:
      'Streak distribution histogram using current_streak user property with buckets: 1, 2-3, 4-7, 8-14, 15-30, 30+. Shows habit formation.',
    queryFile: 'retention-growth/streak-distribution.sql',
    visualizationType: 'Distribution',
    dashboards: ['retention-growth'],
    timeWindow: '30d',
  },
  {
    name: 'Trend - Activation Rate Trend',
    description:
      'New user activation rate trend showing 7-day rolling average. Tracks onboarding effectiveness over time.',
    queryFile: 'retention-growth/activation-rate-trend.sql',
    visualizationType: 'Trend',
    dashboards: ['retention-growth'],
    timeWindow: '30d',
  },
  {
    name: 'Number - Resurrection Rate',
    description:
      'Resurrection rate: dormant users (14+ days inactive) who returned in current period. Key metric for re-engagement success.',
    queryFile: 'retention-growth/resurrection-rate.sql',
    visualizationType: 'Number',
    dashboards: ['retention-growth'],
    timeWindow: '30d',
  },
];

/**
 * AI Feature Performance insights (Dashboard 4)
 */
const AI_PERFORMANCE_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Number - Tooltip Open Rate',
    description:
      'Tooltip open rate: VERSEMATE_TOOLTIP_OPENED count / CHAPTER_VIEWED count per user session. Measures AI feature discovery and interest.',
    queryFile: 'ai-performance/tooltip-open-rate.sql',
    visualizationType: 'Number',
    dashboards: ['ai-performance'],
    timeWindow: '7d',
  },
  {
    name: 'Distribution - Tooltip Dwell Time',
    description:
      'Tooltip dwell time distribution using TOOLTIP_READING_DURATION with buckets: 3-10s, 10-30s, 30-60s, 60s+. Shows engagement depth with AI explanations.',
    queryFile: 'ai-performance/tooltip-dwell-time.sql',
    visualizationType: 'Distribution',
    dashboards: ['ai-performance'],
    timeWindow: '7d',
  },
  {
    name: 'Pie - Explanation Tab Preference',
    description:
      'Explanation tab preference breakdown using EXPLANATION_TAB_CHANGED (summary vs byline vs detailed). Shows which explanation depth users prefer.',
    queryFile: 'ai-performance/explanation-tab-preference.sql',
    visualizationType: 'Pie',
    dashboards: ['ai-performance'],
    timeWindow: '30d',
  },
  {
    name: 'Number - Auto-Highlight View Rate',
    description:
      'Auto-highlight tooltip view rate: AUTO_HIGHLIGHT_TOOLTIP_VIEWED / chapters with auto-highlights. Measures auto-highlight feature engagement.',
    queryFile: 'ai-performance/auto-highlight-view-rate.sql',
    visualizationType: 'Number',
    dashboards: ['ai-performance'],
    timeWindow: '7d',
  },
  {
    name: 'Bar - Auto-Highlight Settings',
    description:
      'Auto-highlight setting adoption using AUTO_HIGHLIGHT_SETTING_CHANGED. Track enable/disable rates by settingId to identify UX issues.',
    queryFile: 'ai-performance/auto-highlight-settings.sql',
    visualizationType: 'Bar',
    dashboards: ['ai-performance'],
    timeWindow: '30d',
  },
  {
    name: 'Bar - Dictionary Lookup Frequency',
    description:
      'Dictionary lookup frequency using DICTIONARY_LOOKUP event, segmented by language (greek/hebrew). Shows scholarly engagement.',
    queryFile: 'ai-performance/dictionary-lookup-frequency.sql',
    visualizationType: 'Bar',
    dashboards: ['ai-performance'],
    timeWindow: '30d',
  },
  {
    name: 'Trend - AI Adoption Trend',
    description:
      'AI feature adoption trend line showing weekly tooltip open rate over time. Tracks growth in AI feature usage.',
    queryFile: 'ai-performance/ai-adoption-trend.sql',
    visualizationType: 'Trend',
    dashboards: ['ai-performance'],
    timeWindow: '90d',
  },
];

/**
 * Technical Health insights (Dashboard 5)
 */
const TECHNICAL_HEALTH_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Bar - Auth Success Rates',
    description:
      'Authentication success rates by method (email/google/apple) using LOGIN_COMPLETED and SIGNUP_COMPLETED. Monitors auth system health.',
    queryFile: 'technical-health/auth-success-rates.sql',
    visualizationType: 'Bar',
    dashboards: ['technical-health'],
    timeWindow: '30d',
  },
  {
    name: 'Pie - Platform Distribution',
    description:
      'Platform distribution (iOS vs Android) using PostHog built-in $os property. Essential for platform-specific issue tracking.',
    queryFile: 'technical-health/platform-distribution.sql',
    visualizationType: 'Pie',
    dashboards: ['technical-health'],
    timeWindow: '30d',
  },
  {
    name: 'Distribution - Session Duration',
    description:
      'Session duration distribution to identify abnormal sessions (>1 hour may indicate bugs). Useful for detecting stuck states.',
    queryFile: 'technical-health/session-duration.sql',
    visualizationType: 'Distribution',
    dashboards: ['technical-health'],
    timeWindow: '7d',
  },
  {
    name: 'Pie - App Version Distribution',
    description:
      'App version distribution to monitor rollout adoption. Critical for understanding update adoption and legacy version usage.',
    queryFile: 'technical-health/app-version-distribution.sql',
    visualizationType: 'Pie',
    dashboards: ['technical-health'],
    timeWindow: '30d',
  },
  {
    name: 'Table - Geographic Distribution',
    description:
      'Geographic distribution using country user property. Helps identify region-specific issues and opportunities.',
    queryFile: 'technical-health/geographic-distribution.sql',
    visualizationType: 'Table',
    dashboards: ['technical-health'],
    timeWindow: '30d',
  },
  {
    name: 'Trend - Logout Patterns',
    description:
      'Logout patterns using LOGOUT event showing frequency and timing. Helps identify forced logouts vs intentional.',
    queryFile: 'technical-health/logout-patterns.sql',
    visualizationType: 'Trend',
    dashboards: ['technical-health'],
    timeWindow: '30d',
  },
  {
    name: 'Distribution - Login Frequency',
    description:
      'Login frequency monitoring using last_login_at user property. Identifies users who login multiple times per day (potential auth issues).',
    queryFile: 'technical-health/login-frequency.sql',
    visualizationType: 'Distribution',
    dashboards: ['technical-health'],
    timeWindow: '7d',
  },
];

/**
 * Social & Virality insights (Dashboard 6)
 */
const SOCIAL_VIRALITY_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Number - Total Shares',
    description:
      'Total shares using CHAPTER_SHARED and TOPIC_SHARED events combined. Primary virality metric.',
    queryFile: 'social-virality/total-shares.sql',
    visualizationType: 'Number',
    dashboards: ['social-virality'],
    timeWindow: '30d',
  },
  {
    name: 'Number - Share Rate',
    description:
      'Share rate per active user: total shares / unique active users. Measures sharing propensity of the user base.',
    queryFile: 'social-virality/share-rate.sql',
    visualizationType: 'Number',
    dashboards: ['social-virality'],
    timeWindow: '30d',
  },
  {
    name: 'Table - Chapter Sharing Patterns',
    description:
      'Chapter sharing patterns: which books and chapters are shared most (by bookId, chapterNumber). Helps identify viral content.',
    queryFile: 'social-virality/chapter-sharing-patterns.sql',
    visualizationType: 'Table',
    dashboards: ['social-virality'],
    timeWindow: '30d',
  },
  {
    name: 'Table - Topic Sharing Patterns',
    description:
      'Topic sharing patterns: which categories and topics are shared most (by category, topicSlug). Identifies engaging topic content.',
    queryFile: 'social-virality/topic-sharing-patterns.sql',
    visualizationType: 'Table',
    dashboards: ['social-virality'],
    timeWindow: '30d',
  },
  {
    name: 'Trend - Sharing Trends',
    description:
      'Sharing trends over time showing weekly/monthly share volume. Tracks virality growth and seasonal patterns.',
    queryFile: 'social-virality/sharing-trends.sql',
    visualizationType: 'Trend',
    dashboards: ['social-virality'],
    timeWindow: '90d',
  },
  {
    name: 'Table - Super Sharers',
    description:
      'Super sharers identification: users in top 10% of sharing activity. Key for understanding power sharer behavior.',
    queryFile: 'social-virality/super-sharers.sql',
    visualizationType: 'Table',
    dashboards: ['social-virality'],
    timeWindow: '30d',
  },
];

/**
 * Error Monitoring insights (Dashboard 7)
 */
const ERROR_MONITORING_INSIGHTS: InsightDefinition[] = [
  {
    name: 'Number - Error Rate Health',
    description:
      'Primary health indicator showing overall error rate as a percentage. Traffic-light status: green (<1%), yellow (1-5%), red (>5%). Uses 7-day window for stable calculation.',
    queryFile: 'error-monitoring/error-rate-health.sql',
    visualizationType: 'Number',
    dashboards: ['error-monitoring'],
    timeWindow: '7d',
    layoutHint: { row: 0, col: 0 }, // Top-left for critical metric
  },
  {
    name: 'Trend - Error Volume',
    description:
      'Line chart showing $exception count over time with daily granularity. Includes 7-day rolling average for baseline comparison.',
    queryFile: 'error-monitoring/error-volume-trend.sql',
    visualizationType: 'Trend',
    dashboards: ['error-monitoring'],
    timeWindow: '30d',
  },
  {
    name: 'Bar - Errors by Source',
    description:
      'Breakdown of errors by source: error-boundary, react-query, network-error, backend. Helps identify which system component is generating errors.',
    queryFile: 'error-monitoring/errors-by-source.sql',
    visualizationType: 'Bar',
    dashboards: ['error-monitoring'],
    timeWindow: '7d',
  },
  {
    name: 'Bar - Errors by Severity',
    description:
      'Group errors into severity buckets: 4xx (client errors), 5xx (server errors), crash (error boundary). Excludes 401 auth flow errors.',
    queryFile: 'error-monitoring/errors-by-severity.sql',
    visualizationType: 'Bar',
    dashboards: ['error-monitoring'],
    timeWindow: '7d',
  },
  {
    name: 'Table - Top Endpoints with Errors',
    description:
      'Top 10 API endpoints by error count. Shows endpoint, method, error count, and most common status code for investigation.',
    queryFile: 'error-monitoring/top-endpoints-with-errors.sql',
    visualizationType: 'Table',
    dashboards: ['error-monitoring'],
    timeWindow: '7d',
  },
  {
    name: 'Number - Crash Rate',
    description:
      'Error boundary trigger rate as percentage of sessions. Traffic-light status: green (<0.1%), yellow (0.1-0.5%), red (>0.5%). Critical for mobile UX.',
    queryFile: 'error-monitoring/crash-rate.sql',
    visualizationType: 'Number',
    dashboards: ['error-monitoring'],
    timeWindow: '7d',
  },
  {
    name: 'Trend - 5xx Rate',
    description:
      'Trend line showing 5xx server error rate over time. Helps identify backend stability trends and correlate with incidents.',
    queryFile: 'error-monitoring/server-error-rate-trend.sql',
    visualizationType: 'Trend',
    dashboards: ['error-monitoring'],
    timeWindow: '30d',
  },
];

/**
 * All insight definitions combined
 */
export const INSIGHT_DEFINITIONS: InsightDefinition[] = [
  ...EXECUTIVE_OVERVIEW_INSIGHTS,
  ...USER_ENGAGEMENT_INSIGHTS,
  ...RETENTION_GROWTH_INSIGHTS,
  ...AI_PERFORMANCE_INSIGHTS,
  ...TECHNICAL_HEALTH_INSIGHTS,
  ...SOCIAL_VIRALITY_INSIGHTS,
  ...ERROR_MONITORING_INSIGHTS,
];

/**
 * Get insight definition by name
 */
export function getInsightByName(name: string): InsightDefinition | undefined {
  return INSIGHT_DEFINITIONS.find((i) => i.name === name);
}

/**
 * Get insights for a specific dashboard
 */
export function getInsightsForDashboard(dashboardId: DashboardId): InsightDefinition[] {
  return INSIGHT_DEFINITIONS.filter((i) => i.dashboards.includes(dashboardId));
}

/**
 * Get all insight names
 */
export function getAllInsightNames(): string[] {
  return INSIGHT_DEFINITIONS.map((i) => i.name);
}

/**
 * Get insights by visualization type
 */
export function getInsightsByType(type: VisualizationType): InsightDefinition[] {
  return INSIGHT_DEFINITIONS.filter((i) => i.visualizationType === type);
}
