-- Insight: Line Chart - AI Adoption Trend
-- Dashboard: AI Feature Performance
-- Visualization: Line chart showing weekly tooltip open rate
-- Time window: Last 30 days
-- Description: Weekly trend line showing AI feature adoption over time.
--              Measures tooltip open rate (tooltips opened / chapters viewed) per week.
--              Useful for tracking adoption of AI features and impact of feature changes.

-- Weekly tooltip open rate
SELECT
    toStartOfWeek(timestamp) AS week,
    countIf(event = 'VERSEMATE_TOOLTIP_OPENED') AS tooltips_opened,
    countIf(event = 'CHAPTER_VIEWED') AS chapters_viewed,
    round(
        countIf(event = 'VERSEMATE_TOOLTIP_OPENED') * 100.0
        / nullIf(countIf(event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS tooltip_open_rate_pct,
    count(DISTINCT CASE WHEN event = 'VERSEMATE_TOOLTIP_OPENED' THEN distinct_id END) AS users_opening_tooltips,
    count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) AS active_users
FROM events
WHERE
    event IN ('VERSEMATE_TOOLTIP_OPENED', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY week
ORDER BY week;

-- Weekly AI feature adoption rate (users using any AI feature / active users)
SELECT
    toStartOfWeek(timestamp) AS week,
    count(DISTINCT CASE
        WHEN event IN ('VERSEMATE_TOOLTIP_OPENED', 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED', 'DICTIONARY_LOOKUP', 'EXPLANATION_TAB_CHANGED')
        THEN distinct_id
    END) AS ai_feature_users,
    count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END) AS active_users,
    round(
        count(DISTINCT CASE
            WHEN event IN ('VERSEMATE_TOOLTIP_OPENED', 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED', 'DICTIONARY_LOOKUP', 'EXPLANATION_TAB_CHANGED')
            THEN distinct_id
        END) * 100.0
        / nullIf(count(DISTINCT CASE WHEN event = 'CHAPTER_VIEWED' THEN distinct_id END), 0),
        1
    ) AS ai_adoption_rate_pct
FROM events
WHERE
    event IN (
        'VERSEMATE_TOOLTIP_OPENED',
        'AUTO_HIGHLIGHT_TOOLTIP_VIEWED',
        'DICTIONARY_LOOKUP',
        'EXPLANATION_TAB_CHANGED',
        'CHAPTER_VIEWED'
    )
    AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY week
ORDER BY week;

-- Compare new vs existing users AI adoption
SELECT
    toStartOfWeek(e.timestamp) AS week,
    'New Users' AS user_segment,
    round(
        countIf(e.event = 'VERSEMATE_TOOLTIP_OPENED') * 100.0
        / nullIf(countIf(e.event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS tooltip_open_rate_pct
FROM events e
INNER JOIN (
    SELECT distinct_id, min(toDate(timestamp)) AS first_seen
    FROM events
    GROUP BY distinct_id
) AS user_first_seen ON e.distinct_id = user_first_seen.distinct_id
WHERE
    e.event IN ('VERSEMATE_TOOLTIP_OPENED', 'CHAPTER_VIEWED')
    AND e.timestamp >= now() - INTERVAL 30 DAY
    AND user_first_seen.first_seen >= toStartOfWeek(e.timestamp)
GROUP BY week

UNION ALL

SELECT
    toStartOfWeek(e.timestamp) AS week,
    'Existing Users' AS user_segment,
    round(
        countIf(e.event = 'VERSEMATE_TOOLTIP_OPENED') * 100.0
        / nullIf(countIf(e.event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS tooltip_open_rate_pct
FROM events e
INNER JOIN (
    SELECT distinct_id, min(toDate(timestamp)) AS first_seen
    FROM events
    GROUP BY distinct_id
) AS user_first_seen ON e.distinct_id = user_first_seen.distinct_id
WHERE
    e.event IN ('VERSEMATE_TOOLTIP_OPENED', 'CHAPTER_VIEWED')
    AND e.timestamp >= now() - INTERVAL 30 DAY
    AND user_first_seen.first_seen < toStartOfWeek(e.timestamp)
GROUP BY week
ORDER BY week, user_segment;
