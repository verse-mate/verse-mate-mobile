-- Query Name: Funnel - Feature Depth
-- Dashboard: Product - User Engagement
-- Type: funnel
-- Description: Tracks users who refine their work after initial feature usage.
--   Measures: highlight created -> highlight edited.
--   Expected conversion: 15-25% of highlight creators edit their highlights.
--   High conversion indicates engaged "study" users who revisit and refine;
--   low conversion may indicate highlights are "fire and forget" or edit UX issues.
-- Time Window: 30d (feature refinement period)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User creates a highlight
-- Event: HIGHLIGHT_CREATED
-- Time window: Start of funnel

-- Step 2: User edits a highlight (refining their work)
-- Event: HIGHLIGHT_EDITED
-- Conversion window: 30 days from Step 1

-- HogQL Funnel Analysis Query:

WITH highlight_creators AS (
    -- All users who created highlights in the analysis period
    SELECT
        distinct_id,
        min(timestamp) as first_highlight_time,
        count(*) as total_highlights_created
    FROM events
    WHERE event = 'HIGHLIGHT_CREATED'
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY distinct_id
),

highlight_editors AS (
    -- Users who edited highlights
    SELECT
        distinct_id,
        min(timestamp) as first_edit_time,
        count(*) as total_highlights_edited
    FROM events
    WHERE event = 'HIGHLIGHT_EDITED'
        AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY distinct_id
)

SELECT
    'Feature Depth Funnel' as funnel_name,
    -- Step counts
    count(DISTINCT hc.distinct_id) as step_1_highlight_created,
    count(DISTINCT he.distinct_id) as step_2_highlight_edited,
    -- Conversion rate
    round(
        count(DISTINCT he.distinct_id) * 100.0 /
        nullif(count(DISTINCT hc.distinct_id), 0),
        1
    ) as create_to_edit_conversion_pct,
    -- Average highlights per creator
    round(avg(hc.total_highlights_created), 1) as avg_highlights_per_creator,
    -- Average edits per editor
    round(avg(he.total_highlights_edited), 1) as avg_edits_per_editor,
    -- Edit intensity (edits per highlight for editors)
    round(
        sum(he.total_highlights_edited) * 1.0 /
        nullif(sum(CASE WHEN he.distinct_id IS NOT NULL THEN hc.total_highlights_created END), 0),
        2
    ) as edit_ratio
FROM highlight_creators hc
LEFT JOIN highlight_editors he ON hc.distinct_id = he.distinct_id

-- Extended analysis including notes (for "Feature Refiners" cohort identification)
-- SELECT
--     'Combined Feature Depth' as analysis_type,
--     count(DISTINCT CASE WHEN event = 'HIGHLIGHT_CREATED' THEN distinct_id END) as highlight_creators,
--     count(DISTINCT CASE WHEN event = 'HIGHLIGHT_EDITED' THEN distinct_id END) as highlight_editors,
--     count(DISTINCT CASE WHEN event = 'NOTE_CREATED' THEN distinct_id END) as note_creators,
--     count(DISTINCT CASE WHEN event = 'NOTE_EDITED' THEN distinct_id END) as note_editors,
--     -- Feature refiners: anyone who edits
--     count(DISTINCT CASE
--         WHEN event IN ('HIGHLIGHT_EDITED', 'NOTE_EDITED')
--         THEN distinct_id
--     END) as feature_refiners
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 30 DAY
--     AND event IN ('HIGHLIGHT_CREATED', 'HIGHLIGHT_EDITED', 'NOTE_CREATED', 'NOTE_EDITED')

-- Time to first edit analysis
-- SELECT
--     CASE
--         WHEN time_to_edit_hours < 1 THEN 'Within 1 hour'
--         WHEN time_to_edit_hours < 24 THEN 'Same day'
--         WHEN time_to_edit_hours < 168 THEN 'Within 1 week'
--         ELSE 'After 1 week'
--     END as edit_timing,
--     count(*) as user_count
-- FROM (
--     SELECT
--         hc.distinct_id,
--         dateDiff('hour', hc.first_highlight_time, he.first_edit_time) as time_to_edit_hours
--     FROM (
--         SELECT distinct_id, min(timestamp) as first_highlight_time
--         FROM events
--         WHERE event = 'HIGHLIGHT_CREATED'
--             AND timestamp >= now() - INTERVAL 30 DAY
--         GROUP BY distinct_id
--     ) hc
--     JOIN (
--         SELECT distinct_id, min(timestamp) as first_edit_time
--         FROM events
--         WHERE event = 'HIGHLIGHT_EDITED'
--             AND timestamp >= now() - INTERVAL 30 DAY
--         GROUP BY distinct_id
--     ) he ON hc.distinct_id = he.distinct_id
--     WHERE he.first_edit_time >= hc.first_highlight_time
-- )
-- GROUP BY edit_timing
-- ORDER BY
--     CASE edit_timing
--         WHEN 'Within 1 hour' THEN 1
--         WHEN 'Same day' THEN 2
--         WHEN 'Within 1 week' THEN 3
--         ELSE 4
--     END

-- Daily trend of feature depth
-- SELECT
--     toDate(timestamp) as date,
--     count(DISTINCT CASE WHEN event = 'HIGHLIGHT_CREATED' THEN distinct_id END) as creators,
--     count(DISTINCT CASE WHEN event = 'HIGHLIGHT_EDITED' THEN distinct_id END) as editors,
--     round(
--         count(DISTINCT CASE WHEN event = 'HIGHLIGHT_EDITED' THEN distinct_id END) * 100.0 /
--         nullif(count(DISTINCT CASE WHEN event = 'HIGHLIGHT_CREATED' THEN distinct_id END), 0),
--         1
--     ) as edit_rate_pct
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 30 DAY
--     AND event IN ('HIGHLIGHT_CREATED', 'HIGHLIGHT_EDITED')
-- GROUP BY toDate(timestamp)
-- ORDER BY date DESC
