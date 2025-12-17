-- Insight: Number - Retention Headlines
-- Dashboard: Executive Overview
-- Visualization: 3 number cards (D1, D7, D30)
-- Time window: Last 30 days of cohorts
-- Description: Headline retention rates showing D1 (next-day), D7 (weekly), and D30 (monthly)
--              retention. These are the most critical indicators of product-market fit.
--              D1 > 40% = good, D7 > 20% = healthy, D30 > 10% = sustainable.

-- D1 Retention (users who returned the day after first activity)
SELECT
    round(
        countDistinctIf(
            e2.distinct_id,
            toDate(e2.timestamp) = toDate(first_seen.first_day) + INTERVAL 1 DAY
        ) * 100.0 / count(DISTINCT first_seen.distinct_id),
        1
    ) AS d1_retention_pct
FROM (
    SELECT
        distinct_id,
        min(toDate(timestamp)) AS first_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 31 DAY
      AND timestamp < now() - INTERVAL 1 DAY
    GROUP BY distinct_id
) AS first_seen
LEFT JOIN events AS e2
    ON e2.distinct_id = first_seen.distinct_id
    AND toDate(e2.timestamp) = first_seen.first_day + INTERVAL 1 DAY;

-- D7 Retention (users who returned within 7 days of first activity)
SELECT
    round(
        countDistinctIf(
            e2.distinct_id,
            toDate(e2.timestamp) >= toDate(first_seen.first_day) + INTERVAL 1 DAY
            AND toDate(e2.timestamp) <= toDate(first_seen.first_day) + INTERVAL 7 DAY
        ) * 100.0 / count(DISTINCT first_seen.distinct_id),
        1
    ) AS d7_retention_pct
FROM (
    SELECT
        distinct_id,
        min(toDate(timestamp)) AS first_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 37 DAY
      AND timestamp < now() - INTERVAL 7 DAY
    GROUP BY distinct_id
) AS first_seen
LEFT JOIN events AS e2
    ON e2.distinct_id = first_seen.distinct_id
    AND toDate(e2.timestamp) >= first_seen.first_day + INTERVAL 1 DAY
    AND toDate(e2.timestamp) <= first_seen.first_day + INTERVAL 7 DAY;

-- D30 Retention (users who returned within 30 days of first activity)
SELECT
    round(
        countDistinctIf(
            e2.distinct_id,
            toDate(e2.timestamp) >= toDate(first_seen.first_day) + INTERVAL 1 DAY
            AND toDate(e2.timestamp) <= toDate(first_seen.first_day) + INTERVAL 30 DAY
        ) * 100.0 / count(DISTINCT first_seen.distinct_id),
        1
    ) AS d30_retention_pct
FROM (
    SELECT
        distinct_id,
        min(toDate(timestamp)) AS first_day
    FROM events
    WHERE timestamp >= now() - INTERVAL 60 DAY
      AND timestamp < now() - INTERVAL 30 DAY
    GROUP BY distinct_id
) AS first_seen
LEFT JOIN events AS e2
    ON e2.distinct_id = first_seen.distinct_id
    AND toDate(e2.timestamp) >= first_seen.first_day + INTERVAL 1 DAY
    AND toDate(e2.timestamp) <= first_seen.first_day + INTERVAL 30 DAY;
