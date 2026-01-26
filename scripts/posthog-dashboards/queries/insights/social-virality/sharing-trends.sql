-- Insight: Line Chart - Sharing Trends
-- Dashboard: Social & Virality
-- Visualization: Line chart showing weekly/monthly share volume
-- Time window: Last 30 days
-- Description: Tracks sharing activity over time to identify trends.
--              Shows weekly share volume and sharer count.
--              Useful for measuring impact of sharing feature improvements.

-- Weekly share volume trend
SELECT
    toStartOfWeek(timestamp) AS week,
    count(*) AS total_shares,
    countIf(event = 'CHAPTER_SHARED') AS chapter_shares,
    countIf(event = 'TOPIC_SHARED') AS topic_shares,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY week
ORDER BY week;

-- Daily share trend
SELECT
    toDate(timestamp) AS day,
    count(*) AS total_shares,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day;

-- Day of week patterns (which days see most sharing)
SELECT
    toDayOfWeek(timestamp) AS day_of_week,
    CASE toDayOfWeek(timestamp)
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        WHEN 7 THEN 'Sunday'
    END AS day_name,
    count(*) AS shares,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
              AND timestamp >= now() - INTERVAL 30 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day_of_week
ORDER BY day_of_week;

-- Hour of day patterns (when users share most)
SELECT
    toHour(timestamp) AS hour_of_day,
    count(*) AS shares,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
              AND timestamp >= now() - INTERVAL 30 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY hour_of_day
ORDER BY hour_of_day;
