-- Insight: Number - Tooltip Open Rate
-- Dashboard: AI Feature Performance
-- Visualization: Number card with trend
-- Time window: Last 7 days
-- Description: Percentage of chapter views that result in a tooltip being opened.
--              Formula: VERSEMATE_TOOLTIP_OPENED count / CHAPTER_VIEWED count
--              Higher rates indicate AI explanations are discoverable and valuable.
--              Target: >30% indicates strong AI engagement.

SELECT
    countIf(event = 'VERSEMATE_TOOLTIP_OPENED') AS tooltips_opened,
    countIf(event = 'CHAPTER_VIEWED') AS chapters_viewed,
    round(
        countIf(event = 'VERSEMATE_TOOLTIP_OPENED') * 100.0
        / nullIf(countIf(event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS tooltip_open_rate_pct
FROM events
WHERE
    event IN ('VERSEMATE_TOOLTIP_OPENED', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Daily tooltip open rate trend
SELECT
    toDate(timestamp) AS day,
    countIf(event = 'VERSEMATE_TOOLTIP_OPENED') AS tooltips,
    countIf(event = 'CHAPTER_VIEWED') AS chapters,
    round(
        countIf(event = 'VERSEMATE_TOOLTIP_OPENED') * 100.0
        / nullIf(countIf(event = 'CHAPTER_VIEWED'), 0),
        1
    ) AS tooltip_open_rate_pct
FROM events
WHERE
    event IN ('VERSEMATE_TOOLTIP_OPENED', 'CHAPTER_VIEWED')
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;

-- Per-user tooltip engagement
SELECT
    round(avg(tooltip_count), 1) AS avg_tooltips_per_user,
    quantile(0.5)(tooltip_count) AS median_tooltips_per_user,
    max(tooltip_count) AS max_tooltips_per_user
FROM (
    SELECT
        distinct_id,
        count(*) AS tooltip_count
    FROM events
    WHERE
        event = 'VERSEMATE_TOOLTIP_OPENED'
        AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY distinct_id
);
