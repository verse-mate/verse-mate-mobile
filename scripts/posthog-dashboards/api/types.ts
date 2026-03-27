/**
 * PostHog API Types
 *
 * TypeScript interfaces for PostHog API resources.
 * These types are based on the PostHog API documentation.
 */

/**
 * Dashboard resource
 */
export interface PostHogDashboard {
  id: number;
  name: string;
  description: string;
  pinned: boolean;
  created_at: string;
  created_by: number | null;
  is_shared: boolean;
  deleted: boolean;
  creation_mode: string;
  use_template: string;
  effective_restriction_level: number;
  effective_privilege_level: number;
  tiles: PostHogDashboardTile[];
  filters: Record<string, unknown>;
  tags: string[];
}

/**
 * Dashboard creation/update payload
 */
export interface PostHogDashboardInput {
  name: string;
  description?: string;
  pinned?: boolean;
  filters?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Dashboard tile (links insights to dashboards)
 */
export interface PostHogDashboardTile {
  id: number;
  dashboard_id: number;
  insight: PostHogInsight | null;
  text: PostHogDashboardText | null;
  deleted: boolean;
  layouts: Record<string, PostHogTileLayout>;
  color: string | null;
}

/**
 * Dashboard text tile
 */
export interface PostHogDashboardText {
  body: string;
  last_refresh: string | null;
}

/**
 * Tile layout information
 */
export interface PostHogTileLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Insight resource
 */
export interface PostHogInsight {
  id: number;
  short_id: string;
  name: string;
  derived_name: string | null;
  description: string;
  filters: PostHogInsightFilters;
  query: PostHogInsightQuery | null;
  order: number | null;
  deleted: boolean;
  dashboards: number[];
  last_refresh: string | null;
  refreshing: boolean;
  created_at: string;
  created_by: PostHogUser | null;
  updated_at: string;
  tags: string[];
  favorited: boolean;
  saved: boolean;
  result: unknown;
  last_modified_at: string;
  last_modified_by: PostHogUser | null;
}

/**
 * Insight creation/update payload
 */
export interface PostHogInsightInput {
  name: string;
  description?: string;
  filters?: PostHogInsightFilters;
  query?: PostHogInsightQuery;
  dashboards?: number[];
  tags?: string[];
  saved?: boolean;
}

/**
 * Insight filters (legacy format)
 */
export interface PostHogInsightFilters {
  insight?: 'TRENDS' | 'FUNNELS' | 'RETENTION' | 'PATHS' | 'STICKINESS' | 'LIFECYCLE';
  events?: PostHogInsightEvent[];
  actions?: PostHogInsightAction[];
  properties?: PostHogPropertyFilter[];
  filter_test_accounts?: boolean;
  date_from?: string;
  date_to?: string;
  breakdown?: string;
  breakdown_type?: 'event' | 'person' | 'cohort' | 'group' | 'session' | 'hogql';
  aggregation_group_type_index?: number;
  display?: string;
  formula?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  funnel_window_days?: number;
  funnel_window_interval?: number;
  funnel_window_interval_unit?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  funnel_order_type?: 'strict' | 'unordered' | 'ordered';
  funnel_viz_type?: 'steps' | 'time_to_convert' | 'trends';
  exclusions?: PostHogFunnelExclusion[];
  entity_type?: 'events' | 'actions';
  shown_as?: string;
  [key: string]: unknown;
}

/**
 * Insight event definition
 */
export interface PostHogInsightEvent {
  id: string;
  name?: string;
  type?: 'events' | 'actions';
  order?: number;
  math?: string;
  math_property?: string;
  math_hogql?: string;
  properties?: PostHogPropertyFilter[];
  custom_name?: string;
}

/**
 * Insight action definition
 */
export interface PostHogInsightAction {
  id: number;
  name?: string;
  type?: 'actions';
  order?: number;
  math?: string;
  math_property?: string;
  properties?: PostHogPropertyFilter[];
}

/**
 * Property filter
 */
export interface PostHogPropertyFilter {
  key: string;
  value: string | number | boolean | string[] | number[];
  operator:
    | 'exact'
    | 'is_not'
    | 'icontains'
    | 'not_icontains'
    | 'regex'
    | 'not_regex'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'is_set'
    | 'is_not_set'
    | 'is_date_before'
    | 'is_date_after';
  type: 'event' | 'person' | 'element' | 'session' | 'cohort' | 'recording' | 'group' | 'hogql';
}

/**
 * Funnel exclusion step
 */
export interface PostHogFunnelExclusion {
  id: string;
  name?: string;
  type: 'events' | 'actions';
  funnel_from_step: number;
  funnel_to_step: number;
}

/**
 * HogQL query format (new query format)
 */
export interface PostHogInsightQuery {
  kind:
    | 'HogQLQuery'
    | 'TrendsQuery'
    | 'FunnelsQuery'
    | 'RetentionQuery'
    | 'PathsQuery'
    | 'StickinessQuery'
    | 'LifecycleQuery'
    | 'DataTableNode'
    | 'InsightVizNode';
  query?: string;
  source?: PostHogInsightQuery;
  series?: PostHogEventSeries[];
  funnelsFilter?: PostHogFunnelsFilter;
  retentionFilter?: PostHogRetentionFilter;
  dateRange?: PostHogDateRange;
  filterTestAccounts?: boolean;
  properties?: PostHogPropertyFilter[];
  [key: string]: unknown;
}

/**
 * Event series for TrendsQuery
 */
export interface PostHogEventSeries {
  kind: 'EventsNode' | 'ActionsNode';
  event?: string;
  name?: string;
  math?: string;
  math_property?: string;
  math_hogql?: string;
  properties?: PostHogPropertyFilter[];
}

/**
 * Funnels filter configuration
 */
export interface PostHogFunnelsFilter {
  funnelWindowInterval?: number;
  funnelWindowIntervalUnit?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  funnelOrderType?: 'strict' | 'unordered' | 'ordered';
  funnelVizType?: 'steps' | 'time_to_convert' | 'trends';
  exclusions?: PostHogFunnelExclusion[];
}

/**
 * Retention filter configuration
 */
export interface PostHogRetentionFilter {
  targetEntity?: PostHogInsightEvent;
  returningEntity?: PostHogInsightEvent;
  retentionType?: 'retention_first_time' | 'retention_recurring';
  totalIntervals?: number;
  period?: 'Hour' | 'Day' | 'Week' | 'Month';
}

/**
 * Date range configuration
 */
export interface PostHogDateRange {
  date_from?: string;
  date_to?: string;
}

/**
 * Cohort resource
 */
export interface PostHogCohort {
  id: number;
  name: string;
  description: string;
  groups: PostHogCohortGroup[];
  deleted: boolean;
  filters: PostHogCohortFilters;
  query: PostHogCohortQuery | null;
  is_calculating: boolean;
  created_at: string;
  created_by: PostHogUser | null;
  last_calculation: string | null;
  errors_calculating: number;
  count: number | null;
  is_static: boolean;
}

/**
 * Cohort creation/update payload
 */
export interface PostHogCohortInput {
  name: string;
  description?: string;
  groups?: PostHogCohortGroup[];
  filters?: PostHogCohortFilters;
  is_static?: boolean;
}

/**
 * Cohort group definition
 */
export interface PostHogCohortGroup {
  id?: string;
  days?: number;
  action_id?: number;
  event_id?: string;
  label?: string;
  count?: number;
  count_operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'exact';
  properties?: PostHogPropertyFilter[];
}

/**
 * Cohort filters
 */
export interface PostHogCohortFilters {
  properties?: PostHogCohortPropertyGroup;
}

/**
 * Cohort property group
 */
export interface PostHogCohortPropertyGroup {
  type: 'AND' | 'OR';
  values: (PostHogCohortPropertyGroup | PostHogCohortProperty)[];
}

/**
 * Cohort property filter
 */
export interface PostHogCohortProperty {
  key: string;
  value: string | number | boolean | string[] | number[];
  operator: string;
  type: 'person' | 'event' | 'cohort' | 'behavioral';
  event_type?: string;
  time_value?: number;
  time_interval?: 'day' | 'week' | 'month' | 'year';
  total_count?: number;
  total_count_operator?: string;
  negation?: boolean;
}

/**
 * Cohort query (HogQL format)
 */
export interface PostHogCohortQuery {
  kind: 'HogQLQuery';
  query: string;
}

/**
 * User resource (minimal)
 */
export interface PostHogUser {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Feature flag resource (for reference)
 */
export interface PostHogFeatureFlag {
  id: number;
  key: string;
  name: string;
  filters: Record<string, unknown>;
  deleted: boolean;
  active: boolean;
  created_at: string;
}
