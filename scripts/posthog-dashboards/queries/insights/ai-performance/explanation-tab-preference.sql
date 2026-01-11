-- Insight: Pie Chart - Explanation Tab Preference
-- Dashboard: AI Feature Performance
-- Visualization: Pie chart showing tab distribution
-- Time window: Last 7 days
-- Description: Distribution of which explanation tabs users select.
--              Uses EXPLANATION_TAB_CHANGED event with tab property (summary, byline, detailed).
--              Helps understand content depth preferences and optimize default tabs.

SELECT
    JSONExtractString(properties, 'tab') AS tab_name,
    count(*) AS tab_switches,
    count(DISTINCT distinct_id) AS unique_users,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'EXPLANATION_TAB_CHANGED'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS percentage
FROM events
WHERE
    event = 'EXPLANATION_TAB_CHANGED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'tab') IN ('summary', 'byline', 'detailed')
GROUP BY tab_name
ORDER BY tab_switches DESC;

-- Daily trend by tab
SELECT
    toDate(timestamp) AS day,
    JSONExtractString(properties, 'tab') AS tab_name,
    count(*) AS switches
FROM events
WHERE
    event = 'EXPLANATION_TAB_CHANGED'
    AND timestamp >= now() - INTERVAL 7 DAY
    AND JSONExtractString(properties, 'tab') IN ('summary', 'byline', 'detailed')
GROUP BY day, tab_name
ORDER BY day, tab_name;

-- Per-user tab switching behavior
SELECT
    round(avg(switch_count), 1) AS avg_switches_per_user,
    quantile(0.5)(switch_count) AS median_switches_per_user
FROM (
    SELECT
        distinct_id,
        count(*) AS switch_count
    FROM events
    WHERE
        event = 'EXPLANATION_TAB_CHANGED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
);
