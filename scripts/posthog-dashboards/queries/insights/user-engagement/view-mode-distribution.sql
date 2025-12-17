-- Insight: Pie Chart - View Mode Distribution
-- Dashboard: User Engagement
-- Visualization: Pie or bar chart showing time split
-- Time window: Last 7 days
-- Description: Distribution of time spent in Bible vs Explanations view mode.
--              Uses VIEW_MODE_DURATION event with viewMode and duration_seconds properties.
--              Helps understand how users balance reading scripture vs AI explanations.

-- Total time by view mode
SELECT
    JSONExtractString(properties, 'viewMode') AS view_mode,
    round(sum(JSONExtractFloat(properties, 'duration_seconds')) / 3600.0, 1) AS total_hours,
    round(sum(JSONExtractFloat(properties, 'duration_seconds')) / 60.0, 0) AS total_minutes,
    count(*) AS session_count,
    round(
        sum(JSONExtractFloat(properties, 'duration_seconds'))
        * 100.0
        / nullIf((
            SELECT sum(JSONExtractFloat(properties, 'duration_seconds'))
            FROM events
            WHERE event = 'VIEW_MODE_DURATION'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'VIEW_MODE_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'viewMode') IN ('bible', 'explanations')
GROUP BY view_mode
ORDER BY total_hours DESC;

-- Daily trend by view mode
SELECT
    toDate(timestamp) AS day,
    JSONExtractString(properties, 'viewMode') AS view_mode,
    round(sum(JSONExtractFloat(properties, 'duration_seconds')) / 60.0, 1) AS total_minutes
FROM events
WHERE
    event = 'VIEW_MODE_DURATION'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'viewMode') IN ('bible', 'explanations')
GROUP BY day, view_mode
ORDER BY day, view_mode;
