-- Insight: Bar Chart - Feature Usage Rates
-- Dashboard: User Engagement
-- Visualization: Bar chart with 3 bars (bookmark, highlight, note rates)
-- Time window: Last 7 days
-- Description: Percentage of active users who used each study feature at least once.
--              Bookmark rate: % with BOOKMARK_ADDED
--              Highlight rate: % with HIGHLIGHT_CREATED
--              Note rate: % with NOTE_CREATED
--              Higher rates indicate better feature discovery and value.

WITH active_users AS (
    SELECT count(DISTINCT distinct_id) AS total_active
    FROM events
    WHERE
        timestamp >= now() - INTERVAL 7 DAY
        AND event IN ('CHAPTER_VIEWED', 'BOOKMARK_ADDED', 'HIGHLIGHT_CREATED', 'NOTE_CREATED')
)
SELECT
    'Bookmarks' AS feature,
    count(DISTINCT distinct_id) AS users_using_feature,
    (SELECT total_active FROM active_users) AS total_active_users,
    round(
        count(DISTINCT distinct_id) * 100.0
        / nullIf((SELECT total_active FROM active_users), 0),
        1
    ) AS usage_rate_pct
FROM events
WHERE
    event = 'BOOKMARK_ADDED'
    AND timestamp >= now() - INTERVAL 7 DAY

UNION ALL

SELECT
    'Highlights' AS feature,
    count(DISTINCT distinct_id) AS users_using_feature,
    (SELECT total_active FROM active_users) AS total_active_users,
    round(
        count(DISTINCT distinct_id) * 100.0
        / nullIf((SELECT total_active FROM active_users), 0),
        1
    ) AS usage_rate_pct
FROM events
WHERE
    event = 'HIGHLIGHT_CREATED'
    AND timestamp >= now() - INTERVAL 7 DAY

UNION ALL

SELECT
    'Notes' AS feature,
    count(DISTINCT distinct_id) AS users_using_feature,
    (SELECT total_active FROM active_users) AS total_active_users,
    round(
        count(DISTINCT distinct_id) * 100.0
        / nullIf((SELECT total_active FROM active_users), 0),
        1
    ) AS usage_rate_pct
FROM events
WHERE
    event = 'NOTE_CREATED'
    AND timestamp >= now() - INTERVAL 7 DAY
ORDER BY usage_rate_pct DESC;
