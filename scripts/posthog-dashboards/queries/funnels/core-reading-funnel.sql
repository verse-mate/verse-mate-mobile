-- Query Name: Funnel - Core Reading
-- Dashboard: Product - User Engagement
-- Type: funnel
-- Description: Tracks the core reading experience from session start to completion.
--   Measures: session start -> chapter viewed -> scroll depth >= 90% (completed reading).
--   Expected conversion: 80% session->chapter, 40% chapter->completion.
--   Low scroll completion indicates content engagement issues or UX friction.
-- Time Window: 30min (single reading session)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User starts a session (any event or $pageview)
-- Event: $pageview OR LOGIN_COMPLETED OR CHAPTER_VIEWED (first event of session)
-- Time window: Start of funnel

-- Step 2: User views a chapter
-- Event: CHAPTER_VIEWED
-- Conversion window: 30 minutes from Step 1

-- Step 3: User completes reading (90%+ scroll depth)
-- Event: CHAPTER_SCROLL_DEPTH with maxScrollDepthPercent >= 90
-- Conversion window: 30 minutes from Step 2

-- HogQL Funnel Analysis Query:

WITH session_starts AS (
    -- Identify session starts (first event per user per day with 30min gap)
    SELECT
        distinct_id,
        timestamp as session_start,
        -- Use a session window of 30 minutes
        dateTrunc('day', timestamp) as session_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 7 DAY
        AND event IN ('$pageview', 'LOGIN_COMPLETED', 'CHAPTER_VIEWED')
    GROUP BY distinct_id, dateTrunc('day', timestamp), timestamp
),

chapter_views AS (
    -- Users who viewed a chapter within 30 minutes of session start
    SELECT
        distinct_id,
        timestamp as view_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number
    FROM events
    WHERE event = 'CHAPTER_VIEWED'
        AND timestamp >= now() - INTERVAL 7 DAY
),

scroll_completions AS (
    -- Users who reached 90%+ scroll depth
    SELECT
        distinct_id,
        timestamp as completion_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number,
        properties.maxScrollDepthPercent as scroll_depth
    FROM events
    WHERE event = 'CHAPTER_SCROLL_DEPTH'
        AND properties.maxScrollDepthPercent >= 90
        AND timestamp >= now() - INTERVAL 7 DAY
)

SELECT
    'Core Reading Funnel' as funnel_name,
    -- Count unique sessions (users per day)
    count(DISTINCT concat(toString(s.distinct_id), '_', toString(s.session_day))) as step_1_sessions,
    -- Count chapter views
    count(DISTINCT c.distinct_id) as step_2_chapter_viewed,
    -- Count completions (90%+ scroll)
    count(DISTINCT sc.distinct_id) as step_3_reading_completed,
    -- Conversion rates
    round(
        count(DISTINCT c.distinct_id) * 100.0 /
        nullif(count(DISTINCT concat(toString(s.distinct_id), '_', toString(s.session_day))), 0),
        1
    ) as session_to_chapter_pct,
    round(
        count(DISTINCT sc.distinct_id) * 100.0 /
        nullif(count(DISTINCT c.distinct_id), 0),
        1
    ) as chapter_to_completion_pct,
    -- Overall conversion
    round(
        count(DISTINCT sc.distinct_id) * 100.0 /
        nullif(count(DISTINCT concat(toString(s.distinct_id), '_', toString(s.session_day))), 0),
        1
    ) as overall_reading_completion_pct
FROM session_starts s
LEFT JOIN chapter_views c ON s.distinct_id = c.distinct_id
    AND c.view_time >= s.session_start
    AND c.view_time <= s.session_start + INTERVAL 30 MINUTE
LEFT JOIN scroll_completions sc ON c.distinct_id = sc.distinct_id
    AND sc.book_id = c.book_id
    AND sc.chapter_number = c.chapter_number
    AND sc.completion_time >= c.view_time
    AND sc.completion_time <= c.view_time + INTERVAL 30 MINUTE

-- Alternative: Daily aggregation for trend analysis
-- SELECT
--     toDate(timestamp) as date,
--     count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) as chapter_viewers,
--     count(DISTINCT CASE
--         WHEN event = 'CHAPTER_SCROLL_DEPTH'
--         AND properties.maxScrollDepthPercent >= 90
--         THEN distinct_id
--     END) as reading_completers,
--     round(
--         count(DISTINCT CASE
--             WHEN event = 'CHAPTER_SCROLL_DEPTH'
--             AND properties.maxScrollDepthPercent >= 90
--             THEN distinct_id
--         END) * 100.0 /
--         nullif(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
--         1
--     ) as completion_rate_pct
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 7 DAY
--     AND event IN ('CHAPTER_VIEWED', 'CHAPTER_SCROLL_DEPTH')
-- GROUP BY toDate(timestamp)
-- ORDER BY date DESC
