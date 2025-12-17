-- Insight: Table - Feature Engagement Depth
-- Dashboard: User Engagement
-- Visualization: Table or bar chart
-- Time window: Last 7 days
-- Description: Measures how deeply users engage with features by tracking edits.
--              HIGHLIGHT_EDITED count per user = users refining their highlights
--              NOTE_EDITED count per user = users returning to and updating notes
--              High edit rates indicate users find ongoing value in their annotations.

-- Highlight engagement depth
SELECT
    'Highlight Edits' AS metric,
    count(*) AS total_edits,
    count(DISTINCT distinct_id) AS users_editing,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 1) AS edits_per_user
FROM events
WHERE
    event = 'HIGHLIGHT_EDITED'
    AND timestamp >= now() - INTERVAL 7 DAY

UNION ALL

-- Note engagement depth
SELECT
    'Note Edits' AS metric,
    count(*) AS total_edits,
    count(DISTINCT distinct_id) AS users_editing,
    round(count(*) * 1.0 / nullIf(count(DISTINCT distinct_id), 0), 1) AS edits_per_user
FROM events
WHERE
    event = 'NOTE_EDITED'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Users who both create and edit (power users for each feature)
SELECT
    'Highlight Power Users' AS segment,
    count(DISTINCT creators.distinct_id) AS creators,
    count(DISTINCT editors.distinct_id) AS editors,
    count(DISTINCT CASE WHEN editors.distinct_id IS NOT NULL THEN creators.distinct_id END) AS creators_who_edit,
    round(
        count(DISTINCT CASE WHEN editors.distinct_id IS NOT NULL THEN creators.distinct_id END)
        * 100.0
        / nullIf(count(DISTINCT creators.distinct_id), 0),
        1
    ) AS edit_rate_pct
FROM (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'HIGHLIGHT_CREATED'
      AND timestamp >= now() - INTERVAL 7 DAY
) AS creators
LEFT JOIN (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'HIGHLIGHT_EDITED'
      AND timestamp >= now() - INTERVAL 7 DAY
) AS editors ON creators.distinct_id = editors.distinct_id

UNION ALL

SELECT
    'Note Power Users' AS segment,
    count(DISTINCT creators.distinct_id) AS creators,
    count(DISTINCT editors.distinct_id) AS editors,
    count(DISTINCT CASE WHEN editors.distinct_id IS NOT NULL THEN creators.distinct_id END) AS creators_who_edit,
    round(
        count(DISTINCT CASE WHEN editors.distinct_id IS NOT NULL THEN creators.distinct_id END)
        * 100.0
        / nullIf(count(DISTINCT creators.distinct_id), 0),
        1
    ) AS edit_rate_pct
FROM (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'NOTE_CREATED'
      AND timestamp >= now() - INTERVAL 7 DAY
) AS creators
LEFT JOIN (
    SELECT DISTINCT distinct_id
    FROM events
    WHERE event = 'NOTE_EDITED'
      AND timestamp >= now() - INTERVAL 7 DAY
) AS editors ON creators.distinct_id = editors.distinct_id;
