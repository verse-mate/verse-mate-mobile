-- Insight: Number - Activation Rate
-- Dashboard: Executive Overview
-- Visualization: Number card with trend
-- Time window: Last 7 days
-- Description: Percentage of users who signed up and viewed their first chapter within 24 hours.
--              This measures the effectiveness of onboarding. Target: >50% activation rate.
--              Formula: Users with CHAPTER_VIEWED within 24h of SIGNUP_COMPLETED / Total signups

SELECT
    round(
        countDistinctIf(
            signups.distinct_id,
            chapters.timestamp IS NOT NULL
        ) * 100.0 / count(DISTINCT signups.distinct_id),
        1
    ) AS activation_rate_pct,
    count(DISTINCT signups.distinct_id) AS total_signups,
    countDistinctIf(
        signups.distinct_id,
        chapters.timestamp IS NOT NULL
    ) AS activated_users
FROM (
    SELECT
        distinct_id,
        min(timestamp) AS signup_time
    FROM events
    WHERE
        event = 'SIGNUP_COMPLETED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
) AS signups
LEFT JOIN (
    SELECT
        distinct_id,
        min(timestamp) AS timestamp
    FROM events
    WHERE event = 'CHAPTER_VIEWED'
    GROUP BY distinct_id
) AS chapters
    ON chapters.distinct_id = signups.distinct_id
    AND chapters.timestamp >= signups.signup_time
    AND chapters.timestamp <= signups.signup_time + INTERVAL 24 HOUR;
