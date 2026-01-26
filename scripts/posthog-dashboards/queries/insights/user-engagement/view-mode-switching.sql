-- Insight: Number - View Mode Switching Frequency
-- Dashboard: User Engagement
-- Visualization: Number card with trend
-- Time window: Last 7 days
-- Description: Frequency of VIEW_MODE_SWITCHED events per user session.
--              High switching indicates users actively exploring both Bible text and explanations.
--              Low switching may indicate users prefer one mode exclusively.

-- Overall switching stats
SELECT
    count(*) AS total_switches,
    count(DISTINCT distinct_id) AS users_who_switched,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 1) AS switches_per_user
FROM events
WHERE
    event = 'VIEW_MODE_SWITCHED'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Switching breakdown by target mode
SELECT
    JSONExtractString(properties, 'mode') AS target_mode,
    count(*) AS switch_count,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'VIEW_MODE_SWITCHED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY target_mode
ORDER BY switch_count DESC;

-- Daily switching trend
SELECT
    toDate(timestamp) AS day,
    count(*) AS switches,
    count(DISTINCT distinct_id) AS users_switching,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 1) AS switches_per_user
FROM events
WHERE
    event = 'VIEW_MODE_SWITCHED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
