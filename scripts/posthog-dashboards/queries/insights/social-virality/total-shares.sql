-- Insight: Number - Total Shares
-- Dashboard: Social & Virality
-- Visualization: Number card with trend
-- Time window: Last 30 days
-- Description: Total shares combining CHAPTER_SHARED and TOPIC_SHARED events.
--              Key metric for measuring organic growth potential and virality.
--              Also shows breakdown of chapter vs topic shares.

-- Total shares (combined)
SELECT
    count(*) AS total_shares,
    countIf(event = 'CHAPTER_SHARED') AS chapter_shares,
    countIf(event = 'TOPIC_SHARED') AS topic_shares,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY;

-- Share type distribution
SELECT
    event AS share_type,
    count(*) AS share_count,
    count(DISTINCT distinct_id) AS unique_sharers,
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
GROUP BY share_type
ORDER BY share_count DESC;

-- Daily share trend
SELECT
    toDate(timestamp) AS day,
    countIf(event = 'CHAPTER_SHARED') AS chapter_shares,
    countIf(event = 'TOPIC_SHARED') AS topic_shares,
    count(*) AS total_shares,
    count(DISTINCT distinct_id) AS unique_sharers
FROM events
WHERE
    event IN ('CHAPTER_SHARED', 'TOPIC_SHARED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day;
