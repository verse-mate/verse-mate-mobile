-- Insight: Line Chart - Activation Rate Trend
-- Dashboard: Retention & Growth
-- Visualization: Line chart with 7-day rolling average
-- Time window: Last 30 days
-- Description: 7-day rolling average of new user activation rate.
--              Activation = signup followed by chapter view within 24 hours.
--              Helps identify trends in onboarding effectiveness over time.

WITH daily_signups AS (
    SELECT
        toDate(timestamp) AS signup_day,
        distinct_id,
        min(timestamp) AS signup_time
    FROM events
    WHERE
        event = 'SIGNUP_COMPLETED'
        AND timestamp >= now() - INTERVAL 37 DAY
    GROUP BY signup_day, distinct_id
),
daily_activation AS (
    SELECT
        ds.signup_day,
        count(DISTINCT ds.distinct_id) AS total_signups,
        count(DISTINCT CASE
            WHEN cv.timestamp IS NOT NULL THEN ds.distinct_id
        END) AS activated_users
    FROM daily_signups ds
    LEFT JOIN (
        SELECT distinct_id, min(timestamp) AS timestamp
        FROM events
        WHERE event = 'CHAPTER_VIEWED'
        GROUP BY distinct_id
    ) cv
        ON cv.distinct_id = ds.distinct_id
        AND cv.timestamp >= ds.signup_time
        AND cv.timestamp <= ds.signup_time + INTERVAL 24 HOUR
    GROUP BY ds.signup_day
)
SELECT
    signup_day AS day,
    total_signups,
    activated_users,
    round(activated_users * 100.0 / nullIf(total_signups, 0), 1) AS daily_activation_rate,
    round(
        avg(activated_users * 100.0 / nullIf(total_signups, 0))
        OVER (ORDER BY signup_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW),
        1
    ) AS rolling_7d_activation_rate
FROM daily_activation
WHERE signup_day <= now() - INTERVAL 1 DAY
ORDER BY signup_day;
