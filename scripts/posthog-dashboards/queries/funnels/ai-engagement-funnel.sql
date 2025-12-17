-- Query Name: Funnel - AI Engagement
-- Dashboard: Product - AI Feature Performance
-- Type: funnel
-- Description: Tracks user engagement with AI-powered features from chapter view
--   to deep exploration. Measures: chapter viewed -> tooltip opened -> explanation tab changed.
--   Expected conversion: 25% chapter->tooltip, 40% tooltip->tab_change.
--   Low tooltip conversion indicates discoverability issues; low tab change
--   suggests users find initial explanation sufficient or UI is unclear.
-- Time Window: 30min (single reading session)

-- PostHog Funnel Configuration:
-- This funnel should be created using PostHog's Funnel insight type
-- with the following step configuration:

-- Step 1: User views a chapter
-- Event: CHAPTER_VIEWED
-- Time window: Start of funnel

-- Step 2: User opens a VerseMate tooltip (AI explanation)
-- Event: VERSEMATE_TOOLTIP_OPENED
-- Conversion window: 30 minutes from Step 1

-- Step 3: User explores different explanation tabs
-- Event: EXPLANATION_TAB_CHANGED
-- Conversion window: 30 minutes from Step 2

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
        AND timestamp >= now() - INTERVAL 7 DAY
),

tooltip_opens AS (
    -- Users who opened AI tooltips
    SELECT
        distinct_id,
        timestamp as tooltip_time,
        properties.bookId as book_id,
        properties.chapterNumber as chapter_number,
        properties.verseNumber as verse_number
    FROM events
    WHERE event = 'VERSEMATE_TOOLTIP_OPENED'
        AND timestamp >= now() - INTERVAL 7 DAY
),

tab_changes AS (
    -- Users who changed explanation tabs (exploring AI content)
    SELECT
        distinct_id,
        timestamp as tab_change_time,
        properties.tab as tab_selected
    FROM events
    WHERE event = 'EXPLANATION_TAB_CHANGED'
        AND timestamp >= now() - INTERVAL 7 DAY
)

SELECT
    'AI Engagement Funnel' as funnel_name,
    -- Step 1: Chapter viewers
    count(DISTINCT cv.distinct_id) as step_1_chapter_viewed,
    -- Step 2: Tooltip openers (within same chapter session)
    count(DISTINCT t.distinct_id) as step_2_tooltip_opened,
    -- Step 3: Tab explorers
    count(DISTINCT tc.distinct_id) as step_3_tab_changed,
    -- Conversion rates
    round(
        count(DISTINCT t.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as chapter_to_tooltip_pct,
    round(
        count(DISTINCT tc.distinct_id) * 100.0 /
        nullif(count(DISTINCT t.distinct_id), 0),
        1
    ) as tooltip_to_tab_pct,
    -- Overall AI engagement rate
    round(
        count(DISTINCT tc.distinct_id) * 100.0 /
        nullif(count(DISTINCT cv.distinct_id), 0),
        1
    ) as overall_ai_engagement_pct
FROM chapter_views cv
LEFT JOIN tooltip_opens t ON cv.distinct_id = t.distinct_id
    AND t.book_id = cv.book_id
    AND t.chapter_number = cv.chapter_number
    AND t.tooltip_time >= cv.view_time
    AND t.tooltip_time <= cv.view_time + INTERVAL 30 MINUTE
LEFT JOIN tab_changes tc ON t.distinct_id = tc.distinct_id
    AND tc.tab_change_time >= t.tooltip_time
    AND tc.tab_change_time <= t.tooltip_time + INTERVAL 30 MINUTE

-- Daily trend analysis (alternative view)
-- SELECT
--     toDate(timestamp) as date,
--     count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) as chapter_viewers,
--     count(DISTINCT CASE WHEN event = 'VERSEMATE_TOOLTIP_OPENED' THEN distinct_id END) as tooltip_users,
--     count(DISTINCT CASE WHEN event = 'EXPLANATION_TAB_CHANGED' THEN distinct_id END) as tab_explorers,
--     round(
--         count(DISTINCT CASE WHEN event = 'VERSEMATE_TOOLTIP_OPENED' THEN distinct_id END) * 100.0 /
--         nullif(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
--         1
--     ) as tooltip_rate_pct
-- FROM events
-- WHERE timestamp >= now() - INTERVAL 7 DAY
--     AND event IN ('CHAPTER_VIEWED', 'VERSEMATE_TOOLTIP_OPENED', 'EXPLANATION_TAB_CHANGED')
-- GROUP BY toDate(timestamp)
-- ORDER BY date DESC

-- Tab preference breakdown (supplementary analysis)
-- SELECT
--     properties.tab as tab_name,
--     count(*) as switch_count,
--     count(DISTINCT distinct_id) as unique_users
-- FROM events
-- WHERE event = 'EXPLANATION_TAB_CHANGED'
--     AND timestamp >= now() - INTERVAL 7 DAY
-- GROUP BY properties.tab
-- ORDER BY switch_count DESC
