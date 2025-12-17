-- Query Name: Funnel - Activation
-- Dashboard: Product - Retention & Growth
-- Type: funnel
-- Description: Tracks user activation journey from signup to engaged user.
--   Measures conversion through: signup -> first chapter view (within 24h) ->
--   any feature event (within 7d) -> return visit on day 1.
--   Expected conversion: 60% signup->chapter, 30% chapter->feature, 50% feature->return.
--   Low conversion at any step indicates onboarding friction.
-- Time Window: 7d (activation window)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User signs up
-- Event: SIGNUP_COMPLETED
-- Time window: Start of funnel

-- Step 2: User views their first chapter (within 24 hours of signup)
-- Event: CHAPTER_VIEWED
-- Conversion window: 24 hours from Step 1

-- Step 3: User engages with any feature (within 7 days of signup)
-- Events: BOOKMARK_ADDED OR HIGHLIGHT_CREATED OR NOTE_CREATED OR VERSEMATE_TOOLTIP_OPENED
-- Conversion window: 7 days from Step 1

-- Step 4: User returns the next day (D1 retention)
-- Event: Any event (CHAPTER_VIEWED recommended)
-- Conversion window: 24-48 hours from Step 1 (must be on the next calendar day)

-- HogQL Funnel Definition (for API/programmatic creation):
-- Note: PostHog funnels are typically created via UI or API, not raw HogQL.
-- This query provides the logic for manual analysis or custom funnel implementation.

WITH signup_users AS (
    -- Get all users who completed signup in the analysis period
    SELECT
        distinct_id,
        min(timestamp) as signup_time
    FROM events
    WHERE event = 'SIGNUP_COMPLETED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
),

first_chapter_view AS (
    -- Users who viewed a chapter within 24 hours of signup
    SELECT
        s.distinct_id,
        s.signup_time,
        min(e.timestamp) as first_view_time
    FROM signup_users s
    JOIN events e ON s.distinct_id = e.distinct_id
    WHERE e.event = 'CHAPTER_VIEWED'
        AND e.timestamp >= s.signup_time
        AND e.timestamp <= s.signup_time + INTERVAL 24 HOUR
    GROUP BY s.distinct_id, s.signup_time
),

feature_engagement AS (
    -- Users who engaged with any feature within 7 days of signup
    SELECT
        s.distinct_id,
        s.signup_time,
        min(e.timestamp) as first_feature_time
    FROM signup_users s
    JOIN events e ON s.distinct_id = e.distinct_id
    WHERE e.event IN (
        'BOOKMARK_ADDED',
        'HIGHLIGHT_CREATED',
        'NOTE_CREATED',
        'VERSEMATE_TOOLTIP_OPENED'
    )
        AND e.timestamp >= s.signup_time
        AND e.timestamp <= s.signup_time + INTERVAL 7 DAY
    GROUP BY s.distinct_id, s.signup_time
),

d1_return AS (
    -- Users who returned on day 1 (24-48 hours after signup)
    SELECT
        s.distinct_id,
        s.signup_time,
        min(e.timestamp) as return_time
    FROM signup_users s
    JOIN events e ON s.distinct_id = e.distinct_id
    WHERE e.event = 'CHAPTER_VIEWED'
        AND e.timestamp >= s.signup_time + INTERVAL 24 HOUR
        AND e.timestamp <= s.signup_time + INTERVAL 48 HOUR
    GROUP BY s.distinct_id, s.signup_time
)

SELECT
    'Activation Funnel' as funnel_name,
    count(DISTINCT s.distinct_id) as step_1_signups,
    count(DISTINCT f.distinct_id) as step_2_first_chapter,
    count(DISTINCT fe.distinct_id) as step_3_feature_used,
    count(DISTINCT d.distinct_id) as step_4_d1_return,
    -- Conversion rates
    round(count(DISTINCT f.distinct_id) * 100.0 / nullif(count(DISTINCT s.distinct_id), 0), 1) as signup_to_chapter_pct,
    round(count(DISTINCT fe.distinct_id) * 100.0 / nullif(count(DISTINCT f.distinct_id), 0), 1) as chapter_to_feature_pct,
    round(count(DISTINCT d.distinct_id) * 100.0 / nullif(count(DISTINCT fe.distinct_id), 0), 1) as feature_to_return_pct,
    -- Overall conversion
    round(count(DISTINCT d.distinct_id) * 100.0 / nullif(count(DISTINCT s.distinct_id), 0), 1) as overall_activation_pct
FROM signup_users s
LEFT JOIN first_chapter_view f ON s.distinct_id = f.distinct_id
LEFT JOIN feature_engagement fe ON s.distinct_id = fe.distinct_id
LEFT JOIN d1_return d ON s.distinct_id = d.distinct_id
