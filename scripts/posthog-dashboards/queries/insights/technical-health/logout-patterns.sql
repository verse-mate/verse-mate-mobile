-- Insight: Table - Logout Patterns
-- Dashboard: Technical Health
-- Visualization: Table or time series
-- Time window: Last 7 days
-- Description: Analyzes LOGOUT event patterns to identify forced vs intentional logouts.
--              High logout frequency may indicate auth issues or session problems.
--              Tracks timing patterns (time of day, day of week) and frequency.

-- Overall logout statistics
SELECT
    count(*) AS total_logouts,
    count(DISTINCT distinct_id) AS users_who_logged_out,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 2) AS logouts_per_user,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS logout_user_rate_pct
FROM events
WHERE
    event = 'LOGOUT'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Logout timing by hour (to identify patterns)
SELECT
    toHour(timestamp) AS hour_of_day,
    count(*) AS logout_count,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'LOGOUT'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'LOGOUT'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY hour_of_day
ORDER BY hour_of_day;

-- Daily logout trend
SELECT
    toDate(timestamp) AS day,
    count(*) AS logouts,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'LOGOUT'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;

-- Users with multiple logouts (potential forced logout indicator)
SELECT
    count(DISTINCT distinct_id) AS users_multiple_logouts,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE event = 'LOGOUT'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM (
    SELECT distinct_id, count(*) AS logout_count
    FROM events
    WHERE
        event = 'LOGOUT'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
    HAVING logout_count > 1
);
