-- Query Name: Funnel - Feature Adoption
-- Dashboard: Product - User Engagement
-- Type: funnel
-- Description: Tracks progressive feature adoption from reading to full study tool usage.
--   Measures: chapter viewed -> bookmark added -> highlight created -> note created.
--   Expected conversion: 15% chapter->bookmark, 30% bookmark->highlight, 20% highlight->note.
--   Each step represents deeper engagement; low conversion indicates feature
--   discoverability issues or users not finding value in advanced features.
-- Time Window: 30d (feature discovery period)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User views a chapter
-- Event: CHAPTER_VIEWED
-- Time window: Start of funnel

-- Step 2: User adds a bookmark
-- Event: BOOKMARK_ADDED
-- Conversion window: 30 days from Step 1

-- Step 3: User creates a highlight
-- Event: HIGHLIGHT_CREATED
-- Conversion window: 30 days from Step 1

-- Step 4: User creates a note
-- Event: NOTE_CREATED
-- Conversion window: 30 days from Step 1

-- HogQL Funnel Analysis Query:

WITH chapter_viewers AS (
    -- All users who viewed chapters in the analysis period
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'CHAPTER_VIEWED'
        AND timestamp >= now() - INTERVAL 30 DAY
),

bookmark_users AS (
    -- Users who added bookmarks
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'BOOKMARK_ADDED'
        AND timestamp >= now() - INTERVAL 30 DAY
),

highlight_users AS (
    -- Users who created highlights
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'HIGHLIGHT_CREATED'
        AND timestamp >= now() - INTERVAL 30 DAY
),

note_users AS (
    -- Users who created notes
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'NOTE_CREATED'
        AND timestamp >= now() - INTERVAL 30 DAY
)

SELECT
    'Feature Adoption Funnel' as funnel_name,
    -- Step counts
    count(DISTINCT cv.distinct_id) as step_1_chapter_viewed,
    count(DISTINCT bu.distinct_id) as step_2_bookmark_added,
    count(DISTINCT hu.distinct_id) as step_3_highlight_created,
    count(DISTINCT nu.distinct_id) as step_4_note_created,
    -- Step-by-step conversion rates
    round(
        count(DISTINCT bu.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as chapter_to_bookmark_pct,
    round(
        count(DISTINCT hu.distinct_id) * 100.0 /
        nullif(count(DISTINCT bu.distinct_id), 0),
        1
    ) as bookmark_to_highlight_pct,
    round(
        count(DISTINCT nu.distinct_id) * 100.0 /
        nullif(count(DISTINCT hu.distinct_id), 0),
        1
    ) as highlight_to_note_pct,
    -- Overall feature adoption rate (chapter -> any feature)
    round(
        count(DISTINCT CASE
            WHEN bu.distinct_id IS NOT NULL
            OR hu.distinct_id IS NOT NULL
            OR nu.distinct_id IS NOT NULL
            THEN cv.distinct_id
        END) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as any_feature_adoption_pct,
    -- Full funnel completion rate
    round(
        count(DISTINCT nu.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as full_funnel_completion_pct
FROM chapter_viewers cv
LEFT JOIN bookmark_users bu ON cv.distinct_id = bu.distinct_id
LEFT JOIN highlight_users hu ON cv.distinct_id = hu.distinct_id
LEFT JOIN note_users nu ON cv.distinct_id = nu.distinct_id

-- Feature adoption by week (trend analysis)
-- SELECT
--     toStartOfWeek(timestamp) as week,
--     count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) as readers,
--     count(DISTINCT CASE WHEN event = 'BOOKMARK_ADDED' THEN distinct_id END) as bookmarkers,
--     count(DISTINCT CASE WHEN event = 'HIGHLIGHT_CREATED' THEN distinct_id END) as highlighters,
--     count(DISTINCT CASE WHEN event = 'NOTE_CREATED' THEN distinct_id END) as note_takers,
--     round(
--         count(DISTINCT CASE WHEN event = 'BOOKMARK_ADDED' THEN distinct_id END) * 100.0 /
--         nullif(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
--         1
--     ) as bookmark_rate_pct
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 30 DAY
--     AND event IN ('CHAPTER_VIEWED', 'BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
-- GROUP BY toStartOfWeek(timestamp)
-- ORDER BY week DESC

-- Feature combination analysis (which features are used together)
-- SELECT
--     CASE
--         WHEN has_bookmark AND has_highlight AND has_note THEN 'All Features'
--         WHEN has_bookmark AND has_highlight THEN 'Bookmark + Highlight'
--         WHEN has_bookmark AND has_note THEN 'Bookmark + Note'
--         WHEN has_highlight AND has_note THEN 'Highlight + Note'
--         WHEN has_bookmark THEN 'Bookmark Only'
--         WHEN has_highlight THEN 'Highlight Only'
--         WHEN has_note THEN 'Note Only'
--         ELSE 'No Features'
--     END as feature_combination,
--     count(*) as user_count
-- FROM (
--     SELECT
--         distinct_id,
--         countIf(event = 'BOOKMARK_ADDED') > 0 as has_bookmark,
--         countIf(event = 'HIGHLIGHT_CREATED') > 0 as has_highlight,
--         countIf(event = 'NOTE_CREATED') > 0 as has_note
--     FROM events
--     WHERE timestamp >= now() - INTERVAL 30 DAY
--         AND event IN ('BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED', 'CHAPTER_VIEWED')
--     GROUP BY distinct_id
-- )
-- GROUP BY feature_combination
-- ORDER BY user_count DESC
