-- Insight: Table - Auto-Highlight Settings Usage
-- Dashboard: AI Feature Performance
-- Visualization: Table or bar chart
-- Time window: Last 7 days
-- Description: Tracks AUTO_HIGHLIGHT_SETTING_CHANGED events to understand adoption.
--              Shows enable/disable rates by settingId property.
--              High disable rate may indicate UX issues or unwanted feature.

-- Enable/disable breakdown
SELECT
    JSONExtractString(properties, 'settingId') AS setting_id,
    countIf(JSONExtractBool(properties, 'enabled') = true) AS enables,
    countIf(JSONExtractBool(properties, 'enabled') = false) AS disables,
    count(*) AS total_changes,
    round(
        countIf(JSONExtractBool(properties, 'enabled') = true) * 100.0
        / nullIf(count(*), 0),
        1
    ) AS enable_rate_pct,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'AUTO_HIGHLIGHT_SETTING_CHANGED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY setting_id
ORDER BY total_changes DESC;

-- Users who enabled then disabled (potential UX issue indicator)
SELECT
    count(DISTINCT users_who_disabled.distinct_id) AS users_who_toggled_off,
    count(DISTINCT users_who_enabled.distinct_id) AS users_who_enabled,
    round(
        count(DISTINCT users_who_disabled.distinct_id) * 100.0
        / nullIf(count(DISTINCT users_who_enabled.distinct_id), 0),
        1
    ) AS churn_rate_pct
FROM (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE
        event = 'AUTO_HIGHLIGHT_SETTING_CHANGED'
        AND JSONExtractBool(properties, 'enabled') = true
        AND timestamp >= now() - INTERVAL 7 DAY
) AS users_who_enabled
LEFT JOIN (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE
        event = 'AUTO_HIGHLIGHT_SETTING_CHANGED'
        AND JSONExtractBool(properties, 'enabled') = false
        AND timestamp >= now() - INTERVAL 7 DAY
) AS users_who_disabled
    ON users_who_enabled.distinct_id = users_who_disabled.distinct_id;

-- Daily setting changes trend
SELECT
    toDate(timestamp) AS day,
    countIf(JSONExtractBool(properties, 'enabled') = true) AS enables,
    countIf(JSONExtractBool(properties, 'enabled') = false) AS disables,
    count(DISTINCT distinct_id) AS unique_users
FROM events
WHERE
    event = 'AUTO_HIGHLIGHT_SETTING_CHANGED'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
