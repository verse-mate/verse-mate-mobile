-- Query Name: Funnel - Sharing
-- Dashboard: Marketing - Social & Virality
-- Type: funnel
-- Description: Tracks the path from content consumption to sharing behavior.
--   Measures: chapter viewed -> scroll depth >= 50% (engaged reading) -> chapter shared.
--   Expected conversion: 50% chapter->engaged, 5% engaged->shared.
--   Sharing typically occurs after meaningful engagement; low engagement suggests
--   content issues, low sharing indicates UX friction or lack of share motivation.
-- Time Window: 30d (sharing discovery period)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User views a chapter
-- Event: CHAPTER_VIEWED
-- Time window: Start of funnel

-- Step 2: User engages meaningfully (50%+ scroll depth)
-- Event: CHAPTER_SCROLL_DEPTH with maxScrollDepthPercent >= 50
-- Conversion window: 30 minutes from Step 1

-- Step 3: User shares the chapter
-- Event: CHAPTER_SHARED
-- Conversion window: 30 days from Step 1

-- HogQL Funnel Analysis Query:

WITH chapter_views AS (
    -- All chapter views in the analysis period
    SELECT
        distinct_id,
        timestamp as view_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number
    FROM events
    WHERE event = 'CHAPTER_VIEWED'
        AND timestamp >= now() - INTERVAL 30 DAY
),

engaged_reading AS (
    -- Users who scrolled at least 50% (meaningful engagement)
    SELECT
        distinct_id,
        timestamp as scroll_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number,
        properties.maxScrollDepthPercent as scroll_depth
    FROM events
    WHERE event = 'CHAPTER_SCROLL_DEPTH'
        AND properties.maxScrollDepthPercent >= 50
        AND timestamp >= now() - INTERVAL 30 DAY
),

chapter_shares AS (
    -- Users who shared chapters
    SELECT
        distinct_id,
        timestamp as share_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number
    FROM events
    WHERE event = 'CHAPTER_SHARED'
        AND timestamp >= now() - INTERVAL 30 DAY
)

SELECT
    'Sharing Funnel' as funnel_name,
    -- Step counts
    count(DISTINCT cv.distinct_id) as step_1_chapter_viewed,
    count(DISTINCT er.distinct_id) as step_2_engaged_reading,
    count(DISTINCT cs.distinct_id) as step_3_chapter_shared,
    -- Step-by-step conversion rates
    round(
        count(DISTINCT er.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as view_to_engaged_pct,
    round(
        count(DISTINCT cs.distinct_id) * 100.0 /
        nullif(count(DISTINCT er.distinct_id), 0),
        1
    ) as engaged_to_share_pct,
    -- Overall sharing rate
    round(
        count(DISTINCT cs.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as overall_share_rate_pct
FROM chapter_views cv
LEFT JOIN engaged_reading er ON cv.distinct_id = er.distinct_id
    AND er.book_id = cv.book_id
    AND er.chapter_number = cv.chapter_number
LEFT JOIN chapter_shares cs ON cv.distinct_id = cs.distinct_id

-- Daily sharing funnel trend
-- SELECT
--     toDate(timestamp) as date,
--     count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) as viewers,
--     count(DISTINCT CASE
--         WHEN event = 'CHAPTER_SCROLL_DEPTH' AND properties.maxScrollDepthPercent >= 50
--         THEN distinct_id
--     END) as engaged_readers,
--     count(DISTINCT CASE WHEN event = 'CHAPTER_SHARED' THEN distinct_id END) as sharers,
--     round(
--         count(DISTINCT CASE WHEN event = 'CHAPTER_SHARED' THEN distinct_id END) * 100.0 /
--         nullif(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
--         2
--     ) as share_rate_pct
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 30 DAY
--     AND event IN ('CHAPTER_VIEWED', 'CHAPTER_SCROLL_DEPTH', 'CHAPTER_SHARED')
-- GROUP BY toDate(timestamp)
-- ORDER BY date DESC

-- Most shared content analysis
-- SELECT
--     properties.bookId as book_id,
--     properties.chapterNumber as chapter_number,
--     count(*) as share_count,
--     count(DISTINCT distinct_id) as unique_sharers
-- FROM events
-- WHERE event = 'CHAPTER_SHARED'
--     AND timestamp >= now() - INTERVAL 30 DAY
-- GROUP BY properties.bookId, properties.chapterNumber
-- ORDER BY share_count DESC
-- LIMIT 20

-- Combined sharing analysis (chapter + topic shares)
-- SELECT
--     'Chapter Shares' as share_type,
--     count(*) as total_shares,
--     count(DISTINCT distinct_id) as unique_sharers
-- FROM events
-- WHERE event = 'CHAPTER_SHARED'
--     AND timestamp >= now() - INTERVAL 30 DAY
--
-- UNION ALL
--
-- SELECT
--     'Topic Shares' as share_type,
--     count(*) as total_shares,
--     count(DISTINCT distinct_id) as unique_sharers
-- FROM events
-- WHERE event = 'TOPIC_SHARED'
--     AND timestamp >= now() - INTERVAL 30 DAY
