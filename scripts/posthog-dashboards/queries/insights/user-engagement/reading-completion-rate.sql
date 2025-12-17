-- Insight: Number - Reading Completion Rate
-- Dashboard: User Engagement
-- Visualization: Number card (percentage)
-- Time window: Last 7 days
-- Description: Percentage of chapter reading sessions where user scrolled to 90%+ depth.
--              Uses CHAPTER_SCROLL_DEPTH event with maxScrollDepthPercent property.
--              Target: >60% completion rate indicates engaging content.

SELECT
    round(
        countIf(JSONExtractFloat(properties, 'maxScrollDepthPercent') >= 90)
        * 100.0
        / nullIf(count(*), 0),
        1
    ) AS completion_rate_pct,
    countIf(JSONExtractFloat(properties, 'maxScrollDepthPercent') >= 90) AS completed_sessions,
    count(*) AS total_sessions
FROM events
WHERE
    event = 'CHAPTER_SCROLL_DEPTH'
    AND timestamp >= now() - INTERVAL 7 DAY;

-- Daily completion rate trend
SELECT
    toDate(timestamp) AS day,
    round(
        countIf(JSONExtractFloat(properties, 'maxScrollDepthPercent') >= 90)
        * 100.0
        / nullIf(count(*), 0),
        1
    ) AS completion_rate_pct,
    count(*) AS total_sessions
FROM events
WHERE
    event = 'CHAPTER_SCROLL_DEPTH'
    AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
