-- Insight: Trend - DAU/WAU/MAU
-- Dashboard: Executive Overview
-- Visualization: Line chart with 3 series
-- Time window: Last 30 days with weekly comparison
-- Description: Daily, Weekly, and Monthly active users with trend indicators.
--              DAU = unique users per day, WAU = unique users per 7-day window,
--              MAU = unique users per 30-day window. Key health metric for overall engagement.

-- Daily Active Users (DAU) - Last 30 days
SELECT
    toDate(timestamp) AS day,
    count(DISTINCT distinct_id) AS dau
FROM events
WHERE
    timestamp >= now() - INTERVAL 30 DAY
    AND event IN (
        'CHAPTER_VIEWED',
        'BOOKMARK_ADDED',
        'HIGHLIGHT_CREATED',
        'NOTE_CREATED',
        'VERSEMATE_TOOLTIP_OPENED'
    )
GROUP BY day
ORDER BY day;

-- Weekly Active Users (WAU) - Rolling 7-day window
-- For PostHog, use this as a separate insight or combine using UNION
SELECT
    toDate(timestamp) AS week_ending,
    count(DISTINCT distinct_id) AS wau
FROM events
WHERE
    timestamp >= now() - INTERVAL 30 DAY
    AND event IN (
        'CHAPTER_VIEWED',
        'BOOKMARK_ADDED',
        'HIGHLIGHT_CREATED',
        'NOTE_CREATED',
        'VERSEMATE_TOOLTIP_OPENED'
    )
GROUP BY toStartOfWeek(timestamp) AS week_ending
ORDER BY week_ending;

-- Monthly Active Users (MAU) - Current month vs previous
SELECT
    toStartOfMonth(timestamp) AS month,
    count(DISTINCT distinct_id) AS mau
FROM events
WHERE
    timestamp >= now() - INTERVAL 60 DAY
    AND event IN (
        'CHAPTER_VIEWED',
        'BOOKMARK_ADDED',
        'HIGHLIGHT_CREATED',
        'NOTE_CREATED',
        'VERSEMATE_TOOLTIP_OPENED'
    )
GROUP BY month
ORDER BY month;
