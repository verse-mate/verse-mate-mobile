-- Insight: Number - Resurrection Rate
-- Dashboard: Retention & Growth
-- Visualization: Number card with trend
-- Time window: Last 30 days
-- Description: Percentage of dormant users (14+ days inactive) who returned.
--              Measures effectiveness of re-engagement efforts and organic return.
--              Formula: Users who returned after 14+ day gap / Total dormant users

WITH dormant_users AS (
    -- Users whose last activity was 14-30 days ago (were dormant)
    SELECT
        distinct_id,
        max(toDate(timestamp)) AS last_activity_before_dormancy
    FROM events
    WHERE timestamp >= now() - INTERVAL 60 DAY
      AND timestamp < now() - INTERVAL 14 DAY
    GROUP BY distinct_id
    HAVING max(toDate(timestamp)) < today() - INTERVAL 14 DAY
),
resurrected AS (
    -- Dormant users who had activity in the last 14 days
    SELECT DISTINCT du.distinct_id
    FROM dormant_users du
    INNER JOIN events e
        ON e.distinct_id = du.distinct_id
        AND toDate(e.timestamp) > du.last_activity_before_dormancy + INTERVAL 14 DAY
        AND e.timestamp >= now() - INTERVAL 14 DAY
)
SELECT
    count(DISTINCT du.distinct_id) AS total_dormant_users,
    count(DISTINCT r.distinct_id) AS resurrected_users,
    round(
        count(DISTINCT r.distinct_id) * 100.0
        / nullIf(count(DISTINCT du.distinct_id), 0),
        1
    ) AS resurrection_rate_pct
FROM dormant_users du
LEFT JOIN resurrected r ON du.distinct_id = r.distinct_id;

-- Weekly resurrection trend
WITH weekly_dormant AS (
    SELECT
        toStartOfWeek(today() - INTERVAL n DAY) AS check_week,
        distinct_id,
        max(toDate(timestamp)) AS last_activity
    FROM events
    CROSS JOIN (SELECT number AS n FROM system.numbers LIMIT 28)
    WHERE timestamp < toStartOfWeek(today() - INTERVAL n DAY) - INTERVAL 14 DAY
      AND timestamp >= toStartOfWeek(today() - INTERVAL n DAY) - INTERVAL 60 DAY
    GROUP BY check_week, distinct_id
),
weekly_resurrected AS (
    SELECT
        wd.check_week,
        count(DISTINCT CASE
            WHEN e.timestamp >= toStartOfWeek(wd.check_week)
                AND e.timestamp < toStartOfWeek(wd.check_week) + INTERVAL 1 WEEK
            THEN wd.distinct_id
        END) AS resurrected
    FROM weekly_dormant wd
    LEFT JOIN events e ON e.distinct_id = wd.distinct_id
    GROUP BY wd.check_week
)
SELECT
    check_week,
    count(DISTINCT wd.distinct_id) AS dormant,
    wr.resurrected,
    round(wr.resurrected * 100.0 / nullIf(count(DISTINCT wd.distinct_id), 0), 1) AS resurrection_rate_pct
FROM weekly_dormant wd
LEFT JOIN weekly_resurrected wr ON wd.check_week = wr.check_week
GROUP BY wd.check_week, wr.resurrected
ORDER BY check_week;
