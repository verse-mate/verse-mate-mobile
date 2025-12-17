-- Insight: Pie Chart - Lifecycle Distribution
-- Dashboard: Retention & Growth
-- Visualization: Pie chart showing user lifecycle stages
-- Time window: Current snapshot based on activity
-- Description: Distribution of users across lifecycle stages.
--              New: First seen within 7 days
--              Active: Returned in last 7 days (not new)
--              Dormant: Last activity 14-30 days ago
--              Churned: Last activity >30 days ago
--              Resurrected: Was dormant but returned this week

WITH user_activity AS (
    SELECT
        distinct_id,
        min(toDate(timestamp)) AS first_seen,
        max(toDate(timestamp)) AS last_seen
    FROM events
    WHERE timestamp >= now() - INTERVAL 90 DAY
    GROUP BY distinct_id
),
lifecycle_stage AS (
    SELECT
        distinct_id,
        first_seen,
        last_seen,
        CASE
            WHEN first_seen >= today() - INTERVAL 7 DAY THEN 'New'
            WHEN last_seen >= today() - INTERVAL 7 DAY THEN 'Active'
            WHEN last_seen >= today() - INTERVAL 30 DAY THEN 'Dormant'
            ELSE 'Churned'
        END AS stage
    FROM user_activity
)
SELECT
    stage,
    count(*) AS user_count,
    round(
        count(*) * 100.0 / nullIf((SELECT count(*) FROM lifecycle_stage), 0),
        1
    ) AS percentage
FROM lifecycle_stage
GROUP BY stage
ORDER BY
    CASE stage
        WHEN 'New' THEN 1
        WHEN 'Active' THEN 2
        WHEN 'Dormant' THEN 3
        WHEN 'Churned' THEN 4
    END;

-- Resurrected users (were dormant, returned this week)
SELECT
    'Resurrected' AS stage,
    count(DISTINCT recent.distinct_id) AS user_count,
    round(
        count(DISTINCT recent.distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE timestamp >= now() - INTERVAL 90 DAY
        ), 0),
        1
    ) AS percentage
FROM (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE
        timestamp >= now() - INTERVAL 7 DAY
) AS recent
INNER JOIN (
    SELECT distinct_id
    FROM events
    WHERE timestamp >= now() - INTERVAL 90 DAY
    GROUP BY distinct_id
    HAVING
        max(toDate(timestamp)) < today() - INTERVAL 14 DAY
        OR (
            max(toDate(timestamp)) < today() - INTERVAL 7 DAY
            AND max(CASE WHEN toDate(timestamp) >= today() - INTERVAL 7 DAY THEN 1 ELSE 0 END) = 1
        )
) AS previously_dormant ON recent.distinct_id = previously_dormant.distinct_id;
