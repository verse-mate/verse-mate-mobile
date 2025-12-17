-- Insight: Histogram - Session Duration Distribution
-- Dashboard: Technical Health
-- Visualization: Bar chart with duration buckets
-- Time window: Last 7 days
-- Description: Distribution of session lengths to identify abnormal patterns.
--              Sessions >1 hour may indicate app left open (potential bugs).
--              Uses PostHog's built-in session tracking ($session_duration).

-- Session duration distribution using PostHog's session duration
SELECT
    CASE
        WHEN properties.$session_duration < 60 THEN '< 1 min'
        WHEN properties.$session_duration < 300 THEN '1-5 min'
        WHEN properties.$session_duration < 900 THEN '5-15 min'
        WHEN properties.$session_duration < 1800 THEN '15-30 min'
        WHEN properties.$session_duration < 3600 THEN '30-60 min'
        ELSE '> 1 hour (flag)'
    END AS duration_bucket,
    count(DISTINCT properties.$session_id) AS session_count,
    round(
        count(DISTINCT properties.$session_id) * 100.0 / nullIf((
            SELECT count(DISTINCT properties.$session_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
              AND properties.$session_duration IS NOT NULL
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$session_duration IS NOT NULL
GROUP BY duration_bucket
ORDER BY
    CASE duration_bucket
        WHEN '< 1 min' THEN 1
        WHEN '1-5 min' THEN 2
        WHEN '5-15 min' THEN 3
        WHEN '15-30 min' THEN 4
        WHEN '30-60 min' THEN 5
        WHEN '> 1 hour (flag)' THEN 6
    END;

-- Session duration statistics
SELECT
    round(avg(properties.$session_duration) / 60.0, 1) AS avg_session_minutes,
    round(quantile(0.5)(properties.$session_duration) / 60.0, 1) AS median_session_minutes,
    round(quantile(0.9)(properties.$session_duration) / 60.0, 1) AS p90_session_minutes,
    round(max(properties.$session_duration) / 60.0, 1) AS max_session_minutes,
    count(DISTINCT properties.$session_id) AS total_sessions
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$session_duration IS NOT NULL
    AND properties.$session_duration > 0;

-- Sessions > 1 hour (potential issues)
SELECT
    count(DISTINCT properties.$session_id) AS long_sessions,
    round(
        count(DISTINCT properties.$session_id) * 100.0 / nullIf((
            SELECT count(DISTINCT properties.$session_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
              AND properties.$session_duration IS NOT NULL
        ), 0),
        2
    ) AS percentage_long_sessions
FROM events
WHERE
    timestamp >= now() - INTERVAL 7 DAY
    AND properties.$session_duration > 3600;
