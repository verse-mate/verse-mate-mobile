-- Insight: Table - Cohort Retention Matrix
-- Dashboard: Retention & Growth
-- Visualization: Retention matrix table (heatmap)
-- Time window: Last 8 weeks
-- Description: Weekly cohort retention matrix showing retention decay over 8 weeks.
--              Each row = signup week cohort, columns = Week 0 through Week 8.
--              Enables comparison of retention across different signup cohorts.

WITH weekly_cohorts AS (
    SELECT
        distinct_id,
        toStartOfWeek(min(toDate(timestamp))) AS cohort_week
    FROM events
    WHERE timestamp >= now() - INTERVAL 8 WEEK
    GROUP BY distinct_id
),
weekly_activity AS (
    SELECT
        distinct_id,
        toStartOfWeek(toDate(timestamp)) AS activity_week
    FROM events
    WHERE timestamp >= now() - INTERVAL 16 WEEK
    GROUP BY distinct_id, activity_week
)
SELECT
    toString(wc.cohort_week) AS cohort_week,
    count(DISTINCT wc.distinct_id) AS cohort_size,
    -- Week 0 (signup week) - always 100%
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_0,
    -- Week 1
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 1 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_1,
    -- Week 2
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 2 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_2,
    -- Week 3
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 3 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_3,
    -- Week 4
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 4 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_4,
    -- Week 5
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 5 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_5,
    -- Week 6
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 6 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_6,
    -- Week 7
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 7 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_7,
    -- Week 8
    round(
        count(DISTINCT CASE
            WHEN wa.activity_week = wc.cohort_week + INTERVAL 8 WEEK
            THEN wc.distinct_id
        END) * 100.0 / nullIf(count(DISTINCT wc.distinct_id), 0),
        1
    ) AS week_8
FROM weekly_cohorts wc
LEFT JOIN weekly_activity wa ON wc.distinct_id = wa.distinct_id
GROUP BY wc.cohort_week
ORDER BY wc.cohort_week DESC;
