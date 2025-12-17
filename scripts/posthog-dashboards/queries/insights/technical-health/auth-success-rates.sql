-- Insight: Bar Chart - Auth Success Rates by Method
-- Dashboard: Technical Health
-- Visualization: Bar chart with 3 bars (email, google, apple)
-- Time window: Last 7 days
-- Description: Authentication success rates broken down by method.
--              Uses LOGIN_COMPLETED and SIGNUP_COMPLETED events with method property.
--              Methods: email, google, apple. Monitors auth provider health.

-- Login completions by method
SELECT
    'Login' AS auth_type,
    JSONExtractString(properties, 'method') AS auth_method,
    count(*) AS event_count,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'LOGIN_COMPLETED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'method') IN ('email', 'google', 'apple')
GROUP BY auth_method

UNION ALL

-- Signup completions by method
SELECT
    'Signup' AS auth_type,
    JSONExtractString(properties, 'method') AS auth_method,
    count(*) AS event_count,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'SIGNUP_COMPLETED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'method') IN ('email', 'google', 'apple')
GROUP BY auth_method
ORDER BY auth_type, event_count DESC;

-- Auth method distribution (all auth events combined)
SELECT
    JSONExtractString(properties, 'method') AS auth_method,
    countIf(event = 'LOGIN_COMPLETED') AS logins,
    countIf(event = 'SIGNUP_COMPLETED') AS signups,
    count(*) AS total_auth_events,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event IN ('LOGIN_COMPLETED', 'SIGNUP_COMPLETED')
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event IN ('LOGIN_COMPLETED', 'SIGNUP_COMPLETED')
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'method') IN ('email', 'google', 'apple')
GROUP BY auth_method
ORDER BY total_auth_events DESC;

-- Daily auth volume trend
SELECT
    toDate(timestamp) AS day,
    countIf(event = 'LOGIN_COMPLETED') AS logins,
    countIf(event = 'SIGNUP_COMPLETED') AS signups,
    count(*) AS total_auth
FROM events
WHERE
    event IN ('LOGIN_COMPLETED', 'SIGNUP_COMPLETED')
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
