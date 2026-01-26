-- Insight: Table - Login Frequency Analysis
-- Dashboard: Technical Health
-- Visualization: Table with distribution
-- Time window: Last 7 days
-- Description: Analyzes login patterns using LOGIN_COMPLETED events and last_login_at property.
--              Multiple logins per day may indicate session issues or auth problems.
--              Normal: 1 login per day. Flagged: >2 logins per day.

-- Login frequency distribution
SELECT
    CASE
        WHEN daily_logins = 1 THEN '1 login/day'
        WHEN daily_logins = 2 THEN '2 logins/day'
        WHEN daily_logins <= 5 THEN '3-5 logins/day'
        ELSE '5+ logins/day (flag)'
    END AS login_frequency,
    count(*) AS user_day_count,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM (
                SELECT distinct_id, toDate(timestamp) AS day, count(*) AS cnt
                FROM events
                WHERE event = 'LOGIN_COMPLETED'
                  AND timestamp >= now() - INTERVAL 7 DAY
                GROUP BY distinct_id, day
            )
        ), 0),
        1
    ) AS percentage
FROM (
    SELECT
        distinct_id,
        toDate(timestamp) AS day,
        count(*) AS daily_logins
    FROM events
    WHERE
        event = 'LOGIN_COMPLETED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id, day
)
GROUP BY login_frequency
ORDER BY
    CASE login_frequency
        WHEN '1 login/day' THEN 1
        WHEN '2 logins/day' THEN 2
        WHEN '3-5 logins/day' THEN 3
        WHEN '5+ logins/day (flag)' THEN 4
    END;

-- Overall login statistics
SELECT
    count(*) AS total_logins,
    count(DISTINCT distinct_id) AS unique_users,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 2) AS avg_logins_per_user,
    count(DISTINCT toDate(timestamp)) AS active_days
FROM events
WHERE
    event = 'LOGIN_COMPLETED'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Users with excessive logins (potential issue indicator)
SELECT
    count(DISTINCT distinct_id) AS users_with_excessive_logins,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE event = 'LOGIN_COMPLETED'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM (
    SELECT distinct_id
    FROM events
    WHERE
        event = 'LOGIN_COMPLETED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
    HAVING count(*) > 7  -- More than 1 login per day on average
);

-- Daily login volume trend
SELECT
    toDate(timestamp) AS day,
    count(*) AS logins,
    count(DISTINCT distinct_id) AS unique_users,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 2) AS logins_per_user
FROM events
WHERE
    event = 'LOGIN_COMPLETED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
