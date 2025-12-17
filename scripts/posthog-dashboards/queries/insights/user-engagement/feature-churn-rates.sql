-- Insight: Table - Feature Churn Rates
-- Dashboard: User Engagement
-- Visualization: Table with 3 rows (bookmark, highlight, note churn)
-- Time window: Last 7 days
-- Description: Ratio of removed/deleted features to added/created features.
--              Bookmark Churn: BOOKMARK_REMOVED / BOOKMARK_ADDED
--              Highlight Churn: HIGHLIGHT_DELETED / HIGHLIGHT_CREATED
--              Note Churn: NOTE_DELETED / NOTE_CREATED
--              High churn (>50%) may indicate users are experimenting but not finding value.
--              Low churn (<20%) indicates users value their saved content.

SELECT
    'Bookmarks' AS feature,
    countIf(event = 'BOOKMARK_ADDED') AS added,
    countIf(event = 'BOOKMARK_REMOVED') AS removed,
    round(
        countIf(event = 'BOOKMARK_REMOVED') * 100.0
        / nullIf(countIf(event = 'BOOKMARK_ADDED'), 0),
        1
    ) AS churn_rate_pct
FROM events
WHERE
    event IN ('BOOKMARK_ADDED', 'BOOKMARK_REMOVED')
    AND timestamp >= now() - INTERVAL 7 DAY

UNION ALL

SELECT
    'Highlights' AS feature,
    countIf(event = 'HIGHLIGHT_CREATED') AS added,
    countIf(event = 'HIGHLIGHT_DELETED') AS removed,
    round(
        countIf(event = 'HIGHLIGHT_DELETED') * 100.0
        / nullIf(countIf(event = 'HIGHLIGHT_CREATED'), 0),
        1
    ) AS churn_rate_pct
FROM events
WHERE
    event IN ('HIGHLIGHT_CREATED', 'HIGHLIGHT_DELETED')
    AND timestamp >= now() - INTERVAL 7 DAY

UNION ALL

SELECT
    'Notes' AS feature,
    countIf(event = 'NOTE_CREATED') AS added,
    countIf(event = 'NOTE_DELETED') AS removed,
    round(
        countIf(event = 'NOTE_DELETED') * 100.0
        / nullIf(countIf(event = 'NOTE_CREATED'), 0),
        1
    ) AS churn_rate_pct
FROM events
WHERE
    event IN ('NOTE_CREATED', 'NOTE_DELETED')
    AND timestamp >= now() - INTERVAL 7 DAY
ORDER BY churn_rate_pct DESC;
