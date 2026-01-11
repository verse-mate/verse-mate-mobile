-- Insight: Line Chart - Retention Curve
-- Dashboard: Retention & Growth
-- Visualization: Line chart with D1, D7, D14, D30, D60, D90 points
-- Time window: Last 90 days
-- Description: Retention curve showing percentage of users who return at key milestones.
--              D1 = next day, D7 = first week, D14 = two weeks, D30 = month,
--              D60 = two months, D90 = quarter. Classic retention analysis.

WITH user_cohort AS (
    SELECT
        distinct_id,
        min(toDate(timestamp)) AS first_seen_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 90 DAY
    GROUP BY distinct_id
),
user_activity AS (
    SELECT
        distinct_id,
        toDate(timestamp) AS activity_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 90 DAY
    GROUP BY distinct_id, activity_day
)
SELECT
    'D1' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day = uc.first_seen_day + INTERVAL 1 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 1 DAY

UNION ALL

SELECT
    'D7' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day BETWEEN uc.first_seen_day + INTERVAL 1 DAY
                                     AND uc.first_seen_day + INTERVAL 7 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 7 DAY

UNION ALL

SELECT
    'D14' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day BETWEEN uc.first_seen_day + INTERVAL 8 DAY
                                     AND uc.first_seen_day + INTERVAL 14 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 14 DAY

UNION ALL

SELECT
    'D30' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day BETWEEN uc.first_seen_day + INTERVAL 15 DAY
                                     AND uc.first_seen_day + INTERVAL 30 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 30 DAY

UNION ALL

SELECT
    'D60' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day BETWEEN uc.first_seen_day + INTERVAL 31 DAY
                                     AND uc.first_seen_day + INTERVAL 60 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 60 DAY

UNION ALL

SELECT
    'D90' AS retention_day,
    round(
        count(DISTINCT CASE
            WHEN ua.activity_day BETWEEN uc.first_seen_day + INTERVAL 61 DAY
                                     AND uc.first_seen_day + INTERVAL 90 DAY
            THEN uc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT uc.distinct_id), 0),
        1
    ) AS retention_rate_pct
FROM user_cohort uc
LEFT JOIN user_activity ua ON uc.distinct_id = ua.distinct_id
WHERE uc.first_seen_day <= now() - INTERVAL 90 DAY

ORDER BY
    CASE retention_day
        WHEN 'D1' THEN 1
        WHEN 'D7' THEN 2
        WHEN 'D14' THEN 3
        WHEN 'D30' THEN 4
        WHEN 'D60' THEN 5
        WHEN 'D90' THEN 6
    END;
