-- Insight: Number - Auto-Highlight Tooltip View Rate
-- Dashboard: AI Feature Performance
-- Visualization: Number card with trend
-- Time window: Last 7 days
-- Description: Measures engagement with auto-highlight tooltips.
--              Formula: AUTO_HIGHLIGHT_TOOLTIP_VIEWED / chapter views with auto-highlights
--              Since we can't track chapters with auto-highlights directly,
--              we use total chapter views as a proxy denominator.

SELECT
    count(*) AS auto_highlight_tooltip_views,
    (SELECT count(*) FROM events WHERE event = 'CHAPTER_VIEWED' AND timestamp >= now() - INTERVAL 7 DAY) AS total_chapter_views,
    round(
        count(*) * 100.0 / nullIf((
            SELECT count(*)
            FROM events
            WHERE event = 'CHAPTER_VIEWED'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS view_rate_pct
FROM events
WHERE
    event = 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Daily auto-highlight tooltip view trend
SELECT
    toDate(timestamp) AS day,
    countIf(event = 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED') AS auto_highlight_views,
    countIf(event = 'CHAPTER_VIEWED') AS chapter_views,
    round(
        countIf(event = 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED') * 100.0
        / nullIf(countIf(event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS view_rate_pct
FROM events
WHERE
    event IN ('AUTO_HIGHLIGHT_TOOLTIP_VIEWED', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;

-- Per-user auto-highlight engagement
SELECT
    count(DISTINCT distinct_id) AS users_viewing_auto_highlights,
    round(
        count(DISTINCT distinct_id) * 100.0 / nullIf((
            SELECT count(DISTINCT distinct_id)
            FROM events
            WHERE event = 'CHAPTER_VIEWED'
              AND timestamp >= now() - INTERVAL 7 DAY
        ), 0),
        1
    ) AS user_engagement_rate_pct
FROM events
WHERE
    event = 'AUTO_HIGHLIGHT_TOOLTIP_VIEWED'
    AND timestamp >= now() - INTERVAL 7 DAY;
